"use client";

// Quem esteve no encontro, em ordem de importância.
//
// A ordem padrão é o tempo de fala, e não os minutos de presença. Presença
// mede quem deixou a janela aberta; fala mede quem participou. Num grupo de
// setenta pessoas, a lista por presença é quase o resultado de quem clicou no
// link primeiro — todo mundo com noventa minutos, empatado, na ordem em que o
// Google devolveu. A lista por fala responde à pergunta que se faz de verdade
// depois de um encontro: quem estava ali.
//
// Os dois critérios continuam a um clique de distância, porque presença é o
// que importa para certificado e frequência, e fala é o que importa para
// conduzir. São perguntas diferentes sobre a mesma tabela.
//
// A barra existe para não precisar comparar números: num grupo com um condutor
// falando quarenta minutos e vinte pessoas falando um, o desequilíbrio é a
// informação, e ele aparece na hora.

import { useMemo, useState } from "react";
import { Mic, Timer, UserRound } from "lucide-react";
import type { CriterioRanking, ParticipacaoUI } from "./tipos";
import { minutos, ROXO } from "./tipos";

export default function ListaParticipacoes({
  participacoes,
  tolerancia,
  aoAbrirPessoa,
  compacta = false,
}: {
  participacoes: ParticipacaoUI[];
  tolerancia: number;
  /** Quando ausente, os nomes não viram link. */
  aoAbrirPessoa?: (p: ParticipacaoUI) => void;
  compacta?: boolean;
}) {
  // Transcrição desligada deixa `minutos_fala` nulo em todo mundo. Nesse caso
  // ordenar por fala é ordenar por nada, e o critério começa na presença.
  const houveFala = useMemo(
    () => participacoes.some((p) => p.minutos_fala !== null),
    [participacoes]
  );
  const [criterio, setCriterio] = useState<CriterioRanking>(houveFala ? "fala" : "presenca");
  const criterioReal: CriterioRanking = houveFala ? criterio : "presenca";

  const { ordenadas, falaTotal, maxValor } = useMemo(() => {
    const lista = [...participacoes].sort((a, b) => {
      if (criterioReal === "fala") {
        const fa = a.minutos_fala ?? -1;
        const fb = b.minutos_fala ?? -1;
        if (fb !== fa) return fb - fa;
        return b.minutos_presentes - a.minutos_presentes;
      }
      if (b.minutos_presentes !== a.minutos_presentes) {
        return b.minutos_presentes - a.minutos_presentes;
      }
      return (b.minutos_fala ?? -1) - (a.minutos_fala ?? -1);
    });

    const total = participacoes.reduce((s, p) => s + (p.minutos_fala || 0), 0);
    const max =
      criterioReal === "fala"
        ? Math.max(...participacoes.map((p) => p.minutos_fala || 0), 0.01)
        : Math.max(...participacoes.map((p) => p.minutos_presentes), 1);

    return { ordenadas: lista, falaTotal: total, maxValor: max };
  }, [participacoes, criterioReal]);

  if (!participacoes.length) {
    return <p className="text-xs text-cream/30">Nenhuma presença registrada neste encontro.</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
        <div className="flex items-center gap-1.5">
          {(
            [
              ["fala", "Quem mais falou", Mic],
              ["presenca", "Quem mais ficou", Timer],
            ] as const
          ).map(([chave, rotulo, Icone]) => {
            const ativo = criterioReal === chave;
            const desligado = chave === "fala" && !houveFala;
            return (
              <button
                key={chave}
                onClick={() => setCriterio(chave)}
                disabled={desligado}
                title={
                  desligado
                    ? "Este encontro não teve transcrição, então não há tempo de fala."
                    : undefined
                }
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] disabled:opacity-30"
                style={{
                  background: ativo ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                  color: ativo ? ROXO : "rgba(253,251,247,0.4)",
                  border: `1px solid ${ativo ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <Icone className="h-3 w-3" />
                {rotulo}
              </button>
            );
          })}
        </div>

        {houveFala && falaTotal > 0 && (
          <span className="text-[11px] text-cream/30">
            {minutos(falaTotal)} min de fala no total
          </span>
        )}
      </div>

      <div className="space-y-1">
        {ordenadas.map((p, i) => {
          const valor = criterioReal === "fala" ? p.minutos_fala || 0 : p.minutos_presentes;
          const proporcao = Math.max(2, Math.round((valor / maxValor) * 100));
          const fatiaDaFala =
            falaTotal > 0 && p.minutos_fala ? Math.round((p.minutos_fala / falaTotal) * 100) : null;
          const clicavel = !!aoAbrirPessoa && !!p.identificada;
          const nomeDiferente =
            p.pessoa_nome && p.pessoa_nome.toLowerCase() !== p.display_name.toLowerCase();

          return (
            <div
              key={`${p.display_name_norm}-${i}`}
              className="relative rounded-[10px] overflow-hidden"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              {/* A barra é fundo, não elemento ao lado: assim o número fica
                  legível por cima dela em qualquer largura de tela. */}
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${proporcao}%`,
                  background:
                    criterioReal === "fala"
                      ? "linear-gradient(90deg, rgba(108,92,231,0.20), rgba(108,92,231,0.05))"
                      : "linear-gradient(90deg, rgba(200,75,49,0.16), rgba(200,75,49,0.04))",
                }}
              />

              <div className="relative flex items-start gap-2 px-2.5 py-2">
                <span className="text-[11px] text-cream/25 w-5 shrink-0 tabular-nums pt-0.5">
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {clicavel ? (
                      <button
                        onClick={() => aoAbrirPessoa?.(p)}
                        className="text-xs text-cream hover:underline text-left break-words"
                        style={{ textDecorationColor: ROXO }}
                      >
                        {p.display_name}
                      </button>
                    ) : (
                      <span className="text-xs text-cream/70 break-words">{p.display_name}</span>
                    )}

                    {p.eh_condutor && (
                      <span className="text-[10px] text-cream/30 shrink-0">condutor</span>
                    )}

                    {!p.eh_condutor && !p.identificada && (
                      <span className="text-[10px] text-amber-400/60 shrink-0">sem cadastro</span>
                    )}

                    {p.identificada && !p.tem_conta && (
                      <span
                        className="text-[10px] shrink-0"
                        title="Identificada pelo formulário de certificado. Ainda não tem conta na plataforma."
                        style={{ color: "rgba(108,92,231,0.75)" }}
                      >
                        pelo certificado
                      </span>
                    )}
                  </div>

                  {nomeDiferente && (
                    <p className="text-[11px] text-cream/35 break-words flex items-center gap-1">
                      <UserRound className="h-2.5 w-2.5 shrink-0" />
                      {p.pessoa_nome}
                    </p>
                  )}

                  {!compacta && (
                    <p className="text-[11px] text-cream/40 mt-0.5">
                      {p.minutos_presentes} min presentes
                      {p.permanencia_pct !== null ? ` · ${p.permanencia_pct}% do encontro` : ""}
                      {p.atraso_min === null
                        ? ""
                        : p.atraso_min <= tolerancia
                          ? " · no horário"
                          : ` · ${p.atraso_min} min depois`}
                      {p.n_sessoes > 1 ? ` · ${p.n_sessoes} entradas` : ""}
                    </p>
                  )}
                </div>

                <div className="text-right shrink-0">
                  {criterioReal === "fala" ? (
                    p.minutos_fala === null ? (
                      <span className="text-[11px] text-cream/25">sem transcrição</span>
                    ) : p.minutos_fala === 0 ? (
                      <span className="text-[11px] text-cream/25">não falou</span>
                    ) : (
                      <>
                        <span className="text-xs text-cream tabular-nums">
                          {minutos(p.minutos_fala)} min
                        </span>
                        <span className="block text-[10px] text-cream/35 tabular-nums">
                          {p.n_turnos_fala}x{fatiaDaFala !== null ? ` · ${fatiaDaFala}%` : ""}
                        </span>
                      </>
                    )
                  ) : (
                    <>
                      <span className="text-xs text-cream tabular-nums">
                        {p.minutos_presentes} min
                      </span>
                      {p.permanencia_pct !== null && (
                        <span className="block text-[10px] text-cream/35 tabular-nums">
                          {p.permanencia_pct}%
                        </span>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
