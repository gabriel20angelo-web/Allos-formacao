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
    // Em produção: fail-closed. Se o env for removido por engano, NÃO
    // queremos abrir o endpoint inteiro — melhor quebrar a extensão até
    // configurarem direito.
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[meet-shared-secret] MEET_PRESENCA_TOKEN não configurado em produção. Endpoints fechados.",
      );
      return false;
    }
    console.warn(
      "[meet-shared-secret] MEET_PRESENCA_TOKEN não configurado (dev/teste).",
    );
    return true;
  }
  if (!authHeader || !authHeader.startsWith("Bearer ")) return false;
  const token = authHeader.slice("Bearer ".length).trim();
  return token === expected;
}

/**
 * Verifica se o request vem de um admin logado (via cookies sb-*) OU
 * tem o shared secret válido. Usado em endpoints que servem tanto a UI
 * admin (cookies) quanto a extensão Chrome (token).
 */
export async function isAdminOrSharedSecret(
  req: { headers: { get: (name: string) => string | null } },
): Promise<boolean> {
  if (isValidMeetSharedSecret(req.headers.get("authorization"))) {
    return true;
  }
  // Importação tardia pra evitar carregar `next/headers` em runtimes que
  // não suportam (ex: edge), e pra não acoplar este helper a Supabase.
  try {
    const { createServerSupabaseClient } = await import("@/lib/supabase/server");
    const sb = await createServerSupabaseClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return profile?.role === "admin";
  } catch {
    return false;
  }
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
