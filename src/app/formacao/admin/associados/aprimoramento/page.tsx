"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Shield,
  ChevronLeft,
  Plus,
  Search,
  Star,
  Archive,
  ArchiveRestore,
  Trash2,
  Edit,
  ExternalLink,
  ArrowUpDown,
  Sparkles,
  Loader2,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  listAllForAdmin,
  setCurado,
  setStatus,
  deleteExercicio,
  type AdminExercicioRow,
} from "@/lib/queries/aprimoramento-exercicios-admin";
import {
  CATEGORIES,
  CATEGORY_ORDER,
} from "@/lib/aprimoramento-categories";
import { isCurated, type CategorySlug } from "@/lib/aprimoramento-dinamicas";

type CuracaoFilter = "all" | "curado" | "nao-curado";
type StatusFilter = "publicado" | "rascunho" | "arquivado";
type CreatorFilter = "all" | "sistema" | "associados";
type SortKey = "number" | "titulo" | "updated";

const STATUS_LABEL: Record<StatusFilter, string> = {
  publicado: "Publicado",
  rascunho: "Rascunho",
  arquivado: "Arquivado",
};

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export default function AprimoramentoAdminPage() {
  const { isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<AdminExercicioRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [query, setQuery] = useState("");
  const [activeCats, setActiveCats] = useState<Set<CategorySlug>>(new Set());
  const [curacao, setCuracao] = useState<CuracaoFilter>("all");
  const [activeStatuses, setActiveStatuses] = useState<Set<StatusFilter>>(
    new Set<StatusFilter>(["publicado"]),
  );
  const [creator, setCreator] = useState<CreatorFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("number");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // Ação em progresso (id do exercício)
  const [busyId, setBusyId] = useState<string | null>(null);

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<AdminExercicioRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await listAllForAdmin();
      if (!cancelled) {
        setRows(data);
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Filter + sort ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return rows.filter((ex) => {
      if (activeCats.size > 0 && !activeCats.has(ex.category)) return false;
      if (activeStatuses.size > 0 && !activeStatuses.has(ex.status ?? "publicado"))
        return false;
      if (curacao === "curado" && !isCurated(ex)) return false;
      if (curacao === "nao-curado" && isCurated(ex)) return false;
      if (creator === "sistema" && ex.criadoPor !== null) return false;
      if (creator === "associados" && !ex.criadoPor) return false;
      if (!q) return true;
      const hay = normalize(
        [ex.title, ex.summary, ex.slug, ...ex.tags].join(" "),
      );
      return hay.includes(q);
    });
  }, [rows, query, activeCats, activeStatuses, curacao, creator]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "titulo":
        arr.sort((a, b) => a.title.localeCompare(b.title, "pt-BR") * dir);
        break;
      case "updated":
        arr.sort(
          (a, b) => (a.updatedAt > b.updatedAt ? 1 : -1) * dir,
        );
        break;
      default:
        arr.sort((a, b) => (a.number - b.number) * dir);
    }
    return arr;
  }, [filtered, sortKey, sortDir]);

  const hasFilters =
    query.length > 0 ||
    activeCats.size > 0 ||
    curacao !== "all" ||
    activeStatuses.size !== 1 ||
    !activeStatuses.has("publicado") ||
    creator !== "all";

  const clearFilters = () => {
    setQuery("");
    setActiveCats(new Set());
    setCuracao("all");
    setActiveStatuses(new Set<StatusFilter>(["publicado"]));
    setCreator("all");
  };

  function toggleCat(slug: CategorySlug) {
    setActiveCats((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleStatus(s: StatusFilter) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      // Não permitir set vazio — mantém o último
      if (next.size === 0) return prev;
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  // ─── Mutações (optimistic) ────────────────────────────────────────────────
  async function handleSetCurado(row: AdminExercicioRow, curado: boolean) {
    setBusyId(row.id);
    const original = row.curado;
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? { ...r, curado, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
    const { error } = await setCurado(row.id, curado);
    setBusyId(null);
    if (error) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, curado: original } : r)),
      );
      toast.error(`Falha: ${error.message}`);
      return;
    }
    toast.success(curado ? "Marcado como curado" : "Removida a curadoria");
  }

  async function handleSetStatus(
    row: AdminExercicioRow,
    status: "publicado" | "arquivado",
  ) {
    setBusyId(row.id);
    const original = row.status;
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? { ...r, status, updatedAt: new Date().toISOString() }
          : r,
      ),
    );
    const { error } = await setStatus(row.id, status);
    setBusyId(null);
    if (error) {
      setRows((rs) =>
        rs.map((r) => (r.id === row.id ? { ...r, status: original } : r)),
      );
      toast.error(`Falha: ${error.message}`);
      return;
    }
    toast.success(
      status === "arquivado" ? "Arquivado" : "Desarquivado (publicado)",
    );
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteExercicio(deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(`Falha ao excluir: ${error.message}`);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Exercício excluído");
  }

  // ─── Guards ───────────────────────────────────────────────────────────────
  if (authLoading) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">
          Acesso restrito. Apenas administradores podem aceder.
        </p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl">
      <Link
        href="/formacao/admin/associados"
        className="font-dm text-[12px] inline-flex items-center gap-1 text-cream/55 hover:text-accent transition-colors mb-6"
      >
        <ChevronLeft width={14} height={14} aria-hidden="true" />
        Associados
      </Link>

      <header className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <Sparkles
              width={14}
              height={14}
              className="text-accent"
              aria-hidden="true"
            />
            <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent">
              Conteúdo
            </p>
          </div>
          <h1 className="font-fraunces text-3xl md:text-4xl text-cream leading-tight mb-2">
            Aprimoramento de Dinâmicas
          </h1>
          <p className="font-dm text-sm text-cream/55 leading-relaxed max-w-2xl">
            Lista, edita, cria, cura e arquiva os exercícios.
          </p>
        </div>

        <Link
          href="/formacao/admin/associados/aprimoramento/novo"
          className="font-dm text-[13px] font-medium inline-flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all hover:translate-y-[-1px]"
          style={{
            background: "linear-gradient(135deg, #C84B31, #A33D27)",
            color: "white",
            boxShadow: "0 2px 12px rgba(200,75,49,0.25)",
          }}
        >
          <Plus width={14} height={14} aria-hidden="true" />
          Novo exercício
        </Link>
      </header>

      {/* Search */}
      <div className="mb-3">
        <div className="relative">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-cream/35 pointer-events-none"
            width={14}
            height={14}
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por título, slug, tema, tag…"
            className="font-dm text-sm w-full pl-10 pr-3 py-2.5 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
        </div>
      </div>

      {/* Filtros */}
      <div
        className="rounded-xl p-3 mb-3 space-y-2.5"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <FilterChips label="Categoria">
          {CATEGORY_ORDER.map((slug) => {
            const meta = CATEGORIES[slug];
            const active = activeCats.has(slug);
            return (
              <Chip
                key={slug}
                active={active}
                color={meta.color}
                tint={meta.tint}
                border={meta.border}
                onClick={() => toggleCat(slug)}
              >
                {meta.label}
              </Chip>
            );
          })}
        </FilterChips>

        <FilterChips label="Curadoria">
          {(["all", "curado", "nao-curado"] as CuracaoFilter[]).map((v) => (
            <Chip
              key={v}
              active={curacao === v}
              onClick={() => setCuracao(v)}
            >
              {v === "all" ? "Todos" : v === "curado" ? "Curados" : "Não-curados"}
            </Chip>
          ))}
        </FilterChips>

        <FilterChips label="Status">
          {(["publicado", "rascunho", "arquivado"] as StatusFilter[]).map(
            (s) => (
              <Chip
                key={s}
                active={activeStatuses.has(s)}
                onClick={() => toggleStatus(s)}
              >
                {STATUS_LABEL[s]}
              </Chip>
            ),
          )}
        </FilterChips>

        <FilterChips label="Criador">
          {(["all", "sistema", "associados"] as CreatorFilter[]).map((v) => (
            <Chip
              key={v}
              active={creator === v}
              onClick={() => setCreator(v)}
            >
              {v === "all"
                ? "Todos"
                : v === "sistema"
                  ? "Sistema (seed)"
                  : "Associados"}
            </Chip>
          ))}
        </FilterChips>
      </div>

      <div className="flex items-center justify-between mb-3 font-dm text-xs">
        <p className="text-cream/40">
          {loading ? "Carregando…" : `${sorted.length} de ${rows.length} exercícios`}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-cream/40 hover:text-accent transition-colors"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela — visível só em md+ */}
      <div
        className="hidden md:block rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        {/* Header */}
        <div
          className="grid grid-cols-[40px_1fr_140px_140px_120px_120px_160px] gap-3 px-4 py-2.5 font-dm text-[10px] font-bold tracking-widest uppercase text-cream/45"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            onClick={() => toggleSort("number")}
            className="text-left inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            #
            <ArrowUpDown width={10} height={10} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => toggleSort("titulo")}
            className="text-left inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            Título
            <ArrowUpDown width={10} height={10} aria-hidden="true" />
          </button>
          <span>Categoria</span>
          <span>Status</span>
          <span>Criador</span>
          <button
            type="button"
            onClick={() => toggleSort("updated")}
            className="text-left inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            Atualizado
            <ArrowUpDown width={10} height={10} aria-hidden="true" />
          </button>
          <span className="text-right">Ações</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-cream/40 font-dm text-sm">
            <Loader2 className="animate-spin inline mr-2" width={14} height={14} />
            Carregando exercícios…
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center font-dm text-sm text-cream/40">
            Nenhum exercício corresponde aos filtros.
          </div>
        ) : (
          sorted.map((row) => (
            <ExercicioRow
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onEdit={() =>
                router.push(
                  `/formacao/admin/associados/aprimoramento/${row.id}/editar`,
                )
              }
              onSetCurado={(c) => handleSetCurado(row, c)}
              onSetStatus={(s) => handleSetStatus(row, s)}
              onDelete={() => setDeleteTarget(row)}
            />
          ))
        )}
      </div>

      {/* Cards — visíveis só em mobile (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="p-8 text-center text-cream/40 font-dm text-sm">
            <Loader2 className="animate-spin inline mr-2" width={14} height={14} />
            Carregando exercícios…
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center font-dm text-sm text-cream/40">
            Nenhum exercício corresponde aos filtros.
          </div>
        ) : (
          sorted.map((row) => {
            const cat = CATEGORIES[row.category];
            const curado = isCurated(row);
            const arquivado = row.status === "arquivado";
            const busy = busyId === row.id;
            return (
              <div
                key={row.id}
                className="rounded-[14px] p-3.5"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {/* Topo: número + título */}
                <div className="flex items-start gap-2 mb-2">
                  <span className="font-fraunces text-sm text-cream/50 shrink-0 mt-0.5">
                    #{row.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          `/formacao/admin/associados/aprimoramento/${row.id}/editar`,
                        )
                      }
                      className="font-fraunces text-sm text-cream hover:text-accent transition-colors text-left line-clamp-2 w-full"
                    >
                      {row.title}
                    </button>
                    <p className="font-dm text-[10.5px] text-cream/35 truncate mt-0.5">
                      {row.slug}
                    </p>
                  </div>
                </div>

                {/* Meta: categoria + status + curado */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <span
                    className="font-dm text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md"
                    style={{
                      color: cat.color,
                      background: cat.tint,
                      border: `1px solid ${cat.border}`,
                    }}
                  >
                    {cat.label}
                  </span>
                  <Badge
                    label={
                      row.status === "publicado"
                        ? "Publicado"
                        : row.status === "rascunho"
                          ? "Rascunho"
                          : "Arquivado"
                    }
                    color={
                      row.status === "publicado"
                        ? "#34D399"
                        : row.status === "rascunho"
                          ? "#D4854A"
                          : "#9CA3AF"
                    }
                  />
                  {!curado && <Badge label="Não-curado" color="#D4854A" />}
                  <span className="font-dm text-[10px] text-cream/35 self-center ml-auto">
                    {formatDistanceToNow(new Date(row.updatedAt), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </span>
                </div>

                {/* Ações rotuladas */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/formacao/admin/associados/aprimoramento/${row.id}/editar`,
                      )
                    }
                    disabled={busy}
                    className="font-dm text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors disabled:opacity-30"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      color: "rgba(253,251,247,0.75)",
                    }}
                  >
                    <Edit width={12} height={12} aria-hidden="true" />
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => window.open(`/formacao/aprimoramento-dinamicas/${row.slug}`, "_blank")}
                    className="font-dm text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      color: "rgba(253,251,247,0.75)",
                    }}
                  >
                    <ExternalLink width={12} height={12} aria-hidden="true" />
                    Ver
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetCurado(row, !curado)}
                    disabled={busy}
                    className="font-dm text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors disabled:opacity-30"
                    style={{
                      background: curado ? "rgba(245,158,11,0.10)" : "rgba(255,255,255,0.05)",
                      border: `1px solid ${curado ? "rgba(245,158,11,0.25)" : "rgba(255,255,255,0.09)"}`,
                      color: curado ? "#F59E0B" : "rgba(253,251,247,0.75)",
                    }}
                  >
                    <Star
                      width={12}
                      height={12}
                      aria-hidden="true"
                      fill={curado ? "currentColor" : "none"}
                    />
                    {curado ? "Curado" : "Curar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSetStatus(row, arquivado ? "publicado" : "arquivado")}
                    disabled={busy}
                    className="font-dm text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors disabled:opacity-30"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.09)",
                      color: "rgba(253,251,247,0.75)",
                    }}
                  >
                    {arquivado ? (
                      <ArchiveRestore width={12} height={12} aria-hidden="true" />
                    ) : (
                      <Archive width={12} height={12} aria-hidden="true" />
                    )}
                    {arquivado ? "Desarquivar" : "Arquivar"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(row)}
                    disabled={busy}
                    className="font-dm text-xs px-3 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors disabled:opacity-30"
                    style={{
                      background: "rgba(248,113,113,0.06)",
                      border: "1px solid rgba(248,113,113,0.15)",
                      color: "rgba(248,113,113,0.80)",
                    }}
                  >
                    <Trash2 width={12} height={12} aria-hidden="true" />
                    Excluir
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir exercício?"
        description={
          deleteTarget ? (
            <>
              <strong className="text-cream">{deleteTarget.title}</strong> será
              removido permanentemente. Estados pessoais e notas dos associados
              perdem o vínculo. Esta ação não pode ser desfeita.
            </>
          ) : null
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function FilterChips({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/35 mr-1 min-w-[70px]">
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
}

function Chip({ children, active, onClick, color, tint, border }: ChipProps) {
  const c = color ?? "#FDFBF7";
  const t = tint ?? "rgba(255,255,255,0.05)";
  const b = border ?? "rgba(255,255,255,0.12)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-dm text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
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

interface ExercicioRowProps {
  row: AdminExercicioRow;
  busy: boolean;
  onEdit: () => void;
  onSetCurado: (c: boolean) => void;
  onSetStatus: (s: "publicado" | "arquivado") => void;
  onDelete: () => void;
}

function ExercicioRow({
  row,
  busy,
  onEdit,
  onSetCurado,
  onSetStatus,
  onDelete,
}: ExercicioRowProps) {
  const cat = CATEGORIES[row.category];
  const curado = isCurated(row);
  const arquivado = row.status === "arquivado";

  return (
    <div
      className="grid grid-cols-[40px_1fr_140px_140px_120px_120px_160px] gap-3 px-4 py-3 items-center group transition-colors hover:bg-white/[0.025]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* # */}
      <span className="font-fraunces text-sm text-cream/65">{row.number}</span>

      {/* Título */}
      <div className="min-w-0">
        <button
          type="button"
          onClick={onEdit}
          className="font-fraunces text-sm text-cream hover:text-accent transition-colors text-left line-clamp-1"
          title={row.title}
        >
          {row.title}
        </button>
        <p className="font-dm text-[10.5px] text-cream/35 truncate mt-0.5">
          {row.slug}
        </p>
      </div>

      {/* Categoria */}
      <span
        className="font-dm text-[10.5px] font-semibold tracking-wider uppercase px-2 py-1 rounded-md w-fit"
        style={{
          color: cat.color,
          background: cat.tint,
          border: `1px solid ${cat.border}`,
        }}
      >
        {cat.label}
      </span>

      {/* Status / Curado */}
      <div className="flex flex-col gap-1">
        <Badge
          label={row.status === "publicado" ? "Publicado" : row.status === "rascunho" ? "Rascunho" : "Arquivado"}
          color={
            row.status === "publicado"
              ? "#34D399"
              : row.status === "rascunho"
                ? "#D4854A"
                : "#9CA3AF"
          }
        />
        {!curado && (
          <Badge label="Não-curado" color="#D4854A" />
        )}
      </div>

      {/* Criador */}
      <span className="font-dm text-[11px] text-cream/50 truncate">
        {row.criadoPor ? row.criadoPor.slice(0, 8) : "Sistema"}
      </span>

      {/* Atualizado */}
      <span
        className="font-dm text-[11px] text-cream/50 truncate"
        title={row.updatedAt}
      >
        {formatDistanceToNow(new Date(row.updatedAt), {
          addSuffix: true,
          locale: ptBR,
        })}
      </span>

      {/* Ações */}
      <div className="flex items-center justify-end gap-1">
        <IconBtn
          onClick={() => window.open(`/formacao/aprimoramento-dinamicas/${row.slug}`, "_blank")}
          title="Ver no site"
        >
          <ExternalLink width={13} height={13} aria-hidden="true" />
        </IconBtn>
        <IconBtn onClick={onEdit} title="Editar" disabled={busy}>
          <Edit width={13} height={13} aria-hidden="true" />
        </IconBtn>
        <IconBtn
          onClick={() => onSetCurado(!curado)}
          title={curado ? "Remover curadoria" : "Marcar como curado"}
          disabled={busy}
          active={curado}
        >
          <Star
            width={13}
            height={13}
            aria-hidden="true"
            fill={curado ? "currentColor" : "none"}
          />
        </IconBtn>
        <IconBtn
          onClick={() => onSetStatus(arquivado ? "publicado" : "arquivado")}
          title={arquivado ? "Desarquivar" : "Arquivar"}
          disabled={busy}
        >
          {arquivado ? (
            <ArchiveRestore width={13} height={13} aria-hidden="true" />
          ) : (
            <Archive width={13} height={13} aria-hidden="true" />
          )}
        </IconBtn>
        <IconBtn onClick={onDelete} title="Excluir" disabled={busy} danger>
          <Trash2 width={13} height={13} aria-hidden="true" />
        </IconBtn>
      </div>
    </div>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  const rgb = color.replace("#", "");
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return (
    <span
      className="font-dm text-[9.5px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded w-fit"
      style={{
        color,
        background: `rgba(${r},${g},${b},0.10)`,
        border: `1px solid rgba(${r},${g},${b},0.28)`,
      }}
    >
      {label}
    </span>
  );
}

interface IconBtnProps {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  active?: boolean;
  danger?: boolean;
}

function IconBtn({
  children,
  onClick,
  title,
  disabled,
  active,
  danger,
}: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        color: active
          ? "#F59E0B"
          : danger
            ? "rgba(248,113,113,0.7)"
            : "rgba(253,251,247,0.5)",
        background: active ? "rgba(245,158,11,0.10)" : "transparent",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = active
          ? "rgba(245,158,11,0.18)"
          : danger
            ? "rgba(248,113,113,0.10)"
            : "rgba(255,255,255,0.06)";
        e.currentTarget.style.color = active
          ? "#F59E0B"
          : danger
            ? "#F87171"
            : "#FDFBF7";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active
          ? "rgba(245,158,11,0.10)"
          : "transparent";
        e.currentTarget.style.color = active
          ? "#F59E0B"
          : danger
            ? "rgba(248,113,113,0.7)"
            : "rgba(253,251,247,0.5)";
      }}
    >
      {children}
    </button>
  );
}
