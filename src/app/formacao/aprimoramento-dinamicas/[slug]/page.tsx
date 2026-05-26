import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EXERCISES, getExerciseBySlug } from "@/lib/aprimoramento-dinamicas";
import ExerciseBlocks from "@/components/aprimoramento/ExerciseBlocks";
import type { Metadata } from "next";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return EXERCISES.map((e) => ({ slug: e.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const ex = getExerciseBySlug(params.slug);
  if (!ex) return { title: "Exercício não encontrado — Allos Formação" };
  return {
    title: `${ex.title} — Aprimoramento de Dinâmicas`,
    description: ex.summary,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({ params }: PageProps) {
  const exercise = getExerciseBySlug(params.slug);
  if (!exercise) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/formacao/auth?next=/formacao/aprimoramento-dinamicas/${params.slug}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = profile?.role === "associado" || profile?.role === "admin";
  if (!allowed) {
    redirect("/formacao");
  }

  const index = EXERCISES.findIndex((e) => e.slug === exercise.slug);
  const prev = index > 0 ? EXERCISES[index - 1] : null;
  const next = index < EXERCISES.length - 1 ? EXERCISES[index + 1] : null;

  return (
    <article className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <nav className="mb-8">
        <Link
          href="/formacao/aprimoramento-dinamicas"
          className="font-dm text-sm text-cream/55 hover:text-accent transition-colors inline-flex items-center gap-1.5"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Aprimoramento de Dinâmicas
        </Link>
      </nav>

      <header className="mb-10 pb-8" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex items-center gap-3 mb-4">
          <div
            className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-fraunces text-sm font-bold"
            style={{
              background: "rgba(200,75,49,0.12)",
              color: "#C84B31",
              border: "1px solid rgba(200,75,49,0.25)",
            }}
          >
            {exercise.number}
          </div>
          <span className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-cream/40">
            Exercício {exercise.number} de {EXERCISES.length}
          </span>
        </div>
        <h1 className="font-fraunces text-3xl md:text-4xl text-cream leading-tight mb-4">
          {exercise.title}
        </h1>
        <p className="font-dm text-base md:text-lg text-cream/65 leading-relaxed">
          {exercise.summary}
        </p>
      </header>

      <ExerciseBlocks blocks={exercise.blocks} />

      <div
        className="mt-14 pt-8 grid grid-cols-2 gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {prev ? (
          <Link
            href={`/formacao/aprimoramento-dinamicas/${prev.slug}`}
            className="group rounded-2xl p-4 transition-all hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mb-1.5">
              ← Anterior
            </p>
            <p className="font-fraunces text-sm text-cream group-hover:text-accent transition-colors line-clamp-2">
              {prev.title}
            </p>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/formacao/aprimoramento-dinamicas/${next.slug}`}
            className="group rounded-2xl p-4 text-right transition-all hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mb-1.5">
              Próximo →
            </p>
            <p className="font-fraunces text-sm text-cream group-hover:text-accent transition-colors line-clamp-2">
              {next.title}
            </p>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </article>
  );
}
