"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  ChevronRight,
  ChevronDown,
  Clock,
  Users,
  Shuffle,
  ArrowDownAZ,
  LayoutGrid,
  Star,
  Check,
} from "lucide-react";
import type {
  Exercise,
  CategorySlug,
  FormatoSlug,
  Pessoas,
} from "@/lib/aprimoramento-dinamicas";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  FORMATOS,
  FORMATOS_ORDER,
  PESSOAS_LABEL,
  PESSOAS_ORDER,
  DURATION_BUCKETS,
  DURATION_ORDER,
  durationBucket,
  formatDuracao,
  type DurationBucket,
} from "@/lib/aprimoramento-categories";
import { useAuth } from "@/hooks/useAuth";
import { useAprimoramentoEstados } from "@/hooks/useAprimoramentoEstados";
import type { AprimoramentoEstado } from "@/lib/queries/aprimoramento";

type SortKey = "ordem" | "titulo" | "duracao-asc" | "duracao-desc";
type GroupKey = "categoria" | "duracao" | "lista";
type StatusFilter = "favorito" | "fazer-depois" | "feito";

const STATUS_FILTER_ORDER: StatusFilter[] = ["favorito", "fazer-depois", "feito"];
const STATUS_FILTER_LABEL: Record<StatusFilter, string> = {
  favorito: "★ Favoritos",
  "fazer-depois": "⏰ Para fazer",
  feito: "✓ Já fiz",
};

