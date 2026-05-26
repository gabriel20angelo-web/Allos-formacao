import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isCurated, type Exercise } from "@/lib/aprimoramento-dinamicas";
import { listAprimoramentoExercicios } from "@/lib/queries/aprimoramento-exercicios";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/aprimoramento-categories";
import ExerciseCatalog from "@/components/aprimoramento/ExerciseCatalog";
import Breadcrumbs from "@/components/aprimoramento/Breadcrumbs";
import { TRILHAS } from "@/lib/aprimoramento-trilhas";
import {
  Sparkles,
  Drama,
  BrainCog,
  MessagesSquare,
  Star,
  ChevronRight,
  Compass,
} from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aprimoramento de Dinâmicas — Allos Formação",
  description:
    "Lista curada de exercícios e dinâmicas para grupos de aprimoramento clínico. Acesso restrito a associados.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Exercício do dia — rotação determinística por dia do ano.
function pickFeatured(all: Exercise[]) {
  if (all.length === 0) return null;
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return all[dayOfYear % all.length];
}

function computeStats(all: Exercise[]) {
  const total = all.length;
  const cats = new Set(all.map((e) => e.category)).size;
  const curados = all.filter((e) => isCurated(e)).length;
  return { total, cats, curados };
}

export default async function AprimoramentoDinamicasPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/formacao/auth?next=/formacao/aprimoramento-dinamicas");
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

  const exercises = await listAprimoramentoExercicios();
  const featured = pickFeatured(exercises);
  const stats = computeStats(exercises);
  // featured pode ser null se banco vazio — UI lida com isso
  const featuredCat = featured ? CATEGORIES[featured.category] : null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Formação", href: "/formacao" },
            { label: "Aprimoramento de Dinâmicas" },
          ]}
        />
      </div>

      {/* ─── Hero ───────────────────────────────────────────────────────── */}
      <div className="relative mb-10 md:mb-12">
        {/* Pattern radial de fundo (sutil) */}
        <div
          className="absolute inset-0 -z-10 pointer-events-none rounded-3xl"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 15% 0%, rgba(200,75,49,0.08), transparent 60%), radial-gradient(ellipse 60% 50% at 90% 100%, rgba(46,158,143,0.06), transparent 60%)",
          }}
        />

        <header className="mb-8 md:mb-10 pt-2 md:pt-4">
          <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-3">
            Restrito a associados
          </p>
          <h1 className="font-fraunces text-3xl md:text-5xl text-cream leading-tight mb-4">
            Aprimoramento de Dinâmicas
          </h1>
          <p className="font-dm text-base md:text-lg text-cream/65 leading-relaxed max-w-3xl">
            Lista curada de {stats.total} exercícios para grupos de aprimoramento
            clínico. Cada dinâmica traz contextualização, objetivo e descrição
            passo-a-passo — pensada para coordenadores, supervisores e participantes
            conduzirem juntos.
          </p>
        </header>

        {/* Stat strip + Featured */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 mb-6">
          {/* Coluna esquerda: stats + atalhos */}
          <div className="space-y-4">
            <StatStrip stats={stats} exercises={exercises} />
            <QuickShortcuts />
          </div>

          {/* Coluna direita: Exercício do dia */}
          {featured && featuredCat && (
            <Link
              href={`/formacao/aprimoramento-dinamicas/${featured.slug}`}
              className="group block rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${featuredCat.tint} 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${featuredCat.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <Sparkles
                  width={14}
                  height={14}
                  aria-hidden="true"
                  style={{ color: featuredCat.color }}
                />
                <p
                  className="font-dm text-[10px] font-bold tracking-[0.24em] uppercase"
                  style={{ color: featuredCat.color }}
                >
                  Exercício do dia
                </p>
              </div>

              <div className="flex items-start gap-3 mb-2">
                <div
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-fraunces text-xs font-bold"
                  style={{
                    background: featuredCat.tint,
                    color: featuredCat.color,
                    border: `1px solid ${featuredCat.border}`,
                  }}
                  aria-hidden="true"
                >
                  {featured.number}
                </div>
                <h3 className="font-fraunces text-base md:text-lg text-cream leading-snug group-hover:text-accent transition-colors flex-1 min-w-0">
                  {featured.title}
                </h3>
              </div>

              <p className="font-dm text-[13px] text-cream/55 leading-relaxed line-clamp-3 mb-4">
                {featured.summary}
              </p>

              <div className="flex items-center justify-end mt-auto">
                <ChevronRight
                  width={16}
                  height={16}
                  className="text-cream/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                  aria-hidden="true"
                />
              </div>
            </Link>
          )}
        </div>
      </div>

      {/* ─── Trilhas sugeridas ──────────────────────────────────────────── */}
      <section className="mb-12 md:mb-14">
        <header className="flex items-baseline justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <Compass
              width={16}
              height={16}
              className="text-accent"
              aria-hidden="true"
            />
            <h2 className="font-fraunces text-xl md:text-2xl text-cream">
              Trilhas sugeridas
            </h2>
            <span className="font-dm text-[11px] text-cream/35">
              {TRILHAS.length}
            </span>
          </div>
          <p className="font-dm text-xs text-cream/40 max-w-md">
            Sequências curadas de exercícios que fazem sentido em ordem.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {TRILHAS.map((t) => (
            <Link
              key={t.slug}
              href={`/formacao/aprimoramento-dinamicas/trilha/${t.slug}`}
              className="group block rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${t.tint} 0%, rgba(255,255,255,0.02) 100%)`,
                border: `1px solid ${t.border}`,
              }}
            >
              <div className="flex items-center gap-2 mb-2.5">
                <p
                  className="font-dm text-[10px] font-bold tracking-[0.24em] uppercase"
                  style={{ color: t.color }}
                >
                  {t.pretitle}
                </p>
                <span className="text-cream/15" aria-hidden="true">
                  ·
                </span>
                <span className="font-dm text-[11px] text-cream/40">
                  {t.exercise_slugs.length} etapas
                </span>
              </div>

              <h3 className="font-fraunces text-lg md:text-xl text-cream leading-snug mb-2 group-hover:text-accent transition-colors">
                {t.title}
              </h3>
              <p className="font-dm text-[13px] text-cream/55 leading-relaxed line-clamp-2">
                {t.descricao}
              </p>

              <div className="flex items-center justify-between mt-4">
                <span
                  className="font-dm text-[12px] font-medium inline-flex items-center gap-1"
                  style={{ color: t.color }}
                >
                  Ver trilha
                  <ChevronRight
                    width={13}
                    height={13}
                    aria-hidden="true"
                    className="group-hover:translate-x-0.5 transition-transform"
                  />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <ExerciseCatalog exercises={exercises} />
    </div>
  );
}

