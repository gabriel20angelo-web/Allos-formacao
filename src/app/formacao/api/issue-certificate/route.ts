import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { generateCertificateCode } from "@/lib/utils/certificate";

export const dynamic = "force-dynamic";

/**
 * POST /formacao/api/issue-certificate
 *
 * Emite certificado COM validação server-side. Antes, o client fazia
 * INSERT direto na tabela certificates (RLS exigia só user_id = auth.uid()),
 * então qualquer aluno autenticado podia forjar certificado de qualquer
 * curso via DevTools.
 *
 * Aqui validamos antes do insert:
 * - enrollment.status === "completed"
 * - se exam_enabled, existe exam_attempt.passed === true mais recente
 * - se já há certificado pra este (user, course), retorna o existente
 */
export async function POST(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { course_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const courseId = body.course_id;
  if (!courseId || typeof courseId !== "string") {
    return NextResponse.json({ error: "course_id obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // Já tem certificado?
  const { data: existing } = await sb
    .from("certificates")
    .select("*")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ certificate: existing, reused: true });
  }

  // Curso permite certificado e tem exam_enabled?
  const { data: course } = await sb
    .from("courses")
    .select("id, certificate_enabled, exam_enabled, course_type")
    .eq("id", courseId)
    .single();
  if (!course || !course.certificate_enabled) {
    return NextResponse.json(
      { error: "Curso não emite certificado" },
      { status: 400 },
    );
  }

  // Enrollment marcado como completed
  const { data: enrollment } = await sb
    .from("enrollments")
    .select("status")
    .eq("user_id", user.id)
    .eq("course_id", courseId)
    .single();
  if (!enrollment || enrollment.status !== "completed") {
    return NextResponse.json(
      { error: "Conclua o curso antes de emitir o certificado" },
      { status: 403 },
    );
  }

  // Se tem prova, exigir que tenha passado
  if (course.exam_enabled) {
    const { data: attempt } = await sb
      .from("exam_attempts")
      .select("passed, score, created_at")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .eq("passed", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!attempt) {
      return NextResponse.json(
        { error: "Você precisa ser aprovado na prova antes" },
        { status: 403 },
      );
    }
  }

  // Tenta inserir com até 3 retries pra colisão de code (extremamente raro).
  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateCertificateCode();
    const { data, error } = await sb
      .from("certificates")
      .insert({
        user_id: user.id,
        course_id: courseId,
        certificate_code: code,
        issued_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      return NextResponse.json({ certificate: data, reused: false });
    }
    if (error && !error.message.toLowerCase().includes("unique")) {
      console.error("[issue-certificate]", error);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Não foi possível gerar código único" }, { status: 500 });
}
