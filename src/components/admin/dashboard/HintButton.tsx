// O "?" que explica um número sem ocupar a tela.
//
// No celular o balão vira uma faixa ancorada na base, e não um retângulo
// centralizado no botão. A razão é que o botão é do tamanho de um caractere e
// cai onde a linha de texto terminar: quando ele calhava perto da borda
// direita, um balão de 13rem centralizado nele saía uns sessenta pixels para
// fora da tela, e o texto mais longo do painel abria vinte e duas linhas para
// cima, passando do topo da rolagem. Ancorado na base, ele cabe sempre, não
// depende de onde o botão parou e ainda ganha alvo de toque decente para
// fechar.

"use client";

import { useState } from "react";

export default function HintButton({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block flex-shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        aria-label="O que este número quer dizer"
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,251,247,0.3)" }}
      >?</button>
      {show && (
        <>
          {/* Fundo que fecha ao toque, só no celular: sem ele, a faixa fica
              presa na base e a saída não é óbvia. */}
          <span
            onClick={() => setShow(false)}
            className="fixed inset-0 z-40 sm:hidden"
            aria-hidden
          />
          <div
            className="fixed inset-x-4 bottom-4 z-50 px-4 py-3 rounded-lg text-[12px] font-dm leading-relaxed
                       sm:absolute sm:inset-auto sm:bottom-6 sm:left-1/2 sm:-translate-x-1/2 sm:w-52 sm:px-3 sm:py-2 sm:text-[11px]"
            style={{ background: "#222", border: "1px solid #444", color: "rgba(253,251,247,0.7)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
          >
            {text}
            <button
              onClick={() => setShow(false)}
              aria-label="Fechar"
              className="absolute top-0.5 right-1 p-2 sm:p-0 sm:top-1 sm:right-1.5 text-cream/30 hover:text-cream text-[13px] sm:text-[10px]"
            >
              x
            </button>
          </div>
        </>
      )}
    </span>
  );
}
