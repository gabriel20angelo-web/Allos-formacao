import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const BASE_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

function hardRedirect(path: string, cookieSource?: NextResponse) {
  const headers = new Headers({ Location: `${BASE_URL}${path}` });
  if (cookieSource) {
    for (const cookie of cookieSource.cookies.getAll()) {
      headers.append("Set-Cookie", `${cookie.name}=${cookie.value}; Path=/; HttpOnly; Secure; SameSite=Lax`);
    }
  }
  return new Response(null, { status: 307, headers });
}

function clearAuthRedirect(request: NextRequest, redirectPath: string) {
  const headers = new Headers({ Location: `${BASE_URL}${redirectPath}` });
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      headers.append(
        "Set-Cookie",
        `${cookie.name}=; Path=/; Max-Age=0; Secure; SameSite=Lax`
      );
    }
  }
  return new Response(null, { status: 307, headers });
}

// Public paths that don't need auth/profile checks. Skipping the middleware's
// supabase.auth.getUser() call here saves one Supabase round-trip (~200-500ms
// from Singapore region) per request to these endpoints.
const PUBLIC_PATH_PREFIXES = [
  "/formacao/api/home-data",
  "/formacao/api/ranking",
  "/formacao/auth/callback",
  "/formacao/auth/set-session",
  "/formacao/auth/sync-cookies",
  "/formacao/auth/forgot-password",
  "/formacao/auth/reset-password",
];

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATH_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) {
    // Pass through — let the route handler set its own Cache-Control
    // so CDN caching (s-maxage on home-data and ranking) actually works.
    return NextResponse.next({ request });
  }

  try {
    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    let user: { id: string } | null = null;
    try {
      const result = await supabase.auth.getUser();
      user = result.data.user;
    } catch (err) {
      // Corrupted/truncated sb-* cookies make getUser throw and propagate as
      // a raw 500 ("Internal Server Error") because middleware errors bypass
      // error.tsx. Treat as unauthenticated and clear the bad cookies so the
      // next request starts from a clean slate.
      console.error("[MIDDLEWARE] auth.getUser threw, clearing session:", err);
      const target = pathname.startsWith("/formacao/admin") || pathname.startsWith("/formacao/curso")
        ? `/formacao/auth?redirect=${encodeURIComponent(pathname)}`
        : pathname;
      return clearAuthRedirect(request, target);
    }

    // Protected routes that require authentication
    const protectedPaths = ["/formacao/admin", "/formacao/curso"];
    const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

    // If accessing a protected route without auth, redirect to login
    if (isProtected && !user) {
      return hardRedirect(`/formacao/auth?redirect=${encodeURIComponent(pathname)}`, supabaseResponse);
    }

    // Admin routes — check role (admin or instructor required)
    if (pathname.startsWith("/formacao/admin") && user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const allowedRoles = ["admin", "instructor"];
      if (!profile?.role || !allowedRoles.includes(profile.role)) {
        return hardRedirect("/formacao", supabaseResponse);
      }
    }

    // Prevent CDN (Cloudflare/Railway) from caching HTML responses
    supabaseResponse.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    supabaseResponse.headers.set("Pragma", "no-cache");

    return supabaseResponse;
  } catch (err) {
    // Last-resort safety net so a thrown middleware never reaches the client
    // as a bare "Internal Server Error".
    console.error("[MIDDLEWARE] unexpected throw, clearing session:", err);
    return clearAuthRedirect(request, "/formacao/auth");
  }
}
