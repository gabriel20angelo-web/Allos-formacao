// Janelas de tempo e normalização de eventos da "Atividade recente".
//
// A ideia central: cada coisa que acontece na plataforma (um feedback no
// /certificado, uma matrícula, uma aula concluída) vira um TimelineEvent com a
// mesma forma, para que a timeline não precise saber de onde veio.
//
// As janelas são móveis (últimos N dias contando hoje), não de calendário —
// é o que permite responder "depois da divulgação de terça, quem apareceu?".

export type ActivityRange = "today" | "7d" | "30d" | "90d" | "6m" | "1y" | "all";

export const ACTIVITY_RANGES: ActivityRange[] = [
  "today",
  "7d",
  "30d",
  "90d",
  "6m",
  "1y",
  "all",
];

export const RANGE_LABELS: Record<ActivityRange, string> = {
  today: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "6m": "6 meses",
  "1y": "1 ano",
  all: "Tudo",
};

/** Texto para o comparativo: "vs. os 7 dias anteriores". */
export const RANGE_PREVIOUS_LABELS: Record<ActivityRange, string> = {
  today: "vs. ontem",
  "7d": "vs. os 7 dias anteriores",
  "30d": "vs. os 30 dias anteriores",
  "90d": "vs. os 90 dias anteriores",
  "6m": "vs. os 6 meses anteriores",
  "1y": "vs. o ano anterior",
  all: "",
};

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Início da janela. `null` = sem corte (todo o período). */
export function getRangeStart(range: ActivityRange, now = new Date()): Date | null {
  const today = startOfDay(now);
  switch (range) {
    case "today":
      return today;
    case "7d":
      return startOfDay(new Date(today.getTime() - 6 * 86400000));
    case "30d":
      return startOfDay(new Date(today.getTime() - 29 * 86400000));
    case "90d":
      return startOfDay(new Date(today.getTime() - 89 * 86400000));
    case "6m": {
      const d = new Date(today);
      d.setMonth(d.getMonth() - 6);
      return startOfDay(d);
    }
    case "1y": {
      const d = new Date(today);
      d.setFullYear(d.getFullYear() - 1);
      return startOfDay(d);
    }
    case "all":
      return null;
  }
}

/**
 * Início da janela imediatamente anterior, do mesmo tamanho — é contra ela que
 * o resumo compara. `null` quando não há comparação possível.
 */
export function getPreviousRangeStart(
  range: ActivityRange,
  now = new Date()
): Date | null {
  const start = getRangeStart(range, now);
  if (!start) return null;
  const span = startOfDay(now).getTime() + 86400000 - start.getTime();
  return new Date(start.getTime() - span);
}

// ─────────────────────────────────────────────────────────────────
// Eventos
// ─────────────────────────────────────────────────────────────────

export type TimelineEventType =
  // síncrona (/certificado)
  | "feedback"
  // síncrona (captura do Meet) — o que foi medido, ao lado do que foi declarado
  | "encontro"
  // assíncrona (cursos)
  | "signup"
  | "enrollment"
  | "lesson"
  | "completion"
  | "review"
  | "certificate"
  | "comment"
  | "exam";

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  /** Quem fez. */
  person: string;
  /**
   * E-mail de quem fez — é a chave real da pessoa. O nome digitado no
   * formulário varia ("Sabrina Sales" e "Sabrina Sales Bezerra" são a mesma
   * conta), então qualquer agrupamento por pessoa usa isto quando existe.
   */
  personEmail?: string;
  /** Onde: curso, aula ou atividade. */
  title: string;
  /** Contexto curto (curso, condutores) mostrado em segunda linha. */
  detail?: string;
  /**
   * Texto escrito por uma pessoa — relato, comentário, avaliação. É o que
   * torna a linha clicável: fechada mostra o começo, aberta mostra tudo.
   */
  body?: string;
  /** Nota, quando o evento tiver uma. */
  score?: number;
  /** Sufixo da nota ("/10", "/5"). */
  scoreSuffix?: string;
}

/** Chave de dia no fuso local — agrupar por UTC jogaria a noite para o dia seguinte. */
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function dayLabel(key: string, now = new Date()): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = startOfDay(now);
  const diff = Math.round((today.getTime() - date.getTime()) / 86400000);
  if (diff === 0) return "Hoje";
  if (diff === 1) return "Ontem";
  const weekday = date.toLocaleDateString("pt-BR", { weekday: "short" });
  const short = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  const clean = weekday.replace(".", "");
  return `${clean}, ${short}${date.getFullYear() !== now.getFullYear() ? `/${String(y).slice(2)}` : ""}`;
}

