import { createServerClient, serialize } from "@supabase/ssr";
import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

const BASE_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const redirectTo = searchParams.get("redirect") || "/formacao";

  if (code) {
    const cookieStore = await cookies();
    const allCookies: { name: string; value: string; options: Record<string, unknown> }[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              allCookies.push({ name, value, options: options || {} });
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const url = `${BASE_URL}${redirectTo}`;
      const headers = new Headers({ Location: url });
      for (const c of allCookies) {
        const parts = [`${c.name}=${encodeURIComponent(c.value)}`];
        parts.push(`Path=${(c.options.path as string) || "/"}`);
        if (c.options.maxAge) parts.push(`Max-Age=${c.options.maxAge}`);
        if (c.options.domain) parts.push(`Domain=${c.options.domain}`);
        if (c.options.httpOnly) parts.push("HttpOnly");
        if (c.options.secure !== false) parts.push("Secure");
        parts.push(`SameSite=${(c.options.sameSite as string) || "Lax"}`);
        headers.append("Set-Cookie", parts.join("; "));
      }
      return new Response(null, { status: 302, headers });
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: `${BASE_URL}/formacao/auth` },
  });
}
