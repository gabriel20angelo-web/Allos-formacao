// Sinais de atenção no dashboard.
//
// Fica recolhido por padrão: é informação de auditoria, não o que se olha todo
// dia. Cada linha abre o dossiê da pessoa, porque o sinal sozinho não decide
// nada — quem decide é olhar o histórico dela inteiro.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { dayLabel } from "@/lib/utils/activity";
import type { Sinal } from "@/lib/utils/suspeita";

export default function SinaisAtencao({
  sinais,
  onPersonClick,
}: {
  sinais: Sinal[];
  onPersonClick: (pessoa: { nome: string; email?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  if (sinais.length === 0) return null;

  const pessoas = new Set(sinais.map((s) => s.email || s.pessoa)).size;

  return (
    <div
      className="rounded-[12px] mb-6 overflow-hidden"
      style={{
        background: "rgba(245,158,11,0.04)",
        border: "1px solid rgba(245,158,11,0.16)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <AlertTriangle className="h-4 w-4 flex-shrink-0" style={{ color: "#F59E0B" }} />
        <span className="font-dm text-[12px] text-amber-200/90 font-semibold">
          Sinais de atenção
        </span>
        <span className="font-dm text-[11px] text-cream/35">
          {sinais.length} ocorrência{sinais.length > 1 ? "s" : ""} · {pessoas} pessoa
          {pessoas > 1 ? "s" : ""}
        </span>
        <div className="flex-1" />
        <ChevronDown
          className="h-3.5 w-3.5 text-cream/30 transition-transform"
          style={{ transform: open ? "rotate(180deg)" : "none" }}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="px-3.5 pb-3 space-y-1.5">
              <p className="font-dm text-[10px] text-cream/30 leading-snug mb-2">
                Padrões que valem conferir, não acusações: o formulário de
                certificação é autodeclarado e marcar aula como assistida é um
                clique.
              </p>
              {sinais.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onPersonClick({ nome: s.pessoa, email: s.email })}
                  className="w-full text-left flex items-start gap-2.5 px-2.5 py-2 rounded-[8px] transition-colors hover:bg-white/[.03]"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-dm text-[11px] text-cream/80">
                      <span className="font-semibold hover:underline decoration-dotted underline-offset-2">
                        {s.pessoa}
                      </span>
                      <span className="text-cream/35"> · {dayLabel(s.dia)}</span>
                    </p>
                    <p className="font-dm text-[11px] font-medium text-amber-200/80 mt-0.5">
                      {s.titulo}
                    </p>
                    <p className="font-dm text-[10px] text-cream/35 leading-snug">
                      {s.detalhe}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
