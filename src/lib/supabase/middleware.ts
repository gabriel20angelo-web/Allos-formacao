import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const baseUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";

  // Protected routes that require authentication
  const protectedPaths = ["/formacao/admin", "/formacao/curso"];
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p));

  // If accessing a protected route without auth, redirect to login
  if (isProtected && !user) {
    const redirectUrl = new URL(`/formacao/auth?redirect=${encodeURIComponent(pathname)}`, baseUrl);
    const redirectResponse = NextResponse.redirect(redirectUrl);
    // Preserve any session cookies that were refreshed during this request
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
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
      const redirectUrl = new URL("/formacao", baseUrl);
      const redirectResponse = NextResponse.redirect(redirectUrl);
      // Preserve any session cookies that were refreshed during this request
      supabaseResponse.cookies.getAll().forEach((cookie) => {
        redirectResponse.cookies.set(cookie.name, cookie.value);
      });
      return redirectResponse;
    }
  }

  return supabaseResponse;
}
