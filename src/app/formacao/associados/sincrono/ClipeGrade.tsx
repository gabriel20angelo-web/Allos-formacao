"use client";

// A grade de cortes, com o aviso que a antecede.
//
// Extraída porque aparece em dois lugares — nos encontros ao vivo e nos cursos
// gravados — e duas cópias divergiriam na primeira correção.
//
// O aviso fica aqui dentro, colado na grade, e não no topo da página: quem
// avalia quarenta cortes cansa e passa a julgar pela miniatura, e é aí que
// escapa um trecho que soa bem e diz o contrário do que foi dito.

import { useState } from "react";
import { Download, ImageOff, Play, ThumbsDown, ThumbsUp } from "lucide-react";

export interface ClipeC {
  id: string;
  titulo: string | null;
  descricao: string | null;
  hashtags: string[] | null;
  url: string | null;
  preview_url: string | null;
  thumbnail_url: string | null;
  duracao_seg: number | null;
  pontuacao: number | null;
  avaliacao: "gostei" | "rejeitado" | null;
  anotacao: string | null;
}

/**
 * O combinado da curadoria.
 *
 * Separado da grade porque a fila de cortes mostra vários encontros seguidos, e
 * repetir o mesmo parágrafo entre cada um deles ensina a pular o parágrafo.
 */
export function AvisoDeCuradoria() {
  return (
    <p className="text-[11px] text-cream/35 mb-2 leading-relaxed">
      Ouça antes de aprovar: o que decide é o que está sendo dito, não a imagem. Repare se o corte
      não começa no meio de uma ressalva nem termina antes dela. O mesmo corte serve em pé e
      deitado, então o formato não é motivo para reprovar.
    </p>
  );
}

export default function ClipeGrade({
  clipes,
  aoAssistir,
  aoAvaliar,
  mostrarAviso = true,
}: {
  clipes: ClipeC[];
  aoAssistir: (c: ClipeC) => void;
  aoAvaliar: (c: ClipeC, v: "gostei" | "rejeitado") => void;
  mostrarAviso?: boolean;
}) {
  return (
    <>
      {mostrarAviso && <AvisoDeCuradoria />}

      {/* Seis colunas nas telas largas: o corte é vertical, e cada coluna a
          menos estica o card para além de seiscentos pixels de altura, o que
          transforma a grade numa pilha de painéis gigantes e impede comparar um
          corte com o seguinte. */}
      <div className="grid gap-2 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
        {clipes.map((c) => (
          <CartaoClipe key={c.id} c={c} aoAssistir={aoAssistir} aoAvaliar={aoAvaliar} />
        ))}
      </div>
    </>
  );
}

function CartaoClipe({
  c,
  aoAssistir,
  aoAvaliar,
}: {
  c: ClipeC;
  aoAssistir: (c: ClipeC) => void;
  aoAvaliar: (c: ClipeC, v: "gostei" | "rejeitado") => void;
}) {
  // Miniatura que não carrega não desenha nada, e "nada" é igualzinho a um
  // corte que é mesmo escuro. O endereço dos arquivos vence em 24 horas, então
  // isso acontece de verdade, e sem aviso a tela parece dizer que os cortes
  // saíram ruins.
  const [imagemFalhou, setImagemFalhou] = useState(false);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{
        border: `1px solid ${c.avaliacao === "gostei" ? "rgba(74,222,128,0.35)" : "rgba(255,255,255,0.06)"}`,
        opacity: c.avaliacao === "rejeitado" ? 0.4 : 1,
      }}
    >
      <button
        onClick={() => aoAssistir(c)}
        className="relative block w-full group"
        style={{ aspectRatio: "9/16", background: "rgba(0,0,0,0.3)" }}
        title="Assistir"
      >
        {c.thumbnail_url && !imagemFalhou ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={c.thumbnail_url}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
            onError={() => setImagemFalhou(true)}
          />
        ) : (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-2 text-center">
            <ImageOff className="h-4 w-4 text-cream/20" />
            <span className="text-[10px] text-cream/25 leading-tight">
              {imagemFalhou ? "prévia expirada, recarregue a página" : "sem prévia"}
            </span>
          </span>
        )}
        <span
          className="absolute inset-0 flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          style={{ background: "rgba(0,0,0,0.45)" }}
        >
          <Play className="h-7 w-7 text-white" fill="white" />
        </span>
        {c.duracao_seg ? (
          <span
            className="absolute bottom-1 right-1 px-1 rounded text-[10px] text-white"
            style={{ background: "rgba(0,0,0,0.65)" }}
          >
            {Math.round(c.duracao_seg)}s
          </span>
        ) : null}
      </button>

      <p className="text-[10px] text-cream/70 px-1.5 pt-1.5 line-clamp-2">{c.titulo}</p>

      <div className="flex items-center flex-wrap gap-2 sm:gap-1 p-1.5">
        <button
          onClick={() => aoAvaliar(c, "gostei")}
          title="Publicável"
          className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 rounded"
          style={{
            background: c.avaliacao === "gostei" ? "rgba(74,222,128,0.15)" : "transparent",
            color: c.avaliacao === "gostei" ? "#4ADE80" : "rgba(253,251,247,0.3)",
          }}
        >
          <ThumbsUp className="h-3 w-3" />
        </button>
        <button
          onClick={() => aoAvaliar(c, "rejeitado")}
          title="Não publicar"
          className="flex items-center justify-center min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-1 rounded"
          style={{
            background: c.avaliacao === "rejeitado" ? "rgba(245,158,11,0.15)" : "transparent",
            color: c.avaliacao === "rejeitado" ? "#F59E0B" : "rgba(253,251,247,0.3)",
          }}
        >
          <ThumbsDown className="h-3 w-3" />
        </button>
        <a
          href={c.url || c.preview_url || "#"}
          download
          target="_blank"
          rel="noreferrer"
          title="Baixar"
          className="flex items-center justify-center min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 p-1 rounded text-cream/30 ml-auto"
        >
          <Download className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
