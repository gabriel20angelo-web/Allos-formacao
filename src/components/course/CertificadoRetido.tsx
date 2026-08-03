// Aviso de certificado retido para verificação, do lado do aluno.
//
// O texto é o combinado com a Allos: explica o que houve, o que fazer, e diz
// com todas as letras que a via de saída mais simples é assistir ao conteúdo.
// Não acusa ninguém de nada — quem decide é a análise humana que vem depois.

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle, Check, Clock, MessageSquare } from "lucide-react";

export interface ReviewInfo {
  id: string;
  status: "retido" | "explicado" | "aprovado" | "recusado";
  motivo: string;
  explicacao?: string | null;
  explicado_em?: string | null;
  resposta?: string | null;
  respondido_em?: string | null;
}

export default function CertificadoRetido({
  review,
  courseId,
  courseSlug,
  onAtualizar,
}: {
  review: ReviewInfo;
  courseId: string;
  courseSlug: string;
  onAtualizar: (r: ReviewInfo) => void;
}) {
  const [escrevendo, setEscrevendo] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    if (texto.trim().length < 10) {
      toast.error("Conte um pouco mais sobre o que aconteceu.");
      return;
    }
    setEnviando(true);
    try {
      const res = await fetch("/formacao/api/certificate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ course_id: courseId, explicacao: texto }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(payload?.error || "Não foi possível enviar.");
        return;
      }
      onAtualizar(payload.review);
      setEscrevendo(false);
      toast.success("Enviado. A equipe analisa em até 5 dias úteis.");
    } catch {
      toast.error("Erro de rede ao enviar.");
    } finally {
      setEnviando(false);
    }
  }

  const jaExplicou = review.status === "explicado" || !!review.explicacao;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-xl mx-auto px-6 py-16"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "rgba(245,158,11,0.1)",
          border: "1px solid rgba(245,158,11,0.2)",
        }}
      >
        <AlertTriangle className="h-8 w-8" style={{ color: "#F59E0B" }} />
      </div>

      <h1 className="font-fraunces font-bold text-2xl text-cream mb-3 text-center tracking-tight">
        Certificado retido para verificação
      </h1>

      <div className="space-y-4 text-sm text-cream/55 font-dm leading-relaxed">
        <p>
          Seu progresso neste curso foi registrado, mas o certificado não foi
          emitido automaticamente.
        </p>
        <p>
          O sistema identificou que o tempo de reprodução registrado na sua conta
          é bem inferior à duração do conteúdo. Nossos certificados declaram
          carga horária cumprida, e a instituição que recebe esse documento
          confia nessa declaração. Por isso verificamos antes de emitir.
        </p>

        {review.status === "recusado" && review.resposta ? (
          <div
            className="rounded-[12px] px-4 py-3"
            style={{
              background: "rgba(239,68,68,0.06)",
              border: "1px solid rgba(239,68,68,0.18)",
            }}
          >
            <p className="text-[11px] font-semibold text-red-300/90 mb-1">
              Resposta da equipe
            </p>
            <p className="text-[13px] text-cream/60 whitespace-pre-wrap">
              {review.resposta}
            </p>
          </div>
        ) : jaExplicou ? (
          <div
            className="rounded-[12px] px-4 py-3"
            style={{
              background: "rgba(46,158,143,0.06)",
              border: "1px solid rgba(46,158,143,0.18)",
            }}
          >
            <p className="text-[11px] font-semibold text-teal-300/90 mb-1 flex items-center gap-1.5">
              <Check className="h-3 w-3" />
              Sua explicação foi enviada
            </p>
            <p className="text-[13px] text-cream/50">
              A equipe analisa em até 5 dias úteis e você recebe a resposta por
              aqui.
            </p>
            {review.explicacao && (
              <p className="text-[12px] text-cream/35 mt-2 whitespace-pre-wrap border-l-2 pl-2.5" style={{ borderColor: "rgba(255,255,255,0.1)" }}>
                {review.explicacao}
              </p>
            )}
          </div>
        ) : (
          <>
            <p className="text-cream/70 font-medium">O que fazer agora:</p>
            <p>
              Se você assistiu ao conteúdo por outro meio, ou se houve falha de
              registro na plataforma, responda a este aviso pelo botão abaixo
              explicando o ocorrido. A equipe analisa em até 5 dias úteis e emite
              o certificado se estiver tudo certo.
            </p>
            <p>
              Se você não assistiu, é só concluir as aulas. O acesso continua
              liberado e a formação é gratuita.
            </p>
          </>
        )}

        <p className="text-[12px] text-cream/35">
          Vale lembrar que o uso da plataforma está sujeito aos nossos{" "}
          <Link href="/formacao/termos" className="text-accent hover:underline">
            Termos de Uso
          </Link>{" "}
          e ao dever de boa-fé previsto no art. 422 do Código Civil.
          Certificados emitidos com base em registros inconsistentes podem ser
          anulados, e a anulação é comunicada à instituição de ensino que os
          recebeu.
        </p>
      </div>

      {escrevendo ? (
        <div className="mt-6 space-y-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            autoFocus
            placeholder="Conte o que aconteceu: como acompanhou o conteúdo, se houve algum problema técnico, o que mais achar relevante."
            className="w-full px-4 py-3 dark-input rounded-[12px] text-sm font-dm resize-none"
          />
          <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-center">
            <button
              onClick={() => setEscrevendo(false)}
              className="px-4 py-2.5 rounded-[10px] text-sm font-dm text-cream/50 hover:text-cream transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Cancelar
            </button>
            <button
              onClick={enviar}
              disabled={enviando}
              className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-cream disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
                boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
              }}
            >
              {enviando ? "Enviando..." : "Enviar explicação"}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col-reverse sm:flex-row gap-2.5 justify-center">
          <Link
            href={`/formacao/curso/${courseSlug}`}
            className="px-4 py-2.5 rounded-[10px] text-sm font-dm text-cream/60 hover:text-cream transition-colors text-center"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Voltar ao curso
          </Link>
          {review.status !== "recusado" && !jaExplicou && (
            <button
              onClick={() => setEscrevendo(true)}
              className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-cream inline-flex items-center justify-center gap-2"
              style={{
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
                boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
              }}
            >
              <MessageSquare className="h-4 w-4" />
              Explicar o que aconteceu
            </button>
          )}
        </div>
      )}

      <p className="text-[11px] text-cream/25 font-dm text-center mt-6 flex items-center justify-center gap-1.5">
        <Clock className="h-3 w-3" />
        Prazo de manifestação: 7 dias corridos (Termos de Uso, 8.5)
      </p>
    </motion.div>
  );
}
