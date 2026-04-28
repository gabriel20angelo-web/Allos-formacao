export type DashMode = "sync" | "async";
export type DashPeriod = "week" | "month" | "quarter" | "semester" | "year";

export const PERIOD_LABELS: Record<DashPeriod, string> = {
  week: "Semana",
  month: "Mês",
  quarter: "Trimestre",
  semester: "Semestre",
  year: "Ano",
};

export function getPeriodDate(p: DashPeriod): Date {
  const now = new Date();
  switch (p) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter":
      return new Date(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) * 3,
        1
      );
    case "semester":
      return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
  }
}

export function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

export function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "há 1 dia";
  if (diffD < 30) return `há ${diffD} dias`;
  return `há ${Math.floor(diffD / 30)} mês${Math.floor(diffD / 30) > 1 ? "es" : ""}`;
}
