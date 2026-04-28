/**
 * CORS whitelist compartilhado pelos endpoints `/api/*` chamados externamente
 * (extensão Chrome de quórum, formulários públicos de certificado, etc.).
 */
const ALLOWED_ORIGINS = [
  "https://allos.org.br",
  "https://www.allos.org.br",
  "https://allos-formacao.up.railway.app",
  process.env.APP_URL,
  process.env.NEXT_PUBLIC_APP_URL,
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000"]
    : []),
].filter((o): o is string => Boolean(o));

export interface CorsOptions {
  methods?: string;
  cacheControl?: string;
}

export function buildCorsHeaders(
  origin: string | null,
  options: CorsOptions = {},
): Record<string, string> {
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": options.methods ?? "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8",
  };
  if (options.cacheControl) {
    headers["Cache-Control"] = options.cacheControl;
  }
  return headers;
}

/**
 * Verifica `Authorization: Bearer <secret>` contra `MEET_PRESENCA_TOKEN`.
 * Endpoints chamados pela extensão Chrome (que não tem cookies do site).
 * Retorna true se o token bate ou se o env não está definido (modo legado).
 */
export function isValidMeetSharedSecret(
  authHeader: string | null,
): boolean {
  const expected = process.env.MEET_PRESENCA_TOKEN;
  if (!expected) {
    // Sem env definido: não força auth (modo legado pra não quebrar
    // produção até a extensão ser atualizada). Avisa em log.
    console.warn(
      "[meet-shared-secret] MEET_PRESENCA_TOKEN não configurado; endpoint aceitando requisições sem auth.",
    );
    return true;
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  return token === expected;
}
