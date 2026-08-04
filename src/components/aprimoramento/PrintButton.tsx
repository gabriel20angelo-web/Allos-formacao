"use client";

import { Printer } from "lucide-react";

export default function PrintButton({ label = "Imprimir" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print-hide font-dm text-[12px] inline-flex items-center gap-1.5 px-3 py-2.5 md:py-1.5 rounded-lg text-cream/55 hover:text-accent transition-colors"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.07)",
      }}
      aria-label="Imprimir versão limpa do exercício"
    >
      <Printer width={13} height={13} aria-hidden="true" />
      {label}
    </button>
  );
}
