// O seletor de janela do painel, e o selo de quem não obedece a ele.
//
// Duas peças que só fazem sentido juntas. O seletor oferece hoje, 15, 30, 60,
// 90 dias e tudo. O selo existe porque alguns blocos têm janela por definição,
// e não por escolha: núcleo é cinco presenças em noventa dias, sumiço é
// quarenta e cinco dias sem sinal, coorte é por mês de estreia.
//
// A tentação era deixar o seletor governar tudo, e o resultado medido em
// 06/08/2026 mostra por que não: com a janela em "hoje", um núcleo que segue o
// seletor cai de vinte pessoas para zero, e a tela passa a anunciar o fim da
// formação num dia em que nada aconteceu. Então esses blocos ignoram o seletor
// e dizem isso na cara, com o selo ao lado do título. Um número que não obedece
// ao filtro e não avisa é pior que um número errado, porque ninguém desconfia.

"use client";

import { JANELAS_PAINEL, RANGE_LABELS, type ActivityRange } from "@/lib/utils/activity";

const TERRACOTA = "#C84B31";

export function SeletorJanela({
  valor,
  onChange,
  desabilitado,
}: {
  valor: ActivityRange;
  onChange: (j: ActivityRange) => void;
  desabilitado?: boolean;
}) {
  return (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
      {JANELAS_PAINEL.map((j) => {
        const ativo = valor === j;
        return (
          <button
            key={j}
            onClick={() => onChange(j)}
            disabled={desabilitado}
            className="font-dm text-xs px-3 py-2 rounded-full whitespace-nowrap transition-all min-h-[36px] disabled:opacity-40"
            style={{
              backgroundColor: ativo ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: ativo ? TERRACOTA : "rgba(253,251,247,0.4)",
              border: `1px solid ${ativo ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {RANGE_LABELS[j]}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Selo para o bloco que não segue o seletor. O `motivo` deve dizer a definição,
 * não o número: "noventa dias, por definição" e não "noventa dias".
 */
export function JanelaPropria({ motivo }: { motivo: string }) {
  return (
    <span
      className="font-dm text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{
        color: "rgba(253,251,247,0.35)",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)",
      }}
    >
      {motivo}
    </span>
  );
}
