// Anulação de certificado emitido (Termos de Uso, 8.6 e 8.7).
//
// Anular não apaga o certificado: o registro continua existindo para que a
// consulta pública pelo código responda "existiu e foi anulado" em vez de "não
// existe". A diferença importa para quem recebeu o documento e precisa saber que
// ele deixou de valer, e não que nunca foi emitido.
//
// O que este componente grava é exatamente o que a página pública
// /formacao/certificado/verificar mostra. Por isso o motivo é obrigatório e
// escrito: ele não é anotação interna, é texto que um empregador ou uma
// instituição vai ler ao conferir o documento.
//
// A escrita vai direto do client pela policy de admin da tabela certificates.
// Não passa por rota própria porque não há nada a decidir no servidor: quem não
// é admin não consegue gravar, e o RLS é quem diz isso.

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, Ban, RotateCcw, X } from "lucide-react";

const MIN_MOTIVO = 10;

export default function AnularCertificado({
  certificateId,
  codigo,
  anulado,
  onMudou,
}: {
  certificateId: string;
  codigo: string;
  anulado: boolean;
  onMudou: () => void;
}) {
  const [painel, setPainel] = useState<"anular" | "reverter" | null>(null);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);

  function fechar() {
    setPainel(null);
    setMotivo("");
  }

  async function anular() {
    const texto = motivo.trim();
    if (texto.length < MIN_MOTIVO) {
      toast.error("Escreva o motivo: é o texto que aparece na consulta pública.");
      return;
    }
    setSalvando(true);
    try {
      const sb = createClient();
      // anulado_por guarda quem assinou a decisão. Sem sessão a policy de admin
      // nem deixaria gravar, então o null aqui é só defesa de tipo.
      const {
        data: { user },
      } = await sb.auth.getUser();

      const { error } = await sb
        .from("certificates")
        .update({
          anulado: true,
          anulado_em: new Date().toISOString(),
          anulado_motivo: texto,
          anulado_por: user?.id ?? null,
        })
        .eq("id", certificateId);

      if (error) {
        console.error("[AnularCertificado] anular", error);
        toast.error("Não foi possível anular. Verifique suas permissões.");
        return;
      }
      toast.success(`Certificado ${codigo} anulado. Já consta na verificação pública.`);
      fechar();
      onMudou();
    } catch {
      toast.error("Erro de rede ao anular.");
    } finally {
      setSalvando(false);
    }
  }

  async function reverter() {
    setSalvando(true);
    try {
      const sb = createClient();
      // A reversão limpa as quatro colunas juntas. Deixar data ou motivo para
      // trás criaria uma linha ambígua, com anulado false e marca de anulação
      // preenchida, que a próxima pessoa a ler o registro interpretaria errado.
      // Histórico de decisões, se for preciso, pede tabela própria.
      const { error } = await sb
        .from("certificates")
        .update({
          anulado: false,
          anulado_em: null,
          anulado_motivo: null,
          anulado_por: null,
        })
        .eq("id", certificateId);

      if (error) {
        console.error("[AnularCertificado] reverter", error);
        toast.error("Não foi possível reverter. Verifique suas permissões.");
        return;
      }
      toast.success(`Anulação revertida. ${codigo} volta a constar como válido.`);
      fechar();
      onMudou();
    } catch {
      toast.error("Erro de rede ao reverter.");
    } finally {
      setSalvando(false);
    }
  }

  if (painel === "anular") {
    return (
      <div
        className="rounded-[14px] p-4 space-y-3"
        style={{
          background: "rgba(239,68,68,0.05)",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <div className="flex items-start gap-2.5">
          <AlertTriangle
            className="h-4 w-4 mt-0.5 shrink-0"
            style={{ color: "#EF4444" }}
          />
          <div className="space-y-1.5">
            <p className="text-sm text-cream font-medium font-dm">
              Anular o certificado {codigo}
            </p>
            <p className="text-[12px] text-cream/50 font-dm leading-relaxed">
              A partir da confirmação, quem consultar este código na verificação
              pública vê que o documento foi anulado, com a data de hoje e o
              motivo escrito abaixo. Escreva pensando em quem vai ler: pode ser o
              empregador ou a instituição que recebeu o certificado.
            </p>
          </div>
        </div>

        <textarea
          rows={4}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ex.: auditoria constatou progresso simulado por automação nas aulas do módulo 2, sem manifestação do titular no prazo da cláusula 8.5."
          className="w-full px-3 py-2.5 dark-input rounded-[10px] text-sm font-dm resize-none"
        />
        <p className="text-[11px] text-cream/30 font-dm">
          {motivo.trim().length < MIN_MOTIVO
            ? `Mínimo de ${MIN_MOTIVO} caracteres (${motivo.trim().length} até agora).`
            : "O texto acima fica visível na consulta pública."}
        </p>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={anular}
            disabled={salvando || motivo.trim().length < MIN_MOTIVO}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-cream disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ background: "#B23B32" }}
          >
            <Ban className="h-3.5 w-3.5" />
            {salvando ? "Anulando..." : "Confirmar anulação"}
          </button>
          <button
            onClick={fechar}
            disabled={salvando}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-cream/60 transition-all hover:bg-white/[.05]"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (painel === "reverter") {
    return (
      <div
        className="rounded-[14px] p-4 space-y-3"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-sm text-cream font-medium font-dm">
          Reverter a anulação de {codigo}
        </p>
        <p className="text-[12px] text-cream/50 font-dm leading-relaxed">
          O certificado volta a constar como autêntico e válido na verificação
          pública, e a data e o motivo da anulação deixam de aparecer. Use quando
          a anulação foi feita por engano ou quando o titular apresentou
          justificativa aceita.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={reverter}
            disabled={salvando}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-cream disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{
              background: "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {salvando ? "Revertendo..." : "Confirmar reversão"}
          </button>
          <button
            onClick={fechar}
            disabled={salvando}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-[13px] font-medium text-cream/60 transition-all hover:bg-white/[.05]"
            style={{ border: "1px solid rgba(255,255,255,0.1)" }}
          >
            <X className="h-3.5 w-3.5" />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  if (anulado) {
    return (
      <button
        onClick={() => setPainel("reverter")}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12px] font-medium text-cream/60 transition-all hover:bg-white/[.05]"
        style={{ border: "1px solid rgba(255,255,255,0.1)" }}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Reverter anulação
      </button>
    );
  }

  return (
    <button
      onClick={() => setPainel("anular")}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px] text-[12px] font-medium transition-all hover:bg-[rgba(239,68,68,0.08)]"
      style={{
        color: "rgba(239,68,68,0.85)",
        border: "1px solid rgba(239,68,68,0.25)",
      }}
    >
      <Ban className="h-3.5 w-3.5" />
      Anular certificado
    </button>
  );
}
