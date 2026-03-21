"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { Award, RotateCcw, CheckCircle, XCircle } from "lucide-react";
import type { ExamQuestion, ExamOption } from "@/types";

export default function ProvaPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [courseId, setCourseId] = useState<string | null>(null);
  const [passingScore, setPassingScore] = useState(70);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    score: number;
    passed: boolean;
    total: number;
    correct: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function fetch() {
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: course } = await createClient()
        .from("courses")
        .select("id, exam_enabled, exam_passing_score, certificate_enabled, course_type")
        .eq("slug", slug)
        .single();

      if (!course || !course.exam_enabled || course.course_type === "sync") {
        router.push(`/formacao/curso/${slug}`);
        return;
      }

      setCourseId(course.id);
      setPassingScore(course.exam_passing_score);

      const { data: enrollment } = await createClient()
        .from("enrollments")
        .select("status")
        .eq("course_id", course.id)
        .eq("user_id", user.id)
        .single();

      if (!enrollment || enrollment.status !== "completed") {
        toast.error("Complete todas as aulas antes de fazer a prova.");
        router.push(`/formacao/curso/${slug}`);
        return;
      }

      const { data: questionsData } = await createClient()
        .from("exam_questions")
        .select("*")
        .eq("course_id", course.id)
        .order("position");

      if (questionsData) setQuestions(questionsData);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [slug, user?.id, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !courseId) return;

    const unanswered = questions.filter((q) => !answers[q.id]);
    if (unanswered.length > 0) {
      toast.error(`Responda todas as perguntas. Faltam ${unanswered.length}.`);
      return;
    }

    setSubmitting(true);

    let correct = 0;
    const examAnswers = questions.map((q) => {
      const selectedId = answers[q.id];
      const correctOption = q.options.find((o: ExamOption) => o.is_correct);
      const isCorrect = selectedId === correctOption?.id;
      if (isCorrect) correct++;
      return {
        question_id: q.id,
        selected_option_id: selectedId,
        correct: isCorrect,
      };
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score >= passingScore;

    await createClient().from("exam_attempts").insert({
      user_id: user.id,
      course_id: courseId,
      score,
      passed,
      answers: examAnswers,
    });

    setResult({ score, passed, total: questions.length, correct });
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <Skeleton className="h-10 w-1/2" />
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  // Result screen
  if (result) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{
            background: result.passed
              ? "rgba(46,158,143,0.1)"
              : "rgba(200,75,49,0.1)",
          }}
        >
          {result.passed ? (
            <CheckCircle className="h-10 w-10 text-teal" />
          ) : (
            <XCircle className="h-10 w-10 text-accent" />
          )}
        </div>

        <h1 className="font-fraunces font-bold text-3xl text-cream mb-3 tracking-tight">
          {result.passed ? "Parabéns! Você foi aprovado!" : "Não foi desta vez"}
        </h1>

        <p className="text-lg text-cream/50 mb-2">
          Você acertou{" "}
          <span className="font-bold text-cream">
            {result.correct} de {result.total}
          </span>{" "}
          — {result.score}%
        </p>

        {!result.passed && (
          <p className="text-sm text-cream/40 mb-8">
            A nota mínima é {passingScore}%. Tente novamente!
          </p>
        )}

        <div className="flex flex-wrap justify-center gap-3 mt-8">
          {result.passed ? (
            <Button
              onClick={() =>
                router.push(`/formacao/curso/${slug}/certificado`)
              }
            >
              <Award className="h-4 w-4" />
              Emitir certificado
            </Button>
          ) : (
            <Button
              onClick={() => {
                setResult(null);
                setAnswers({});
              }}
            >
              <RotateCcw className="h-4 w-4" />
              Refazer prova
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => router.push(`/formacao/curso/${slug}`)}
          >
            Voltar ao curso
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <h1 className="font-fraunces font-bold text-3xl text-cream mb-2 tracking-tight">
        Prova final
      </h1>
      <p className="text-cream/40 mb-8">
        Responda todas as questões. Nota mínima: {passingScore}%.
      </p>

      <form onSubmit={handleSubmit} className="space-y-8">
        {questions.map((q, index) => (
          <div
            key={q.id}
            className="rounded-[16px] p-6"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <p className="text-sm font-medium text-cream/40 mb-1">
              Questão {index + 1} de {questions.length}
            </p>
            <p className="font-medium text-cream mb-4">
              {q.question_text}
            </p>

            <div className="space-y-2">
              {q.options.map((option: ExamOption) => (
                <label
                  key={option.id}
                  className="flex items-center gap-3 p-3 rounded-[10px] cursor-pointer transition-all duration-200"
                  style={{
                    border: `1.5px solid ${
                      answers[q.id] === option.id
                        ? "#C84B31"
                        : "rgba(255,255,255,0.08)"
                    }`,
                    background:
                      answers[q.id] === option.id
                        ? "rgba(200,75,49,0.08)"
                        : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={option.id}
                    checked={answers[q.id] === option.id}
                    onChange={() =>
                      setAnswers((prev) => ({ ...prev, [q.id]: option.id }))
                    }
                    className="w-4 h-4 accent-[#C84B31]"
                  />
                  <span className="text-sm text-cream/70">{option.text}</span>
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex justify-end pt-4">
          <Button type="submit" size="lg" loading={submitting}>
            Enviar prova
          </Button>
        </div>
      </form>
    </div>
  );
}
