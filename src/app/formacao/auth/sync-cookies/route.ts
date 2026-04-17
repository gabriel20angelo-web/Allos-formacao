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
export async function POST(request: NextRequest) {
  let body: { cookies?: { name?: unknown; value?: unknown }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.cookies)) {
    return NextResponse.json({ error: "Missing cookies array" }, { status: 400 });
  }

  const cookieStore = await cookies();
  let written = 0;

  for (const c of body.cookies) {
    if (typeof c.name !== "string" || typeof c.value !== "string") continue;
    if (!/^sb-[a-z0-9]+-auth-token/.test(c.name)) continue;
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
