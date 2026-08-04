// Devolutiva da administração sobre um certificado retido (Termos de Uso, 8.5).
//
// Aprovar emite o certificado na hora — se a pessoa já esperou a análise, não
// faz sentido pedir que volte na tela e clique de novo. Recusar registra o
// motivo, que é o que a pessoa vê como resposta.

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { temCargo } from "@/lib/cargos";
import { generateCertificateCode } from "@/lib/utils/certificate";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: perfil } = await userClient
    .from("profiles")
    .select("role, cargos")
    .eq("id", user.id)
    .single();
  // Pelos cargos: quem administra pode ter "admin" entre os extras, e a
  // comparação crua o barrava aqui sem dizer por quê.
  if (!temCargo(perfil, "admin")) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let body: { review_id?: string; decisao?: string; resposta?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { review_id: reviewId, decisao } = body;
  const resposta = (body.resposta || "").trim();

  if (!reviewId || (decisao !== "aprovado" && decisao !== "recusado")) {
    return NextResponse.json(
      { error: "review_id e decisão (aprovado|recusado) são obrigatórios" },
      { status: 400 }
    );
  }
  if (decisao === "recusado" && resposta.length < 10) {
    return NextResponse.json(
      { error: "Explique o motivo da recusa: é o que a pessoa vai ler." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  const { data: review } = await sb
    .from("certificate_reviews")
    .select("id, user_id, course_id, status")
    .eq("id", reviewId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json({ error: "Caso não encontrado" }, { status: 404 });
  }

  const { error: updErr } = await sb
    .from("certificate_reviews")
    .update({
      status: decisao,
      resposta: resposta || null,
      respondido_em: new Date().toISOString(),
      respondido_por: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", reviewId);

  if (updErr) {
    console.error("[certificate-review/decide]", updErr);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  if (decisao !== "aprovado") {
    return NextResponse.json({ ok: true, certificate: null });
  }

  // Aprovado: emite agora, reaproveitando se já existir.
  const { data: existente } = await sb
    .from("certificates")
    .select("*")
    .eq("user_id", review.user_id)
    .eq("course_id", review.course_id)
    .maybeSingle();
  if (existente) {
    return NextResponse.json({ ok: true, certificate: existente });
  }

  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const { data, error } = await sb
      .from("certificates")
      .insert({
        user_id: review.user_id,
        course_id: review.course_id,
        certificate_code: generateCertificateCode(),
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (!error && data) {
      return NextResponse.json({ ok: true, certificate: data });
    }
    if (error && !error.message.toLowerCase().includes("unique")) {
      console.error("[certificate-review/decide]", error);
      return NextResponse.json(
        { error: "Caso liberado, mas houve erro ao emitir o certificado." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Não foi possível gerar código único" },
    { status: 500 }
  );
}
