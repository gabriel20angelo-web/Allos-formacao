"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Lightbulb,
  Sparkles,
  Send,
  Loader2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import {
  createSugestao,
  listMySugestoes,
  type MinhaSugestao,
  type SugestaoStatus,
} from "@/lib/queries/aprimoramento-sugestoes";
import { CATEGORIES, CATEGORY_ORDER } from "@/lib/aprimoramento-categories";
import type { CategorySlug } from "@/lib/aprimoramento-dinamicas";

const TITLE_MAX = 100;
const DESC_MAX = 500;

type Tab = "nova" | "minhas";

export default function SuggestIdeaTrigger() {
  const { user, isAssociado, isAdmin , isCondutor, isEventos } = useAuth();
  // Quem conduz grupo e quem cuida de eventos também: o papel é uma coluna só,
  // então marcar alguém como condutor apagava o "associado" dela e tirava
  // justamente de quem mais usa isto.
  const allowed = !!user && (isAssociado || isAdmin || isCondutor || isEventos);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("nova");

  // Form
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<CategorySlug | "">("");
  const [submitting, setSubmitting] = useState(false);

  // Minhas
  const [mine, setMine] = useState<MinhaSugestao[] | null>(null);
  const [loadingMine, setLoadingMine] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!user) return;
    setLoadingMine(true);
    listMySugestoes()
      .then((rows) => setMine(rows))
      .catch(() => setMine([]))
      .finally(() => setLoadingMine(false));
  }, [open, user]);

  if (!allowed) return null;

  const pendingCount = mine?.filter((s) => s.status === "pendente").length ?? 0;
  const tituloTrim = titulo.trim();
  const descricaoTrim = descricao.trim();
  const formValid =
    tituloTrim.length >= 4 &&
    tituloTrim.length <= TITLE_MAX &&
    descricaoTrim.length >= 10 &&
    descricaoTrim.length <= DESC_MAX;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !formValid || submitting) return;
    setSubmitting(true);
    const { data, error } = await createSugestao(
      {
        titulo: tituloTrim,
        descricao: descricaoTrim,
        categoriaSugerida: categoria === "" ? null : categoria,
      },
      user.id,
    );
    setSubmitting(false);
    if (error || !data) {
      toast.error(`Falha ao enviar: ${error?.message ?? "desconhecido"}`);
      return;
    }
    toast.success("Sugestão enviada! Avisaremos quando for analisada.");
    // Reset form
    setTitulo("");
    setDescricao("");
    setCategoria("");
    // Recarrega lista + muda pra aba "minhas"
    setLoadingMine(true);
    const rows = await listMySugestoes();
    setMine(rows);
    setLoadingMine(false);
    setTab("minhas");
  }

  function closeModal() {
    if (submitting) return;
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTab("nova");
        }}
        className="group w-full md:w-auto inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl transition-all hover:translate-y-[-1px]"
        style={{
          background:
            "linear-gradient(135deg, rgba(212,168,87,0.14), rgba(212,168,87,0.06))",
          border: "1px solid rgba(212,168,87,0.28)",
          color: "#D4A857",
        }}
      >
        <Lightbulb width={14} height={14} aria-hidden="true" />
        <span className="font-dm text-[13px] font-medium">
          Tem ideia de exercício?
        </span>
        <span className="font-dm text-[11px] text-cream/45 hidden md:inline">
          Sugira aqui
        </span>
      </button>

      <Modal
        open={open}
        onClose={closeModal}
        title="Sugerir dinâmica"
        maxWidth="max-w-xl"
      >
        {/* Tabs */}
        <div
          className="flex items-center gap-1 mb-5 p-1 rounded-xl"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <TabButton
            active={tab === "nova"}
            onClick={() => setTab("nova")}
            label="Nova ideia"
          />
          <TabButton
            active={tab === "minhas"}
            onClick={() => setTab("minhas")}
            label={`Minhas sugestões${
              mine && mine.length > 0 ? ` · ${mine.length}` : ""
            }`}
            badge={pendingCount > 0 ? pendingCount : undefined}
          />
        </div>

        {tab === "nova" ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="font-dm text-[13px] text-cream/55 leading-relaxed">
              Conta a ideia em poucas linhas — alguém da curadoria avalia, e se
              for o caminho, vira um rascunho de exercício pra ser desenvolvido.
            </p>

            {/* Título */}
            <Field
              id="sg-title"
              label="Título"
              required
              hint={`${tituloTrim.length}/${TITLE_MAX}`}
            >
              <input
                id="sg-title"
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value.slice(0, TITLE_MAX))}
                placeholder="Ex.: Roleplay sobre confronto suave"
                maxLength={TITLE_MAX}
                className="font-dm text-sm w-full px-3 py-2.5 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </Field>

            {/* Descrição */}
            <Field
              id="sg-desc"
              label="Descrição"
              required
              hint={`${descricaoTrim.length}/${DESC_MAX}`}
            >
              <textarea
                id="sg-desc"
                value={descricao}
                onChange={(e) =>
                  setDescricao(e.target.value.slice(0, DESC_MAX))
                }
                rows={5}
                maxLength={DESC_MAX}
                placeholder="Pra que serve, em que contexto entra e como funciona — em traços gerais."
                className="font-dm text-sm w-full px-3 py-2.5 rounded-xl text-cream placeholder:text-cream/30 focus:outline-none focus:ring-1 focus:ring-accent/50 resize-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              />
            </Field>

            {/* Categoria */}
            <Field id="sg-cat" label="Categoria sugerida (opcional)">
              <div className="flex flex-wrap gap-1.5">
                <CategoryChip
                  active={categoria === ""}
                  onClick={() => setCategoria("")}
                  label="Não sei ainda"
                />
                {CATEGORY_ORDER.map((slug) => {
                  const meta = CATEGORIES[slug];
                  return (
                    <CategoryChip
                      key={slug}
                      active={categoria === slug}
                      onClick={() => setCategoria(slug)}
                      label={meta.label}
                      color={meta.color}
                      tint={meta.tint}
                      border={meta.border}
                    />
                  );
                })}
              </div>
            </Field>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                disabled={submitting}
                className="font-dm text-sm px-4 py-2 rounded-xl text-cream/55 hover:text-cream transition-colors disabled:opacity-40"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!formValid || submitting}
                className="font-dm text-sm font-medium inline-flex items-center gap-2 px-4 py-2 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:translate-y-[-1px]"
                style={{
                  background: "linear-gradient(135deg, #C84B31, #A33D27)",
                  color: "white",
                  boxShadow: "0 2px 12px rgba(200,75,49,0.25)",
                }}
              >
                {submitting ? (
                  <Loader2
                    width={14}
                    height={14}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Send width={14} height={14} aria-hidden="true" />
                )}
                Enviar sugestão
              </button>
            </div>
          </form>
        ) : (
          <MinhasSugestoes mine={mine} loading={loadingMine} />
        )}
      </Modal>
    </>
  );
}

