// Gravação do encontro vira sugestão de aula.
//
// Só sugestão: a aula em si nasce quando alguém aprova. A tabela `lessons` não
// tem estado de rascunho, então criar direto seria publicar direto, e a
// gravação começa antes do grupo se formar, pegando a conversa de chegada e o
// que se diz antes de todo mundo saber que está sendo gravado.
//
// O vínculo é da SALA com o curso, não do encontro: configura-se uma vez por
// grupo e vale para todas as semanas seguintes.

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ResultadoSugestoes {
  criadas: number;
  ja_existiam: number;
  sem_curso: number;
}

/** "Encontro 7 · 05/08" — a numeração continua de onde a seção parou. */
function montarTitulo(numero: number, data: string): string {
  const [, mes, dia] = data.split("-");
  return `Encontro ${numero} · ${dia}/${mes}`;
}

export async function sugerirAulasDeGravacoes(sb: Sb): Promise<ResultadoSugestoes> {
  const res: ResultadoSugestoes = { criadas: 0, ja_existiam: 0, sem_curso: 0 };

  // Só encontro com gravação pronta e que ainda não gerou sugestão.
  const { data: encontros } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, space_name, data_reuniao, duracao_min, gravacao_uri, atividade_nome, youtube_video_id, inicio_efetivo_seg"
    )
    .eq("descartado", false)
    .not("gravacao_uri", "is", null)
    // Onde o YouTube está ligado, espera o envio terminar: sugerir agora criaria
    // a aula apontando para o Drive, e o vídeo bom chegaria depois.
    .or("youtube_status.is.null,youtube_status.eq.pronto,youtube_status.eq.erro")
    .order("data_reuniao", { ascending: true })
    .limit(50);

  if (!encontros?.length) return res;

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, curso_id, secao_id");
  const porSpace = new Map(
    (spaces || []).map((s: { space_name: string; curso_id: string | null; secao_id: string | null }) => [
      s.space_name,
      s,
    ])
  );

  const { data: jaSugeridos } = await sb
    .from("formacao_meet_aulas_sugeridas")
    .select("encontro_id");
  const vistos = new Set((jaSugeridos || []).map((s: { encontro_id: string }) => s.encontro_id));

  for (const e of encontros as {
    id: string;
    space_name: string;
    data_reuniao: string;
    duracao_min: number | null;
    gravacao_uri: string;
    atividade_nome: string | null;
    youtube_video_id: string | null;
    inicio_efetivo_seg: number | null;
  }[]) {
    if (vistos.has(e.id)) {
      res.ja_existiam++;
      continue;
    }

    const space = porSpace.get(e.space_name);
    if (!space?.curso_id) {
      res.sem_curso++;
      continue;
    }

    // A numeração segue o que já existe no curso, contando as aulas que vieram
    // de encontros. Assim "Encontro 8" vem depois do 7 mesmo que alguém tenha
    // criado aulas à mão no meio.
    const { count } = await sb
      .from("formacao_meet_aulas_sugeridas")
      .select("id", { count: "exact", head: true })
      .eq("curso_id", space.curso_id)
      .eq("status", "aprovada");

    // Se o vídeo já subiu para o YouTube, a aula aponta para lá: player melhor,
    // sem depender de compartilhamento do Drive, e com o `start` pulando a
    // espera antes do encontro começar.
    const url = e.youtube_video_id
      ? `https://www.youtube.com/watch?v=${e.youtube_video_id}` +
        (e.inicio_efetivo_seg ? `&t=${e.inicio_efetivo_seg}` : "")
      : e.gravacao_uri;

    const { error } = await sb.from("formacao_meet_aulas_sugeridas").insert({
      encontro_id: e.id,
      curso_id: space.curso_id,
      secao_id: space.secao_id,
      titulo: montarTitulo((count ?? 0) + 1, e.data_reuniao),
      video_url: url,
      duracao_min: e.duracao_min,
      data_reuniao: e.data_reuniao,
    });

    if (!error) res.criadas++;
  }

  return res;
}
