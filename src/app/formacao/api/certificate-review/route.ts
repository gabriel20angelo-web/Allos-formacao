// Manifestação do titular sobre um certificado retido (Termos de Uso, 8.5).
//
// GET  → o caso da pessoa naquele curso, para a tela mostrar o andamento
// POST → grava a explicação e devolve o caso para a administração
//
// A pessoa nunca muda o próprio status para "aprovado": ela só sai de "retido"
// para "explicado". Quem decide é o painel.

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE_EXPLICACAO = 4000;

export async function GET(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get("course_id");
  if (!courseId) {
    return NextResponse.json({ error: "course_id obrigatório" }, { status: 400 });
  }

  const { data } = await userClient
    .from("certificate_reviews")
    .select(
      "id, status, motivo, segundos_registrados, minutos_conteudo, explicacao, explicado_em, resposta, respondido_em, created_at"
    )
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  return NextResponse.json({ review: data ?? null });
}

export async function POST(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { course_id?: string; explicacao?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const courseId = body.course_id;
  const explicacao = (body.explicacao || "").trim();

  if (!courseId || typeof courseId !== "string") {
    return NextResponse.json({ error: "course_id obrigatório" }, { status: 400 });
  }
  if (explicacao.length < 10) {
    return NextResponse.json(
      { error: "Descreva o que aconteceu com um pouco mais de detalhe." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  const { data: review } = await sb
    .from("certificate_reviews")
    .select("id, status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();

  if (!review) {
    return NextResponse.json(
      { error: "Não há verificação aberta para este curso." },
      { status: 404 }
    );
  }
  if (review.status === "aprovado") {
    return NextResponse.json(
      { error: "Este caso já foi liberado. Emita o certificado normalmente." },
      { status: 409 }
    );
  }

  const { data: atualizado, error } = await sb
    .from("certificate_reviews")
    .update({
      explicacao: explicacao.slice(0, LIMITE_EXPLICACAO),
      explicado_em: new Date().toISOString(),
      status: "explicado",
      updated_at: new Date().toISOString(),
    })
    .eq("id", review.id)
    .select(
      "id, status, motivo, explicacao, explicado_em, resposta, respondido_em"
    )
    .single();

  if (error) {
    console.error("[certificate-review]", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ review: atualizado });
}
