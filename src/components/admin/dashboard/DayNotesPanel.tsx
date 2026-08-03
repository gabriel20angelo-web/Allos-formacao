// Painel de anotações do período — o "diário" do dashboard.
//
// Cada anotação diz o que foi feito num dia ("divulguei no Instagram") e vem
// acompanhada de quantos eventos aquele dia rendeu. É a leitura que interessa:
// a divulgação de terça trouxe 22 eventos, a de sábado trouxe zero.
//
// Por isso a data é livre: dá para anotar um dia que não teve movimento nenhum,
// que é justamente o caso que ensina algo.

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Megaphone, Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { dayLabel } from "@/lib/utils/activity";
import type { DayNotesApi } from "@/hooks/useDayNotes";

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function DayNotesPanel({
  api,
  eventCountByDay,
  rangeStart,
  accent = "#C84B31",
}: {
  api: DayNotesApi;
  eventCountByDay: Map<string, number>;
  /** `null` = janela "Tudo". */
  rangeStart: Date | null;
  accent?: string;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [novaData, setNovaData] = useState(hoje());
  const [novoTexto, setNovoTexto] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTexto, setEditTexto] = useState("");

  if (!api.available) return null;

  const doPeriodo = rangeStart
    ? api.notes.filter((n) => new Date(`${n.data}T23:59:59`) >= rangeStart)
    : api.notes;

  async function criar() {
    const ok = await api.save(novaData, novoTexto);
    if (ok) {
      setNovoTexto("");
      setCreating(false);
      setOpen(true);
    }
  }

  async function salvarEdicao(id: string, data: string) {
    const ok = await api.save(data, editTexto, id);
    if (ok) setEditId(null);
  }

  return (
    <div
      className="rounded-[12px] mb-4 overflow-hidden"
      style={{
        background: "rgba(212,168,87,0.04)",
        border: "1px solid rgba(212,168,87,0.14)",
      }}
    >
      <div className="flex items-center gap-2 px-3 py-2">
        <Megaphone className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#D4A857" }} />
        <button
          onClick={() => setOpen((v) => !v)}
          className="font-dm text-[11px] text-cream/55 hover:text-cream/80 transition-colors"
        >
          Anotações do período
          <span className="text-cream/30"> · {doPeriodo.length}</span>
        </button>
        <div className="flex-1" />
        <button
          onClick={() => {
            setCreating((v) => !v);
            setOpen(true);
          }}
          className="font-dm text-[10px] px-2 py-1 rounded-full flex items-center gap-1 transition-all hover:bg-white/[.05]"
          style={{ color: "#D4A857", border: "1px solid rgba(212,168,87,0.25)" }}
        >
          <Plus className="h-2.5 w-2.5" />
          Anotar um dia
        </button>
      </div>

      <AnimatePresence initial={false}>
        {creating && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 pb-3"
          >
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="date"
                value={novaData}
                onChange={(e) => setNovaData(e.target.value)}
                className="dark-input rounded-[8px] px-2.5 py-1.5 text-[11px] font-dm sm:w-[140px]"
              />
              <input
                type="text"
                value={novoTexto}
                onChange={(e) => setNovoTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && criar()}
                placeholder="O que aconteceu nesse dia? Ex.: post no Instagram, e-mail para a lista..."
                className="dark-input rounded-[8px] px-2.5 py-1.5 text-[11px] font-dm flex-1"
                autoFocus
              />
              <button
                onClick={criar}
                disabled={!novoTexto.trim()}
                className="font-dm text-[11px] px-3 py-1.5 rounded-[8px] transition-all disabled:opacity-30"
                style={{
                  background: "rgba(212,168,87,0.14)",
                  color: "#D4A857",
                  border: "1px solid rgba(212,168,87,0.3)",
                }}
              >
                Salvar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
          >
            <div className="px-3 pb-3 space-y-1.5">
              {doPeriodo.length === 0 ? (
                <p className="font-dm text-[11px] text-cream/25">
                  Nenhuma anotação nesta janela. Registre o dia de uma divulgação
                  para comparar com o movimento que veio depois.
                </p>
              ) : (
                doPeriodo.map((n) => {
                  const eventos = eventCountByDay.get(n.data) ?? 0;
                  return (
                    <div
                      key={n.id}
                      className="flex items-start gap-2 px-2 py-1.5 rounded-[8px] group"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-dm text-[10px] font-semibold text-cream/50">
                            {dayLabel(n.data)}
                          </span>
                          <span
                            className="font-dm text-[9px] px-1.5 py-0.5 rounded-full"
                            style={{
                              background:
                                eventos > 0
                                  ? `${accent}14`
                                  : "rgba(255,255,255,0.04)",
                              color: eventos > 0 ? accent : "rgba(253,251,247,0.3)",
                            }}
                          >
                            {eventos} evento{eventos === 1 ? "" : "s"} no dia
                          </span>
                        </div>
                        {editId === n.id ? (
                          <div className="flex gap-1.5 mt-1">
                            <input
                              type="text"
                              value={editTexto}
                              onChange={(e) => setEditTexto(e.target.value)}
                              onKeyDown={(e) =>
                                e.key === "Enter" && salvarEdicao(n.id, n.data)
                              }
                              className="dark-input rounded-[6px] px-2 py-1 text-[11px] font-dm flex-1"
                              autoFocus
                            />
                            <button
                              onClick={() => salvarEdicao(n.id, n.data)}
                              className="p-1 rounded text-cream/30 hover:text-[#22C55E]"
                            >
                              <Check className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => setEditId(null)}
                              className="p-1 rounded text-cream/30 hover:text-cream/60"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ) : (
                          <p className="font-dm text-[11px] text-cream/65 leading-snug mt-0.5">
                            {n.texto}
                          </p>
                        )}
                      </div>
                      {editId !== n.id && (
                        <div className="flex items-center gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditId(n.id);
                              setEditTexto(n.texto);
                            }}
                            className="p-1 rounded text-cream/20 hover:text-cream/60"
                            aria-label="Editar anotação"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                          <button
                            onClick={() => api.remove(n.id)}
                            className="p-1 rounded text-cream/20 hover:text-red-400"
                            aria-label="Remover anotação"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
