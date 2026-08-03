// Painel das respostas de ocorrência (migration 048_ocorrencias.sql).
//
// Quem recebe um aviso de atividade atípica não responde por e-mail: responde
// por uma página pública do site. O objetivo desta aba é que essa manifestação
// não morra numa caixa de entrada. Ela chega estruturada (nome, e-mail,
// contato, origem), fica ao lado do caso e recebe uma devolutiva escrita.
//
// A leitura é direta na tabela porque a policy de RLS já restringe a admin; a
// escrita passa pela rota, que usa service role e carimba quem respondeu.

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Archive, Inbox, MessageSquare, Phone } from "lucide-react";

type Status = "nova" | "respondida" | "arquivada";
type Origem = "aviso" | "bloqueio" | "certificado" | "outro";

interface Ocorrencia {
  id: string;
  nome: string;
  email: string;
  whatsapp: string | null;
  relato: string;
  origem: Origem;
  status: Status;
  resposta: string | null;
  respondido_em: string | null;
  created_at: string;
}

const STATUS_META: Record<Status, { label: string; cor: string; fundo: string }> = {
  nova: { label: "Aguardando você", cor: "#C84B31", fundo: "rgba(200,75,49,0.12)" },
  respondida: { label: "Respondida", cor: "#22C55E", fundo: "rgba(34,197,94,0.1)" },
  arquivada: { label: "Arquivada", cor: "#8B8B8B", fundo: "rgba(255,255,255,0.05)" },
};

// O rótulo de origem existe porque o mesmo formulário atende situações bem
// diferentes: um aviso de atividade não se lê com a mesma pressa que um acesso
// bloqueado.
const ORIGEM_LABEL: Record<Origem, string> = {
  aviso: "Aviso de atividade",
  bloqueio: "Acesso bloqueado",
  certificado: "Certificado",
  outro: "Outro assunto",
};

// A pessoa digita o WhatsApp como quiser: com parênteses, traço, espaço, com
// ou sem o código do país. O link só vale a pena se sobrar número suficiente,
// e o 55 não pode ser duplicado em quem já digitou.
function linkWhatsapp(bruto: string): string | null {
  const digitos = bruto.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  const comPais =
    digitos.startsWith("55") && digitos.length >= 12 ? digitos : `55${digitos}`;
  return `https://wa.me/${comPais}`;
}

