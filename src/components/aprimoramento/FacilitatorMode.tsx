"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Check,
  RotateCcw,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import type { Exercise } from "@/lib/aprimoramento-dinamicas";
import { partitionSections } from "@/lib/aprimoramento-dinamicas";
import ExerciseBlocks from "./ExerciseBlocks";
import { useAuth } from "@/hooks/useAuth";
import { useAprimoramentoEstados } from "@/hooks/useAprimoramentoEstados";

interface Props {
  exercise: Exercise;
  color: string;
  tint: string;
  border: string;
  onClose: () => void;
}

const CHECKLIST_KEY = (slug: string) => `aprimoramento-facilitator-${slug}`;

function loadChecklist(slug: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(CHECKLIST_KEY(slug));
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as number[];
    return new Set(arr);
  } catch {
    return new Set();
  }
}

function saveChecklist(slug: string, set: Set<number>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      CHECKLIST_KEY(slug),
      JSON.stringify(Array.from(set)),
    );
  } catch {
    /* ignore */
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function FacilitatorMode({
  exercise,
  color,
  tint,
  border,
  onClose,
}: Props) {
  const { user } = useAuth();
  const { markDone } = useAprimoramentoEstados(user?.id ?? null);

  const sections = useMemo(
    () => partitionSections(exercise.blocks),
    [exercise.blocks],
  );

  const [activeIdx, setActiveIdx] = useState(0);
  const [secondsTotal, setSecondsTotal] = useState(0);
  const [secondsSection, setSecondsSection] = useState(0);
  const [paused, setPaused] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() =>
    loadChecklist(exercise.slug),
  );

  // Suprime scroll do body enquanto o modal está aberto.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  // Persistir checklist
  useEffect(() => {
    saveChecklist(exercise.slug, checked);
  }, [exercise.slug, checked]);

  // Reset timer da section quando muda
  useEffect(() => {
    setSecondsSection(0);
  }, [activeIdx]);

  // Timer global + section
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setSecondsTotal((s) => s + 1);
      setSecondsSection((s) => s + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  const handleClose = useCallback(() => {
    // Se cumpriu pelo menos metade das sections, sugere marcar como feito.
    const completed = checked.size;
    const enough = completed >= Math.ceil(sections.length / 2);
    if (enough && user?.id) {
      const wantToMark = window.confirm(
        `Você concluiu ${completed} de ${sections.length} momentos. Marcar como feito no seu histórico?`,
      );
      if (wantToMark) {
        markDone(exercise.slug);
        toast.success("Sessão registrada como feita");
      }
    }
    // Limpa checklist da sessão.
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(CHECKLIST_KEY(exercise.slug));
    }
    onClose();
  }, [checked.size, sections.length, user?.id, markDone, exercise.slug, onClose]);

  const goPrev = useCallback(
    () => setActiveIdx((i) => Math.max(0, i - 1)),
    [],
  );
  const goNext = useCallback(
    () => setActiveIdx((i) => Math.min(sections.length - 1, i + 1)),
    [sections.length],
  );

  const toggleCheck = useCallback((idx: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const resetTimers = useCallback(() => {
    setSecondsTotal(0);
    setSecondsSection(0);
  }, []);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === " " && !(e.target as HTMLElement)?.matches?.("input,textarea")) {
        e.preventDefault();
        setPaused((p) => !p);
      } else if ((e.key === "Enter" || e.key === "x" || e.key === "X")) {
        // Toggle check da section atual
        if (!(e.target as HTMLElement)?.matches?.("input,textarea,button,a")) {
          e.preventDefault();
          toggleCheck(activeIdx);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose, goNext, goPrev, activeIdx, toggleCheck]);

  if (sections.length === 0) return null;

  const active = sections[activeIdx];
  const isFirst = activeIdx === 0;
  const isLast = activeIdx === sections.length - 1;
  const completedCount = checked.size;
  const overallPct = Math.round((completedCount / sections.length) * 100);
  const isChecked = checked.has(activeIdx);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ background: "#0F0F0F", color: "#FDFBF7" }}
      role="dialog"
      aria-modal="true"
      aria-label={`Modo facilitador: ${exercise.title}`}
    >
      {/* Background gradient sutil */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 50% 0%, ${tint} 0%, transparent 60%)`,
        }}
      />

      {/* ─── Header ───────────────────────────────────────────────────── */}
      <header
        className="relative flex items-center justify-between gap-4 px-4 md:px-8 py-4 z-10"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={handleClose}
            className="flex-shrink-0 w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-cream/55 hover:text-cream hover:bg-white/[0.06] transition-colors"
            aria-label="Sair do modo facilitador (Esc)"
          >
            <X width={16} height={16} />
          </button>
          <div className="min-w-0">
            <p
              className="font-dm text-[9px] font-bold tracking-[0.28em] uppercase truncate"
              style={{ color }}
            >
              Modo facilitador
            </p>
            <h1 className="font-fraunces text-base md:text-lg text-cream truncate">
              {exercise.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div
            className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
            title="Total · Momento atual"
          >
            <Timer width={13} height={13} aria-hidden="true" style={{ color }} />
            <span className="font-dm text-[12px] text-cream/85 tabular-nums">
              {formatTime(secondsTotal)}
            </span>
            <span className="text-cream/25">·</span>
            <span className="font-dm text-[12px] text-cream/55 tabular-nums">
              {formatTime(secondsSection)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            className="w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-cream/55 hover:text-cream hover:bg-white/[0.06] transition-colors"
            aria-label={paused ? "Retomar (Espaço)" : "Pausar (Espaço)"}
            title={paused ? "Retomar (Espaço)" : "Pausar (Espaço)"}
          >
            {paused ? (
              <Play width={14} height={14} />
            ) : (
              <Pause width={14} height={14} />
            )}
          </button>

          <button
            type="button"
            onClick={resetTimers}
            className="w-10 h-10 md:w-9 md:h-9 rounded-xl flex items-center justify-center text-cream/45 hover:text-cream hover:bg-white/[0.06] transition-colors"
            aria-label="Zerar timers"
            title="Zerar timers"
          >
            <RotateCcw width={13} height={13} />
          </button>
        </div>
      </header>

      {/* ─── Conteúdo principal (rolável) ───────────────────────────── */}
      <main className="relative flex-1 overflow-y-auto z-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 py-8 md:py-12">
          <div className="flex items-center gap-3 mb-2">
            <span
              className="inline-flex items-center justify-center w-9 h-9 rounded-full font-fraunces text-base font-bold"
              style={{
                background: tint,
                color,
                border: `1px solid ${border}`,
              }}
              aria-hidden="true"
            >
              {active.isMomento && active.momentoNumber
                ? active.momentoNumber
                : activeIdx + 1}
            </span>
            <p
              className="font-dm text-[10px] font-bold tracking-[0.24em] uppercase"
              style={{ color }}
            >
              {active.isMomento
                ? `Momento ${active.momentoNumber}`
                : `${activeIdx + 1} de ${sections.length}`}
            </p>
          </div>

          <h2 className="font-fraunces text-2xl md:text-3xl text-cream leading-tight mb-6">
            {active.label}
          </h2>

          <ExerciseBlocks blocks={active.blocks} />

          <label
            className="inline-flex items-center gap-2 mt-10 px-3 py-2.5 md:py-2 rounded-xl cursor-pointer transition-colors hover:bg-white/[0.04]"
            style={{
              background: isChecked ? tint : "transparent",
              border: `1px solid ${isChecked ? border : "rgba(255,255,255,0.07)"}`,
              color: isChecked ? color : "rgba(253,251,247,0.65)",
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleCheck(activeIdx)}
              className="sr-only"
            />
            <span
              className="inline-flex items-center justify-center w-4 h-4 rounded"
              style={{
                background: isChecked ? color : "transparent",
                border: `1.5px solid ${isChecked ? color : "rgba(253,251,247,0.35)"}`,
              }}
              aria-hidden="true"
            >
              {isChecked && (
                <Check width={11} height={11} style={{ color: "#111" }} />
              )}
            </span>
            <span className="font-dm text-[13px]">
              {isChecked ? "Concluído" : "Marcar como concluído"}
            </span>
          </label>
        </div>
      </main>

      {/* ─── Footer ──────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 px-4 md:px-8 pt-3 md:pt-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:pb-4"
        style={{
          borderTop: "1px solid rgba(255,255,255,0.06)",
          background: "rgba(0,0,0,0.4)",
          backdropFilter: "blur(8px)",
        }}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-3">
          <span className="font-dm text-[11px] text-cream/45 tabular-nums hidden md:inline">
            {completedCount}/{sections.length}
          </span>
          <div
            className="relative flex-1 h-1.5 rounded-full overflow-hidden"
            style={{ background: "rgba(255,255,255,0.05)" }}
            aria-hidden="true"
          >
            <div
              className="absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-300"
              style={{
                width: `${overallPct}%`,
                background: `linear-gradient(90deg, ${color}88, ${color})`,
              }}
            />
          </div>
          <span
            className="font-dm text-[11px] tabular-nums hidden md:inline"
            style={{ color }}
          >
            {overallPct}%
          </span>
        </div>

        {/* Dots + nav */}
        <div className="flex items-center justify-between gap-2 md:gap-3">
          <div className="flex items-center gap-1 md:gap-1.5 flex-wrap min-w-0">
            {sections.map((s, i) => {
              const isDone = checked.has(i);
              const isCurrent = i === activeIdx;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveIdx(i)}
                  className="w-6 h-6 md:w-7 md:h-7 rounded-full flex items-center justify-center font-dm text-[10px] font-bold transition-all hover:scale-110"
                  style={{
                    background: isCurrent
                      ? color
                      : isDone
                        ? tint
                        : "rgba(255,255,255,0.04)",
                    color: isCurrent
                      ? "#111"
                      : isDone
                        ? color
                        : "rgba(253,251,247,0.45)",
                    border: `1px solid ${
                      isCurrent ? color : isDone ? border : "rgba(255,255,255,0.07)"
                    }`,
                  }}
                  aria-label={`Ir para ${s.label}`}
                  aria-current={isCurrent ? "step" : undefined}
                  title={s.label}
                >
                  {isDone ? <Check width={11} height={11} /> : i + 1}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={goPrev}
              disabled={isFirst}
              className="px-3 py-2 min-h-[48px] min-w-[48px] md:min-h-0 md:min-w-0 rounded-xl text-cream/65 hover:text-cream hover:bg-white/[0.06] transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent inline-flex items-center justify-center gap-1 font-dm text-[12px]"
              aria-label="Voltar (←)"
            >
              <ChevronLeft width={14} height={14} aria-hidden="true" />
              <span className="hidden md:inline">Anterior</span>
            </button>

            <button
              type="button"
              onClick={isLast ? handleClose : goNext}
              className="px-4 py-2 min-h-[48px] md:min-h-0 rounded-xl font-dm text-[12.5px] font-medium transition-colors inline-flex items-center justify-center gap-1"
              style={{
                background: color,
                color: "#111",
              }}
              aria-label={isLast ? "Encerrar sessão" : "Próximo (→)"}
            >
              {isLast ? "Encerrar" : "Próximo"}
              {!isLast && (
                <ChevronRight width={14} height={14} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
