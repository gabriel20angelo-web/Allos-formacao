// Tolerância de atraso.
//
// Mora em formacao_cronograma, junto de duracao_minutos, porque é regra do
// encontro e não do módulo do Meet. Vale para a leitura de todo o histórico,
// então mudar aqui muda os números de trás também.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();
  const { data } = await sb
    .from("formacao_cronograma")
    .select("id, duracao_minutos, tolerancia_atraso_min")
    .maybeSingle();

  return NextResponse.json({
    duracao_minutos: data?.duracao_minutos ?? 90,
    tolerancia_atraso_min: data?.tolerancia_atraso_min ?? 7,
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { tolerancia_atraso_min?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const valor = Number(body.tolerancia_atraso_min);
  if (!Number.isFinite(valor) || valor < 0 || valor > 60) {
    return NextResponse.json(
      { error: "Tolerância deve ser um número entre 0 e 60 minutos." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  // A tabela é singleton, mas pode nem ter linha ainda em base nova.
  const { data: existente } = await sb
    .from("formacao_cronograma")
    .select("id")
    .maybeSingle();

  const { error } = existente
    ? await sb
        .from("formacao_cronograma")
        .update({ tolerancia_atraso_min: Math.round(valor) })
        .eq("id", existente.id)
    : await sb
        .from("formacao_cronograma")
        .insert({ tolerancia_atraso_min: Math.round(valor) });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, tolerancia_atraso_min: Math.round(valor) });
}