// ─── Componentes do hero ────────────────────────────────────────────────────

function StatStrip({
  stats,
  exercises,
}: {
  stats: { total: number; cats: number; curados: number };
  exercises: Exercise[];
}) {
  const items: { label: string; value: string }[] = [
    { label: "Exercícios", value: String(stats.total) },
    { label: "Categorias", value: String(stats.cats) },
    { label: "Curados", value: String(stats.curados) },
  ];

  // Contagem por categoria
  const counts = CATEGORY_ORDER.map((slug) => ({
    slug,
    meta: CATEGORIES[slug],
    count: exercises.filter((e) => e.category === slug).length,
  })).filter((c) => c.count > 0);

  return (
    <div
      className="rounded-2xl p-4 md:p-5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="grid grid-cols-3 gap-4 mb-4 pb-4 border-b border-white/[0.05]">
        {items.map((it) => (
          <div key={it.label}>
            <p className="font-fraunces text-xl md:text-2xl text-cream leading-tight">
              {it.value}
            </p>
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mt-0.5">
              {it.label}
            </p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {counts.map((c) => (
          <Link
            key={c.slug}
            href={`/formacao/aprimoramento-dinamicas?cat=${c.slug}`}
            className="font-dm text-[11px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all hover:translate-y-[-1px]"
            style={{
              color: c.meta.color,
              background: c.meta.tint,
              border: `1px solid ${c.meta.border}`,
            }}
            scroll={false}
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: c.meta.color }}
              aria-hidden="true"
            />
            {c.meta.label}
            <span className="text-cream/40 ml-0.5">{c.count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function QuickShortcuts() {
  // Atalhos pré-aplicam filtros via URL state (lido pelo ExerciseCatalog).
  const shortcuts: {
    href: string;
    label: string;
    Icon: React.ElementType;
  }[] = [
    {
      href: "/formacao/aprimoramento-dinamicas?fmt=roleplay",
      label: "Quero roleplay",
      Icon: Drama,
    },
    {
      href: "/formacao/aprimoramento-dinamicas?fmt=reflexao",
      label: "Pra reflexão",
      Icon: BrainCog,
    },
    {
      href: "/formacao/aprimoramento-dinamicas?fmt=discussao",
      label: "Pra discussão",
      Icon: MessagesSquare,
    },
    {
      href: "/formacao/aprimoramento-dinamicas?cu=curado",
      label: "Só curados",
      Icon: Star,
    },
  ];

  return (
    <div>
      <p className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/35 mb-2">
        Atalhos rápidos
      </p>
      <div className="flex flex-wrap gap-2">
        {shortcuts.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            scroll={false}
            className="font-dm text-[12px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-cream/70 hover:text-accent transition-all hover:translate-y-[-1px]"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <Icon
              width={12}
              height={12}
              aria-hidden="true"
              className="text-accent/70"
            />
            {label}
          </Link>
        ))}
      </div>
    </div>
  );
}
