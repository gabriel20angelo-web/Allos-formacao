import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  EXERCISES,
  getExerciseBySlug,
  extractToc,
  getRelated,
} from "@/lib/aprimoramento-dinamicas";
import { CATEGORIES } from "@/lib/aprimoramento-categories";
import ExerciseBlocks from "@/components/aprimoramento/ExerciseBlocks";
import ExerciseQuickFacts from "@/components/aprimoramento/ExerciseQuickFacts";
import ExerciseToc from "@/components/aprimoramento/ExerciseToc";
import PrintButton from "@/components/aprimoramento/PrintButton";
import RelatedExercises from "@/components/aprimoramento/RelatedExercises";
import Breadcrumbs from "@/components/aprimoramento/Breadcrumbs";
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
    redirect(
      `/formacao/auth?next=/formacao/aprimoramento-dinamicas/${params.slug}`,
    );
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

  const toc = extractToc(exercise.blocks);
  const cat = CATEGORIES[exercise.category];
  const related = getRelated(exercise, 3);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="flex items-center justify-between gap-3 mb-8 print-hide">
        <Breadcrumbs
          items={[
            { label: "Formação", href: "/formacao" },
            {
              label: "Aprimoramento",
              href: "/formacao/aprimoramento-dinamicas",
            },
            {
              label: cat.label,
              href: `/formacao/aprimoramento-dinamicas?cat=${cat.slug}`,
            },
            { label: exercise.title },
          ]}
        />
        <PrintButton />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10 lg:gap-12">
        {/* Coluna principal */}
        <article className="min-w-0 max-w-3xl">
          <header
            className="mb-8 pb-8"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-fraunces text-sm font-bold"
                style={{
                  background: cat.tint,
                  color: cat.color,
                  border: `1px solid ${cat.border}`,
                }}
                aria-hidden="true"
              >
                {exercise.number}
              </div>
              <span
                className="font-dm text-[10px] font-semibold tracking-[0.28em] uppercase px-2.5 py-1 rounded-md"
                style={{
                  color: cat.color,
                  background: cat.tint,
                  border: `1px solid ${cat.border}`,
                }}
              >
                {cat.label}
              </span>
              <span className="font-dm text-[11px] text-cream/35">
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

          <ExerciseQuickFacts exercise={exercise} />
          <ExerciseBlocks blocks={exercise.blocks} />

          <RelatedExercises items={related} />

          <div
            className="mt-14 pt-8 grid grid-cols-2 gap-3 print-hide"
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

        {/* TOC lateral (sticky em desktop, oculto em mobile) */}
        <aside className="min-w-0">
          <ExerciseToc items={toc} />
        </aside>
      </div>
    </div>
  );
}
