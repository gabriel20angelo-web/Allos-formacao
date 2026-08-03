// Painel de verificações de certificado (Termos de Uso, 8.5).
//
// É aqui que a retenção deixa de ser automática e vira decisão de gente: o
// caso mostra os números que motivaram a trava, a explicação de quem pediu o
// certificado, e recebe uma resposta escrita. Aprovar emite o certificado na
// hora; recusar registra o motivo, que é exatamente o texto que a pessoa lê.

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  Clock,
  MessageSquare,
  ShieldCheck,
  X,
} from "lucide-react";

type Status = "retido" | "explicado" | "aprovado" | "recusado";

interface Review {
  id: string;
  user_id: string;
  course_id: string;
  status: Status;
  motivo: string;
  segundos_registrados: number;
  minutos_conteudo: number;
  explicacao: string | null;
  explicado_em: string | null;
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
  user?: { full_name: string | null; email: string | null } | null;
  course?: { title: string | null } | null;
}

const STATUS_META: Record<Status, { label: string; cor: string; fundo: string }> = {
  retido: { label: "Aguardando o aluno", cor: "#F59E0B", fundo: "rgba(245,158,11,0.1)" },
  explicado: { label: "Aguardando você", cor: "#C84B31", fundo: "rgba(200,75,49,0.12)" },
  aprovado: { label: "Liberado", cor: "#22C55E", fundo: "rgba(34,197,94,0.1)" },
  recusado: { label: "Recusado", cor: "#EF4444", fundo: "rgba(239,68,68,0.1)" },
};

function minutos(segundos: number): string {
  const m = Math.round(segundos / 60);
  return m < 1 ? "menos de 1 min" : `${m} min`;
}

