// E-mails enviados pelo painel, com retratação em um clique.
//
// Existe por um motivo específico: aviso de atividade atípica é a comunicação
// mais delicada que a plataforma manda, e engano acontece. Quando acontece, o
// que reduz dano é retratar rápido, por escrito, no mesmo canal — e para isso
// é preciso saber exatamente quem recebeu o quê e quando.
//
// A retratação fica marcada na própria lista, então dá para conferir de
// relance se sobrou alguém sem resposta.

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Check, ChevronDown, Mail, Undo2 } from "lucide-react";
import Modal from "@/components/ui/Modal";

interface Envio {
  id: string;
  destinatario: string;
  tipo: string;
  assunto: string;
  created_at: string;
}

export default function EmailsEnviados() {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [open, setOpen] = useState(false);
  const [disponivel, setDisponivel] = useState(true);
  const [enviando, setEnviando] = useState<string | null>(null);
  // A retratação também passa por prévia: é o e-mail mais delicado de todos,
  // e mandar sem ler é como o problema começou.
  const [alvo, setAlvo] = useState<string | null>(null);
  const [assunto, setAssunto] = useState("");
  const [texto, setTexto] = useState("");
  const [carregando, setCarregando] = useState(false);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const { data, error } = await sb
      .from("email_envios")
      .select("id, destinatario, tipo, assunto, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      if (error.code === "42P01") setDisponivel(false);
      return;
    }
    setEnvios((data ?? []) as Envio[]);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!disponivel || envios.length === 0) return null;

  // Um e-mail de aviso só conta como resolvido se veio retratação DEPOIS dele.
  const retratados = new Set(
    envios.filter((e) => e.tipo === "retratacao").map((e) => e.destinatario)
  );
  const avisos = envios.filter((e) => e.tipo !== "retratacao");
  const pendentes = avisos.filter((e) => !retratados.has(e.destinatario));

  async function abrirPrevia(destinatario: string) {
    setAlvo(destinatario);
    setCarregando(true);
    setTexto("");
    try {
      const res = await fetch(
        `/formacao/api/admin/email-suspeita?email=${encodeURIComponent(destinatario)}&nivel=retratacao`,
        { credentials: "include" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível montar a retratação.");
        setAlvo(null);
        return;
      }
      setAssunto(payload.assunto);
      setTexto(payload.texto);
    } catch {
      toast.error("Erro de rede.");
      setAlvo(null);
    } finally {
      setCarregando(false);
    }
  }

  async function retratar(destinatario: string) {
    setEnviando(destinatario);
    try {
      const res = await fetch("/formacao/api/admin/email-suspeita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: destinatario,
          nivel: "retratacao",
          assunto,
          texto,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível enviar a retratação.");
        return;
      }
      toast.success(`Retratação enviada para ${destinatario}.`);
      setAlvo(null);
      carregar();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setEnviando(null);
    }
  }

  const porDestinatario = new Map<string, Envio[]>();
  avisos.forEach((e) => {
    const lista = porDestinatario.get(e.destinatario) ?? [];
    lista.push(e);
    porDestinatario.set(e.destinatario, lista);
  });

  return (
    <div
      className="rounded-[12px] mb-6 overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.02)",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left"
      >
        <Mail className="h-4 w-4 flex-shrink-0 text-cream/30" />
        <span className="font-dm text-[12px] font-semibold text-cream/55">
          E-mails enviados
        </span>
        <span className="font-dm text-[11px] text-cream/35">
          {avisos.length} aviso{avisos.length > 1 ? "s" : ""} ·{" "}
          {porDestinatario.size} pessoa{porDestinatario.size > 1 ? "s" : ""}
          {retratados.size > 0 && ` · ${retratados.size} retratada${retratados.size > 1 ? "s" : ""}`}
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
              <p className="font-dm text-[10px] text-cream/30 leading-snug mb-1">
                Enviou por engano? A retratação diz que a mensagem anterior não
                procede, sem repetir o assunto, e chega no mesmo endereço.
              </p>

              {Array.from(porDestinatario.entries()).map(([email, lista]) => {
                const jaRetratado = retratados.has(email);
                return (
                  <div
                    key={email}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2.5 py-2 rounded-[8px]"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-dm text-[11px] text-cream/75 truncate">
                        {email}
                      </p>
                      <p className="font-dm text-[10px] text-cream/30">
                        {lista.length} envio{lista.length > 1 ? "s" : ""} ·{" "}
                        {new Date(lista[0].created_at).toLocaleString("pt-BR", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {lista.some((l) => l.tipo.includes("notificacao")) &&
                          " · versão formal"}
                      </p>
                    </div>

                    {jaRetratado ? (
                      <span
                        className="font-dm text-[10px] px-2 py-1 rounded-full flex items-center gap-1"
                        style={{ color: "#22C55E", border: "1px solid rgba(34,197,94,0.25)" }}
                      >
                        <Check className="h-2.5 w-2.5" />
                        retratado
                      </span>
                    ) : (
                      <button
                        onClick={() => abrirPrevia(email)}
                        disabled={enviando === email}
                        className="font-dm text-[10px] px-2.5 py-1 rounded-full flex items-center gap-1 transition-all hover:bg-white/[.05] disabled:opacity-40"
                        style={{ color: "#38BDF8", border: "1px solid rgba(56,189,248,0.3)" }}
                      >
                        <Undo2 className="h-2.5 w-2.5" />
                        {enviando === email ? "Enviando..." : "Foi engano, retratar"}
                      </button>
                    )}
                  </div>
                );
              })}

              {pendentes.length === 0 && avisos.length > 0 && (
                <p className="font-dm text-[10px] text-cream/25 pt-1">
                  Todos os avisos enviados já foram retratados.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <Modal
        open={!!alvo}
        onClose={() => setAlvo(null)}
        title="Retratação"
        maxWidth="max-w-2xl"
      >
        {carregando || !texto ? (
          <p className="font-dm text-sm text-cream/40 py-8 text-center">
            Montando o texto...
          </p>
        ) : (
          <div className="space-y-4">
            <p className="font-dm text-[11px] text-cream/40 leading-relaxed">
              Este texto não repete o assunto da mensagem anterior, assume o
              erro como nosso e não pede nada em troca. Dá para ajustar antes de
              enviar.
            </p>
            <div>
              <p className="font-dm text-[10px] text-cream/35 mb-1">Para</p>
              <p className="font-dm text-[13px] text-cream/70">{alvo}</p>
            </div>
            <div>
              <p className="font-dm text-[10px] text-cream/35 mb-1">Assunto</p>
              <input
                type="text"
                value={assunto}
                onChange={(e) => setAssunto(e.target.value)}
                className="w-full dark-input rounded-[8px] px-3 py-2 text-[13px] font-dm"
              />
            </div>
            <div>
              <p className="font-dm text-[10px] text-cream/35 mb-1">Mensagem</p>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={14}
                className="w-full dark-input rounded-[10px] px-3 py-2.5 text-[12px] font-dm leading-relaxed resize-y"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button
                onClick={() => setAlvo(null)}
                className="px-4 py-2 rounded-[10px] text-sm font-dm text-cream/50 hover:text-cream transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => alvo && retratar(alvo)}
                disabled={enviando === alvo}
                className="px-4 py-2 rounded-[10px] text-sm font-medium text-cream disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #C84B31, #A33D27)",
                  boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                }}
              >
                {enviando === alvo ? "Enviando..." : "Enviar retratação"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
