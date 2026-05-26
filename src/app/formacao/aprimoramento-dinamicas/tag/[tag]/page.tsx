import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  findTagBySlug,
  listAllTags,
} from "@/lib/aprimoramento-dinamicas";
import { CATEGORIES } from "@/lib/aprimoramento-categories";
import Breadcrumbs from "@/components/aprimoramento/Breadcrumbs";
import { ChevronRight, Tag as TagIcon } from "lucide-react";
import type { Metadata } from "next";

interface PageProps {
  params: { tag: string };
}

export function generateStaticParams() {
  return listAllTags().map((t) => ({ tag: t.slug }));
}

export function generateMetadata({ params }: PageProps): Metadata {
  const found = findTagBySlug(params.tag);
  if (!found) return { title: "Tag não encontrada — Allos Formação" };
  return {
    title: `#${found.tag} — Aprimoramento de Dinâmicas`,
    description: `Exercícios marcados com a tag ${found.tag}.`,
    robots: { index: false, follow: false },
  };
}

export const dynamic = "force-dynamic";

export default async function TagPage({ params }: PageProps) {
  const found = findTagBySlug(params.tag);
  if (!found) notFound();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(
      `/formacao/auth?next=/formacao/aprimoramento-dinamicas/tag/${params.tag}`,
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

  const { tag, exercises } = found;
  const allTags = listAllTags();
  const related = allTags.filter((t) => t.tag !== tag).slice(0, 8);

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
            { label: `#${tag}` },
          ]}
        />
      </div>

      <header className="mb-8">
        <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-3 inline-flex items-center gap-1.5">
          <TagIcon width={12} height={12} aria-hidden="true" />
          Tag
        </p>
        <h1 className="font-fraunces text-3xl md:text-5xl text-cream leading-tight mb-3">
          #{tag}
        </h1>
        <p className="font-dm text-base text-cream/55 leading-relaxed">
          {exercises.length}{" "}
          {exercises.length === 1
            ? "exercício marcado com esta tag"
            : "exercícios marcados com esta tag"}
          .
        </p>
      </header>

      <ol className="space-y-3 mb-12">
        {exercises.map((ex) => {
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
                  <span
                    className="font-dm text-[9px] font-semibold tracking-[0.24em] uppercase"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <h3 className="font-fraunces text-base md:text-lg text-cream leading-snug mt-0.5 mb-1 group-hover:text-accent transition-colors">
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
          );
        })}
      </ol>

      {related.length > 0 && (
        <section
          className="pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
        >
          <h2 className="font-dm text-[11px] font-bold tracking-[0.24em] uppercase text-accent/80 mb-4">
            Outras tags
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {related.map((t) => (
              <Link
                key={t.slug}
                href={`/formacao/aprimoramento-dinamicas/tag/${t.slug}`}
                className="font-dm text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-cream/65 hover:text-accent transition-colors"
                style={{
                  background: "rgba(255,255,255,0.025)",
                  border: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                #{t.tag}
                <span className="text-cream/35">{t.count}</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