interface Props {
  exercises: Exercise[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

interface InitialState {
  q: string;
  cats: Set<CategorySlug>;
  durs: Set<DurationBucket>;
  formatos: Set<FormatoSlug>;
  pessoas: Set<Pessoas>;
  statuses: Set<StatusFilter>;
  sort: SortKey;
  group: GroupKey;
}

function emptyState(): InitialState {
  return {
    q: "",
    cats: new Set(),
    durs: new Set(),
    formatos: new Set(),
    pessoas: new Set(),
    statuses: new Set(),
    sort: "ordem",
    group: "categoria",
  };
}

function readUrl(): InitialState {
  if (typeof window === "undefined") return emptyState();
  const p = new URLSearchParams(window.location.search);
  const parseSet = <T extends string>(key: string): Set<T> =>
    new Set((p.get(key)?.split(",").filter(Boolean) || []) as T[]);
  const sort = (p.get("sort") as SortKey | null) || "ordem";
  const group = (p.get("group") as GroupKey | null) || "categoria";
  return {
    q: p.get("q") || "",
    cats: parseSet<CategorySlug>("cat"),
    durs: parseSet<DurationBucket>("dur"),
    formatos: parseSet<FormatoSlug>("fmt"),
    pessoas: parseSet<Pessoas>("p"),
    statuses: parseSet<StatusFilter>("st"),
    sort: ["ordem", "titulo", "duracao-asc", "duracao-desc"].includes(sort)
      ? sort
      : "ordem",
    group: ["categoria", "duracao", "lista"].includes(group) ? group : "categoria",
  };
}

export default function ExerciseCatalog({ exercises }: Props) {
  const router = useRouter();
  const initial = useMemo(() => readUrl(), []);

  const [query, setQuery] = useState(initial.q);
  const [activeCats, setActiveCats] = useState<Set<CategorySlug>>(initial.cats);
  const [activeDurs, setActiveDurs] = useState<Set<DurationBucket>>(initial.durs);
  const [activeFormatos, setActiveFormatos] = useState<Set<FormatoSlug>>(
    initial.formatos,
  );
  const [activePessoas, setActivePessoas] = useState<Set<Pessoas>>(
    initial.pessoas,
  );
  const [activeStatuses, setActiveStatuses] = useState<Set<StatusFilter>>(
    initial.statuses,
  );
  const [sortKey, setSortKey] = useState<SortKey>(initial.sort);
  const [groupKey, setGroupKey] = useState<GroupKey>(initial.group);

  // "Mais filtros" abre automaticamente se o estado inicial já tem algum filtro avançado.
  const [showMore, setShowMore] = useState<boolean>(
    initial.durs.size > 0 ||
      initial.formatos.size > 0 ||
      initial.pessoas.size > 0 ||
      initial.statuses.size > 0,
  );

  // Estado pessoal (favoritos, feito, depois, notas). null userId desliga o fetch.
  const { user } = useAuth();
  const { states: estados } = useAprimoramentoEstados(user?.id ?? null);

  const total = exercises.length;

  // Sync state → URL com replaceState (sem rerender / sem scroll).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams();
    if (query.trim()) p.set("q", query.trim());
    if (activeCats.size) p.set("cat", Array.from(activeCats).join(","));
    if (activeDurs.size) p.set("dur", Array.from(activeDurs).join(","));
    if (activeFormatos.size) p.set("fmt", Array.from(activeFormatos).join(","));
    if (activePessoas.size) p.set("p", Array.from(activePessoas).join(","));
    if (activeStatuses.size) p.set("st", Array.from(activeStatuses).join(","));
    if (sortKey !== "ordem") p.set("sort", sortKey);
    if (groupKey !== "categoria") p.set("group", groupKey);
    const qs = p.toString();
    const url = qs
      ? `${window.location.pathname}?${qs}`
      : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [
    query,
    activeCats,
    activeDurs,
    activeFormatos,
    activePessoas,
    activeStatuses,
    sortKey,
    groupKey,
  ]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return exercises.filter((ex) => {
      if (activeCats.size > 0 && !activeCats.has(ex.category)) return false;
      if (activeDurs.size > 0 && !activeDurs.has(durationBucket(ex.duracaoMin)))
        return false;
      if (activePessoas.size > 0 && !activePessoas.has(ex.pessoas)) return false;
      if (
        activeFormatos.size > 0 &&
        !ex.formato.some((f) => activeFormatos.has(f))
      )
        return false;
      if (activeStatuses.size > 0) {
        const est = estados.get(ex.slug);
        const matches = STATUS_FILTER_ORDER.some((s) => {
          if (!activeStatuses.has(s)) return false;
          if (s === "feito") {
            // "Já fiz" inclui qualquer estado com done_count > 0, mesmo que o
            // status atual não seja "feito" (user pode estar de favorito agora).
            return (est?.done_count ?? 0) > 0;
          }
          return est?.status === s;
        });
        if (!matches) return false;
      }
      if (!q) return true;
      const hay = normalize([ex.title, ex.summary, ...ex.tags].join(" "));
      return hay.includes(q);
    });
  }, [
    exercises,
    query,
    activeCats,
    activeDurs,
    activeFormatos,
    activePessoas,
    activeStatuses,
    estados,
  ]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const mid = (e: Exercise) => (e.duracaoMin[0] + e.duracaoMin[1]) / 2;
    switch (sortKey) {
      case "titulo":
        arr.sort((a, b) => a.title.localeCompare(b.title, "pt-BR"));
        break;
      case "duracao-asc":
        arr.sort((a, b) => mid(a) - mid(b) || a.number - b.number);
        break;
      case "duracao-desc":
        arr.sort((a, b) => mid(b) - mid(a) || a.number - b.number);
        break;
      default:
        arr.sort((a, b) => a.number - b.number);
    }
    return arr;
  }, [filtered, sortKey]);

  type Group = {
    key: string;
    label: string | null;
    hint?: string | null;
    color: string | null;
    items: Exercise[];
  };

  const grouped: Group[] = useMemo(() => {
    if (groupKey === "lista") {
      return [{ key: "lista", label: null, color: null, items: sorted }];
    }
    if (groupKey === "duracao") {
      const map = new Map<DurationBucket, Exercise[]>();
      for (const ex of sorted) {
        const k = durationBucket(ex.duracaoMin);
        const arr = map.get(k) ?? [];
        arr.push(ex);
        map.set(k, arr);
      }
      return DURATION_ORDER.map((k) => {
        const meta = DURATION_BUCKETS[k];
        return {
          key: k,
          label: meta.label,
          hint: meta.hint,
          color: meta.color,
          items: map.get(k) ?? [],
        };
      }).filter((g) => g.items.length > 0);
    }
    const map = new Map<CategorySlug, Exercise[]>();
    for (const ex of sorted) {
      const arr = map.get(ex.category) ?? [];
      arr.push(ex);
      map.set(ex.category, arr);
    }
    return CATEGORY_ORDER.map((slug) => {
      const meta = CATEGORIES[slug];
      return {
        key: slug,
        label: meta.label,
        hint: meta.description,
        color: meta.color,
        items: map.get(slug) ?? [],
      };
    }).filter((g) => g.items.length > 0);
  }, [sorted, groupKey]);

  function toggle<T>(set: Set<T>, value: T, setter: (s: Set<T>) => void) {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    setter(next);
  }

  const clearAll = () => {
    setQuery("");
    setActiveCats(new Set());
    setActiveDurs(new Set());
    setActiveFormatos(new Set());
    setActivePessoas(new Set());
    setActiveStatuses(new Set());
    setSortKey("ordem");
    setGroupKey("categoria");
  };

  const advancedCount =
    activeDurs.size +
    activeFormatos.size +
    activePessoas.size +
    activeStatuses.size;

  const hasFilters =
    query.length > 0 ||
    activeCats.size > 0 ||
    advancedCount > 0 ||
    sortKey !== "ordem" ||
    groupKey !== "categoria";

  const suggestRandom = useCallback(() => {
    if (sorted.length === 0) return;
    const ex = sorted[Math.floor(Math.random() * sorted.length)];
    router.push(`/formacao/aprimoramento-dinamicas/${ex.slug}`);
  }, [sorted, router]);

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* Barra de busca */}
      <div className="mb-4">
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

      {/* Chips de categoria — sempre visíveis */}
      <ChipRow label="Categoria">
        {CATEGORY_ORDER.map((slug) => {
          const cat = CATEGORIES[slug];
          const active = activeCats.has(slug);
          return (
            <Chip
              key={slug}
              active={active}
              color={cat.color}
              tint={cat.tint}
              border={cat.border}
              onClick={() => toggle(activeCats, slug, setActiveCats)}
            >
              {cat.label}
            </Chip>
          );
        })}
      </ChipRow>

      {/* Toggle mais filtros */}
      <div className="flex flex-wrap items-center gap-2 mt-3 mb-3">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="font-dm text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-cream/60 hover:text-cream hover:bg-white/[0.04] transition-colors"
          aria-expanded={showMore}
        >
          <ChevronDown
            width={13}
            height={13}
            style={{
              transform: showMore ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform .2s",
            }}
            aria-hidden="true"
          />
          Mais filtros
          {advancedCount > 0 && (
            <span
              className="ml-1 font-dm text-[10px] px-1.5 py-0.5 rounded-md text-accent"
              style={{
                background: "rgba(200,75,49,0.12)",
                border: "1px solid rgba(200,75,49,0.28)",
              }}
            >
              {advancedCount}
            </span>
          )}
        </button>

        <span className="text-cream/15" aria-hidden="true">·</span>

        {/* Sort */}
        <label className="inline-flex items-center gap-1.5 font-dm text-[12px] text-cream/55">
          <ArrowDownAZ width={13} height={13} aria-hidden="true" />
          <span className="sr-only md:not-sr-only">Ordenar</span>
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="font-dm text-[12px] bg-transparent text-cream/85 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded px-1 py-0.5 cursor-pointer"
            aria-label="Ordenar"
          >
            <option value="ordem">Ordem original</option>
            <option value="titulo">Título A-Z</option>
            <option value="duracao-asc">Mais curtos primeiro</option>
            <option value="duracao-desc">Mais longos primeiro</option>
          </select>
        </label>

        {/* Group */}
        <label className="inline-flex items-center gap-1.5 font-dm text-[12px] text-cream/55">
          <LayoutGrid width={13} height={13} aria-hidden="true" />
          <span className="sr-only md:not-sr-only">Agrupar</span>
          <select
            value={groupKey}
            onChange={(e) => setGroupKey(e.target.value as GroupKey)}
            className="font-dm text-[12px] bg-transparent text-cream/85 focus:outline-none focus:ring-1 focus:ring-accent/40 rounded px-1 py-0.5 cursor-pointer"
            aria-label="Agrupar"
          >
            <option value="categoria">Por categoria</option>
            <option value="duracao">Por duração</option>
            <option value="lista">Lista plana</option>
          </select>
        </label>

        <div className="flex-1" />

        {/* Aleatório */}
        <button
          type="button"
          onClick={suggestRandom}
          disabled={sorted.length === 0}
          className="font-dm text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-cream/60 hover:text-accent hover:bg-accent/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:text-cream/60 disabled:hover:bg-transparent"
          aria-label="Sugerir exercício aleatório"
          title={
            sorted.length === 0
              ? "Nenhum exercício no filtro atual"
              : `Sorteia entre os ${sorted.length} exercícios filtrados`
          }
        >
          <Shuffle width={13} height={13} aria-hidden="true" />
          Aleatório
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={clearAll}
            className="font-dm text-[12px] text-cream/40 hover:text-accent transition-colors px-2 py-1"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {/* Painel "Mais filtros" */}
      {showMore && (
        <div
          className="rounded-xl p-3 md:p-4 mb-4 space-y-3"
          style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <ChipRow label="Duração" compact>
            {DURATION_ORDER.map((slug) => {
              const meta = DURATION_BUCKETS[slug];
              const active = activeDurs.has(slug);
              return (
                <Chip
                  key={slug}
                  active={active}
                  color={meta.color}
                  tint={meta.tint}
                  border={meta.border}
                  onClick={() => toggle(activeDurs, slug, setActiveDurs)}
                  hint={meta.hint}
                >
                  {meta.label}
                </Chip>
              );
            })}
          </ChipRow>

          <ChipRow label="Pessoas" compact>
            {PESSOAS_ORDER.map((slug) => {
              const active = activePessoas.has(slug);
              return (
                <Chip
                  key={slug}
                  active={active}
                  onClick={() => toggle(activePessoas, slug, setActivePessoas)}
                >
                  {PESSOAS_LABEL[slug]}
                </Chip>
              );
            })}
          </ChipRow>

          <ChipRow label="Formato" compact>
            {FORMATOS_ORDER.map((slug) => {
              const fmt = FORMATOS[slug];
              const active = activeFormatos.has(slug);
              return (
                <Chip
                  key={slug}
                  active={active}
                  onClick={() =>
                    toggle(activeFormatos, slug, setActiveFormatos)
                  }
                >
                  {fmt.label}
                </Chip>
              );
            })}
          </ChipRow>

          {user?.id && (
            <ChipRow label="Minha trilha" compact>
              {STATUS_FILTER_ORDER.map((slug) => {
                const active = activeStatuses.has(slug);
                return (
                  <Chip
                    key={slug}
                    active={active}
                    onClick={() =>
                      toggle(activeStatuses, slug, setActiveStatuses)
                    }
                  >
                    {STATUS_FILTER_LABEL[slug]}
                  </Chip>
                );
              })}
            </ChipRow>
          )}
        </div>
      )}

      <p className="font-dm text-xs text-cream/40 mb-6">
        Mostrando {sorted.length} de {total} {total === 1 ? "exercício" : "exercícios"}
      </p>

      {/* Lista vazia */}
      {sorted.length === 0 && (
        <div
          className="rounded-2xl py-16 text-center"
          style={{ border: "1.5px dashed rgba(255,255,255,0.08)" }}
        >
          <p className="font-dm text-sm text-cream/40 mb-3">
            Nenhum exercício corresponde aos filtros.
          </p>
          <button
            type="button"
            onClick={clearAll}
            className="font-dm text-xs px-4 py-2 rounded-xl text-accent hover:bg-accent/10 transition-colors"
          >
            Limpar filtros
          </button>
        </div>
      )}

      {/* Lista agrupada */}
      <div className="space-y-10">
        {grouped.map((group) => (
          <section key={group.key}>
            {group.label && (
              <header className="flex items-baseline gap-3 mb-4 flex-wrap">
                <div
                  className="w-1.5 h-5 rounded-full flex-shrink-0"
                  style={{ background: group.color ?? "#FDFBF7" }}
                  aria-hidden="true"
                />
                <h2
                  className="font-fraunces text-lg md:text-xl"
                  style={{ color: group.color ?? "#FDFBF7" }}
                >
                  {group.label}
                </h2>
                <span className="font-dm text-[11px] text-cream/30">
                  {group.items.length}{" "}
                  {group.items.length === 1 ? "exercício" : "exercícios"}
                </span>
                {group.hint && (
                  <p className="font-dm text-xs text-cream/40 hidden md:block ml-2">
                    {group.hint}
                  </p>
                )}
              </header>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
              {group.items.map((ex) => (
                <ExerciseCard
                  key={ex.slug}
                  exercise={ex}
                  estado={estados.get(ex.slug)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ─── Helpers de UI ───────────────────────────────────────────────────────────

function ChipRow({
  label,
  children,
  compact,
}: {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? "" : "mt-3"}`}>
      <span className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/35 mr-1 min-w-[68px]">
        {label}
      </span>
      {children}
    </div>
  );
}

interface ChipProps {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  color?: string;
  tint?: string;
  border?: string;
  hint?: string;
}

function Chip({
  children,
  active,
  onClick,
  color,
  tint,
  border,
  hint,
}: ChipProps) {
  const c = color ?? "#FDFBF7";
  const t = tint ?? "rgba(255,255,255,0.05)";
  const b = border ?? "rgba(255,255,255,0.12)";
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className="font-dm text-xs font-medium px-3 py-1.5 rounded-full transition-all hover:translate-y-[-1px]"
      style={{
        color: active ? c : "rgba(253,251,247,0.55)",
        background: active ? t : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? b : "rgba(255,255,255,0.07)"}`,
      }}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function ExerciseCard({
  exercise,
  estado,
}: {
  exercise: Exercise;
  estado?: AprimoramentoEstado;
}) {
  const cat = CATEGORIES[exercise.category];
  const primaryFormato = FORMATOS[exercise.formato[0]];
  const doneCount = estado?.done_count ?? 0;
  const isFav = estado?.status === "favorito";
  const isDepois = estado?.status === "fazer-depois";
  return (
    <Link
      href={`/formacao/aprimoramento-dinamicas/${exercise.slug}`}
      className="group block rounded-2xl p-5 transition-all duration-200 hover:translate-y-[-1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 relative"
      style={
        {
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
          // Cor da categoria como CSS var → usada em hover/border via :hover
          ["--cat-color" as string]: cat.color,
          ["--cat-tint" as string]: cat.tint,
          ["--cat-border" as string]: cat.border,
        } as React.CSSProperties
      }
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = cat.border;
        e.currentTarget.style.boxShadow = `0 8px 24px -10px ${cat.tint}`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div className="flex items-start gap-4 mb-3">
        <div
          className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center font-fraunces text-sm font-bold transition-transform group-hover:scale-105"
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
          {/* Hover preview: line-clamp expande de 2 → 4 ao passar o mouse */}
          <p className="font-dm text-[13px] text-cream/55 leading-relaxed line-clamp-2 group-hover:line-clamp-4 transition-all">
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
        <CardBadge color={cat.color} tint={cat.tint} border={cat.border}>
          {primaryFormato.label}
        </CardBadge>
        <CardBadge>
          <Clock width={11} height={11} aria-hidden="true" />
          {formatDuracao(exercise.duracaoMin)}
        </CardBadge>
        <CardBadge>
          <Users width={11} height={11} aria-hidden="true" />
          {PESSOAS_LABEL[exercise.pessoas]}
        </CardBadge>

        {/* Badges de estado pessoal — sempre alinhadas ao fim do row */}
        {(isFav || isDepois || doneCount > 0) && (
          <div className="ml-auto flex items-center gap-1">
            {isFav && (
              <CardBadge
                color="#F59E0B"
                tint="rgba(245,158,11,0.10)"
                border="rgba(245,158,11,0.28)"
              >
                <Star
                  width={10}
                  height={10}
                  aria-hidden="true"
                  fill="currentColor"
                />
              </CardBadge>
            )}
            {isDepois && (
              <CardBadge
                color="#60A5FA"
                tint="rgba(96,165,250,0.10)"
                border="rgba(96,165,250,0.28)"
              >
                <Clock width={10} height={10} aria-hidden="true" />
              </CardBadge>
            )}
            {doneCount > 0 && (
              <CardBadge
                color="#34D399"
                tint="rgba(52,211,153,0.10)"
                border="rgba(52,211,153,0.28)"
              >
                <Check width={10} height={10} aria-hidden="true" />
                {doneCount > 1 && <span className="ml-0.5">{doneCount}×</span>}
              </CardBadge>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

interface CardBadgeProps {
  children: React.ReactNode;
  color?: string;
  tint?: string;
  border?: string;
}

function CardBadge({ children, color, tint, border }: CardBadgeProps) {
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
