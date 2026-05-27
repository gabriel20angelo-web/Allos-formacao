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
  Lightbulb,
  Search,
  Sparkles,
  XCircle,
  RotateCcw,
  Trash2,
  ExternalLink,
  Loader2,
  ArrowUpDown,
  User as UserIcon,
} from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import {
  listSugestoesForAdmin,
  descartarSugestao,
  reabrirSugestao,
  deleteSugestao,
  transformarEmRascunho,
  type SugestaoAdminRow,
  type SugestaoStatus,
} from "@/lib/queries/aprimoramento-sugestoes-admin";
import { CATEGORIES } from "@/lib/aprimoramento-categories";

type SortKey = "created" | "titulo";

const STATUS_META: Record<
  SugestaoStatus,
  { label: string; color: string; tint: string; border: string }
> = {
  pendente: {
    label: "Pendente",
    color: "#D4A857",
    tint: "rgba(212,168,87,0.10)",
    border: "rgba(212,168,87,0.28)",
  },
  desenvolvido: {
    label: "Desenvolvido",
    color: "#34D399",
    tint: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.28)",
  },
  descartado: {
    label: "Descartado",
    color: "#9CA3AF",
    tint: "rgba(156,163,175,0.10)",
    border: "rgba(156,163,175,0.28)",
  },
};

