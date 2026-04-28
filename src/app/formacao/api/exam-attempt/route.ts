import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ExamAnswerInput {
  question_id: string;
  selected_option_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const userClient = await createServerSupabaseClient();
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const courseId: string | undefined = body?.course_id;
    const answers: ExamAnswerInput[] | undefined = body?.answers;

    if (!courseId || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json(
        { error: "Parâmetros inválidos" },
        { status: 400 }
      );
    }

    const sb = await createServiceRoleClient();

    const { data: course } = await sb
      .from("courses")
      .select("id, exam_enabled, exam_passing_score")
      .eq("id", courseId)
      .single();
    if (!course || !course.exam_enabled) {
      return NextResponse.json(
        { error: "Curso ou prova indisponíveis" },
        { status: 400 }
      );
    }

    const { data: enrollment } = await sb
      .from("enrollments")
      .select("status")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .single();
    if (!enrollment || enrollment.status !== "completed") {
      return NextResponse.json(
        { error: "Conclua todas as aulas antes de fazer a prova" },
        { status: 403 }
      );
    }

    const { data: questions } = await sb
      .from("exam_questions")
      .select("id, options:exam_options(id, is_correct)")
      .eq("course_id", courseId);
    if (!questions || questions.length === 0) {
      return NextResponse.json(
        { error: "Prova sem questões" },
        { status: 400 }
      );
    }

    const answerMap = new Map(answers.map((a) => [a.question_id, a.selected_option_id]));

    let correct = 0;
    const examAnswers = questions.map((q: { id: string; options: { id: string; is_correct: boolean }[] }) => {
      const selectedId = answerMap.get(q.id);
      const correctOption = q.options?.find((o) => o.is_correct);
      const isCorrect = !!selectedId && selectedId === correctOption?.id;
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        selected_option_id: selectedId ?? null,
        correct: isCorrect,
      };
    });

    const total = questions.length;
    const score = Math.round((correct / total) * 100);
    const passingScore = course.exam_passing_score ?? 70;
    const passed = score >= passingScore;

    await sb.from("exam_attempts").insert({
      user_id: user.id,
      course_id: courseId,
      score,
      passed,
      answers: examAnswers,
    });

    return NextResponse.json({ score, passed, total, correct });
  } catch (err) {
    console.error("[exam-attempt]", err);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
