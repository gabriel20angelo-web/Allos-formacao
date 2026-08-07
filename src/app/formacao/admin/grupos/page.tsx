"use client";

/**
 * Grupos: a seção.
 *
 * A atividade é o grupo. O slot é onde ele cai na grade, a sala do Meet é onde
 * ele acontece, o calendário é a grade dele, e a captura é como ele é medido.
 * Tudo isso vivia em telas separadas dentro de Formação, e para responder uma
 * pergunta sobre um grupo era preciso saber de cor qual tela guardava o quê.
 *
 * Três entradas, e o critério da divisão é o sujeito de cada uma:
 *
 *   **Grupos** é o catálogo com a saúde de cada um. Clicar abre a página do
 *   grupo, que junta as sete peças.
 *
 *   **Grade** é a semana: quem cai em que horário, quem conduz, o status, a
 *   arte do cronograma e as mensagens. É a única visão que precisa de todos os
 *   grupos ao mesmo tempo.
 *
 *   **Captura** é o encanamento: a conta do Google, a ingestão, a conciliação
 *   de nomes e os ajustes. Não é sobre grupo nenhum, e por isso não polui as
 *   outras duas. Um nome conciliado ali vale para todos os grupos de uma vez.
 *
 * As duas últimas montam as telas que já existiam, em vez de reescrevê-las. O
 * que era POR GRUPO dentro delas já mudou de endereço: foi para a página do
 * grupo, em `/admin/grupos/[id]`.
 */

import { useState } from "react";
import dynamic from "next/dynamic";
import { LayoutGrid, CalendarDays, Radio, History } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Panorama from "./Panorama";

const GradePage = dynamic(() => import("@/app/formacao/admin/calendario/page"), { ssr: false });
const CapturaPage = dynamic(() => import("@/app/formacao/admin/meet/page"), { ssr: false });
const CiclosPage = dynamic(() => import("./Ciclos"), { ssr: false });

type Aba = "grupos" | "grade" | "ciclos" | "captura";

const ABAS: { id: Aba; rotulo: string; icone: typeof LayoutGrid; dica: string }[] = [
  { id: "grupos", rotulo: "Grupos", icone: LayoutGrid, dica: "O catálogo e a saúde de cada um" },
  { id: "grade", rotulo: "Grade", icone: CalendarDays, dica: "A semana, os horários e quem conduz" },
  // ⭐ Ciclos fica colado na Grade porque é a história dela: a grade é o
  // cronograma de agora, o ciclo é o cronograma que rodou e fechou.
  { id: "ciclos", rotulo: "Ciclos", icone: History, dica: "Os cronogramas que rodaram, e a comparação entre eles" },
  { id: "captura", rotulo: "Captura", icone: Radio, dica: "Conta do Google, ingestão e nomes a resolver" },
];

export default function GruposPage() {
  const { isAdmin } = useAuth();
  const [aba, setAba] = useState<Aba>("grupos");

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-dm text-cream/50">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex gap-1 flex-wrap mb-6">
        {ABAS.map((a) => {
          const ativa = aba === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              title={a.dica}
              className="font-dm text-xs px-3 py-2 sm:px-4 rounded-full flex items-center gap-1.5 transition-all min-h-[40px]"
              style={{
                background: ativa ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                color: ativa ? "#C84B31" : "rgba(253,251,247,0.4)",
                border: `1px solid ${ativa ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <a.icone className="h-3.5 w-3.5" />
              {a.rotulo}
            </button>
          );
        })}
      </div>

      {aba === "grupos" && <Panorama />}
      {aba === "grade" && <GradePage />}
      {aba === "ciclos" && <CiclosPage />}
      {aba === "captura" && <CapturaPage />}
    </div>
  );
}
