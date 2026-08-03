// De onde sai a transcrição de uma aula, e em que ordem de preferência.
//
// Há duas fontes, e elas não são equivalentes:
//
//   Meet     — uma linha por turno de fala, COM O NOME de quem falou. Só existe
//              para encontro que rodou pelo Meet com transcrição ligada.
//   OpusClip — o vídeo inteiro transcrito, sem falante. Existe para qualquer
//              vídeo que tenha passado por um corte, inclusive os antigos que
//              só eram arquivo no Drive.
//
// O Meet ganha quando existe. Num grupo de formação, saber quem disse o quê é
// metade do valor do texto: sem isso, uma pergunta do aluno e a resposta do
// condutor viram o mesmo parágrafo.

import {
  BlocoFala,
  blocosParaTexto,
  falasParaBlocos,
  lerSrt,
  limparTextoCorrido,
} from "./transcricao";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export type OrigemTranscricao = "meet" | "opusclip" | "opusclip_corrido";

export interface TranscricaoDeAula {
  lessonId: string;
  titulo: string;
  origem: OrigemTranscricao;
  /** Já em Markdown, com parágrafos. */
  markdown: string;
  /** A legenda crua, quando a fonte tem tempos. */
  srt: string | null;
  /** Quantos turnos de fala, quando a fonte sabe. */
  falas: number | null;
}

/** Como cada origem se chama para quem lê. */
export const NOME_ORIGEM: Record<OrigemTranscricao, string> = {
  meet: "transcrição do Meet, com os nomes de quem falou",
  opusclip: "transcrição automática do vídeo",
  opusclip_corrido: "transcrição automática (sem marcação de tempo)",
};

/**
 * Busca a transcrição de uma aula, pela melhor fonte disponível.
 *
 * Devolve `null` quando não há nenhuma — o que é o caso comum de aula
 * cadastrada à mão cujo vídeo nunca passou nem pelo Meet nem por um corte.
 */
export async function transcricaoDaAula(
  sb: Sb,
  lessonId: string,
  tituloFallback?: string
): Promise<TranscricaoDeAula | null> {
  const { data: aula } = await sb
    .from("lessons")
    .select("id, title")
    .eq("id", lessonId)
    .maybeSingle();

  const titulo = aula?.title || tituloFallback || "Aula";

  // ── 1. Meet: tem quem falou ──
  const { data: sugestao } = await sb
    .from("formacao_meet_aulas_sugeridas")
    .select("encontro_id")
    .eq("lesson_id", lessonId)
    .maybeSingle();

  if (sugestao?.encontro_id) {
    const { data: falas } = await sb
      .from("formacao_meet_falas")
      .select("display_name, texto, inicio, fim")
      .eq("encontro_id", sugestao.encontro_id)
      .order("ordem", { ascending: true });

    if (falas?.length) {
      const blocos = falasParaBlocos(
        falas as { display_name: string; texto: string; inicio: string | null; fim: string | null }[]
      );
      return {
        lessonId,
        titulo,
        origem: "meet",
        markdown: blocosParaTexto(blocos, { titulo, comTempos: true }),
        srt: null,
        falas: falas.length,
      };
    }
  }

  // ── 2. OpusClip: legenda com tempos, ou texto corrido ──
  // Aceita o job da própria aula e o do encontro que virou a aula: os dois
  // caminhos existem e nenhum preenche as duas colunas na mesma linha.
  const filtro = sugestao?.encontro_id
    ? `lesson_id.eq.${lessonId},encontro_id.eq.${sugestao.encontro_id}`
    : `lesson_id.eq.${lessonId}`;

  const { data: jobs } = await sb
    .from("formacao_clip_jobs")
    .select("transcricao_srt, transcricao_texto")
    .or(filtro)
    .not("transcricao_em", "is", null)
    .order("transcricao_em", { ascending: false })
    .limit(1);

  const job = jobs?.[0];
  if (job?.transcricao_srt) {
    const blocos: BlocoFala[] = lerSrt(job.transcricao_srt);
    if (blocos.length) {
      return {
        lessonId,
        titulo,
        origem: "opusclip",
        markdown: blocosParaTexto(blocos, { titulo, comTempos: true }),
        srt: job.transcricao_srt,
        falas: blocos.length,
      };
    }
  }

  if (job?.transcricao_texto) {
    return {
      lessonId,
      titulo,
      origem: "opusclip_corrido",
      markdown: `# ${titulo}\n\n${limparTextoCorrido(job.transcricao_texto)}`,
      srt: null,
      falas: null,
    };
  }

  return null;
}

/** As aulas de um curso, na ordem, com transcrição quando houver. */
export async function transcricoesDoCurso(
  sb: Sb,
  cursoId: string
): Promise<{ curso: string; itens: TranscricaoDeAula[]; semTranscricao: string[] }> {
  const { data: curso } = await sb
    .from("courses")
    .select("title")
    .eq("id", cursoId)
    .maybeSingle();

  const { data: secoes } = await sb
    .from("sections")
    .select("id")
    .eq("course_id", cursoId)
    .order("position", { ascending: true });

  const secaoIds = (secoes || []).map((s: { id: string }) => s.id);
  if (!secaoIds.length) {
    return { curso: curso?.title || "Curso", itens: [], semTranscricao: [] };
  }

  const { data: aulas } = await sb
    .from("lessons")
    .select("id, title, position")
    .in("section_id", secaoIds)
    .order("position", { ascending: true });

  const itens: TranscricaoDeAula[] = [];
  const semTranscricao: string[] = [];

  for (const a of (aulas || []) as { id: string; title: string }[]) {
    const t = await transcricaoDaAula(sb, a.id, a.title);
    if (t) itens.push(t);
    else semTranscricao.push(a.title);
  }

  return { curso: curso?.title || "Curso", itens, semTranscricao };
}

/**
 * Junta as aulas num documento só.
 *
 * Um arquivo por aula obrigaria a costurar tudo à mão depois, e o que o Gabriel
 * quer fazer com isso é escrever. Então o curso sai como um documento contínuo,
 * cada encontro virando uma seção, na ordem em que foram dados.
 */
export function montarDocumento(
  titulo: string,
  itens: TranscricaoDeAula[],
  semTranscricao: string[] = []
): string {
  const partes: string[] = [`# ${titulo}`, ""];

  if (itens.length) {
    partes.push(
      `*${itens.length} ${itens.length === 1 ? "encontro transcrito" : "encontros transcritos"}.*`,
      ""
    );
  }

  // Quem lê precisa saber o que NÃO está aqui. Um sumário que esconde as
  // ausências faz o leitor procurar por horas um trecho que nunca existiu.
  if (semTranscricao.length) {
    partes.push(
      `> Sem transcrição: ${semTranscricao.join(", ")}.`,
      "> São aulas cujo vídeo não passou pelo Meet nem por um corte.",
      ""
    );
  }

  for (const item of itens) {
    // O título da aula já vira o cabeçalho de nível 1 dentro do markdown de
    // cada uma; aqui ele desce um nível para virar seção do documento.
    partes.push(item.markdown.replace(/^# /, "## "), "\n---\n");
  }

  return partes.join("\n").trim() + "\n";
}

/** Nome de arquivo sem acento, espaço nem surpresa. */
export function nomeDeArquivo(base: string, extensao: string): string {
  const limpo = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const hoje = new Date().toISOString().slice(0, 10);
  return `${limpo || "transcricao"}-${hoje}.${extensao}`;
}