// ─── Sub-componentes ────────────────────────────────────────────────────────

function Field({
  id,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label
          htmlFor={id}
          className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/55"
        >
          {label}
          {required && <span className="text-accent ml-1">*</span>}
        </label>
        {hint && (
          <span className="font-dm text-[10px] text-cream/30">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex-1 font-dm text-[12px] font-medium px-3 py-2 rounded-lg transition-all inline-flex items-center justify-center gap-1.5"
      style={{
        color: active ? "#FDFBF7" : "rgba(253,251,247,0.45)",
        background: active ? "rgba(255,255,255,0.08)" : "transparent",
      }}
      aria-pressed={active}
    >
      {label}
      {badge !== undefined && (
        <span
          className="font-dm text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center"
          style={{
            color: "#D4A857",
            background: "rgba(212,168,87,0.14)",
            border: "1px solid rgba(212,168,87,0.28)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function CategoryChip({
  active,
  onClick,
  label,
  color,
  tint,
  border,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
  tint?: string;
  border?: string;
}) {
  const c = color ?? "#FDFBF7";
  const t = tint ?? "rgba(255,255,255,0.05)";
  const b = border ?? "rgba(255,255,255,0.12)";
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-dm text-[11.5px] font-medium px-2.5 py-1 rounded-full transition-all"
      style={{
        color: active ? c : "rgba(253,251,247,0.55)",
        background: active ? t : "rgba(255,255,255,0.025)",
        border: `1px solid ${active ? b : "rgba(255,255,255,0.07)"}`,
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

function MinhasSugestoes({
  mine,
  loading,
}: {
  mine: MinhaSugestao[] | null;
  loading: boolean;
}) {
  if (loading || mine === null) {
    return (
      <div className="py-12 text-center font-dm text-sm text-cream/40">
        <Loader2
          className="animate-spin inline mr-2"
          width={14}
          height={14}
        />
        Carregando…
      </div>
    );
  }
  if (mine.length === 0) {
    return (
      <div className="py-10 text-center">
        <Lightbulb
          className="mx-auto mb-3 text-cream/30"
          width={28}
          height={28}
          aria-hidden="true"
        />
        <p className="font-dm text-sm text-cream/50 mb-1">
          Você ainda não enviou nenhuma sugestão.
        </p>
        <p className="font-dm text-[12px] text-cream/35">
          Use a aba &quot;Nova ideia&quot; pra começar.
        </p>
      </div>
    );
  }
  return (
    <ul className="space-y-2.5 max-h-[60vh] overflow-y-auto -mx-1 px-1">
      {mine.map((s) => (
        <SugestaoItem key={s.id} sugestao={s} />
      ))}
    </ul>
  );
}

const STATUS_META: Record<
  SugestaoStatus,
  {
    label: string;
    color: string;
    tint: string;
    border: string;
    Icon: typeof Clock;
  }
> = {
  pendente: {
    label: "Em análise",
    color: "#D4A857",
    tint: "rgba(212,168,87,0.10)",
    border: "rgba(212,168,87,0.28)",
    Icon: Clock,
  },
  desenvolvido: {
    label: "Desenvolvida",
    color: "#34D399",
    tint: "rgba(52,211,153,0.10)",
    border: "rgba(52,211,153,0.28)",
    Icon: CheckCircle2,
  },
  descartado: {
    label: "Descartada",
    color: "#9CA3AF",
    tint: "rgba(156,163,175,0.10)",
    border: "rgba(156,163,175,0.28)",
    Icon: XCircle,
  },
};

function SugestaoItem({ sugestao }: { sugestao: MinhaSugestao }) {
  const meta = STATUS_META[sugestao.status];
  const cat = sugestao.categoriaSugerida
    ? CATEGORIES[sugestao.categoriaSugerida]
    : null;
  const exercicioPublicado =
    sugestao.exercicioSlug && sugestao.exercicioStatus === "publicado";

  return (
    <li
      className="rounded-xl p-3.5"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <h4 className="font-fraunces text-[14px] text-cream leading-snug flex-1 min-w-0">
          {sugestao.titulo}
        </h4>
        <span
          className="font-dm text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-md inline-flex items-center gap-1 flex-shrink-0"
          style={{
            color: meta.color,
            background: meta.tint,
            border: `1px solid ${meta.border}`,
          }}
        >
          <meta.Icon width={9} height={9} aria-hidden="true" />
          {meta.label}
        </span>
      </div>
      {sugestao.descricao && (
        <p className="font-dm text-[12px] text-cream/50 leading-relaxed line-clamp-2 mb-2">
          {sugestao.descricao}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {cat && (
          <span
            className="font-dm font-medium px-1.5 py-0.5 rounded"
            style={{
              color: cat.color,
              background: cat.tint,
              border: `1px solid ${cat.border}`,
            }}
          >
            {cat.label}
          </span>
        )}
        <span className="font-dm text-cream/35">
          enviada{" "}
          {formatDistanceToNow(new Date(sugestao.createdAt), {
            addSuffix: true,
            locale: ptBR,
          })}
        </span>
      </div>
      {sugestao.status === "descartado" && sugestao.notaAdmin && (
        <p
          className="font-dm text-[12px] text-cream/55 leading-relaxed italic mt-2 pl-3"
          style={{ borderLeft: "2px solid rgba(156,163,175,0.35)" }}
        >
          &quot;{sugestao.notaAdmin}&quot;
        </p>
      )}
      {sugestao.status === "desenvolvido" && exercicioPublicado && (
        <Link
          href={`/formacao/aprimoramento-dinamicas/${sugestao.exercicioSlug}`}
          className="font-dm text-[12px] inline-flex items-center gap-1 text-accent/85 hover:text-accent transition-colors mt-2"
        >
          <Sparkles width={11} height={11} aria-hidden="true" />
          Ver exercício gerado
          <ExternalLink width={10} height={10} aria-hidden="true" />
        </Link>
      )}
      {sugestao.status === "desenvolvido" && !exercicioPublicado && (
        <p className="font-dm text-[11.5px] text-cream/40 italic mt-2">
          Virou rascunho — aguardando publicação.
        </p>
      )}
    </li>
  );
}
