"use client";

// Em pé ou deitado.
//
// A escolha aparece em dois lugares (na sala, na aba do encontro; no curso, na
// lista de cortes) e é a mesma escolha, então é o mesmo componente. Duas
// cópias divergiriam no texto, que é justamente a parte que faz a pessoa
// entender o que está prestes a acontecer.
//
// O que a tela precisa dizer, e diz: isto vale para o PRÓXIMO corte. O que já
// foi cortado não muda de proporção, porque o arquivo saiu e foi pago naquele
// formato.

import { RectangleHorizontal, RectangleVertical } from "lucide-react";

export type FormatoC = "reels" | "horizontal";

const OPCOES: { id: FormatoC; rotulo: string; icone: typeof RectangleVertical; dica: string }[] = [
  {
    id: "reels",
    rotulo: "Em pé 9:16",
    icone: RectangleVertical,
    dica: "Para reels, stories e shorts. A ferramenta recorta a tela para caber em pé, e quando a câmera de quem fala está desligada sobra muito preto.",
  },
  {
    id: "horizontal",
    rotulo: "Deitado 16:9",
    icone: RectangleHorizontal,
    dica: "Do mesmo jeito que a gravação nasceu. Quase não há recorte, então a tela compartilhada e quem está falando aparecem inteiros.",
  },
];

export default function EscolhaDeFormato({
  valor,
  aoEscolher,
  ocupado,
  titulo = "Formato dos próximos cortes",
}: {
  /** `null` quando ninguém escolheu ainda: vale o padrão, que é em pé. */
  valor: FormatoC | null;
  aoEscolher: (f: FormatoC) => void;
  ocupado?: boolean;
  titulo?: string;
}) {
  const atual: FormatoC = valor || "reels";

  return (
    <div className="mt-3 pt-3 border-t border-white/5">
      <p className="text-[11px] text-cream/45 mb-2">
        {titulo}
        {!valor && <span className="text-cream/25"> · nada escolhido ainda, sai em pé</span>}
      </p>

      <div className="flex items-center gap-2 flex-wrap">
        {OPCOES.map(({ id, rotulo, icone: Icone, dica }) => {
          const ativo = atual === id;
          return (
            <button
              key={id}
              onClick={() => aoEscolher(id)}
              disabled={ocupado}
              title={dica}
              className="flex items-center gap-1.5 px-3 py-2.5 min-h-[44px] md:px-2.5 md:py-1.5 md:min-h-0 rounded-lg text-xs disabled:opacity-40"
              style={{
                background: ativo ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                color: ativo ? "#6C5CE7" : "rgba(253,251,247,0.35)",
                border: `1px solid ${ativo ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <Icone className="h-3 w-3" /> {rotulo}
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-cream/25 mt-2">
        Vale para o próximo corte. O que já foi cortado continua como saiu, e quem manda cortar
        é o administrador.
      </p>
    </div>
  );
}
