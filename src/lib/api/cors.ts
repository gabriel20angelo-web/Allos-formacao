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
 * Escapa wildcards LIKE/ILIKE (`%` e `_`) em input do usuário pra evitar
 * match acidental quando concatenamos com `%input%`.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, (m) => "\\" + m);
}

/**
 * Saneia um redirect path vindo da query string. Aceita só caminhos
 * relativos same-origin (`/foo`). Bloqueia URLs absolutas
 * (`https://evil.com`), protocol-relative (`//evil.com`), e
 * data:/javascript: schemas.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/formacao"): string {
  if (!value) return fallback;
  // Tem que começar com "/" e não "//" (protocol-relative).
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  // Bloqueia "/\evil.com" e similares.
  if (value.includes("\\")) return fallback;
  return value;
}
