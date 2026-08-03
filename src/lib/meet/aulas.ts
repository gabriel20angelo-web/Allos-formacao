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
  /** Sugestões que trocaram o link do Drive pelo do YouTube quando ele ficou pronto. */
  atualizadas: number;
}

/** Endereço do vídeo, preferindo o YouTube quando ele já existe. */
function montarUrl(
  gravacaoUri: string,
  youtubeId: string | null,
  inicioSeg: number | null
): string {
  if (!youtubeId) return gravacaoUri;
  return (
    `https://www.youtube.com/watch?v=${youtubeId}` + (inicioSeg ? `&t=${inicioSeg}` : "")
  );
}

/** "Encontro 7 · 05/08" — a numeração continua de onde a seção parou. */
function montarTitulo(numero: number, data: string): string {
  const [, mes, dia] = data.split("-");
  return `Encontro ${numero} · ${dia}/${mes}`;
}

export async function sugerirAulasDeGravacoes(sb: Sb): Promise<ResultadoSugestoes> {
  const res: ResultadoSugestoes = { criadas: 0, ja_existiam: 0, sem_curso: 0, atualizadas: 0 };

  // Só encontro com gravação pronta e que ainda não gerou sugestão.
  const { data: encontros } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, space_name, data_reuniao, duracao_min, gravacao_uri, atividade_nome, youtube_video_id, inicio_efetivo_seg"
    )
    .eq("descartado", false)
    // Sem isto, a rodada seguinte traria de volta a gravação que alguém acabou
    // de tirar da fila de aulas — o mesmo erro do descarte que se desfazia.
    .eq("aula_ignorada", false)
    .not("gravacao_uri", "is", null)
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
    .select("id, encontro_id, status, video_url");
  const sugeridoPorEncontro = new Map(
    (jaSugeridos || []).map(
      (s: { id: string; encontro_id: string; status: string; video_url: string }) => [
        s.encontro_id,
        s,
      ]
    )
  );

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
    const existente = sugeridoPorEncontro.get(e.id);
    if (existente) {
      res.ja_existiam++;

      // A aula entra na fila com o link do Drive assim que a gravação existe,
      // sem esperar o YouTube. Se o envio terminar antes de alguém aprovar, o
      // link é trocado aqui: melhor uma aula que melhora sozinha do que uma
      // fila vazia esperando um envio que pode nem estar configurado.
      if (e.youtube_video_id && existente.status === "pendente") {
        const melhor = montarUrl(e.gravacao_uri, e.youtube_video_id, e.inicio_efetivo_seg);
        if (melhor !== existente.video_url) {
          await sb
            .from("formacao_meet_aulas_sugeridas")
            .update({ video_url: melhor })
            .eq("id", existente.id);
          res.atualizadas++;
        }
      }
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
    // Conta aprovadas E pendentes. Contar só aprovadas fazia todas as sugestões
    // criadas na mesma rodada nascerem "Encontro 1", porque nenhuma delas tinha
    // sido aprovada ainda. Vincular um curso a uma sala com histórico produzia
    // dez aulas com o mesmo número.
    const { count } = await sb
      .from("formacao_meet_aulas_sugeridas")
      .select("id", { count: "exact", head: true })
      .eq("curso_id", space.curso_id)
      .in("status", ["aprovada", "pendente"]);

    const url = montarUrl(e.gravacao_uri, e.youtube_video_id, e.inicio_efetivo_seg);

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
