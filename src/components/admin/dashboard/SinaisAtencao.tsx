// Sinais de atenção no dashboard.
//
// Fica recolhido por padrão: é informação de auditoria, não o que se olha todo
// dia. Cada linha abre o dossiê da pessoa, porque o sinal sozinho não decide
// nada — quem decide é olhar o histórico dela inteiro.
//
// Três listas, que são três situações diferentes:
//   Em aberto      — ninguém fez nada ainda
//   E-mail enviado — a pessoa foi avisada, esperando manifestação
//   Arquivadas     — conferido e encerrado
//
// Enviar o e-mail move o caso para a segunda lista, não para a terceira: avisar
// não é decidir. Em qualquer das duas, o caso volta para "em aberto" sozinho se
// a pessoa repetir o padrão depois (ver useSinaisResolvidos).

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Archive,
  Check,
  ChevronDown,
  Mail,
  RotateCcw,
} from "lucide-react";
import { dayLabel } from "@/lib/utils/activity";
import type { Sinal } from "@/lib/utils/suspeita";
import type { SinaisResolvidosApi } from "@/hooks/useSinaisResolvidos";

type Aba = "abertos" | "avisados" | "arquivados";

export default function SinaisAtencao({
  abertos,
  avisados,
  arquivados,
  api,
  onPersonClick,
}: {
  abertos: Sinal[];
  avisados: Sinal[];
  arquivados: Sinal[];
  api: SinaisResolvidosApi;
  onPersonClick: (pessoa: { nome: string; email?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [aba, setAba] = useState<Aba>("abertos");
  const [resolvendo, setResolvendo] = useState<string | null>(null);
  const [observacao, setObservacao] = useState("");

  const total = abertos.length + avisados.length + arquivados.length;
  if (total === 0) return null;

  const listas: Record<Aba, Sinal[]> = { abertos, avisados, arquivados };
  const lista = listas[aba];
  const pessoas = new Set(abertos.map((s) => s.email || s.pessoa)).size;

  async function confirmarResolucao(sinal: Sinal) {
    const ok = await api.resolver(sinal, observacao);
    if (ok) {
      setResolvendo(null);
      setObservacao("");
    }
  }

  const ABAS: { key: Aba; label: string; icone: typeof Archive | null }[] = [
    { key: "abertos", label: "Em aberto", icone: null },
    { key: "avisados", label: "E-mail enviado", icone: Mail },
    { key: "arquivados", label: "Arquivadas", icone: Archive },
  ];

  const NOTA: Record<Aba, string> = {
    abertos:
      "Padrões que valem conferir, não acusações: o formulário de certificação é autodeclarado e marcar aula como assistida é um clique.",
    avisados:
      "A pessoa já recebeu o aviso e tem prazo para se manifestar. A resposta dela chega em Certificados, na aba Ocorrências.",
    arquivados:
      "Casos já conferidos. Se a pessoa repetir o padrão depois, a ocorrência volta sozinha para a lista aberta.",
  };

  return (
    <div
      className="rounded-[12px] mb-6 overflow-hidden"
      style={{
        background: abertos.length > 0 ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${abertos.length > 0 ? "rgba(245,158,11,0.16)" : "rgba(255,255,255,0.06)"}`,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <AlertTriangle
          className="h-4 w-4 flex-shrink-0"
          style={{ color: abertos.length > 0 ? "#F59E0B" : "rgba(253,251,247,0.25)" }}
        />
        <span
          className="font-dm text-[12px] font-semibold"
          style={{
            color: abertos.length > 0 ? "rgba(253,230,138,0.9)" : "rgba(253,251,247,0.45)",
          }}
        >
          Sinais de atenção
        </span>
        <span className="font-dm text-[11px] text-cream/35">
          {abertos.length > 0
            ? `${abertos.length} em aberto · ${pessoas} pessoa${pessoas > 1 ? "s" : ""}`
            : "nada em aberto"}
          {avisados.length > 0 && ` · ${avisados.length} avisada${avisados.length > 1 ? "s" : ""}`}
          {arquivados.length > 0 && ` · ${arquivados.length} arquivada${arquivados.length > 1 ? "s" : ""}`}
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
            <div className="px-3.5 pb-3">
              <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                {ABAS.map(({ key, label, icone: Icone }) => {
                  const ativo = aba === key;
                  const n = listas[key].length;
                  return (
                    <button
                      key={key}
                      onClick={() => setAba(key)}
                      className="font-dm text-[10px] px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                      style={{
                        backgroundColor: ativo ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.03)",
                        color: ativo ? "#F59E0B" : "rgba(253,251,247,0.4)",
                        border: `1px solid ${ativo ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      {Icone && <Icone className="h-2.5 w-2.5" />}
                      {label} {n}
                    </button>
                  );
                })}
              </div>

              <p className="font-dm text-[10px] text-cream/30 leading-snug mb-2">
                {NOTA[aba]}
              </p>

              {lista.length === 0 ? (
                <p className="font-dm text-[11px] text-cream/25 py-3">
                  {aba === "abertos"
                    ? "Nenhuma ocorrência em aberto."
                    : aba === "avisados"
                      ? "Nenhum aviso enviado ainda."
                      : "Nada arquivado ainda."}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {lista.map((s) => {
                    const marca = api.porSinal.get(s.id);
                    return (
                      <div
                        key={s.id}
                        className="px-2.5 py-2 rounded-[8px]"
                        style={{ background: "rgba(255,255,255,0.02)" }}
                      >
                        <div className="flex items-start gap-2.5">
                          <button
                            onClick={() =>
                              onPersonClick({ nome: s.pessoa, email: s.email })
                            }
                            className="min-w-0 flex-1 text-left"
                          >
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
                            {aba === "avisados" && marca && (
                              <p className="font-dm text-[10px] text-cream/30 mt-1 flex items-center gap-1">
                                <Mail className="h-2.5 w-2.5" />
                                avisada em{" "}
                                {new Date(marca.quando).toLocaleDateString("pt-BR")}
                              </p>
                            )}
                          </button>

                          {api.available && (
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {aba !== "abertos" && (
                                <button
                                  onClick={() => api.reabrir(s.id)}
                                  className="p-1.5 rounded-lg text-cream/25 hover:text-cream/60 hover:bg-white/[.04] transition-all"
                                  title="Voltar para a lista aberta"
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </button>
                              )}
                              {aba !== "arquivados" && (
                                <button
                                  onClick={() => {
                                    setResolvendo(resolvendo === s.id ? null : s.id);
                                    setObservacao("");
                                  }}
                                  className="font-dm text-[10px] px-2 py-1 rounded-full flex items-center gap-1 transition-all hover:bg-white/[.05]"
                                  style={{
                                    color: "#22C55E",
                                    border: "1px solid rgba(34,197,94,0.28)",
                                  }}
                                >
                                  <Check className="h-2.5 w-2.5" />
                                  Resolvido
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {resolvendo === s.id && (
                          <div className="mt-2 flex flex-col sm:flex-row gap-1.5">
                            <input
                              type="text"
                              value={observacao}
                              onChange={(e) => setObservacao(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && confirmarResolucao(s)}
                              autoFocus
                              placeholder="O que ficou decidido? (opcional)"
                              className="dark-input rounded-[8px] px-2.5 py-1.5 text-[11px] font-dm flex-1"
                            />
                            <button
                              onClick={() => confirmarResolucao(s)}
                              className="font-dm text-[11px] px-3 py-1.5 rounded-[8px] transition-all"
                              style={{
                                background: "rgba(34,197,94,0.12)",
                                color: "#22C55E",
                                border: "1px solid rgba(34,197,94,0.3)",
                              }}
                            >
                              Arquivar
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
