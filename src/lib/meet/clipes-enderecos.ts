// Mantém vivos os endereços dos clipes.
//
// Os arquivos do OpusClip moram num CDN atrás de assinatura que vale 24 horas.
// O endereço era guardado no banco no dia em que o corte ficou pronto e nunca
// mais era tocado, então no dia seguinte a aba de cortes virava uma parede de
// retângulos pretos: miniatura que não carrega, player que não toca, download
// que não baixa. Nada disso dava erro na tela, porque um <img> que falha
// simplesmente não desenha nada.
//
// A saída não é guardar o arquivo: é pedir o endereço de novo. A API reassina a
// cada consulta, e uma consulta serve todos os clipes daquele projeto de uma
// vez. Com 41 clipes por encontro, isso é uma chamada em vez de quarenta e uma.
//
// Renovar acontece na leitura, e não numa rotina de fundo, porque o que importa
// é que o endereço esteja vivo no instante em que alguém abre a tela. Rotina de
// fundo a cada quinze minutos gastaria chamadas o dia inteiro para manter vivo
// aquilo que ninguém está olhando.

import { listarClipesDoProjeto, validadeDoEndereco } from "./opusclip";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ClipeComEndereco {
  id: string;
  job_id: string;
  external_id: string | null;
  url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
}

/**
 * Margem antes do vencimento.
 *
 * Endereço que vence em vinte minutos ainda funciona agora, mas não sobrevive a
 * uma sessão de curadoria: quem avalia quarenta cortes fica na página mais que
 * isso, e os últimos morreriam na mão da pessoa.
 */
const MARGEM_MS = 2 * 60 * 60 * 1000;

/** Quantos projetos, no máximo, uma única leitura de tela pode renovar. */
const MAX_PROJETOS_POR_LEITURA = 8;

function precisaRenovar(c: ClipeComEndereco): boolean {
  // Sem endereço nenhum não há o que renovar por aqui: o clipe nasceu torto e
  // quem resolve isso é o reprocessamento, não esta função.
  if (!c.thumbnail_url && !c.url && !c.preview_url) return false;

  const prazos = [c.thumbnail_url, c.url, c.preview_url]
    .filter(Boolean)
    .map((u) => validadeDoEndereco(u));

  // Formato não reconhecido conta como precisando: é o caso de endereço antigo,
  // de antes da assinatura, e uma consulta a mais é mais barata que uma tela
  // preta.
  if (prazos.some((p) => p === null)) return true;

  return prazos.some((p) => p!.getTime() - Date.now() < MARGEM_MS);
}

export interface ResultadoRenovacao {
  /** Clipes com o endereço já atualizado, na mesma ordem em que entraram. */
  clipes: ClipeComEndereco[];
  renovados: number;
  projetosConsultados: number;
  /** Projetos que a API recusou, para a tela poder dizer o que houve. */
  falhas: string[];
}

/**
 * Devolve os clipes com endereços que funcionam agora.
 *
 * Escreve no banco o que renovou, para que a próxima leitura não precise
 * perguntar de novo, mas a resposta desta chamada não espera o banco confirmar:
 * quem está olhando a tela precisa da imagem, não da gravação.
 */
export async function renovarEnderecos<T extends ClipeComEndereco>(
  sb: Sb,
  clipes: T[]
): Promise<{ clipes: T[]; renovados: number; falhas: string[] }> {
  const vencidos = clipes.filter(precisaRenovar);
  if (!vencidos.length) return { clipes, renovados: 0, falhas: [] };

  // Um projeto por job: a consulta é por projeto, e pedir uma vez por clipe
  // seria quarenta e uma chamadas para a mesma resposta.
  //
  // O teto existe porque a listagem do painel traz até quarenta jobs de uma vez.
  // Renovar todos numa tela só seria quarenta chamadas em fila, e a requisição
  // estouraria o tempo antes de desenhar qualquer coisa. Os que ficarem de fora
  // renovam no carregamento seguinte, e são sempre os mais antigos: a curadoria
  // acontece nos cortes recentes.
  const jobsEnvolvidos = Array.from(new Set(vencidos.map((c) => c.job_id))).slice(
    0,
    MAX_PROJETOS_POR_LEITURA
  );

  const { data: jobs } = await sb
    .from("formacao_clip_jobs")
    .select("id, external_id")
    .in("id", jobsEnvolvidos);

  const projetoDoJob = new Map(
    ((jobs || []) as { id: string; external_id: string | null }[])
      .filter((j) => j.external_id)
      .map((j) => [j.id, j.external_id!])
  );

  const porExternalId = new Map<string, { url?: string; preview?: string; thumb?: string }>();
  const falhas: string[] = [];

  for (const jobId of jobsEnvolvidos) {
    const projeto = projetoDoJob.get(jobId);
    if (!projeto) continue;

    try {
      const frescos = await listarClipesDoProjeto(projeto);
      for (const f of frescos) {
        if (!f.id) continue;
        porExternalId.set(f.id, {
          url: f.uriForExport,
          preview: f.uriForPreview,
          thumb: f.uriForThumbnail,
        });
      }
    } catch (e) {
      // Uma falha aqui não pode derrubar a tela: o resto dos cortes continua
      // aparecendo, e o endereço velho ainda serve para quem estiver dentro da
      // janela.
      console.error("[clipes-enderecos]", projeto, e);
      falhas.push(projeto);
    }
  }

  let renovados = 0;
  const atualizados = clipes.map((c) => {
    if (!c.external_id) return c;
    const novo = porExternalId.get(c.external_id);
    if (!novo) return c;

    const mudou =
      (novo.thumb && novo.thumb !== c.thumbnail_url) ||
      (novo.url && novo.url !== c.url) ||
      (novo.preview && novo.preview !== c.preview_url);
    if (!mudou) return c;

    renovados++;
    return {
      ...c,
      thumbnail_url: novo.thumb ?? c.thumbnail_url,
      url: novo.url ?? c.url,
      preview_url: novo.preview ?? c.preview_url,
    };
  });

  // Gravação em segundo plano, sem segurar a resposta. Se falhar, a próxima
  // leitura simplesmente renova de novo.
  const paraGravar = atualizados.filter((c, i) => c !== clipes[i]);
  if (paraGravar.length) {
    Promise.all(
      paraGravar.map((c) =>
        sb
          .from("formacao_clips")
          .update({
            thumbnail_url: c.thumbnail_url,
            url: c.url,
            preview_url: c.preview_url,
          })
          .eq("id", c.id)
      )
    ).catch((e) => console.error("[clipes-enderecos] gravar", e));
  }

  return { clipes: atualizados, renovados, falhas };
}
