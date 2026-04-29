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

    // Fisher-Yates shuffle determinístico por (question_id, user_id) — duas
    // vezes a mesma sessão tem a mesma ordem (não confunde quem está
    // respondendo), mas alunos diferentes veem ordens diferentes.
    const seededShuffle = <T,>(arr: T[], seed: string): T[] => {
      let h = 2166136261;
      for (let i = 0; i < seed.length; i++) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 16777619) >>> 0;
      }
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
        const j = h % (i + 1);
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    };

    const questions = (data || []).map((q: { id: string; question_text: string; options: ExamOptionRaw[] | null; position: number }) => ({
      id: q.id,
      question_text: q.question_text,
      position: q.position,
      options: Array.isArray(q.options)
        ? seededShuffle(
            q.options.map((o) => ({ id: o.id, text: o.text })),
            `${user.id}:${q.id}`,
          )
        : [],
    }));

    const sanitized = seededShuffle(questions, `${user.id}:${courseId}`);
    return NextResponse.json(sanitized);
  } catch (err) {
    console.error("[exam-questions]", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
