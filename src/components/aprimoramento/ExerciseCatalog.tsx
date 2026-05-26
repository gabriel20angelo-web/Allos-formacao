"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X, ChevronRight, Clock, Users } from "lucide-react";
import type { Exercise } from "@/lib/aprimoramento-dinamicas";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  FORMATOS,
  PESSOAS_LABEL,
  formatDuracao,
} from "@/lib/aprimoramento-categories";

interface Props {
  exercises: Exercise[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function ExerciseCatalog({ exercises }: Props) {
  const [query, setQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());

  const total = exercises.length;

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return exercises.filter((ex) => {
      if (activeCats.size > 0 && !activeCats.has(ex.category)) return false;
      if (!q) return true;
      const hay = normalize(
        [ex.title, ex.summary, ...ex.tags].join(" "),
      );
      return hay.includes(q);
    });
  }, [exercises, query, activeCats]);

  const grouped = useMemo(() => {
    const map = new Map<string, Exercise[]>();
    for (const ex of filtered) {
      const arr = map.get(ex.category) ?? [];
      arr.push(ex);
      map.set(ex.category, arr);
    }
    return CATEGORY_ORDER.map((slug) => ({
      category: CATEGORIES[slug],
      items: map.get(slug) ?? [],
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  const toggleCat = (slug: string) => {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const clearFilters = () => {
    setQuery("");
    setActiveCats(new Set());
  };

  const hasFilters = query.length > 0 || activeCats.size > 0;

  return (
    <div>
      {/* Barra de busca + contador */}
      <div className="mb-5">
        <div className="relative">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/35 pointer-events-none"
            width={16}
            height={16}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, tema ou tag…"
            className="font-dm text-sm w-full pl-11 pr-10 py-3 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50 transition-all"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            aria-label="Buscar exercícios"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md text-cream/40 hover:text-cream hover:bg-white/[0.05] transition-colors"
              aria-label="Limpar busca"
            >
              <X width={14} height={14} />
            </button>
          )}
        </div>
      </div>

      {/* Chips de categoria */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {CATEGORY_ORDER.map((slug) => {
          const cat = CATEGORIES[slug];
          const active = activeCats.has(slug);
          return (
            <button
              key={slug}
              type="button"
              onClick={() => toggleCat(slug)}
              className="font-dm text-xs font-medium px-3 py-1.5 rounded-full transition-all"
              style={{
                color: active ? cat.color : "rgba(253,251,247,0.5)",
                background: active ? cat.tint : "rgba(255,255,255,0.025)",
                border: `1px solid ${active ? cat.border : "rgba(255,255,255,0.07)"}`,
              }}
              aria-pressed={active}
            >
              {cat.label}
            </button>
          );
        })}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="font-dm text-xs text-cream/40 hover:text-accent ml-1 transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      <p className="font-dm text-xs text-cream/40 mb-8">
        Mostrando {filtered.length} de {total} exercícios
      </p>

      {/* Lista vazia */}
      {filtered.length === 0 && (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ border: "1.5px dashed rgba(255,255,255,0.08)" }}
        >
          <p className="font-dm text-sm text-cream/40 mb-3">
            Nenhum exercício corresponde aos filtros.
          </p>
          <button
            type="button"
            onClick={clearFilters}
            className="font-dm text-xs px-4 py-2 rounded-xl text-accent hover:bg-accent/10 transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Lista agrupada */}
      <div className="space-y-10">
        {grouped.map(({ category, items }) => (
          <section key={category.slug}>
            <header className="flex items-baseline gap-3 mb-4">
              <div
                className="w-1.5 h-5 rounded-full flex-shrink-0"
                style={{ background: category.color }}
                aria-hidden="true"
              />
              <h2
                className="font-fraunces text-lg md:text-xl"
                style={{ color: category.color }}
              >
                {category.label}
              </h2>
              <span className="font-dm text-[11px] text-cream/30">
                {items.length} {items.length === 1 ? "exercício" : "exercícios"}
              </span>
              <p className="font-dm text-xs text-cream/40 hidden md:block ml-2">
                {category.description}
              </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {items.map((ex) => (
                <ExerciseCard key={ex.slug} exercise={ex} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function ExerciseCard({ exercise }: { exercise: Exercise }) {
  const cat = CATEGORIES[exercise.category];
  const primaryFormato = FORMATOS[exercise.formato[0]];
  return (
    <Link
      href={`/formacao/aprimoramento-dinamicas/${exercise.slug}`}
      className="group block rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-1px]"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
    >
      <div className="flex items-start gap-4 mb-3">
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
        <div className="flex-1 min-w-0">
          <h3 className="font-fraunces text-base md:text-lg text-cream leading-snug mb-1.5 group-hover:text-accent transition-colors">
            {exercise.title}
          </h3>
          <p className="font-dm text-[13px] text-cream/55 leading-relaxed line-clamp-2">
            {exercise.summary}
          </p>
        </div>
        <ChevronRight
          className="flex-shrink-0 text-cream/25 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
          width={16}
          height={16}
          aria-hidden="true"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 mt-3 pl-13">
        <Badge color={cat.color} tint={cat.tint} border={cat.border}>
          {primaryFormato.label}
        </Badge>
        <Badge>
          <Clock width={11} height={11} aria-hidden="true" />
          {formatDuracao(exercise.duracaoMin)}
        </Badge>
        <Badge>
          <Users width={11} height={11} aria-hidden="true" />
          {PESSOAS_LABEL[exercise.pessoas]}
        </Badge>
      </div>
    </Link>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  tint?: string;
  border?: string;
}

function Badge({ children, color, tint, border }: BadgeProps) {
  return (
    <span
      className="font-dm text-[10.5px] font-medium px-2 py-1 rounded-md inline-flex items-center gap-1"
      style={{
        color: color ?? "rgba(253,251,247,0.55)",
        background: tint ?? "rgba(255,255,255,0.035)",
        border: `1px solid ${border ?? "rgba(255,255,255,0.06)"}`,
      }}
    >
      {children}
    </span>
  );
}
