"use client";

// A fila de curadoria.
//
// Antes os cortes dos encontros ficavam a três cliques: abrir a sala, abrir o
// encontro, e só então a grade. Quem tem quarenta cortes espalhados por seis
// encontros não descobre isso sozinho — e o trabalho da semana é justamente
// esse, não os interruptores da sala.
//
// Aqui a fila abre já filtrada pelo que ninguém olhou ainda. O agrupamento por
// encontro fica, porque julgar um trecho depende de saber de qual conversa ele
// saiu, mas nada disso exige um clique para aparecer.

import { useState } from "react";
import Card from "@/components/ui/Card";
import ClipeGrade, { AvisoDeCuradoria } from "./ClipeGrade";
import CortesDosCursos from "./CortesDosCursos";
import { DIAS, type ClipeC, type SalaC } from "./tipos";

type Filtro = "por-ver" | "gostei" | "rejeitado" | "todos";

const FILTROS: { id: Filtro; rotulo: string }[] = [
  { id: "por-ver", rotulo: "Por avaliar" },
  { id: "gostei", rotulo: "Publicáveis" },
  { id: "rejeitado", rotulo: "Reprovados" },
  { id: "todos", rotulo: "Todos" },
];

interface Grupo {
  chave: string;
  titulo: string;
  clipes: ClipeC[];
}

function cabe(c: ClipeC, filtro: Filtro): boolean {
  if (filtro === "todos") return true;
  if (filtro === "por-ver") return !c.avaliacao;
  return c.avaliacao === filtro;
}

export default function AbaCortes({
  salas,
  aoAssistir,
  aoAvaliar,
}: {
  salas: SalaC[];
  aoAssistir: (c: ClipeC) => void;
  aoAvaliar: (c: ClipeC, v: "gostei" | "rejeitado") => void;
}) {
  const [filtro, setFiltro] = useState<Filtro>("por-ver");

  const todos = salas.flatMap((s) => s.encontros.flatMap((e) => e.clipes));

  const contagem: Record<Filtro, number> = {
    "por-ver": todos.filter((c) => !c.avaliacao).length,
    gostei: todos.filter((c) => c.avaliacao === "gostei").length,
    rejeitado: todos.filter((c) => c.avaliacao === "rejeitado").length,
    todos: todos.length,
  };

  // Um grupo por encontro, na ordem em que a rota já devolveu (mais recente
  // primeiro). Grupos que ficam vazios pelo filtro somem.
  const grupos: Grupo[] = [];
  for (const sala of salas) {
    const nomeDaSala =
      sala.dia_semana !== null ? DIAS[sala.dia_semana] : sala.rotulo || sala.space_name;

    for (const encontro of sala.encontros) {
      const clipes = encontro.clipes.filter((c) => cabe(c, filtro));
      if (!clipes.length) continue;

      const data = new Date(encontro.inicio).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
      });

      grupos.push({
        chave: encontro.id,
        titulo: salas.length > 1 ? `${nomeDaSala} · ${data}` : data,
        clipes,
      });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 flex-wrap mb-3">
          {FILTROS.map((f) => {
            const ativo = filtro === f.id;
            const n = contagem[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                disabled={n === 0 && !ativo}
                className="px-3 py-2 sm:py-1.5 rounded-lg text-xs transition-all disabled:opacity-30"
                style={{
                  background: ativo ? "rgba(200,75,49,0.14)" : "rgba(255,255,255,0.03)",
                  color: ativo ? "#E8836A" : "rgba(253,251,247,0.4)",
                  border: `1px solid ${ativo ? "rgba(200,75,49,0.32)" : "rgba(255,255,255,0.08)"}`,
                }}
              >
                {f.rotulo}
                <span className="ml-1.5 opacity-60">{n}</span>
              </button>
            );
          })}
        </div>

        {grupos.length > 0 && <AvisoDeCuradoria />}

        {grupos.length === 0 && (
          <p className="text-xs text-cream/30">
            {contagem.todos === 0
              ? "Nenhum corte saiu dos seus encontros ainda. Eles aparecem alguns dias depois da gravação."
              : filtro === "por-ver"
                ? "Nada por avaliar. Você já passou por todos."
                : "Nenhum corte nesta situação."}
          </p>
        )}

        <div className="space-y-5">
          {grupos.map((g) => (
            <div key={g.chave}>
              <p className="text-[11px] text-cream/40 mb-2">
                {g.titulo}
                <span className="text-cream/20"> · {g.clipes.length}</span>
              </p>
              <ClipeGrade
                clipes={g.clipes}
                aoAssistir={aoAssistir}
                aoAvaliar={aoAvaliar}
                mostrarAviso={false}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Os cortes das aulas gravadas. Continuam com a navegação própria —
          curso, depois encontro — porque um curso passa de trezentos cortes, e
          carregar tudo junto da fila acima só produziria uma parede. */}
      <CortesDosCursos aoAssistir={aoAssistir} aoAvaliar={aoAvaliar} />
    </div>
  );
}
