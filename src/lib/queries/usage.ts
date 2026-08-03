// Leitura do tempo de uso da plataforma (tabela usage_sessions).
//
// O que está gravado ali é permanência ativa, não tempo de reprodução: o player
// é um iframe de terceiro e não deixa ler o vídeo. Cada linha é uma janela
// contínua de presença costurada pela rota /formacao/api/usage-ping.
//
// A escrita é exclusiva do service role. Aqui só se lê, com o cliente do
// browser, sob RLS: cada pessoa vê o próprio tempo e admin vê o de todos.

import { createClient } from "@/lib/supabase/client";

export interface UsageDay {
  date: string;
  seconds: number;
}

export interface UsageTotals {
  totalSeconds: number;
  sessions: number;
  firstAt: string | null;
  lastAt: string | null;
  byDay: UsageDay[];
}

export interface UsageLessonSeconds {
  lesson_id: string;
  seconds: number;
}

interface LinhaSessao {
  seconds: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  lesson_id?: string | null;
}

const TABLE = "usage_sessions";

const TOTAIS_VAZIOS: UsageTotals = {
  totalSeconds: 0,
  sessions: 0,
  firstAt: null,
  lastAt: null,
  byDay: [],
};

/**
 * Data no fuso de quem lê, em YYYY-MM-DD. Agrupar pelo dia UTC empurraria a
 * madrugada de quem estuda tarde para o dia seguinte no gráfico.
 */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/** Tempo total, número de sessões, extremos e série por dia de uma pessoa. */
export async function getUsageTotals(userId: string): Promise<UsageTotals> {
  if (!userId) return TOTAIS_VAZIOS;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("seconds, started_at, ended_at")
      .eq("user_id", userId)
      .order("started_at", { ascending: true });

    if (error || !data) return TOTAIS_VAZIOS;

    const linhas = data as LinhaSessao[];
    if (linhas.length === 0) return TOTAIS_VAZIOS;

    const porDia = new Map<string, number>();
    let totalSeconds = 0;
    let firstAt: string | null = null;
    let lastAt: string | null = null;

    for (const linha of linhas) {
      const seconds = Math.max(0, Math.trunc(linha.seconds ?? 0));
      totalSeconds += seconds;

      if (linha.started_at) {
        if (!firstAt || linha.started_at < firstAt) firstAt = linha.started_at;
        const dia = diaLocal(linha.started_at);
        if (dia) porDia.set(dia, (porDia.get(dia) ?? 0) + seconds);
      }
      // O fim da última sessão é o sinal mais recente que a pessoa deu.
      const fim = linha.ended_at ?? linha.started_at;
      if (fim && (!lastAt || fim > lastAt)) lastAt = fim;
    }

    const byDay: UsageDay[] = Array.from(porDia.entries())
      .map(([date, seconds]) => ({ date, seconds }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { totalSeconds, sessions: linhas.length, firstAt, lastAt, byDay };
  } catch {
    return TOTAIS_VAZIOS;
  }
}

/**
 * Tempo por aula dentro de um curso, da maior para a menor. Sessões sem aula
 * (navegar pela página do curso, por exemplo) ficam de fora de propósito.
 */
export async function getUsageByLesson(
  userId: string,
  courseId: string,
): Promise<UsageLessonSeconds[]> {
  if (!userId || !courseId) return [];

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("lesson_id, seconds")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .not("lesson_id", "is", null);

    if (error || !data) return [];

    const porAula = new Map<string, number>();
    for (const linha of data as LinhaSessao[]) {
      if (!linha.lesson_id) continue;
      const seconds = Math.max(0, Math.trunc(linha.seconds ?? 0));
      porAula.set(linha.lesson_id, (porAula.get(linha.lesson_id) ?? 0) + seconds);
    }

    return Array.from(porAula.entries())
      .map(([lesson_id, seconds]) => ({ lesson_id, seconds }))
      .sort((a, b) => b.seconds - a.seconds);
  } catch {
    return [];
  }
}

/**
 * Tempo total de uma pessoa dentro de um curso, somando também o que ela
 * passou fora das aulas (página do curso, prova, certificado).
 */
export async function getCourseWatchSeconds(
  userId: string,
  courseId: string,
): Promise<number> {
  if (!userId || !courseId) return 0;

  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select("seconds")
      .eq("user_id", userId)
      .eq("course_id", courseId);

    if (error || !data) return 0;

    return (data as LinhaSessao[]).reduce(
      (soma, linha) => soma + Math.max(0, Math.trunc(linha.seconds ?? 0)),
      0,
    );
  } catch {
    return 0;
  }
}

/**
 * Uma linha do recorte por curso: quanto tempo a pessoa passou ali e quanto
 * conteúdo ela deu por concluído naquele mesmo curso.
 */
export interface UsageCurso {
  courseId: string;
  titulo: string;
  /** Permanência ativa somada nas sessões daquele curso. */
  segundos: number;
  aulasConcluidas: number;
  /** Duração declarada SÓ das aulas concluídas, nunca a do curso inteiro. */
  minutosConteudoConcluido: number;
}

