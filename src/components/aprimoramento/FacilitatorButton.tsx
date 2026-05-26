"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import type { Exercise } from "@/lib/aprimoramento-dinamicas";
import FacilitatorMode from "./FacilitatorMode";

interface Props {
  exercise: Exercise;
  color: string;
  tint: string;
  border: string;
}

export default function FacilitatorButton({
  exercise,
  color,
  tint,
  border,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="font-dm text-[12.5px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all hover:translate-y-[-1px] print-hide"
        style={{
          color,
          background: tint,
          border: `1px solid ${border}`,
        }}
        aria-label="Iniciar modo facilitador"
        title="Abre um overlay focado com timer, navegação por Momento e checklist"
      >
        <PlayCircle width={14} height={14} aria-hidden="true" />
        Conduzir esta dinâmica
      </button>

      {open && (
        <FacilitatorMode
          exercise={exercise}
          color={color}
          tint={tint}
          border={border}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
