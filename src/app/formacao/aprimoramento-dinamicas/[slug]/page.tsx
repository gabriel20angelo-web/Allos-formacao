import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirAlgumCargo } from "@/lib/auth-servidor";
import { extractToc, isCurated } from "@/lib/aprimoramento-dinamicas";
import {
  listAprimoramentoExercicios,
  getAprimoramentoExercicioBySlug,
  getRelatedFrom,
} from "@/lib/queries/aprimoramento-exercicios";
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

// Sem generateStaticParams: rota é dynamic (depende do banco + auth gate)

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const ex = await getAprimoramentoExercicioBySlug(params.slug);
  if (!ex) return { title: "Exercício não encontrado — Allos Formação" };
  return {
    title: `${ex.title} — Aprimoramento de Dinâmicas`,
    description: ex.summary,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function ExerciseDetailPage({ params }: PageProps) {
  const exercise = await getAprimoramentoExercicioBySlug(params.slug);
  if (!exercise) notFound();

  // Quem chegou sem sessão volta para este exercício depois do login, e não
  // para a home.
  await exigirAlgumCargo(
    ["associado", "condutor"],
    `/formacao/aprimoramento-dinamicas/${params.slug}`,
  );

  const allExercises = await listAprimoramentoExercicios();
  const index = allExercises.findIndex((e) => e.slug === exercise.slug);
  const prev = index > 0 ? allExercises[index - 1] : null;
  const next =
    index >= 0 && index < allExercises.length - 1
      ? allExercises[index + 1]
      : null;
  const totalCount = allExercises.length;

  const toc = extractToc(exercise.blocks);
  const cat = CATEGORIES[exercise.category];
  const related = getRelatedFrom(exercise, allExercises, 3);
  const trilhasOf = getTrilhasOf(exercise.slug);
  const curado = isCurated(exercise);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 md:py-12 relative">
      <ReadingProgress color={cat.color} />

      <div className="flex items-center justify-between gap-3 mb-8 print-hide">
        <Breadcrumbs
          items={[
            { label: "Formação", href: "/formacao" },
            {
              label: "Aprimoramento",
              href: "/formacao/associados/aprimoramento",
            },
            {
              label: cat.label,
              href: `/formacao/associados/aprimoramento?cat=${cat.slug}`,
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
            className="absolute -top-12 -left-4 -right-4 md:-left-6 md:-right-6 h-64 -z-10 pointer-events-none rounded-3xl"
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
                Exercício {exercise.number} de {totalCount}
              </span>
              {!curado && (
                <span
                  className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase px-2 py-1 rounded-md"
                  style={{
                    color: "#D4854A",
                    background: "rgba(212,133,74,0.10)",
                    border: "1px solid rgba(212,133,74,0.28)",
                  }}
                  title="Exercício importado da lista bruta, ainda sem revisão de curadoria"
                >
                  Não-curado
                </span>
              )}
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

          {!curado && (
            <div
              className="rounded-2xl p-4 mb-6 print-hide"
              style={{
                background: "rgba(212,133,74,0.06)",
                border: "1px solid rgba(212,133,74,0.20)",
              }}
              role="note"
            >
              <p
                className="font-dm text-[10px] font-semibold tracking-[0.24em] uppercase mb-1.5"
                style={{ color: "#D4854A" }}
              >
                Exercício não-curado
              </p>
              <p className="font-dm text-[13px] leading-relaxed text-cream/65">
                Importado da lista bruta da Allos. O texto preserva o original,
                mas pode ter sequência improvisada, repetições ou dependência
                de contexto que não está aqui. Use como rascunho — confirme
                duração, materiais e adequação antes de conduzir.
              </p>
            </div>
          )}

          <ExerciseBlocks blocks={exercise.blocks} />

          <ExerciseNotes
            slug={exercise.slug}
            color={cat.color}
            tint={cat.tint}
            border={cat.border}
          />

          <RelatedExercises items={related} />

          <div
            className="mt-10 pt-6 md:mt-14 md:pt-8 grid grid-cols-2 gap-3 print-hide"
            style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
          >
            {prev ? (
              <Link
                href={`/formacao/aprimoramento-dinamicas/${prev.slug}`}
                className="group min-w-0 rounded-2xl p-4 transition-all hover:bg-white/[0.04]"
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
                className="group min-w-0 rounded-2xl p-4 text-right transition-all hover:bg-white/[0.04]"
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
        <aside className="hidden md:block min-w-0">
          <ExerciseToc items={toc} color={cat.color} tint={cat.tint} />
        </aside>
      </div>
    </div>
  );
}
