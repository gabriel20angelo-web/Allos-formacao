"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { ChevronLeft, Save, Eye, Loader2, Star } from "lucide-react";
import type {
  Block,
  CategorySlug,
  FormatoSlug,
} from "@/lib/aprimoramento-dinamicas";
import {
  CATEGORIES,
  CATEGORY_ORDER,
  FORMATOS,
  FORMATOS_ORDER,
} from "@/lib/aprimoramento-categories";
import {
  parseMarkdown,
  blocksToMarkdown,
} from "@/lib/aprimoramento-markdown";
import ExerciseBlocks from "@/components/aprimoramento/ExerciseBlocks";
import { isSlugAvailable } from "@/lib/queries/aprimoramento-exercicios-admin";

export interface EditorInitial {
  id?: string;
  slug?: string;
  number?: number;
  title?: string;
  summary?: string;
  category?: CategorySlug;
  formato?: FormatoSlug[];
  tags?: string[];
  recursos?: string[];
  blocks?: Block[];
  curado?: boolean;
  status?: "publicado" | "rascunho" | "arquivado";
}

interface EditorSubmit {
  slug: string;
  title: string;
  summary: string;
  category: CategorySlug;
  formato: FormatoSlug[];
  tags: string[];
  recursos: string[];
  blocks: Block[];
  curado: boolean;
  status: "publicado" | "rascunho" | "arquivado";
}

interface Props {
  mode: "novo" | "editar";
  initial?: EditorInitial;
  /** Recebe os dados validados. Deve retornar Promise — true = sucesso, redireciona. */
  onSubmit: (data: EditorSubmit) => Promise<boolean>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function ExerciseEditor({ mode, initial, onSubmit }: Props) {
  const router = useRouter();

  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugManual, setSlugManual] = useState(!!initial?.slug);
  const [summary, setSummary] = useState(initial?.summary ?? "");
  const [category, setCategory] = useState<CategorySlug>(
    initial?.category ?? "tecnica",
  );
  const [formato, setFormato] = useState<Set<FormatoSlug>>(
    new Set<FormatoSlug>(initial?.formato ?? ["discussao"]),
  );
  const [tagsInput, setTagsInput] = useState(
    (initial?.tags ?? []).join(", "),
  );
  const [recursosInput, setRecursosInput] = useState(
    (initial?.recursos ?? []).join(", "),
  );
  const [status, setStatus] = useState<"publicado" | "rascunho" | "arquivado">(
    initial?.status ?? "publicado",
  );
  const [curado, setCurado] = useState<boolean>(initial?.curado ?? false);
  const [markdown, setMarkdown] = useState(
    blocksToMarkdown(initial?.blocks ?? []),
  );

  const [saving, setSaving] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  // Auto-gera slug do título enquanto user não editar slug manualmente
  useEffect(() => {
    if (!slugManual) {
      setSlug(slugify(title));
    }
  }, [title, slugManual]);

  // Parse markdown → blocks (live preview)
  const previewBlocks = useMemo(() => parseMarkdown(markdown), [markdown]);

  const tags = useMemo(
    () =>
      tagsInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [tagsInput],
  );
  const recursos = useMemo(
    () =>
      recursosInput
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    [recursosInput],
  );

  function toggleFormato(f: FormatoSlug) {
    setFormato((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      if (next.size === 0) return prev; // pelo menos 1
      return next;
    });
  }

  async function validateAndSave(opts: { withCurar?: boolean } = {}) {
    setSlugError(null);

    if (!title.trim()) {
      toast.error("Título obrigatório");
      return;
    }
    if (!slug) {
      toast.error("Slug obrigatório");
      return;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugError("Use só letras minúsculas, números e hífen");
      toast.error("Slug com caracteres inválidos");
      return;
    }
    if (!summary.trim()) {
      toast.error("Resumo obrigatório");
      return;
    }
    if (previewBlocks.length === 0) {
      toast.error("Conteúdo vazio — escreva pelo menos um parágrafo");
      return;
    }

    setSaving(true);

    // Slug uniqueness (skip checagem se está editando E slug não mudou)
    if (mode === "novo" || slug !== initial?.slug) {
      const available = await isSlugAvailable(slug, initial?.id);
      if (!available) {
        setSlugError("Já existe um exercício com esse slug");
        toast.error("Slug duplicado");
        setSaving(false);
        return;
      }
    }

    const data: EditorSubmit = {
      slug,
      title: title.trim(),
      summary: summary.trim(),
      category,
      formato: Array.from(formato),
      tags,
      recursos,
      blocks: previewBlocks,
      curado: opts.withCurar ? true : curado,
      status,
    };

    const ok = await onSubmit(data);
    setSaving(false);
    if (ok) {
      toast.success(
        mode === "novo" ? "Exercício criado" : "Exercício atualizado",
      );
      router.push("/formacao/admin/associados/aprimoramento");
    }
  }