function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export default function SugestoesAdminPage() {
  const { isAdmin, user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [rows, setRows] = useState<SugestaoAdminRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState<Set<SugestaoStatus>>(
    new Set<SugestaoStatus>(["pendente"]),
  );
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [busyId, setBusyId] = useState<string | null>(null);

  const [discardTarget, setDiscardTarget] = useState<SugestaoAdminRow | null>(
    null,
  );
  const [discardNote, setDiscardNote] = useState("");
  const [discarding, setDiscarding] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<SugestaoAdminRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const data = await listSugestoesForAdmin();
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

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return rows.filter((r) => {
      if (activeStatuses.size > 0 && !activeStatuses.has(r.status)) return false;
      if (!q) return true;
      const hay = normalize(
        [r.titulo, r.descricao, r.criadoPorNome ?? "", r.criadoPorEmail ?? ""].join(
          " ",
        ),
      );
      return hay.includes(q);
    });
  }, [rows, query, activeStatuses]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "titulo":
        arr.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR") * dir);
        break;
      default:
        arr.sort(
          (a, b) => (a.createdAt > b.createdAt ? 1 : -1) * dir,
        );
    }
    return arr;
  }, [filtered, sortKey, sortDir]);

  const pendingCount = useMemo(
    () => rows.filter((r) => r.status === "pendente").length,
    [rows],
  );

  function toggleStatus(s: SugestaoStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      if (next.size === 0) return prev;
      return next;
    });
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "created" ? "desc" : "asc");
    }
  }

  async function handleTransform(row: SugestaoAdminRow) {
    if (!user) return;
    setBusyId(row.id);
    const { exercicio, error } = await transformarEmRascunho(row, user.id);
    setBusyId(null);
    if (error || !exercicio) {
      toast.error(`Falha ao criar rascunho: ${error?.message ?? "desconhecido"}`);
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: "desenvolvido" as const,
              exercicioId: exercicio.id,
              exercicioSlug: exercicio.slug,
              exercicioTitulo: exercicio.title,
              exercicioStatus: exercicio.status ?? "rascunho",
            }
          : r,
      ),
    );
    toast.success("Rascunho criado — abrindo editor");
    router.push(
      `/formacao/admin/associados/aprimoramento/${exercicio.id}/editar`,
    );
  }

  async function handleDiscard() {
    if (!discardTarget) return;
    setDiscarding(true);
    const { error } = await descartarSugestao(
      discardTarget.id,
      discardNote.trim(),
    );
    setDiscarding(false);
    if (error) {
      toast.error(`Falha: ${error.message}`);
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === discardTarget.id
          ? {
              ...r,
              status: "descartado" as const,
              notaAdmin: discardNote.trim(),
            }
          : r,
      ),
    );
    setDiscardTarget(null);
    setDiscardNote("");
    toast.success("Sugestão descartada");
  }

  async function handleReopen(row: SugestaoAdminRow) {
    setBusyId(row.id);
    const { error } = await reabrirSugestao(row.id);
    setBusyId(null);
    if (error) {
      toast.error(`Falha ao reabrir: ${error.message}`);
      return;
    }
    setRows((rs) =>
      rs.map((r) =>
        r.id === row.id
          ? {
              ...r,
              status: "pendente" as const,
              notaAdmin: "",
              exercicioId: null,
              exercicioSlug: null,
              exercicioTitulo: null,
              exercicioStatus: null,
            }
          : r,
      ),
    );
    toast.success("Sugestão reaberta");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await deleteSugestao(deleteTarget.id);
    setDeleting(false);
    if (error) {
      toast.error(`Falha ao excluir: ${error.message}`);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
    toast.success("Sugestão excluída");
  }

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

  return (
    <div className="max-w-6xl">
      <Link
        href="/formacao/admin/associados"
        className="font-dm text-[12px] inline-flex items-center gap-1 text-cream/55 hover:text-accent transition-colors mb-6"
      >
        <ChevronLeft width={14} height={14} aria-hidden="true" />
        Associados
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <Lightbulb
            width={14}
            height={14}
            style={{ color: "#D4A857" }}
            aria-hidden="true"
          />
          <p
            className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase"
            style={{ color: "#D4A857" }}
          >
            Fila
          </p>
        </div>
        <h1 className="font-fraunces text-3xl md:text-4xl text-cream leading-tight mb-3">
          Sugestões
          {pendingCount > 0 && (
            <span
              className="ml-3 font-dm text-[13px] font-semibold align-middle px-2.5 py-1 rounded-full"
              style={{
                color: "#D4A857",
                background: "rgba(212,168,87,0.10)",
                border: "1px solid rgba(212,168,87,0.28)",
              }}
            >
              {pendingCount} pendente{pendingCount === 1 ? "" : "s"}
            </span>
          )}
        </h1>
        <p className="font-dm text-base text-cream/55 leading-relaxed max-w-2xl">
          Ideias de dinâmicas enviadas por associados. Você pode transformar uma
          sugestão em rascunho de exercício pra editar, descartá-la com uma nota,
          ou reabrir uma já fechada.
        </p>
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
            placeholder="Buscar por título, descrição, autor…"
            className="font-dm text-sm w-full pl-10 pr-3 py-2.5 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
        </div>
      </div>

      {/* Filtro status */}
      <div
        className="rounded-xl p-3 mb-3 flex flex-wrap items-center gap-1.5"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <span className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/35 mr-1">
          Status
        </span>
        {(Object.keys(STATUS_META) as SugestaoStatus[]).map((s) => {
          const meta = STATUS_META[s];
          const active = activeStatuses.has(s);
          return (
            <button
              key={s}
              type="button"
              onClick={() => toggleStatus(s)}
              className="font-dm text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
              style={{
                color: active ? meta.color : "rgba(253,251,247,0.55)",
                background: active ? meta.tint : "rgba(255,255,255,0.025)",
                border: `1px solid ${active ? meta.border : "rgba(255,255,255,0.07)"}`,
              }}
              aria-pressed={active}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-3 font-dm text-xs">
        <p className="text-cream/40">
          {loading ? "Carregando…" : `${sorted.length} de ${rows.length} sugestões`}
        </p>
      </div>

      {/* Tabela */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
      >
        <div
          className="hidden md:grid grid-cols-[1fr_180px_120px_160px_200px] gap-3 px-4 py-2.5 font-dm text-[10px] font-bold tracking-widest uppercase text-cream/45"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            type="button"
            onClick={() => toggleSort("titulo")}
            className="text-left inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            Sugestão
            <ArrowUpDown width={10} height={10} aria-hidden="true" />
          </button>
          <span>Autor</span>
          <span>Status</span>
          <button
            type="button"
            onClick={() => toggleSort("created")}
            className="text-left inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            Enviada
            <ArrowUpDown width={10} height={10} aria-hidden="true" />
          </button>
          <span className="text-right">Ações</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-cream/40 font-dm text-sm">
            <Loader2
              className="animate-spin inline mr-2"
              width={14}
              height={14}
            />
            Carregando sugestões…
          </div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center font-dm text-sm text-cream/40">
            {rows.length === 0
              ? "Nenhuma sugestão recebida ainda."
              : "Nenhuma sugestão corresponde aos filtros."}
          </div>
        ) : (
          sorted.map((row) => (
            <SugestaoRow
              key={row.id}
              row={row}
              busy={busyId === row.id}
              onTransform={() => handleTransform(row)}
              onDiscard={() => {
                setDiscardTarget(row);
                setDiscardNote(row.notaAdmin);
              }}
              onReopen={() => handleReopen(row)}
              onDelete={() => setDeleteTarget(row)}
            />
          ))
        )}
      </div>

      {/* Modal descartar */}
      <ConfirmDialog
        open={!!discardTarget}
        onClose={() => {
          setDiscardTarget(null);
          setDiscardNote("");
        }}
        onConfirm={handleDiscard}
        title="Descartar sugestão?"
        description={
          discardTarget ? (
            <>
              <strong className="text-cream">{discardTarget.titulo}</strong>{" "}
              ficará marcada como descartada. O autor continua vendo a sugestão e
              a nota abaixo.
            </>
          ) : null
        }
        confirmLabel="Descartar"
        cancelLabel="Cancelar"
        variant="danger"
        loading={discarding}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="discard-note"
            className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/45 block"
          >
            Nota pro autor (opcional)
          </label>
          <textarea
            id="discard-note"
            value={discardNote}
            onChange={(e) => setDiscardNote(e.target.value)}
            rows={4}
            maxLength={500}
            placeholder="Ex.: já existe um exercício parecido no acervo…"
            className="font-dm text-sm w-full px-3 py-2.5 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          />
          <p className="font-dm text-[10px] text-cream/30 text-right">
            {discardNote.length}/500
          </p>
        </div>
      </ConfirmDialog>

      {/* Modal excluir */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir sugestão?"
        description={
          deleteTarget ? (
            <>
              <strong className="text-cream">{deleteTarget.titulo}</strong> será
              removida permanentemente. O exercício gerado (se houver) NÃO é
              afetado. Esta ação não pode ser desfeita.
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

// ─── Linha ──────────────────────────────────────────────────────────────────

interface SugestaoRowProps {
  row: SugestaoAdminRow;
  busy: boolean;
  onTransform: () => void;
  onDiscard: () => void;
  onReopen: () => void;
  onDelete: () => void;
}

function SugestaoRow({
  row,
  busy,
  onTransform,
  onDiscard,
  onReopen,
  onDelete,
}: SugestaoRowProps) {
  const statusMeta = STATUS_META[row.status];
  const catMeta = row.categoriaSugerida
    ? CATEGORIES[row.categoriaSugerida]
    : null;
  const isPending = row.status === "pendente";

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[1fr_180px_120px_160px_200px] gap-3 px-4 py-3.5 items-start md:items-center group transition-colors hover:bg-white/[0.025]"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
    >
      {/* Título + descrição + categoria sugerida */}
      <div className="min-w-0">
        <p className="font-fraunces text-sm text-cream line-clamp-1 mb-1">
          {row.titulo}
        </p>
        {row.descricao && (
          <p className="font-dm text-[12px] text-cream/45 line-clamp-2 leading-relaxed">
            {row.descricao}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          {catMeta && (
            <span
              className="font-dm text-[9.5px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded"
              style={{
                color: catMeta.color,
                background: catMeta.tint,
                border: `1px solid ${catMeta.border}`,
              }}
              title="Categoria sugerida pelo autor"
            >
              {catMeta.label}
            </span>
          )}
          {row.status === "desenvolvido" && row.exercicioSlug && (
            <Link
              href={`/formacao/aprimoramento-dinamicas/${row.exercicioSlug}`}
              target="_blank"
              className="font-dm text-[10px] inline-flex items-center gap-1 text-accent/80 hover:text-accent transition-colors"
              title="Abrir exercício gerado"
            >
              <Sparkles width={10} height={10} aria-hidden="true" />
              {row.exercicioTitulo}
              <ExternalLink width={9} height={9} aria-hidden="true" />
            </Link>
          )}
          {row.status === "descartado" && row.notaAdmin && (
            <span
              className="font-dm text-[10px] text-cream/40 italic"
              title={row.notaAdmin}
            >
              &quot;{row.notaAdmin.slice(0, 60)}
              {row.notaAdmin.length > 60 ? "…" : ""}&quot;
            </span>
          )}
        </div>
      </div>

      {/* Autor */}
      <div className="min-w-0 flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{
            background: "rgba(200,75,49,0.10)",
            border: "1px solid rgba(200,75,49,0.18)",
          }}
        >
          <UserIcon
            width={11}
            height={11}
            className="text-accent/70"
            aria-hidden="true"
          />
        </div>
        <div className="min-w-0">
          <p className="font-dm text-[12px] text-cream/75 truncate">
            {row.criadoPorNome ?? "—"}
          </p>
          {row.criadoPorEmail && (
            <p className="font-dm text-[10px] text-cream/35 truncate">
              {row.criadoPorEmail}
            </p>
          )}
        </div>
      </div>

      {/* Status */}
      <span
        className="font-dm text-[10.5px] font-semibold tracking-wider uppercase px-2 py-1 rounded-md w-fit"
        style={{
          color: statusMeta.color,
          background: statusMeta.tint,
          border: `1px solid ${statusMeta.border}`,
        }}
      >
        {statusMeta.label}
      </span>

      {/* Enviada */}
      <span
        className="font-dm text-[11px] text-cream/50 truncate"
        title={row.createdAt}
      >
        {formatDistanceToNow(new Date(row.createdAt), {
          addSuffix: true,
          locale: ptBR,
        })}
      </span>

      {/* Ações */}
      <div className="flex items-center justify-end gap-2 flex-wrap">
        {isPending && (
          <button
            type="button"
            onClick={onTransform}
            disabled={busy}
            className="font-dm text-[11.5px] font-medium inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:translate-y-[-1px]"
            style={{
              color: "#C84B31",
              background: "rgba(200,75,49,0.10)",
              border: "1px solid rgba(200,75,49,0.28)",
            }}
            title="Cria rascunho de exercício a partir desta sugestão"
          >
            {busy ? (
              <Loader2
                width={11}
                height={11}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Sparkles width={11} height={11} aria-hidden="true" />
            )}
            Transformar
          </button>
        )}
        {isPending && (
          <IconBtn
            onClick={onDiscard}
            title="Descartar com nota"
            disabled={busy}
          >
            <XCircle width={13} height={13} aria-hidden="true" />
          </IconBtn>
        )}
        {!isPending && (
          <IconBtn
            onClick={onReopen}
            title="Reabrir como pendente"
            disabled={busy}
          >
            <RotateCcw width={13} height={13} aria-hidden="true" />
          </IconBtn>
        )}
        <IconBtn onClick={onDelete} title="Excluir" disabled={busy} danger>
          <Trash2 width={13} height={13} aria-hidden="true" />
        </IconBtn>
      </div>
    </div>
  );
}

interface IconBtnProps {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  danger?: boolean;
}

function IconBtn({ children, onClick, title, disabled, danger }: IconBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
      style={{
        color: danger ? "rgba(248,113,113,0.7)" : "rgba(253,251,247,0.5)",
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.background = danger
          ? "rgba(248,113,113,0.10)"
          : "rgba(255,255,255,0.06)";
        e.currentTarget.style.color = danger ? "#F87171" : "#FDFBF7";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger
          ? "rgba(248,113,113,0.7)"
          : "rgba(253,251,247,0.5)";
      }}
    >
      {children}
    </button>
  );
}
