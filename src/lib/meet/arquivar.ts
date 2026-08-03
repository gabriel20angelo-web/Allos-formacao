// Leva gravação e transcrição para a pasta certa.
//
// Roda depois da captura, e separado dela de propósito: mover arquivo pode
// falhar por permissão do Google, e essa falha não pode derrubar a captura de
// presença, que é o que realmente importa. Se o Drive recusar, o encontro
// continua registrado e o erro fica escrito ao lado dele.

import { extrairIdDaPasta, moverArquivo, nomeDoArquivo } from "./drive";
import { garantirPastaDoGrupo } from "./pastas";
import { MeetApiError } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ResultadoArquivamento {
  movidos: number;
  sem_pasta: number;
  erros: string[];
}

interface EncontroRow {
  id: string;
  space_name: string;
  atividade_nome: string | null;
  data_reuniao: string;
  gravacao_file_id: string | null;
  transcricao_file_id: string | null;
}

export async function arquivarGravacoes(sb: Sb): Promise<ResultadoArquivamento> {
  const res: ResultadoArquivamento = { movidos: 0, sem_pasta: 0, erros: [] };

  // Só o que tem arquivo e ainda não foi movido. Sem isso, toda batida do cron
  // tentaria mover tudo de novo.
  const { data: encontros } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, space_name, atividade_nome, data_reuniao, gravacao_file_id, transcricao_file_id"
    )
    .is("arquivos_movidos_em", null)
    .eq("descartado", false)
    .or("gravacao_file_id.not.is.null,transcricao_file_id.not.is.null")
    .limit(25);

  if (!encontros?.length) return res;

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("pasta_drive_id")
    .maybeSingle();
  const pastaPadrao = cronograma?.pasta_drive_id
    ? extrairIdDaPasta(cronograma.pasta_drive_id)
    : null;

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, pasta_drive_id");
  const pastaPorSpace = new Map(
    (spaces || []).map((s: { space_name: string; pasta_drive_id: string | null }) => [
      s.space_name,
      s.pasta_drive_id ? extrairIdDaPasta(s.pasta_drive_id) : null,
    ])
  );

  for (const e of encontros as EncontroRow[]) {
    let pasta = pastaPorSpace.get(e.space_name) || null;

    // Sala sem pasta própria ganha a dela agora. Cobre as criadas antes desta
    // funcionalidade e as que falharam ao criar no momento do cadastro.
    if (!pasta && pastaPadrao) {
      try {
        const criada = await garantirPastaDoGrupo(sb, e.space_name);
        if (criada) {
          pasta = criada.id;
          pastaPorSpace.set(e.space_name, criada.id);
        }
      } catch (err) {
        res.erros.push(
          `Pasta de ${e.atividade_nome || e.space_name}: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    if (!pasta) {
      res.sem_pasta++;
      continue;
    }

    const erros: string[] = [];

    if (e.gravacao_file_id) {
      try {
        await moverArquivo(
          e.gravacao_file_id,
          pasta,
          nomeDoArquivo(e.data_reuniao, e.atividade_nome, "gravacao")
        );
        res.movidos++;
      } catch (err) {
        erros.push(err instanceof MeetApiError ? err.message : String(err));
      }
    }

    if (e.transcricao_file_id) {
      try {
        await moverArquivo(
          e.transcricao_file_id,
          pasta,
          nomeDoArquivo(e.data_reuniao, e.atividade_nome, "transcricao")
        );
        res.movidos++;
      } catch (err) {
        erros.push(err instanceof MeetApiError ? err.message : String(err));
      }
    }

    // Só marca como resolvido quando nada falhou: assim a próxima batida tenta
    // de novo o que ficou para trás, sem repetir o que já deu certo (mover para
    // a pasta onde o arquivo já está é uma operação inofensiva).
    if (!erros.length) {
      await sb
        .from("formacao_meet_encontros")
        .update({ arquivos_movidos_em: new Date().toISOString(), arquivos_erro: null })
        .eq("id", e.id);
    } else {
      await sb
        .from("formacao_meet_encontros")
        .update({ arquivos_erro: erros.join(" | ").slice(0, 500) })
        .eq("id", e.id);
      res.erros.push(`${e.data_reuniao} ${e.atividade_nome || ""}: ${erros[0]}`);
    }
  }

  return res;
}
