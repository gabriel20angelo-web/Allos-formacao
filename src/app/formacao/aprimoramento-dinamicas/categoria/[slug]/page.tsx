import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EXERCISES } from "@/lib/aprimoramento-dinamicas";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  type CategoryMeta,
} from "@/lib/aprimoramento-categories";
import type { CategorySlug } from "@/lib/aprimoramento-dinamicas";
import Breadcrumbs from "@/components/aprimoramento/Breadcrumbs";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

interface PageProps {
  params: { slug: string };
}

export function generateStaticParams() {
  return CATEGORY_ORDER.map((slug) => ({ slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const cat = CATEGORIES[params.slug as CategorySlug];
  if (!cat) return { title: "Categoria não encontrada — Allos Formação" };
  return {
    title: `${cat.label} — Aprimoramento de Dinâmicas`,
    description: cat.description,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function CategoriaPage({ params }: PageProps) {
  const cat: CategoryMeta | undefined =
    CATEGORIES[params.slug as CategorySlug];
  if (!cat) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/formacao/auth?next=/formacao/aprimoramento-dinamicas/categoria/${params.slug}`,
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

  const items = EXERCISES.filter((e) => e.category === cat.slug);
  const catIdx = CATEGORY_ORDER.indexOf(cat.slug);
  const prev = catIdx > 0 ? CATEGORIES[CATEGORY_ORDER[catIdx - 1]] : null;
  const next =
    catIdx < CATEGORY_ORDER.length - 1
      ? CATEGORIES[CATEGORY_ORDER[catIdx + 1]]
      : null;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <div className="mb-6">
        <Breadcrumbs
          items={[
            { label: "Formação", href: "/formacao" },
            {
              label: "Aprimoramento",
              href: "/formacao/aprimoramento-dinamicas",
            },
            { label: cat.label },
          ]}
        />
      </div>

      <header className="relative mb-10 md:mb-12">
        <div
          className="absolute -top-6 -left-4 -right-4 h-72 -z-10 pointer-events-none rounded-3xl"
          aria-hidden="true"
          style={{
            background: `radial-gradient(ellipse 70% 70% at 30% 0%, ${cat.tint} 0%, transparent 70%)`,
          }}
        />
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-2.5 h-7 rounded-full"
            style={{ background: cat.color }}
            aria-hidden="true"
          />
          <p
            className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase"
            style={{ color: cat.color }}
          >
            Categoria
          </p>
        </div>
        <h1 className="font-fraunces text-3xl md:text-5xl text-cream leading-tight mb-3">
          {cat.label}
        </h1>
        <p className="font-dm text-base md:text-lg text-cream/65 leading-relaxed max-w-3xl mb-3">
          {cat.description}
        </p>
        <p className="font-dm text-sm md:text-base text-cream/50 leading-relaxed max-w-3xl">
          {cat.longDescription}
        </p>
        <p className="font-dm text-xs text-cream/35 mt-4">
          {items.length}{" "}
          {items.length === 1 ? "exercício nesta categoria" : "exercícios nesta categoria"}
        </p>
      </header>

      <ol className="space-y-3 mb-12">
        {items.map((ex) => (
          <li key={ex.slug}>
            <Link
              href={`/formacao/aprimoramento-dinamicas/${ex.slug}`}
              className="group flex items-start gap-4 rounded-2xl p-4 md:p-5 transition-all duration-200 hover:translate-y-[-1px]"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div
                className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-fraunces text-sm font-bold mt-0.5"
                style={{
                  background: cat.tint,
                  color: cat.color,
                  border: `1px solid ${cat.border}`,
                }}
                aria-hidden="true"
              >
                {ex.number}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-fraunces text-base md:text-lg text-cream leading-snug mb-1 group-hover:text-accent transition-colors">
                  {ex.title}
                </h3>
                <p className="font-dm text-[13px] text-cream/55 leading-relaxed line-clamp-2">
                  {ex.summary}
                </p>
              </div>
              <ChevronRight
                className="flex-shrink-0 text-cream/25 group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-2"
                width={18}
                height={18}
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ol>

      <div
        className="mt-14 pt-8 grid grid-cols-2 gap-3"
        style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      >
        {prev ? (
          <Link
            href={`/formacao/aprimoramento-dinamicas/categoria/${prev.slug}`}
            className="group rounded-2xl p-4 transition-all hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mb-1.5">
              ← Categoria anterior
            </p>
            <p className="font-fraunces text-sm text-cream group-hover:text-accent transition-colors">
              {prev.label}
            </p>
          </Link>
        ) : (
          <div />
        )}
        {next ? (
          <Link
            href={`/formacao/aprimoramento-dinamicas/categoria/${next.slug}`}
            className="group rounded-2xl p-4 text-right transition-all hover:bg-white/[0.04]"
            style={{ border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <p className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/40 mb-1.5">
              Próxima categoria →
            </p>
            <p className="font-fraunces text-sm text-cream group-hover:text-accent transition-colors">
              {next.label}
            </p>
          </Link>
        ) : (
          <div />
        )}
      </div>
    </div>
  );
}
