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
