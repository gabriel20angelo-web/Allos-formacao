import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /formacao/auth/sync-cookies
 *
 * Accepts `{ cookies: [{ name, value }] }` and writes each as a real
 * HttpOnly cookie on the response. Intended to run right BEFORE the
 * browser redirects to Google OAuth, so the PKCE code_verifier the
 * Supabase SDK put in localStorage is also persisted as an HTTP cookie
 * the server-side callback can read via `exchangeCodeForSession`.
 *
 * Only writes cookies whose name matches the Supabase SDK prefix so
 * callers can't arbitrarily set cookies on our domain.
 */
// Header customizado que o browser só envia same-origin via fetch (CORS
// preflight bloqueia cross-origin sem allow). Funciona como CSRF guard.
const CSRF_HEADER = "x-allos-auth";

// Project ID do Supabase deriva do hostname da URL pública. Ex.:
// https://syiaushvzhgyhvsmoegt.supabase.co → "syiaushvzhgyhvsmoegt".
function expectedCookiePrefix(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const m = url.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i);
  return m ? `sb-${m[1]}-auth-token` : null;
}

export async function POST(request: NextRequest) {
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  let body: { cookies?: { name?: unknown; value?: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.cookies)) {
    return NextResponse.json({ error: "Missing cookies array" }, { status: 400 });
  }

  const expectedPrefix = expectedCookiePrefix();
  const cookieStore = await cookies();
  let written = 0;

  for (const c of body.cookies) {
    if (typeof c.name !== "string" || typeof c.value !== "string") continue;
    // Restringe ao project ID do próprio site (atacante não pode injetar
    // cookies de outros projetos Supabase).
    if (expectedPrefix && !c.name.startsWith(expectedPrefix)) continue;
    if (!expectedPrefix && !/^sb-[a-z0-9]+-auth-token/.test(c.name)) continue;
    cookieStore.set(c.name, c.value, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
    });
    written++;
  }

  return NextResponse.json(
    { written },
    { headers: { "Cache-Control": "no-store" } }
  );
}