  return (
    <div className="max-w-7xl">
      <Link
        href="/formacao/admin/associados/aprimoramento"
        className="font-dm text-[12px] inline-flex items-center gap-1 text-cream/55 hover:text-accent transition-colors mb-6"
      >
        <ChevronLeft width={14} height={14} aria-hidden="true" />
        Aprimoramento de Dinâmicas
      </Link>

      <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
        <div>
          <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-2">
            {mode === "novo" ? "Novo exercício" : "Editar exercício"}
          </p>
          <h1 className="font-fraunces text-2xl md:text-3xl text-cream leading-tight">
            {title || "Sem título"}
          </h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setPreviewMode((v) => !v)}
            className="font-dm text-[12px] inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-cream/65 hover:text-accent transition-colors"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <Eye width={13} height={13} aria-hidden="true" />
            {previewMode ? "Editar" : "Preview"}
          </button>
          <button
            type="button"
            onClick={() => validateAndSave()}
            disabled={saving}
            className="font-dm text-[13px] font-medium inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-cream/85 hover:text-cream transition-colors disabled:opacity-40"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.10)",
            }}
          >
            {saving ? (
              <Loader2 width={13} height={13} className="animate-spin" />
            ) : (
              <Save width={13} height={13} aria-hidden="true" />
            )}
            Salvar
          </button>
          <button
            type="button"
            onClick={() => validateAndSave({ withCurar: true })}
            disabled={saving}
            className="font-dm text-[13px] font-medium inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white transition-all hover:translate-y-[-1px] disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: "0 2px 12px rgba(200,75,49,0.25)",
            }}
          >
            <Star
              width={13}
              height={13}
              aria-hidden="true"
              fill="currentColor"
            />
            Salvar e curar
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* ─── Coluna esquerda: identificação ──────────────────────────── */}
        <aside
          className="rounded-xl p-4 space-y-4"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <Field label="Título *">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream"
              placeholder="Ex: Feedback Negativo"
            />
          </Field>

          <Field
            label="Slug *"
            hint={
              slugManual
                ? "Editado manualmente"
                : "Auto-gerado do título; clique pra editar"
            }
            error={slugError}
          >
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                setSlugManual(true);
              }}
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream font-mono"
              placeholder="feedback-negativo"
            />
            {slugManual && (
              <button
                type="button"
                onClick={() => {
                  setSlugManual(false);
                  setSlug(slugify(title));
                }}
                className="font-dm text-[11px] text-cream/40 hover:text-accent mt-1 transition-colors"
              >
                Re-gerar do título
              </button>
            )}
          </Field>

          <Field label="Resumo *" hint="2-3 linhas que aparecem no card">
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream resize-none"
              placeholder="Desenvolver decisões clínicas individualizadas..."
            />
          </Field>

          <Field label="Categoria *">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategorySlug)}
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream"
            >
              {CATEGORY_ORDER.map((slug) => (
                <option key={slug} value={slug}>
                  {CATEGORIES[slug].label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Formato *" hint="Múltipla escolha (mínimo 1)">
            <div className="flex flex-wrap gap-1.5">
              {FORMATOS_ORDER.map((f) => {
                const meta = FORMATOS[f];
                const active = formato.has(f);
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFormato(f)}
                    className="font-dm text-[11px] font-medium px-2.5 py-1 rounded-full transition-all"
                    style={{
                      color: active ? "#C84B31" : "rgba(253,251,247,0.55)",
                      background: active
                        ? "rgba(200,75,49,0.10)"
                        : "rgba(255,255,255,0.025)",
                      border: `1px solid ${active ? "rgba(200,75,49,0.28)" : "rgba(255,255,255,0.07)"}`,
                    }}
                    aria-pressed={active}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Tags" hint="Separadas por vírgula">
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream"
              placeholder="feedback, crítica, aliança"
            />
          </Field>

          <Field
            label="Recursos"
            hint="Materiais necessários, separados por vírgula"
          >
            <input
              type="text"
              value={recursosInput}
              onChange={(e) => setRecursosInput(e.target.value)}
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream"
              placeholder="papel, caneta, link X"
            />
          </Field>

          <Field label="Status">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "publicado" | "rascunho" | "arquivado")
              }
              className="dark-input font-dm text-sm w-full px-3 py-2 rounded-lg text-cream"
            >
              <option value="publicado">Publicado</option>
              <option value="rascunho">Rascunho</option>
              <option value="arquivado">Arquivado</option>
            </select>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={curado}
              onChange={(e) => setCurado(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            <span className="font-dm text-sm text-cream/85">
              Marcar como curado
            </span>
          </label>
        </aside>

        {/* ─── Coluna direita: editor markdown + preview ────────────────── */}
        <div>
          {previewMode ? (
            <div
              className="rounded-xl p-5 md:p-8"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.07)",
                minHeight: "500px",
              }}
            >
              {previewBlocks.length === 0 ? (
                <p className="font-dm text-sm text-cream/40 text-center py-12">
                  Sem conteúdo. Volte para editar.
                </p>
              ) : (
                <ExerciseBlocks blocks={previewBlocks} />
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-dm text-[10px] font-bold tracking-[0.22em] uppercase text-cream/45">
                    Markdown
                  </span>
                  <MarkdownHelp />
                </div>
                <textarea
                  value={markdown}
                  onChange={(e) => setMarkdown(e.target.value)}
                  className="dark-input font-mono text-[13px] w-full px-3 py-3 rounded-xl text-cream/90 resize-none"
                  style={{ minHeight: "60vh" }}
                  placeholder={"## Contextualização\n\nTexto do parágrafo aqui...\n\n- Item de lista\n- Outro item\n\n> Uma citação\n> — Atribuição\n\n[!callout]\nTexto em destaque\n\n## Tarefa\n\n1. Passo 1\n2. Passo 2"}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-dm text-[10px] font-bold tracking-[0.22em] uppercase text-cream/45">
                    Preview ao vivo
                  </span>
                  <span className="font-dm text-[10px] text-cream/35">
                    {previewBlocks.length} blocos
                  </span>
                </div>
                <div
                  className="rounded-xl p-4 overflow-y-auto"
                  style={{
                    background: "rgba(255,255,255,0.015)",
                    border: "1px solid rgba(255,255,255,0.05)",
                    minHeight: "60vh",
                    maxHeight: "75vh",
                  }}
                >
                  {previewBlocks.length === 0 ? (
                    <p className="font-dm text-sm text-cream/40 text-center py-12">
                      Comece a digitar markdown ao lado
                    </p>
                  ) : (
                    <ExerciseBlocks blocks={previewBlocks} />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block font-dm text-[10.5px] font-bold tracking-widest uppercase text-cream/55 mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <p className="font-dm text-[11px] text-red-400 mt-1">{error}</p>
      ) : hint ? (
        <p className="font-dm text-[10.5px] text-cream/35 mt-1">{hint}</p>
      ) : null}
    </div>
  );
}

function MarkdownHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-dm text-[10.5px] text-cream/40 hover:text-accent transition-colors"
      >
        {open ? "Esconder ajuda" : "Sintaxe"}
      </button>
      {open && (
        <div
          className="absolute z-10 mt-2 right-0 rounded-xl p-4 max-w-md w-[calc(100vw-2rem)] sm:w-96 text-[11.5px] font-dm"
          style={{
            background: "rgba(20,20,20,0.96)",
            border: "1px solid rgba(255,255,255,0.10)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
          }}
        >
          <pre className="text-cream/70 whitespace-pre-wrap font-mono text-[10.5px] leading-relaxed">
{`## Heading nível 2
### Heading nível 3
#### Heading nível 4

Parágrafo normal.

- Item bullet
- Outro

1. Item numerado
2. Outro

> Citação multi-linha
> — Atribuição opcional

[!callout]
Texto destacado

[!ref] Texto referência | url-opcional

[link: Label → https://url.com]

| Col 1 | Col 2 |
| ----- | ----- |
| a     | b     |`}
          </pre>
        </div>
      )}
    </div>
  );
}
