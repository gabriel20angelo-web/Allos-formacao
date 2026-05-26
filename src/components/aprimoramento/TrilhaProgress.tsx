"use client";

import { useAuth } from "@/hooks/useAuth";
import { useAprimoramentoEstados } from "@/hooks/useAprimoramentoEstados";
import { Check } from "lucide-react";

interface Props {
  exerciseSlugs: string[];
  color: string;
  tint: string;
  border: string;
}

export default function TrilhaProgress({
  exerciseSlugs,
  color,
  tint,
  border,
}: Props) {
  const { user } = useAuth();
  const { states, loading } = useAprimoramentoEstados(user?.id ?? null);

  const total = exerciseSlugs.length;
  const done = exerciseSlugs.filter(
    (s) => (states.get(s)?.done_count ?? 0) > 0,
  ).length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div
      className="rounded-2xl p-3 md:p-4"
      style={{ background: tint, border: `1px solid ${border}` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Check width={13} height={13} aria-hidden="true" style={{ color }} />
          <span
            className="font-dm text-[11px] font-semibold tracking-[0.22em] uppercase"
            style={{ color }}
          >
            Progresso
          </span>
        </div>
        <span className="font-dm text-[12px] text-cream/65">
          {loading ? (
            <span className="text-cream/35">Carregando…</span>
          ) : (
            <>
              <span className="font-fraunces text-base text-cream">{done}</span>
              <span className="text-cream/45"> de </span>
              <span className="font-fraunces text-base text-cream">{total}</span>
              {" "}concluídos
            </>
          )}
        </span>
      </div>

      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
        aria-hidden="true"
      >
        <div
          className="absolute top-0 bottom-0 left-0 rounded-full transition-[width] duration-500"
          style={{
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        />
      </div>
    </div>
  );
}
