// Tenta resolver sozinho os nomes parados na fila.
//
// A captura só casa nome com pessoa no momento em que ingere o encontro. Quem
// não casou naquele instante fica esperando alguém clicar, para sempre. Esta
// rotina volta neles a cada rodada, o que importa porque o universo muda: aluno
// novo se cadastra, alguém corrige o próprio nome, e o que era ambíguo ontem
// pode estar resolvido hoje.
//
// Todo casamento feito aqui vira um alias, que é justamente o que a tela de
// "desfazer" usa: automático não quer dizer irreversível.

import { ehContaDaCasa, normalizarNome, sugerirAluno } from "./nomes";
import type { CandidatoAluno } from "./nomes";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ResultadoConciliacao {
  resolvidos: number;
  participacoes_ligadas: number;
  continuam_na_fila: number;
}

export async function conciliarPendentes(sb: Sb): Promise<ResultadoConciliacao> {
  const res: ResultadoConciliacao = {
    resolvidos: 0,
    participacoes_ligadas: 0,
    continuam_na_fila: 0,
  };

  // Encontro descartado não entra: casar o nome de alguém que apareceu num
  // teste de link não liga ninguém a nada, e enche a fila de trabalho inútil.
  const { data: pendentes } = await sb
    .from("formacao_meet_participacoes")
    .select("display_name, display_name_norm, formacao_meet_encontros!inner(descartado)")
    .is("aluno_id", null)
    .eq("eh_condutor", false)
    .eq("formacao_meet_encontros.descartado", false)
    .limit(500);

  if (!pendentes?.length) return res;

  // Um nome, não uma participação: resolver "Ana Paula" resolve todas as vezes
  // em que ela apareceu.
  const nomes = new Map<string, string>();
  for (const p of pendentes as { display_name: string; display_name_norm: string }[]) {
    if (p.display_name_norm.endsWith("[ignorado]")) continue;
    if (!nomes.has(p.display_name_norm)) nomes.set(p.display_name_norm, p.display_name);
  }
  if (!nomes.size) return res;

  const { data: perfis } = await sb.from("profiles").select("id, full_name").limit(5000);
  const candidatos: CandidatoAluno[] = (perfis || []).map(
    (p: { id: string; full_name: string }) => ({
      id: p.id,
      full_name: p.full_name,
      nomeNorm: normalizarNome(p.full_name || ""),
    })
  );

  for (const [norm, display] of Array.from(nomes.entries())) {
    if (ehContaDaCasa(display)) continue;

    const { automatico } = sugerirAluno(display, candidatos);
    if (!automatico) {
      res.continuam_na_fila++;
      continue;
    }

    await sb.from("formacao_meet_aliases").upsert(
      { display_name_norm: norm, display_name: display, aluno_id: automatico },
      { onConflict: "display_name_norm" }
    );

    const { count } = await sb
      .from("formacao_meet_participacoes")
      .update({ aluno_id: automatico }, { count: "exact" })
      .eq("display_name_norm", norm)
      .is("aluno_id", null);

    // As falas guardam o vínculo por conta própria, para busca por pessoa.
    await sb
      .from("formacao_meet_falas")
      .update({ aluno_id: automatico })
      .eq("display_name", display)
      .is("aluno_id", null);

    res.resolvidos++;
    res.participacoes_ligadas += count ?? 0;
  }

  return res;
}
