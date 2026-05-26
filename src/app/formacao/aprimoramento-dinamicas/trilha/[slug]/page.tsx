import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  TRILHAS,
  getTrilhaBySlug,
  resolveTrilhaExercises,
} from "@/lib/aprimoramento-trilhas";
import {
  CATEGORIES,
  PESSOAS_LABEL,
  formatDuracao,
} from "@/lib/aprimoramento-categories";
import Breadcrumbs from "@/components/aprimoramento/Breadcrumbs";
import TrilhaProgress from "@/components/aprimoramento/TrilhaProgress";
import { ChevronRight, Clock, Users } from "lucide-react";
import type { Metadata } from "next";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return TRILHAS.map((t) => ({ slug: t.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const t = getTrilhaBySlug(params.slug);
  if (!t) return { title: "Trilha não encontrada — Allos Formação" };
  return {
    title: `${t.title} — Aprimoramento de Dinâmicas`,
    description: t.descricao,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function TrilhaPage({ params }: PageProps) {
  const trilha = getTrilhaBySlug(params.slug);
  if (!trilha) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/formacao/auth?next=/formacao/aprimoramento-dinamicas/trilha/${params.slug}`,
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

  const exercises = resolveTrilhaExercises(trilha);
  const trilhaIdx = TRILHAS.findIndex((t) => t.slug === trilha.slug);
  const prev = trilhaIdx > 0 ? TRILHAS[trilhaIdx - 1] : null;
  const next = trilhaIdx < TRILHAS.length - 1 ? TRILHAS[trilhaIdx + 1] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12 relative">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Formação", href: "/formacao" },
            {
              label: "Aprimoramento",
              href: "/formacao/aprimoramento-dinamicas",
            },
            { label: trilha.title },
          ]}
        />
      </div>

      {/* Hero da trilha */}
      <header className="relative mb-10 md:mb-12">
        <div
          className="absolute -top-6 -left-4 -right-4 h-72 -z-10 pointer-events-none rounded-3xl"
          aria-hidden="true"
          style={{
            background: `radial-gradient(ellipse 70% 70% at 30% 0%, ${trilha.tint} 0%, transparent 70%)`,
          }}
        />
        <p
          className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase mb-3"
          style={{ color: trilha.color }}
        >
          {trilha.pretitle}
        </p>
        <h1 className="font-fraunces text-3xl md:text-5xl text-cream leading-tight mb-4">
          {trilha.title}
        </h1>
        <p className="font-dm text-base md:text-lg text-cream/65 leading-relaxed max-w-3xl mb-2">
          {trilha.descricao}
        </p>
        <p className="font-dm text-sm md:text-base text-cream/50 leading-relaxed max-w-3xl">
          {trilha.longDescricao}
        </p>

        <div className="mt-6">
          <TrilhaProgress
            exerciseSlugs={trilha.exercise_slugs}
            color={trilha.color}
            tint={trilha.tint}
            border={trilha.border}
          />
        </div>
      </header>

      {/* Lista ordenada */}
      <ol className="space-y-3 mb-12">
        {exercises.map((ex, idx) => {
          const cat = CATEGORIES[ex.category];
          return (
            <li key={ex.slug}>
              <Link
                href={`/formacao/aprimoramento-dinamicas/${ex.slug}`}
                className="group flex items-start gap-4 rounded-2xl p-4 md:p-5 transition-all duration-200 hover:translate-y-[-1px]"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Step badge (cor da trilha) */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-fraunces text-base font-bold mt-0.5"
                  style={{
                    background: trilha.tint,
                    color: trilha.color,
                    border: `1px solid ${trilha.border}`,
                  }}
                  aria-hidden="true"
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="font-dm text-[9px] font-semibold tracking-[0.24em] uppercase px-1.5 py-0.5 rounded"
                      style={{
                        color: cat.color,
                        background: cat.tint,
                        border: `1px solid ${cat.border}`,
                      }}
                    >
                      {cat.label}
                    </span>
                    <span className="font-dm text-[10px] text-cream/35">
                      Exercício {ex.number} do acervo
                    </span>
                  </div>
                  <h3 className="font-fraunces text-base md:text-lg text-cream leading-snug mb-1 group-hover:text-accent transition-colors">
                    {ex.title}
                  </h3>
                  <p className="font-dm text-[13px] text-cream/55 leading-relaxed line-clamp-2">
                    {ex.summary}
                  </p>
                  <div className="flex items-center gap-3 font-dm text-[11px] text-cream/40 mt-2">
                    <span className="inline-flex items-center gap-1">
                      <Clock width={11} height={11} aria-hidden="true" />
                      {formatDuracao(ex.duracaoMin)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users width={11} height={11} aria-hidden="true" />
                      {PESSOAS_LABEL[ex.pessoas]}
                    </span>
                  </div>
                </div>

                <ChevronRight
                  className="flex-shrink-0 text-cream/25 group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-2"
                  width={18}
                  height={18}
                  aria-hidden="true"
                />
              </Link>
            </li>
          );
        })}
      </ol>

      {/* Nav entre trilhas */}
      <div
        className="mt-14 pt-8 grid grid-cols-2 gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {prev ? (
          <Link
            href={`/formacao/aprimoramento-dinamicas/trilha/${prev.slug}`}
            className="group rounded-2xl p-4 transition-all hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mb-1.5">
              ← Trilha anterior
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
            href={`/formacao/aprimoramento-dinamicas/trilha/${next.slug}`}
            className="group rounded-2xl p-4 text-right transition-all hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mb-1.5">
              Próxima trilha →
            </p>
            <p className="font-fraunces text-sm text-cream group-hover:text-accent transition-colors line-clamp-2">
              {next.title}
            </p>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
