import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * GET /formacao/api/exam-questions?course_id=...
 *
 * Devolve as questões da prova SEM o campo `is_correct` em options
 * (que vazaria as respostas pro client). Score é calculado server-side
 * em /formacao/api/exam-attempt.
 */
export async function GET(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const courseId = req.nextUrl.searchParams.get("course_id");
  if (!courseId) {
    return NextResponse.json({ error: "course_id obrigatório" }, { status: 400 });
  }

  try {
    const sb = await createServiceRoleClient();
    const { data, error } = await sb
      .from("exam_questions")
      .select("id, question_text, options, position")
      .eq("course_id", courseId)
      .order("position");

    if (error) throw error;

    interface ExamOptionRaw {
      id: string;
      text: string;
      is_correct?: boolean;
    }

    const sanitized = (data || []).map((q: { id: string; question_text: string; options: ExamOptionRaw[] | null; position: number }) => ({
      id: q.id,
      question_text: q.question_text,
      position: q.position,
      options: Array.isArray(q.options)
        ? q.options.map((o) => ({ id: o.id, text: o.text }))
        : [],
    }));

    return NextResponse.json(sanitized);
  } catch (err) {
    console.error("[exam-questions]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
