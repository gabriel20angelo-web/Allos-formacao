import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /formacao/api/sign-in
 *
 * Fallback de login server-side. Usado quando o SDK do browser não consegue
 * chegar no Supabase (Cloudflare 522, iCloud Private Relay, adblock,
 * DNS de operadora bloqueando *.supabase.co — caso recorrente pra usuários
 * de Fortaleza em maio/2026).
 *
 * Servidor faz signInWithPassword via rota saudável (Railway → Supabase
 * usa backbone, não passa pelo CF datacenter do usuário), seta cookies
 * HttpOnly E devolve `authCookies` pra o cliente popular o localStorage
 * do SDK (chave `sb-auth-cookies`), pra que o useAuth continue lendo a
 * sessão sem precisar bater no Supabase.
 *
 * Segurança:
 * - Não expõe a API toda do Supabase (só este endpoint específico)
 * - CSRF: X-Allos-Auth: 1 obrigatório
 * - Rate limit nativo do Supabase ainda se aplica (mesma rota auth/v1/token)
 * - Cookies httponly + secure + samesite=lax via cookieStore
 */

const CSRF_HEADER = "x-allos-auth";

export async function POST(request: NextRequest) {
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !password || email.length > 255 || password.length > 200) {
    return NextResponse.json(
      { error: "Missing or invalid email/password" },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const collectedCookies: { name: string; value: string }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
            // Coleta só cookies de sessão (não code-verifier do PKCE)
            // pra devolver ao cliente popular localStorage do SDK.
            if (value && !name.endsWith("-code-verifier")) {
              collectedCookies.push({ name, value });
            }
          });
        },
      },
    }
  );

  let result;
  try {
    result = await supabase.auth.signInWithPassword({ email, password });
  } catch (err) {
    // Erro de rede entre Railway e Supabase (improvável mas possível)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Network error" },
      {
        status: 502,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      }
    );
  }

  const { data, error } = result;

  if (error || !data.session) {
    const status = (error as { status?: number })?.status ?? 401;
    return NextResponse.json(
      {
        error: error?.message || "Login falhou",
        status,
      },
      {
        status: status >= 500 ? 502 : 401,
        headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
      }
    );
  }

  return NextResponse.json(
    {
      user: { id: data.user?.id, email: data.user?.email },
      authCookies: collectedCookies,
    },
    {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" },
    }
  );
}
