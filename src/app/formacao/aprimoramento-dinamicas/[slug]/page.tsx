import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  EXERCISES,
  getExerciseBySlug,
  extractToc,
  getRelated,
} from "@/lib/aprimoramento-dinamicas";
import { getTrilhasOf } from "@/lib/aprimoramento-trilhas";
import { CATEGORIES } from "@/lib/aprimoramento-categories";
import ExerciseBlocks from "@/components/aprimoramento/ExerciseBlocks";
import ExerciseQuickFacts from "@/components/aprimoramento/ExerciseQuickFacts";
import ExerciseToc from "@/components/aprimoramento/ExerciseToc";
import PrintButton from "@/components/aprimoramento/PrintButton";
import RelatedExercises from "@/components/aprimoramento/RelatedExercises";
import Breadcrumbs from "@/components/aprimoramento/Breadcrumbs";
import ReadingProgress from "@/components/aprimoramento/ReadingProgress";
import ExerciseToolbar from "@/components/aprimoramento/ExerciseToolbar";
import ExerciseNotes from "@/components/aprimoramento/ExerciseNotes";
import FacilitatorButton from "@/components/aprimoramento/FacilitatorButton";
import ReadingPrefs from "@/components/aprimoramento/ReadingPrefs";
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
  const trilhasOf = getTrilhasOf(exercise.slug);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 relative">
      <ReadingProgress color={cat.color} />

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
        <div className="flex items-center gap-2">
          <ReadingPrefs />
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-10 lg:gap-12">
        {/* Coluna principal */}
        <article
          className="min-w-0 relative"
          style={{ maxWidth: "var(--ap-reading-mw, 48rem)" }}
        >
          {/* Gradient header — cor da categoria desbotando pra transparente */}
          <div
            className="absolute -top-12 -left-6 -right-6 h-64 -z-10 pointer-events-none rounded-3xl"
            aria-hidden="true"
            style={{
              background: `radial-gradient(ellipse 80% 70% at 30% 0%, ${cat.tint} 0%, transparent 70%)`,
            }}
          />
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
              <Link
                href={`/formacao/aprimoramento-dinamicas/categoria/${cat.slug}`}
                className="font-dm text-[10px] font-semibold tracking-[0.28em] uppercase px-2.5 py-1 rounded-md transition-opacity hover:opacity-80"
                style={{
                  color: cat.color,
                  background: cat.tint,
                  border: `1px solid ${cat.border}`,
                }}
              >
                {cat.label}
              </Link>
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

            {trilhasOf.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <span className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/35">
                  Etapa de
                </span>
                {trilhasOf.map(({ trilha, step, total }) => (
                  <Link
                    key={trilha.slug}
                    href={`/formacao/aprimoramento-dinamicas/trilha/${trilha.slug}`}
                    className="group font-dm text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all hover:translate-y-[-1px]"
                    style={{
                      color: trilha.color,
                      background: trilha.tint,
                      border: `1px solid ${trilha.border}`,
                    }}
                    title={trilha.descricao}
                  >
                    <span
                      className="inline-flex items-center justify-center w-4 h-4 rounded-full font-fraunces text-[10px] font-bold"
                      style={{
                        background: "rgba(0,0,0,0.18)",
                        color: trilha.color,
                      }}
                      aria-hidden="true"
                    >
                      {step}
                    </span>
                    {trilha.title}
                    <span className="text-cream/35 font-dm text-[10px]">
                      {step}/{total}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </header>

          <ExerciseToolbar
            slug={exercise.slug}
            color={cat.color}
            tint={cat.tint}
            border={cat.border}
          />

          <div className="mb-8 -mt-2 print-hide">
            <FacilitatorButton
              exercise={exercise}
              color={cat.color}
              tint={cat.tint}
              border={cat.border}
            />
          </div>

          <ExerciseQuickFacts exercise={exercise} />
          <ExerciseBlocks blocks={exercise.blocks} />

          <ExerciseNotes
            slug={exercise.slug}
            color={cat.color}
            tint={cat.tint}
            border={cat.border}
          />

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
          <ExerciseToc items={toc} color={cat.color} tint={cat.tint} />
        </aside>
      </div>
    </div>
  );
}
