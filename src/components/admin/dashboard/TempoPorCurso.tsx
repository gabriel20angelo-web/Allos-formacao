// Tempo de permanência quebrado por curso, dentro do dossiê da pessoa.
//
// O total da plataforma responde "quanto tempo ela ficou aqui"; o que o dono
// precisa saber antes de assinar um certificado é outra coisa: "ela concluiu
// 19 aulas DESTE curso, mas passou quanto tempo NELE?".
//
// A comparação é sempre com a duração das aulas que ela concluiu, nunca com a
// do curso inteiro. Quem fez metade do curso não deve ser cobrado pela metade
// que não fez: contra o curso todo, qualquer pessoa em andamento pareceria
// suspeita e o número perderia o sentido.

"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/ui/Skeleton";
import {
  formatDuration,
  getUsagePorCurso,
  type UsageCurso,
} from "@/lib/queries/usage";

/** Abaixo disso o tempo na plataforma não cobre nem um terço do conteúdo. */
const LIMIAR_BAIXO = 30;

const CAIXA = {
  background: "rgba(255,255,255,0.02)",
  border: "1px solid rgba(255,255,255,0.06)",
};

export default function TempoPorCurso({ userId }: { userId: string | null }) {
  const [cursos, setCursos] = useState<UsageCurso[]>([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!userId) {
      setCursos([]);
      return;
    }
    // O dossiê troca de pessoa sem desmontar o modal, então a resposta lenta de
    // uma consulta antiga não pode sobrescrever a da pessoa aberta agora.
    let atual = true;
    setCarregando(true);
    getUsagePorCurso(userId)
      .then((lista) => {
        if (!atual) return;
        setCursos(lista);
      })
      .finally(() => {
        if (atual) setCarregando(false);
      });
    return () => {
      atual = false;
    };
  }, [userId]);

  if (carregando) {
    return (
      <div className="space-y-1.5">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-[10px]" />
        ))}
      </div>
    );
  }

  if (cursos.length === 0) {
    return (
      <div className="px-3 py-2.5 rounded-[10px]" style={CAIXA}>
        <p className="font-dm text-[11px] text-cream/30">
          Nenhum tempo de permanência registrado ainda.
        </p>
      </div>
    );
  }

  // A nota de rodapé só aparece quando há de fato um curso sem tempo, para não
  // virar aviso de sempre que ninguém mais lê.
  const temCursoSemTempo = cursos.some((c) => c.segundos <= 0);

  return (
    <div className="space-y-1.5">
      {cursos.map((curso) => {
        const minutosSegundos = curso.minutosConteudoConcluido * 60;
        const semTempo = curso.segundos <= 0;
        // Sem duração cadastrada não há denominador, e uma porcentagem sobre
        // zero seria um número inventado.
        const semDenominador = minutosSegundos <= 0;
        const proporcao = semDenominador
          ? null
          : Math.round((curso.segundos / minutosSegundos) * 100);
        const abaixo =
          proporcao !== null && !semTempo && proporcao < LIMIAR_BAIXO;

        return (
          <div
            key={curso.courseId}
            className="px-3 py-2 rounded-[10px]"
            style={
              abaixo
                ? {
                    background: "rgba(245,158,11,0.05)",
                    border: "1px solid rgba(245,158,11,0.16)",
                  }
                : CAIXA
            }
          >
            <div className="flex items-start gap-2">
              <p className="font-dm text-[11px] font-medium text-cream/75 leading-snug min-w-0 flex-1">
                {curso.titulo}
              </p>

              {semTempo ? (
                <span className="font-dm text-[10px] text-cream/30 flex-shrink-0 mt-0.5">
                  sem tempo registrado
                </span>
              ) : proporcao === null ? (
                <span className="font-dm text-[10px] text-cream/30 flex-shrink-0 mt-0.5">
                  conteúdo sem duração cadastrada
                </span>
              ) : (
                <span className="flex-shrink-0 text-right">
                  <span
                    className="font-fraunces font-bold text-[15px] tabular-nums leading-none"
                    style={{
                      color: abaixo ? "#F59E0B" : "rgba(253,251,247,0.8)",
                    }}
                  >
                    {proporcao}%
                  </span>
                  {abaixo && (
                    <span className="block font-dm text-[10px] text-amber-200/70 leading-tight mt-0.5">
                      tempo muito abaixo do conteúdo
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              <span className="font-dm text-[10px] text-cream/35">
                <span className="font-fraunces font-semibold text-cream/65 tabular-nums">
                  {semTempo ? "0min" : formatDuration(curso.segundos)}
                </span>{" "}
                na plataforma
              </span>
              <span className="font-dm text-[10px] text-cream/35">
                <span className="font-fraunces font-semibold text-cream/65 tabular-nums">
                  {curso.aulasConcluidas}
                </span>{" "}
                {curso.aulasConcluidas === 1
                  ? "aula concluída"
                  : "aulas concluídas"}
              </span>
              <span className="font-dm text-[10px] text-cream/35">
                <span className="font-fraunces font-semibold text-cream/65 tabular-nums">
                  {semDenominador
                    ? "sem duração"
                    : formatDuration(minutosSegundos)}
                </span>{" "}
                de conteúdo concluído
              </span>
            </div>
          </div>
        );
      })}

      {temCursoSemTempo && (
        <p className="font-dm text-[10px] text-cream/25 leading-snug">
          Curso sem tempo registrado não quer dizer curso feito às pressas: o
          registro de permanência começou depois, então conclusão anterior a ele
          não deixou tempo gravado.
        </p>
      )}
    </div>
  );
}
