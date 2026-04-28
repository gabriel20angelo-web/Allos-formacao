import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

export async function POST() {
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