interface LinhaSessaoCurso {
  course_id: string | null;
  seconds: number | null;
}

interface LinhaProgressoCurso {
  lesson: {
    duration_minutes: number | null;
    section: {
      course: { id: string; title: string | null } | null;
    } | null;
  } | null;
}

/**
 * Tempo de permanência de uma pessoa quebrado por curso, ao lado do conteúdo
 * que ela concluiu em cada um. Responde à pergunta que o total da plataforma
 * não responde: "ela marcou 19 aulas neste curso, mas ficou quanto tempo ali?".
 *
 * O denominador é a duração das aulas QUE ELA CONCLUIU, não a do curso inteiro.
 * Quem parou na metade não deve ser cobrado pela metade que não fez: comparar
 * com o curso todo faria qualquer pessoa em andamento parecer suspeita, e o
 * número deixaria de significar alguma coisa.
 *
 * Entram os cursos com tempo registrado E os com aulas concluídas sem tempo
 * nenhum, porque a ausência de tempo também é informação: quem concluiu antes
 * de o rastreio (migration 042) entrar no ar não tem sessão gravada.
 */
export async function getUsagePorCurso(userId: string): Promise<UsageCurso[]> {
  if (!userId) return [];

  try {
    const supabase = createClient();

    const [sessoesRes, progressoRes] = await Promise.all([
      supabase
        .from(TABLE)
        .select("course_id, seconds")
        .eq("user_id", userId)
        .not("course_id", "is", null),
      // O curso não está em lesson_progress: sobe-se lessons → sections →
      // courses para saber a que curso cada aula concluída pertence.
      supabase
        .from("lesson_progress")
        .select(
          "lesson:lessons!lesson_id(duration_minutes, section:sections!section_id(course:courses!course_id(id, title)))",
        )
        .eq("user_id", userId)
        .eq("completed", true),
    ]);

    // Meia leitura seria pior que nenhuma: se só o progresso falhasse, todo
    // curso apareceria com zero aula concluída e pareceria tempo sem conteúdo.
    if (sessoesRes.error || progressoRes.error) return [];

    const porCurso = new Map<string, UsageCurso>();
    const garantir = (courseId: string): UsageCurso => {
      let linha = porCurso.get(courseId);
      if (!linha) {
        linha = {
          courseId,
          titulo: "",
          segundos: 0,
          aulasConcluidas: 0,
          minutosConteudoConcluido: 0,
        };
        porCurso.set(courseId, linha);
      }
      return linha;
    };

    for (const sessao of (sessoesRes.data ?? []) as LinhaSessaoCurso[]) {
      if (!sessao.course_id) continue;
      garantir(sessao.course_id).segundos += Math.max(
        0,
        Math.trunc(sessao.seconds ?? 0),
      );
    }

    for (const progresso of (progressoRes.data ??
      []) as unknown as LinhaProgressoCurso[]) {
      const curso = progresso.lesson?.section?.course;
      if (!curso?.id) continue;
      const linha = garantir(curso.id);
      if (curso.title) linha.titulo = curso.title;
      linha.aulasConcluidas += 1;
      // Aula sem duração cadastrada soma zero em vez de chutar uma média: um
      // denominador inventado viraria uma porcentagem inventada.
      linha.minutosConteudoConcluido += Math.max(
        0,
        Math.trunc(progresso.lesson?.duration_minutes ?? 0),
      );
    }

    // Curso onde só houve tempo (nenhuma aula concluída) não passou por
    // courses no embed acima, então o título vem numa busca à parte.
    const semTitulo = Array.from(porCurso.values())
      .filter((linha) => !linha.titulo)
      .map((linha) => linha.courseId);

    if (semTitulo.length > 0) {
      const { data: cursos } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", semTitulo);

      for (const curso of (cursos ?? []) as { id: string; title: string | null }[]) {
        const linha = porCurso.get(curso.id);
        if (linha && curso.title) linha.titulo = curso.title;
      }
    }

    return Array.from(porCurso.values())
      .map((linha) => ({
        ...linha,
        // Curso apagado ou fora do alcance de leitura ainda aparece: o tempo
        // gasto nele é real e some da conta se a linha for descartada.
        titulo: linha.titulo || "Curso sem título",
      }))
      .sort(
        (a, b) =>
          b.minutosConteudoConcluido - a.minutosConteudoConcluido ||
          b.segundos - a.segundos,
      );
  } catch {
    return [];
  }
}

/** Segundos em texto curto: "2h 14min", "43min", "1h". Zero vira travessão. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";

  const minutos = Math.floor(seconds / 60);
  if (minutos < 1) return "menos de 1min";

  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;

  if (horas === 0) return `${minutos}min`;
  if (resto === 0) return `${horas}h`;
  return `${horas}h ${resto}min`;
}