export function hourLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Agrupa em ordem cronológica decrescente: dias mais recentes primeiro. */
export function groupByDay(
  events: TimelineEvent[]
): { key: string; label: string; events: TimelineEvent[] }[] {
  const map = new Map<string, TimelineEvent[]>();
  events.forEach((e) => {
    const k = dayKey(e.timestamp);
    const list = map.get(k);
    if (list) list.push(e);
    else map.set(k, [e]);
  });
  return Array.from(map.entries())
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, evs]) => ({
      key,
      label: dayLabel(key),
      events: evs.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      ),
    }));
}

export type BucketGrain = "hour" | "day" | "week" | "month";
export type Bucket = {
  key: string;
  label: string;
  count: number;
  /** Granularidade do bucket — quem marca anotação precisa saber. */
  grain: BucketGrain;
};

/** Dias cobertos por um bucket, para casar com as anotações. */
export function bucketCoversDay(bucket: Bucket, day: string): boolean {
  if (bucket.grain === "hour") return true; // janela "hoje": um dia só
  if (bucket.grain === "day") return bucket.key === day;
  const start = new Date(`${bucket.key}T00:00:00`);
  const end = new Date(start);
  if (bucket.grain === "week") end.setDate(end.getDate() + 6);
  else end.setMonth(end.getMonth() + 1), end.setDate(0);
  const d = new Date(`${day}T00:00:00`);
  return d >= start && d <= end;
}

/**
 * Série do gráfico. A granularidade acompanha a janela: hora no dia, dia até
 * 90 dias, semana até um ano, mês no histórico completo. Buckets vazios são
 * preservados — o vale entre dois picos é informação.
 */
export function bucketEvents(
  events: TimelineEvent[],
  range: ActivityRange,
  now = new Date()
): Bucket[] {
  if (range === "today") {
    const counts = new Array(24).fill(0);
    events.forEach((e) => {
      counts[new Date(e.timestamp).getHours()]++;
    });
    return counts.map((count, h) => ({
      key: String(h),
      label: `${String(h).padStart(2, "0")}h`,
      count,
      grain: "hour" as const,
    }));
  }

  const start = getRangeStart(range, now);
  const first = start
    ? start
    : events.length > 0
      ? new Date(
          Math.min(...events.map((e) => new Date(e.timestamp).getTime()))
        )
      : startOfDay(now);

  const spanDays = Math.max(
    1,
    Math.round((startOfDay(now).getTime() - startOfDay(first).getTime()) / 86400000) + 1
  );
  const grain: "day" | "week" | "month" =
    spanDays <= 92 ? "day" : spanDays <= 400 ? "week" : "month";

  const counts = new Map<string, number>();

  // pré-popula os buckets do intervalo para que dias sem evento apareçam zerados
  const cursor = startOfDay(first);
  const end = startOfDay(now);
  if (grain === "week") {
    // alinha na segunda-feira
    const dow = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - dow);
  } else if (grain === "month") {
    cursor.setDate(1);
  }
  while (cursor <= end) {
    counts.set(bucketKeyFor(cursor, grain), 0);
    if (grain === "day") cursor.setDate(cursor.getDate() + 1);
    else if (grain === "week") cursor.setDate(cursor.getDate() + 7);
    else cursor.setMonth(cursor.getMonth() + 1);
  }

  events.forEach((e) => {
    const k = bucketKeyFor(new Date(e.timestamp), grain);
    if (counts.has(k)) counts.set(k, (counts.get(k) || 0) + 1);
  });

  return Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, count]) => ({ key, label: bucketLabel(key, grain), count, grain }));
}

function bucketKeyFor(d: Date, grain: "day" | "week" | "month"): string {
  const c = new Date(d);
  if (grain === "week") {
    const dow = (c.getDay() + 6) % 7;
    c.setDate(c.getDate() - dow);
  } else if (grain === "month") {
    c.setDate(1);
  }
  const m = String(c.getMonth() + 1).padStart(2, "0");
  const day = String(c.getDate()).padStart(2, "0");
  return `${c.getFullYear()}-${m}-${day}`;
}

function bucketLabel(key: string, grain: "day" | "week" | "month"): string {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (grain === "month") {
    return date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  }
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Variação percentual; `null` quando não há base de comparação. */
export function variation(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}
