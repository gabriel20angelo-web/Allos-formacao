import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildCorsHeaders } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: buildCorsHeaders(req.headers.get("origin"), { methods: "GET, OPTIONS" }) });
}

export async function GET(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"), { methods: "GET, OPTIONS" });
  try {
    const sb = await createServiceRoleClient();
    // Apenas id+nome — telefone nunca volta por aqui.
    const { data, error } = await sb
      .from("certificado_condutores")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome");
    if (error) throw error;
    return NextResponse.json(data || [], { headers: corsHeaders });
  } catch (err) {
    console.error("[meet-condutores]", err);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500, headers: corsHeaders },
    );
  }
}