export default function VerificacoesTab({
  onPersonClick,
}: {
  onPersonClick?: (pessoa: { nome: string; email?: string }) => void;
}) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [filtro, setFiltro] = useState<"abertos" | "todos">("abertos");

  const carregar = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb
      .from("certificate_reviews")
      .select(
        "*, user:profiles!user_id(full_name, email), course:courses!course_id(title)"
      )
      .order("created_at", { ascending: false });
    if (!error) setReviews((data ?? []) as unknown as Review[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(review: Review, decisao: "aprovado" | "recusado") {
    if (decisao === "recusado" && texto.trim().length < 10) {
      toast.error("Escreva o motivo da recusa: é o que a pessoa vai ler.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/formacao/api/certificate-review/decide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          review_id: review.id,
          decisao,
          resposta: texto.trim(),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível registrar a decisão.");
        return;
      }
      toast.success(
        decisao === "aprovado"
          ? "Liberado. O certificado foi emitido."
          : "Recusa registrada. A pessoa vê a sua resposta."
      );
      setRespondendo(null);
      setTexto("");
      carregar();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setEnviando(false);
    }
  }

  const abertos = reviews.filter(
    (r) => r.status === "retido" || r.status === "explicado"
  );
  const lista = filtro === "abertos" ? abertos : reviews;

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-[14px]" />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-[12px]"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <ShieldCheck className="h-4 w-4 text-accent" />
        <p className="text-sm text-cream/60">
          <span className="text-cream font-semibold">
            {reviews.filter((r) => r.status === "explicado").length}
          </span>{" "}
          esperando sua resposta
        </p>
        <span className="text-cream/15">·</span>
        <p className="text-sm text-cream/60">
          <span className="text-cream font-semibold">
            {reviews.filter((r) => r.status === "retido").length}
          </span>{" "}
          sem manifestação do aluno
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setFiltro(filtro === "abertos" ? "todos" : "abertos")}
          className="font-dm text-[11px] px-2.5 py-1.5 rounded-full transition-all hover:bg-white/[.05]"
          style={{
            color: "rgba(253,251,247,0.5)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {filtro === "abertos" ? "Ver encerrados também" : "Ver só os abertos"}
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="text-center py-16">
          <ShieldCheck className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm font-dm">
            Nenhum certificado retido. Quando a auditoria travar uma emissão, o
            caso aparece aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((r, i) => {
            const meta = STATUS_META[r.status];
            const proporcao =
              r.minutos_conteudo > 0
                ? Math.round(
                    (r.segundos_registrados / (r.minutos_conteudo * 60)) * 100
                  )
                : 0;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="rounded-[14px] p-4"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <button
                    onClick={() =>
                      onPersonClick?.({
                        nome: r.user?.full_name || "Aluno",
                        email: r.user?.email || undefined,
                      })
                    }
                    className="text-sm text-cream font-medium hover:underline decoration-dotted underline-offset-2"
                  >
                    {r.user?.full_name || "Aluno"}
                  </button>
                  <span className="text-xs text-cream/35">{r.course?.title}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium font-dm"
                    style={{ background: meta.fundo, color: meta.cor }}
                  >
                    {meta.label}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-cream/25 font-dm">
                    retido em{" "}
                    {new Date(r.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>

                <div
                  className="flex items-start gap-2 px-3 py-2 rounded-[10px] mb-2"
                  style={{
                    background: "rgba(245,158,11,0.05)",
                    border: "1px solid rgba(245,158,11,0.14)",
                  }}
                >
                  <AlertTriangle
                    className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                    style={{ color: "#F59E0B" }}
                  />
                  <p className="font-dm text-[11px] text-cream/55 leading-snug">
                    Registrou{" "}
                    <span className="text-cream/80">
                      {minutos(r.segundos_registrados)}
                    </span>{" "}
                    de permanência num conteúdo de{" "}
                    <span className="text-cream/80">{r.minutos_conteudo} min</span>{" "}
                    ({proporcao}% do esperado).
                  </p>
                </div>

                {r.explicacao && (
                  <div className="mb-2">
                    <p className="font-dm text-[10px] text-cream/35 mb-1 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3" />
                      O que a pessoa respondeu
                      {r.explicado_em && (
                        <span className="text-cream/20">
                          · {new Date(r.explicado_em).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </p>
                    <p
                      className="font-dm text-[12px] text-cream/65 leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
                      style={{ borderColor: "rgba(255,255,255,0.1)" }}
                    >
                      {r.explicacao}
                    </p>
                  </div>
                )}

                {r.resposta && (
                  <div className="mb-2">
                    <p className="font-dm text-[10px] text-cream/35 mb-1">
                      Sua devolutiva
                      {r.respondido_em && (
                        <span className="text-cream/20">
                          {" "}
                          · {new Date(r.respondido_em).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </p>
                    <p
                      className="font-dm text-[12px] text-cream/50 leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
                      style={{ borderColor: `${meta.cor}55` }}
                    >
                      {r.resposta}
                    </p>
                  </div>
                )}

                {r.status === "retido" && !r.explicacao && (
                  <p className="font-dm text-[11px] text-cream/30 flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    Ainda sem manifestação. O prazo do aluno é de 7 dias corridos.
                  </p>
                )}

                {(r.status === "retido" || r.status === "explicado") && (
                  <>
                    {respondendo === r.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={texto}
                          onChange={(e) => setTexto(e.target.value)}
                          rows={3}
                          autoFocus
                          placeholder="Escreva a devolutiva. Em caso de recusa, ela é obrigatória e é o texto que a pessoa lê."
                          className="w-full px-3 py-2 dark-input rounded-[10px] text-[12px] font-dm resize-none"
                        />
                        <div className="flex flex-wrap gap-2 justify-end">
                          <button
                            onClick={() => {
                              setRespondendo(null);
                              setTexto("");
                            }}
                            className="px-3 py-1.5 rounded-[8px] text-[11px] font-dm text-cream/50 hover:text-cream transition-colors"
                            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={() => decidir(r, "recusado")}
                            disabled={enviando}
                            className="px-3 py-1.5 rounded-[8px] text-[11px] font-dm flex items-center gap-1.5 disabled:opacity-40"
                            style={{
                              background: "rgba(239,68,68,0.1)",
                              color: "#EF4444",
                              border: "1px solid rgba(239,68,68,0.25)",
                            }}
                          >
                            <X className="h-3 w-3" />
                            Recusar
                          </button>
                          <button
                            onClick={() => decidir(r, "aprovado")}
                            disabled={enviando}
                            className="px-3 py-1.5 rounded-[8px] text-[11px] font-dm flex items-center gap-1.5 disabled:opacity-40"
                            style={{
                              background: "rgba(34,197,94,0.12)",
                              color: "#22C55E",
                              border: "1px solid rgba(34,197,94,0.3)",
                            }}
                          >
                            <Check className="h-3 w-3" />
                            Liberar e emitir
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setRespondendo(r.id);
                          setTexto("");
                        }}
                        className="mt-2 px-3 py-1.5 rounded-[8px] text-[11px] font-dm transition-all hover:bg-white/[.04]"
                        style={{
                          color: "rgba(253,251,247,0.6)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        Responder e decidir
                      </button>
                    )}
                  </>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
