import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const CSRF_HEADER = "x-allos-auth";

export async function POST(request: NextRequest) {
  // CSRF guard: form submit cross-origin não consegue setar custom headers.
  if (request.headers.get(CSRF_HEADER) !== "1") {
    return NextResponse.json({ error: "CSRF check failed" }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  // scope: 'global' invalida o refresh token do usuário em todas as sessões
  await supabase.auth.signOut({ scope: "global" });

  // Limpa qualquer cookie sb-* residual (inclusive HttpOnly, que JS não alcança).
  const cookieStore = await cookies();
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.startsWith("sb-")) {
      cookieStore.set(cookie.name, "", {
        path: "/",
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
        secure: true,
      });
    }
  }

  return NextResponse.json({ success: true });
}
