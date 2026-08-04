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
  /** Gravações seguradas fora da fila até o vídeo existir no YouTube. */
  esperando_youtube: number;
  /** Aulas já publicadas que passaram a apontar para o YouTube. */
  aulas_corrigidas: number;
}

/** Endereço do vídeo, preferindo o YouTube quando ele já existe. */
export function montarUrl(
  gravacaoUri: string,
  youtubeId: string | null,
  inicioSeg: number | null
): string {
  if (!youtubeId) return gravacaoUri;
  return (
    `https://www.youtube.com/watch?v=${youtubeId}` + (inicioSeg ? `&t=${inicioSeg}` : "")
  );
}

/** O que o aluno assiste é o YouTube; o Drive é onde o arquivo mora. */
export function ehDrive(url: string | null): boolean {
  return !!url && /drive\.google\.com/i.test(url);
}

/**
 * A gravação espera fora da fila até existir no YouTube?
 *
 * Sala que não publica no YouTube segue como sempre foi, com o link do Drive:
 * desligar o envio e mesmo assim nunca ver a aula aparecer seria uma armadilha.
 */
export function deveEsperarYoutube(
  subirYoutube: boolean,
  youtubeVideoId: string | null
): boolean {
  return subirYoutube && !youtubeVideoId;
}

/**
 * O que trocar numa sugestão que já existe, agora que o YouTube ficou pronto.
 *
 * `aula` é o caso que faltava: entre a sugestão nascer e alguém publicar passam
 * segundos, e o link do Drive congelava na aula para sempre.
 */
export function decidirTroca(
  sugestao: { status: string; video_url: string; lesson_id: string | null },
  youtubeVideoId: string | null
): "nada" | "sugestao" | "aula" {
  if (!youtubeVideoId || !ehDrive(sugestao.video_url)) return "nada";
  if (sugestao.status === "pendente") return "sugestao";
  if (sugestao.status === "aprovada" && sugestao.lesson_id) return "aula";
  return "nada";
}

/**
 * A aula publicada ainda está com o link que esta sugestão pôs lá?
 *
 * Corrigir a aula não pode atropelar edição feita à mão: uma rotina que
 * sobrescreve escolha de gente é pior que uma aula apontando para o lugar
 * errado. Aula que sumiu também não se corrige.
 */
export function podeCorrigirAula(
  sugestao: { video_url: string },
  urlDaAula: string | null | undefined
): boolean {
  return !!urlDaAula && urlDaAula === sugestao.video_url;
}

/** "Encontro 7 · 05/08" — a numeração continua de onde a seção parou. */
function montarTitulo(numero: number, data: string): string {
  const [, mes, dia] = data.split("-");
  return `Encontro ${numero} · ${dia}/${mes}`;
}

export async function sugerirAulasDeGravacoes(sb: Sb): Promise<ResultadoSugestoes> {
  const res: ResultadoSugestoes = {
    criadas: 0,
    ja_existiam: 0,
    sem_curso: 0,
    atualizadas: 0,
    esperando_youtube: 0,
    aulas_corrigidas: 0,
  };

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
    .select("space_name, curso_id, secao_id, subir_youtube");
  const porSpace = new Map(
    (spaces || []).map(
      (s: {
        space_name: string;
        curso_id: string | null;
        secao_id: string | null;
        subir_youtube: boolean;
      }) => [s.space_name, s]
    )
  );

  const { data: jaSugeridos } = await sb
    .from("formacao_meet_aulas_sugeridas")
    .select("id, encontro_id, status, video_url, lesson_id");
  const sugeridoPorEncontro = new Map(
    (jaSugeridos || []).map(
      (s: {
        id: string;
        encontro_id: string;
        status: string;
        video_url: string;
        lesson_id: string | null;
      }) => [s.encontro_id, s]
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

      // Quando o envio termina, o link do Drive é trocado pelo do YouTube.
      // Vale para a sugestão que ainda espera aprovação E para a aula que já
      // foi publicada: entre criar a sugestão e alguém clicar em publicar
      // passam segundos, e foi assim que a aula de 04/08/2026 nasceu apontando
      // para o Drive dezessete segundos antes de o vídeo ficar pronto. Sem
      // corrigir a aula já criada, essa corrida congela o Drive para sempre.
      const primeira = decidirTroca(existente, e.youtube_video_id);

      if (primeira !== "nada") {
        const melhor = montarUrl(e.gravacao_uri, e.youtube_video_id, e.inicio_efetivo_seg);

        if (primeira === "sugestao") {
          await sb
            .from("formacao_meet_aulas_sugeridas")
            .update({ video_url: melhor })
            .eq("id", existente.id);
          res.atualizadas++;
        } else {
          // A aula publicada só é corrigida se ainda estiver com exatamente o
          // link que esta sugestão pôs lá. Se alguém editou o vídeo à mão
          // depois, essa mão vence: rotina que sobrescreve escolha de gente é
          // pior que aula apontando para o lugar errado.
          const { data: aula } = await sb
            .from("lessons")
            .select("id, video_url")
            .eq("id", existente.lesson_id!)
            .maybeSingle();

          if (podeCorrigirAula(existente, aula?.video_url)) {
            await sb
              .from("lessons")
              .update({ video_url: melhor, video_source: "youtube" })
              .eq("id", existente.lesson_id!);
            await sb
              .from("formacao_meet_aulas_sugeridas")
              .update({ video_url: melhor })
              .eq("id", existente.id);
            res.aulas_corrigidas++;
          }
        }
      }
      continue;
    }

    const space = porSpace.get(e.space_name);
    if (!space?.curso_id) {
      res.sem_curso++;
      continue;
    }

    // A aula do curso é o vídeo do YouTube, não o arquivo do Drive. O Drive é
    // onde a gravação mora e fica organizada; o que o aluno assiste sai de lá
    // só depois de subir como não listado. Enquanto o envio não termina, a
    // gravação espera fora da fila em vez de entrar com o link errado — a tela
    // mostra o progresso, e há um botão para publicar com o Drive assim mesmo
    // quando o envio falhar ou a pressa for maior.
    if (deveEsperarYoutube(space.subir_youtube, e.youtube_video_id)) {
      res.esperando_youtube++;
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
