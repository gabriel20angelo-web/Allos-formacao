// Registro do aceite dos Termos de Uso (cláusula 3).
//
// Chamado uma vez por sessão pelo componente AceiteTermos. O IP vem dos
// cabeçalhos do proxy (Railway/Cloudflare); guardamos o primeiro da cadeia,
// que é o do cliente.

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { VERSAO_TERMOS } from "@/lib/legal/versoes";

export const dynamic = "force-dynamic";



function ipDoCliente(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export async function POST(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sb = await createServiceRoleClient();

  const { data: existente } = await sb
    .from("termos_aceites")
    .select("id, aceito_em")
    .eq("user_id", user.id)
    .eq("documento", "termos-de-uso")
    .eq("versao", VERSAO_TERMOS)
    .maybeSingle();

  if (existente) {
    return NextResponse.json({ ja_registrado: true, aceite: existente });
  }

  const { data, error } = await sb
    .from("termos_aceites")
    .insert({
      user_id: user.id,
      versao: VERSAO_TERMOS,
      documento: "termos-de-uso",
      ip: ipDoCliente(req),
      user_agent: req.headers.get("user-agent")?.slice(0, 500) ?? null,
    })
    .select("id, aceito_em")
    .single();

  if (error) {
    // Corrida entre duas abas cai na constraint única: não é erro para o usuário.
    if (error.code === "23505") {
      return NextResponse.json({ ja_registrado: true });
    }
    console.error("[aceite-termos]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ja_registrado: false, aceite: data });
}
