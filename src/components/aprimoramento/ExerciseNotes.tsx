"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useAprimoramentoEstados } from "@/hooks/useAprimoramentoEstados";

interface Props {
  slug: string;
  color: string;
  tint: string;
  border: string;
}

const DEBOUNCE_MS = 800;

export default function ExerciseNotes({ slug, color, tint, border }: Props) {
  const { user } = useAuth();
  const { states, setNotas, loading } = useAprimoramentoEstados(
    user?.id ?? null,
  );

  const state = states.get(slug);
  const remote = state?.notas ?? "";

  const [local, setLocal] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Hidrata o local quando o fetch termina (uma única vez).
  useEffect(() => {
    if (!loading && !hydrated) {
      setLocal(remote);
      setSavedAt(remote ? state?.updated_at ?? null : null);
      setHydrated(true);
    }
  }, [loading, hydrated, remote, state]);

  // Auto-grow do textarea conforme o conteúdo cresce.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(96, el.scrollHeight) + "px";
  }, [local, hydrated]);

  // Debounced save: dispara setNotas 800ms depois que o user parou de digitar.
  useEffect(() => {
    if (!hydrated) return;
    if (local === remote) return;

    setSaving(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      await setNotas(slug, local);
      setSavedAt(new Date().toISOString());
      setSaving(false);
      timerRef.current = null;
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // remote propositalmente fora — só re-roda quando local muda.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local, hydrated, slug]);

  const disabled = !user?.id;

  return (
    <section
      className="mt-12 mb-20 md:mb-0 print-hide"
      aria-labelledby="exercise-notes-heading"
    >
      <header className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <NotebookPen
            width={14}
            height={14}
            aria-hidden="true"
            style={{ color }}
          />
          <h3
            id="exercise-notes-heading"
            className="font-dm text-[11px] font-bold tracking-[0.24em] uppercase"
            style={{ color }}
          >
            Suas notas
          </h3>
          <span className="font-dm text-[10px] text-cream/35 ml-1">
            privadas
          </span>
        </div>
        <SaveIndicator saving={saving} savedAt={savedAt} loading={loading} />
      </header>

      <textarea
        ref={textareaRef}
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        disabled={disabled || loading}
        placeholder={
          disabled
            ? "Faça login para escrever notas privadas"
            : "Escreva o que ficou marcante, dúvidas, ajustes pra próxima…"
        }
        className="font-dm text-[16px] md:text-[14px] leading-relaxed w-full rounded-2xl p-4 text-cream placeholder:text-cream/30 resize-none transition-all focus:outline-none focus:ring-1"
        style={
          {
            background: "rgba(255,255,255,0.025)",
            border: `1px solid ${border}`,
            minHeight: 96,
            ["--tw-ring-color" as string]: tint,
          } as React.CSSProperties
        }
      />
      <p className="font-dm text-[10.5px] text-cream/30 mt-1.5">
        Salva automaticamente · só você vê.
      </p>
    </section>
  );
}

function SaveIndicator({
  saving,
  savedAt,
  loading,
}: {
  saving: boolean;
  savedAt: string | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <span className="font-dm text-[10.5px] text-cream/30 inline-flex items-center gap-1">
        <Loader2 width={11} height={11} className="animate-spin" aria-hidden="true" />
        Carregando…
      </span>
    );
  }
  if (saving) {
    return (
      <span className="font-dm text-[10.5px] text-cream/45 inline-flex items-center gap-1">
        <Loader2 width={11} height={11} className="animate-spin" aria-hidden="true" />
        Salvando…
      </span>
    );
  }
  if (savedAt) {
    return (
      <span
        className="font-dm text-[10.5px] text-cream/35 inline-flex items-center gap-1"
        title={format(new Date(savedAt), "PPP 'às' HH:mm", { locale: ptBR })}
      >
        <Check width={11} height={11} aria-hidden="true" />
        Salvo às {format(new Date(savedAt), "HH:mm", { locale: ptBR })}
      </span>
    );
  }
  return null;
}
