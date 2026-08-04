"use client";

import { useEffect, useRef, useState } from "react";
import { Type, ChevronDown } from "lucide-react";

type SizeKey = "compact" | "comfort" | "spacious";
type WidthKey = "narrow" | "default" | "wide";

const SIZE_OPTIONS: { key: SizeKey; label: string; px: number; sample: string }[] = [
  { key: "compact", label: "Compacto", px: 14, sample: "Aa" },
  { key: "comfort", label: "Padrão", px: 15, sample: "Aa" },
  { key: "spacious", label: "Espaçoso", px: 17, sample: "Aa" },
];
const WIDTH_OPTIONS: { key: WidthKey; label: string; rem: number }[] = [
  { key: "narrow", label: "Estreita", rem: 40 },
  { key: "default", label: "Padrão", rem: 48 },
  { key: "wide", label: "Larga", rem: 56 },
];

const LS_SIZE = "aprimoramento-reading-size";
const LS_WIDTH = "aprimoramento-reading-width";

function applyVars(size: SizeKey, width: WidthKey) {
  const root = document.documentElement;
  const sizePx = SIZE_OPTIONS.find((o) => o.key === size)?.px ?? 15;
  const widthRem = WIDTH_OPTIONS.find((o) => o.key === width)?.rem ?? 48;
  root.style.setProperty("--ap-reading-fs", `${sizePx}px`);
  root.style.setProperty("--ap-reading-mw", `${widthRem}rem`);
}

export default function ReadingPrefs() {
  const [open, setOpen] = useState(false);
  const [size, setSize] = useState<SizeKey>("comfort");
  const [width, setWidth] = useState<WidthKey>("default");
  const [hydrated, setHydrated] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Hidrata do localStorage no mount.
  useEffect(() => {
    const s = localStorage.getItem(LS_SIZE) as SizeKey | null;
    const w = localStorage.getItem(LS_WIDTH) as WidthKey | null;
    if (s && SIZE_OPTIONS.some((o) => o.key === s)) setSize(s);
    if (w && WIDTH_OPTIONS.some((o) => o.key === w)) setWidth(w);
    setHydrated(true);
  }, []);

  // Aplica + persiste a cada mudança (depois da hidratação).
  useEffect(() => {
    if (!hydrated) return;
    applyVars(size, width);
    localStorage.setItem(LS_SIZE, size);
    localStorage.setItem(LS_WIDTH, width);
  }, [hydrated, size, width]);

  // Fechar popover ao clicar fora ou Esc.
  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative print-hide">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="font-dm text-[12px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-cream/55 hover:text-accent transition-colors"
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid rgba(255,255,255,0.07)",
        }}
        aria-label="Preferências de leitura"
        aria-expanded={open}
      >
        <Type width={13} height={13} aria-hidden="true" />
        Aa
        <ChevronDown
          width={11}
          height={11}
          aria-hidden="true"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform .15s",
          }}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          className="absolute right-0 mt-2 z-[200] rounded-2xl p-4 w-64 max-w-[calc(100vw-2rem)]"
          style={{
            background: "rgba(20,20,20,0.96)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(12px)",
            boxShadow: "0 16px 40px -10px rgba(0,0,0,0.5)",
          }}
          role="dialog"
          aria-label="Preferências de leitura"
        >
          <p className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/40 mb-2">
            Tamanho da fonte
          </p>
          <div className="flex gap-1 mb-4">
            {SIZE_OPTIONS.map((o) => {
              const active = size === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setSize(o.key)}
                  className="flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-colors"
                  style={{
                    background: active ? "rgba(200,75,49,0.10)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      active ? "rgba(200,75,49,0.28)" : "rgba(255,255,255,0.06)"
                    }`,
                    color: active ? "#C84B31" : "rgba(253,251,247,0.65)",
                  }}
                  aria-pressed={active}
                  title={o.label}
                >
                  <span
                    className="font-fraunces font-bold leading-none"
                    style={{ fontSize: `${o.px + 2}px` }}
                  >
                    {o.sample}
                  </span>
                  <span className="font-dm text-[9px] mt-1 opacity-75">
                    {o.label}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="font-dm text-[10px] font-semibold tracking-[0.22em] uppercase text-cream/40 mb-2">
            Largura da coluna
          </p>
          <div className="flex gap-1">
            {WIDTH_OPTIONS.map((o) => {
              const active = width === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => setWidth(o.key)}
                  className="flex-1 flex flex-col items-center justify-center py-2 rounded-lg transition-colors gap-1"
                  style={{
                    background: active ? "rgba(200,75,49,0.10)" : "rgba(255,255,255,0.03)",
                    border: `1px solid ${
                      active ? "rgba(200,75,49,0.28)" : "rgba(255,255,255,0.06)"
                    }`,
                    color: active ? "#C84B31" : "rgba(253,251,247,0.65)",
                  }}
                  aria-pressed={active}
                  title={o.label}
                >
                  <div
                    className="h-3 rounded-sm"
                    style={{
                      width: `${(o.rem / 56) * 24}px`,
                      background: "currentColor",
                      opacity: 0.7,
                    }}
                    aria-hidden="true"
                  />
                  <span className="font-dm text-[9px] opacity-75">
                    {o.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
