// Ações administrativas sobre uma pessoa: avisar por e-mail e bloquear acesso.
//
// As duas pedem confirmação e as duas exigem que o administrador leia antes de
// agir: o e-mail mostra o texto exato que vai sair, e o bloqueio exige motivo
// escrito, que é o que a pessoa lê na tela de acesso suspenso. Ação de uma
// tecla só, nesses dois casos, é como se produz arrependimento.

"use client";

import { useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Lock, Mail, Unlock } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function AcoesPessoa({
  userId,
  nome,
  email,
  bloqueado,
  temSinais,
  onMudou,
}: {
  userId: string | null;
  nome: string;
  email: string | null;
  bloqueado: boolean;
  temSinais: boolean;
  onMudou: () => void;
}) {
  const [previaAberta, setPreviaAberta] = useState(false);
  const [previa, setPrevia] = useState<{ assunto: string; texto: string } | null>(null);
  const [nivel, setNivel] = useState<"aviso" | "notificacao">("aviso");
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [configurado, setConfigurado] = useState(true);

  const [bloqueioAberto, setBloqueioAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [salvandoBloqueio, setSalvandoBloqueio] = useState(false);

  async function abrirPrevia(nivelEscolhido: "aviso" | "notificacao" = nivel) {
    if (!email) return;
    setNivel(nivelEscolhido);
    setPreviaAberta(true);
    setCarregandoPrevia(true);
    setPrevia(null);
    try {
      const res = await fetch(
        `/formacao/api/admin/email-suspeita?email=${encodeURIComponent(email)}&nivel=${nivelEscolhido}`,
        { credentials: "include" }
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível montar o e-mail.");
        setPreviaAberta(false);
        return;
      }
      setConfigurado(payload.configurado !== false);
      setPrevia({ assunto: payload.assunto, texto: payload.texto });
    } catch {
      toast.error("Erro de rede.");
      setPreviaAberta(false);
    } finally {
      setCarregandoPrevia(false);
    }
  }

  async function enviar() {
    if (!email) return;
    setEnviando(true);
    try {
      const res = await fetch("/formacao/api/admin/email-suspeita", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, nivel }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Falha no envio.");
        return;
      }
      toast.success(`E-mail enviado para ${email}.`);
      setPreviaAberta(false);
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setEnviando(false);
    }
  }

  async function alternarBloqueio(bloquear: boolean) {
    if (!userId) return;
    if (bloquear && motivo.trim().length < 10) {
      toast.error("Escreva o motivo: a pessoa vai ler esse texto.");
      return;
    }
    setSalvandoBloqueio(true);
    try {
      const res = await fetch("/formacao/api/admin/bloqueio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ user_id: userId, bloquear, motivo: motivo.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível concluir.");
        return;
      }
      toast.success(
        bloquear
          ? payload.sessoes_encerradas === false
            ? "Bloqueado. A sessão aberta cai na próxima navegação."
            : "Acesso bloqueado e sessões encerradas."
          : "Acesso liberado."
      );
      setBloqueioAberto(false);
      setMotivo("");
      onMudou();
    } catch {
      toast.error("Erro de rede.");
    } finally {
      setSalvandoBloqueio(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {email && temSinais && (
          <button
            onClick={() => abrirPrevia("aviso")}
            className="font-dm text-[11px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all hover:bg-white/[.05]"
            style={{ color: "#F59E0B", border: "1px solid rgba(245,158,11,0.28)" }}
            title="Monta o aviso com os sinais desta pessoa e mostra antes de enviar"
          >
            <Mail className="h-3 w-3" />
            Avisar por e-mail
          </button>
        )}

        {userId &&
          (bloqueado ? (
            <button
              onClick={() => alternarBloqueio(false)}
              disabled={salvandoBloqueio}
              className="font-dm text-[11px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all hover:bg-white/[.05] disabled:opacity-40"
              style={{ color: "#22C55E", border: "1px solid rgba(34,197,94,0.3)" }}
            >
              <Unlock className="h-3 w-3" />
              Desbloquear acesso
            </button>
          ) : (
            <button
              onClick={() => setBloqueioAberto(true)}
              className="font-dm text-[11px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all hover:bg-white/[.05]"
              style={{ color: "#EF4444", border: "1px solid rgba(239,68,68,0.28)" }}
            >
              <Lock className="h-3 w-3" />
              Bloquear acesso
            </button>
          ))}
      </div>

      {/* ── Prévia do e-mail ── */}
      <Modal
        open={previaAberta}
        onClose={() => setPreviaAberta(false)}
        title={`E-mail para ${nome}`}
        maxWidth="max-w-2xl"
      >
        {carregandoPrevia || !previa ? (
          <p className="font-dm text-sm text-cream/40 py-8 text-center">
            Montando com os registros desta pessoa...
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1.5">
              {(["aviso", "notificacao"] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => abrirPrevia(n)}
                  className="font-dm text-[11px] px-3 py-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor: nivel === n ? "rgba(245,158,11,0.14)" : "rgba(255,255,255,0.03)",
                    color: nivel === n ? "#F59E0B" : "rgba(253,251,247,0.4)",
                    border: `1px solid ${nivel === n ? "rgba(245,158,11,0.32)" : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  {n === "aviso" ? "Primeiro aviso" : "Notificação formal (prazo de 7 dias)"}
                </button>
              ))}
            </div>

            <div>
              <p className="font-dm text-[10px] text-cream/35 mb-1">Para</p>
              <p className="font-dm text-[13px] text-cream/70">{email}</p>
            </div>
            <div>
              <p className="font-dm text-[10px] text-cream/35 mb-1">Assunto</p>
              <p className="font-dm text-[13px] text-cream/80">{previa.assunto}</p>
            </div>
            <div>
              <p className="font-dm text-[10px] text-cream/35 mb-1">Mensagem</p>
              <pre
                className="font-dm text-[12px] text-cream/60 leading-relaxed whitespace-pre-wrap max-h-[45vh] overflow-y-auto px-3 py-2.5 rounded-[10px]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                {previa.texto}
              </pre>
            </div>

            {!configurado && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-[10px]"
                style={{
                  background: "rgba(245,158,11,0.06)",
                  border: "1px solid rgba(245,158,11,0.2)",
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#F59E0B" }} />
                <p className="font-dm text-[11px] text-cream/55">
                  Envio ainda não configurado neste ambiente: faltam as
                  credenciais do Google Workspace. O texto acima já está pronto
                  e pode ser copiado.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(
                    `Assunto: ${previa.assunto}\n\n${previa.texto}`
                  );
                  toast.success("Texto copiado.");
                }}
                className="px-3 py-2 rounded-[10px] text-[12px] font-dm text-cream/55 hover:text-cream transition-colors"
                style={{ border: "1px solid rgba(255,255,255,0.08)" }}
              >
                Copiar texto
              </button>
              <button
                onClick={enviar}
                disabled={enviando || !configurado}
                className="px-4 py-2 rounded-[10px] text-[12px] font-medium text-cream disabled:opacity-40"
                style={{
                  background: "linear-gradient(135deg, #C84B31, #A33D27)",
                  boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                }}
              >
                {enviando ? "Enviando..." : "Enviar agora"}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Bloqueio ── */}
      <Modal
        open={bloqueioAberto}
        onClose={() => setBloqueioAberto(false)}
        title="Bloquear acesso"
      >
        <div className="space-y-4">
          <p className="font-dm text-sm text-cream/55 leading-relaxed">
            {nome} perde o acesso à plataforma e as sessões abertas são
            encerradas. Certificados já emitidos continuam válidos.
          </p>
          <div>
            <label className="font-dm text-xs text-cream/40 mb-1.5 block">
              Motivo (a pessoa lê este texto na tela de acesso suspenso)
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Ex.: registros de conclusão incompatíveis com o tempo de acesso, após notificação sem resposta em 03/08/2026."
              className="w-full px-3 py-2.5 dark-input rounded-[10px] text-sm font-dm resize-none"
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5">
            <button
              onClick={() => setBloqueioAberto(false)}
              className="px-4 py-2 rounded-[10px] text-sm font-dm text-cream/50 hover:text-cream transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Cancelar
            </button>
            <button
              onClick={() => alternarBloqueio(true)}
              disabled={salvandoBloqueio}
              className="px-4 py-2 rounded-[10px] text-sm font-medium disabled:opacity-40"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.3)",
              }}
            >
              {salvandoBloqueio ? "Bloqueando..." : "Bloquear acesso"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
