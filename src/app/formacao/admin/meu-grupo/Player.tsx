"use client";

// O corte em tamanho grande, com o veredicto ao lado.
//
// Extraído da página porque agora é chamado das duas abas. A anotação salva ao
// sair do campo e ao fechar: quem escreve o motivo de reprovar costuma fechar
// a janela em seguida, e perder o texto nesse gesto ensina a não escrever mais.

import { Download, ThumbsDown, ThumbsUp, X } from "lucide-react";
import type { ClipeC } from "./tipos";

export default function Player({
  clipe,
  anotacao,
  aoMudarAnotacao,
  aoSalvarAnotacao,
  aoAvaliar,
  aoFechar,
}: {
  clipe: ClipeC;
  anotacao: string;
  aoMudarAnotacao: (v: string) => void;
  aoSalvarAnotacao: (c: ClipeC) => void;
  aoAvaliar: (c: ClipeC, v: "gostei" | "rejeitado") => void;
  aoFechar: () => void;
}) {
  function fecharSalvando() {
    aoSalvarAnotacao(clipe);
    aoFechar();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={fecharSalvando}
    >
      <div
        className="rounded-2xl overflow-hidden max-w-[min(420px,90vw)] w-full"
        style={{ background: "#111" }}
        onClick={(ev) => ev.stopPropagation()}
      >
        <video
          src={clipe.preview_url || clipe.url || undefined}
          poster={clipe.thumbnail_url || undefined}
          controls
          autoPlay
          className="w-full"
          style={{ aspectRatio: "9/16", background: "#000" }}
        />
        <div className="p-3">
          <p className="text-sm text-cream">{clipe.titulo}</p>
          {clipe.descricao && (
            <p className="text-xs text-cream/45 mt-1">{clipe.descricao}</p>
          )}

          <textarea
            value={anotacao}
            onChange={(ev) => aoMudarAnotacao(ev.target.value)}
            onBlur={() => aoSalvarAnotacao(clipe)}
            placeholder="Por que presta, ou por que não. Ex: cortou no meio da ressalva."
            rows={2}
            className="w-full mt-3 px-2.5 py-2 rounded-lg text-xs resize-none"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#FDFBF7",
            }}
          />

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => {
                aoSalvarAnotacao(clipe);
                aoAvaliar(clipe, "gostei");
                aoFechar();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
              style={{
                background: "rgba(74,222,128,0.12)",
                color: "#4ADE80",
                border: "1px solid rgba(74,222,128,0.3)",
              }}
            >
              <ThumbsUp className="h-3.5 w-3.5" /> Publicável
            </button>
            <button
              onClick={() => {
                aoSalvarAnotacao(clipe);
                aoAvaliar(clipe, "rejeitado");
                aoFechar();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: "rgba(255,255,255,0.04)",
                color: "rgba(253,251,247,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <ThumbsDown className="h-3.5 w-3.5" /> Não publicar
            </button>
            <a
              href={clipe.url || clipe.preview_url || "#"}
              download
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-cream/40"
              title="Baixar"
            >
              <Download className="h-4 w-4" />
            </a>
            <button onClick={fecharSalvando} className="ml-auto p-1.5 rounded-lg text-cream/40">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