function dataHora(iso: string): string {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR")} às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

export default function OcorrenciasTab({
  onPersonClick,
}: {
  onPersonClick?: (pessoa: { nome: string; email?: string }) => void;
}) {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [filtro, setFiltro] = useState<"abertas" | "todas">("abertas");

  const carregar = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb
      .from("ocorrencia_respostas")
      .select(
        "id, nome, email, whatsapp, relato, origem, status, resposta, respondido_em, created_at"
      )
      .order("created_at", { ascending: false });
    if (!error) setOcorrencias((data ?? []) as unknown as Ocorrencia[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function decidir(oc: Ocorrencia, acao: "responder" | "arquivar") {
    if (acao === "responder" && texto.trim().length < 10) {
      toast.error("Escreva a devolutiva: é o que a pessoa vai ler.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/formacao/api/admin/ocorrencia-responder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          id: oc.id,
          acao,
          resposta: acao === "responder" ? texto.trim() : undefined,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível registrar a resposta.");
        return;
      }
      toast.success(
        acao === "responder"
          ? "Resposta registrada."
          : "Arquivada. Sai da lista de abertas."
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

  const novas = ocorrencias.filter((o) => o.status === "nova");
  const respondidas = ocorrencias.filter((o) => o.status === "respondida");
  const lista = filtro === "abertas" ? novas : ocorrencias;

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
        <Inbox className="h-4 w-4 text-accent" />
        <p className="text-sm text-cream/60">
          <span className="text-cream font-semibold">{novas.length}</span>{" "}
          {novas.length === 1 ? "nova, esperando você" : "novas, esperando você"}
        </p>
        <span className="text-cream/15">·</span>
        <p className="text-sm text-cream/60">
          <span className="text-cream font-semibold">{respondidas.length}</span>{" "}
          {respondidas.length === 1 ? "já respondida" : "já respondidas"}
        </p>
        <div className="flex-1" />
        <button
          onClick={() => setFiltro(filtro === "abertas" ? "todas" : "abertas")}
          className="font-dm text-[11px] px-2.5 py-1.5 rounded-full transition-all hover:bg-white/[.05]"
          style={{
            color: "rgba(253,251,247,0.5)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          {filtro === "abertas" ? "Ver encerradas também" : "Ver só as abertas"}
        </button>
      </div>

      {lista.length === 0 ? (
        <div className="text-center py-16">
          <Inbox className="h-10 w-10 text-cream/15 mx-auto mb-3" />
          <p className="text-cream/35 text-sm font-dm max-w-md mx-auto leading-relaxed">
            Nada por aqui. Quando alguém responder um aviso pela página pública,
            o relato chega nesta lista com o contato de quem escreveu.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((o, i) => {
            const meta = STATUS_META[o.status];
            const wa = o.whatsapp ? linkWhatsapp(o.whatsapp) : null;
            return (
              <motion.div
                key={o.id}
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
                        nome: o.nome || "Pessoa",
                        email: o.email || undefined,
                      })
                    }
                    className="text-sm text-cream font-medium hover:underline decoration-dotted underline-offset-2"
                    title="Ver tudo o que essa pessoa fez"
                  >
                    {o.nome || "Pessoa"}
                  </button>
                  <span className="text-xs text-cream/35">{o.email}</span>
                  <span
                    className="text-[10px] px-2 py-0.5 rounded-full font-medium font-dm"
                    style={{ background: meta.fundo, color: meta.cor }}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-cream/30 font-dm">
                    {ORIGEM_LABEL[o.origem] ?? o.origem}
                  </span>
                  <div className="flex-1" />
                  <span className="text-[10px] text-cream/25 font-dm">
                    escreveu em {dataHora(o.created_at)}
                  </span>
                </div>

                {wa && (
                  <a
                    href={wa}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-dm text-[11px] mb-2 hover:underline decoration-dotted underline-offset-2"
                    style={{ color: "#22C55E" }}
                  >
                    <Phone className="h-3 w-3" />
                    {o.whatsapp}
                  </a>
                )}

                <div className="mb-2">
                  <p className="font-dm text-[10px] text-cream/35 mb-1 flex items-center gap-1.5">
                    <MessageSquare className="h-3 w-3" />O que a pessoa escreveu
                  </p>
                  <p
                    className="font-dm text-[12px] text-cream/65 leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
                    style={{ borderColor: "rgba(255,255,255,0.1)" }}
                  >
                    {o.relato}
                  </p>
                </div>

                {o.resposta && (
                  <div className="mb-2">
                    <p className="font-dm text-[10px] text-cream/35 mb-1">
                      Sua devolutiva
                      {o.respondido_em && (
                        <span className="text-cream/20">
                          {" "}
                          · {new Date(o.respondido_em).toLocaleDateString("pt-BR")}
                        </span>
                      )}
                    </p>
                    <p
                      className="font-dm text-[12px] text-cream/50 leading-relaxed whitespace-pre-wrap border-l-2 pl-3"
                      style={{ borderColor: `${meta.cor}55` }}
                    >
                      {o.resposta}
                    </p>
                  </div>
                )}

                {o.status === "nova" && (
                  <>
                    {respondendo === o.id ? (
                      <div className="mt-3 space-y-2">
                        <textarea
                          value={texto}
                          onChange={(e) => setTexto(e.target.value)}
                          rows={3}
                          autoFocus
                          placeholder="Escreva a devolutiva. É o texto que a pessoa recebe como resposta ao relato dela."
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
                            onClick={() => decidir(o, "arquivar")}
                            disabled={enviando}
                            className="px-3 py-1.5 rounded-[8px] text-[11px] font-dm flex items-center gap-1.5 disabled:opacity-40"
                            style={{
                              background: "rgba(255,255,255,0.04)",
                              color: "rgba(253,251,247,0.55)",
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                            title="Sai da lista de abertas sem enviar devolutiva"
                          >
                            <Archive className="h-3 w-3" />
                            Arquivar
                          </button>
                          <button
                            onClick={() => decidir(o, "responder")}
                            disabled={enviando}
                            className="px-3 py-1.5 rounded-[8px] text-[11px] font-dm flex items-center gap-1.5 disabled:opacity-40"
                            style={{
                              background: "rgba(34,197,94,0.12)",
                              color: "#22C55E",
                              border: "1px solid rgba(34,197,94,0.3)",
                            }}
                          >
                            <MessageSquare className="h-3 w-3" />
                            Responder
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setRespondendo(o.id);
                          setTexto("");
                        }}
                        className="mt-2 px-3 py-1.5 rounded-[8px] text-[11px] font-dm transition-all hover:bg-white/[.04]"
                        style={{
                          color: "rgba(253,251,247,0.6)",
                          border: "1px solid rgba(255,255,255,0.1)",
                        }}
                      >
                        Responder ou arquivar
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
