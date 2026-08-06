"use client";

/**
 * Os condutores, comparados entre si.
 *
 * Nenhuma tela do painel comparava condutores por quórum, permanência ou vozes
 * ativas. O que existia era um cadastro, e três definições de "condutor bom"
 * espalhadas por três telas, sobre três fontes, com três réguas de tempo, e
 * nenhuma delas avisando que as outras existiam.
 *
 * **A ordem é por volume, nunca por nota.** Vinte e um condutores entre 9,14 e
 * 10 não é uma distribuição, é ruído com nomes: ordenar por isso faz o primeiro
 * lugar ser decidido por sorte. A nota continua aparecendo, porque responde
 * "estão contentes com ele", mas com piso de cinco notas e sem posição.
 *
 * **Quem aparece aqui é união, não interseção.** Condutor que conduziu dez
 * encontros e nunca recebeu formulário existe, e sumia das telas antigas porque
 * elas partiam da lista de quem tinha nota.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import Card from "@/components/ui/Card";
import { chaveTexto, type Sala, type CondutorSala } from "@/hooks/useSala";
import type { CertificadoCondutor } from "@/types";

const TEAL = "#2E9E8F";
const ROXO = "#6C5CE7";
const DOURADO = "#D4854A";

/** Abaixo disso a média é ruído, e a tela diz isso em vez de mostrar o número. */
const PISO_DE_NOTAS = 5;

interface Linha {
  chave: string;
  nome: string;
  fichaId: string | null;
  arquivado: boolean;
  medido: CondutorSala | undefined;
  notas: number;
  somaNotas: number;
}

export default function PainelCondutores({
  sala,
  condutorStats,
  fichas,
  aoAbrir,
}: {
  sala: Sala | null;
  condutorStats: Map<string, { total: number; soma: number }>;
  fichas: CertificadoCondutor[];
  aoAbrir: (id: string) => void;
}) {
  const linhas = useMemo(() => {
    const acc = new Map<string, Linha>();

    const garantir = (nome: string): Linha => {
      const k = chaveTexto(nome);
      const atual = acc.get(k);
      if (atual) return atual;
      const nova: Linha = {
        chave: k,
        nome,
        fichaId: null,
        arquivado: false,
        medido: undefined,
        notas: 0,
        somaNotas: 0,
      };
      acc.set(k, nova);
      return nova;
    };

    // A ficha do cadastro é quem dá o id clicável.
    for (const f of fichas) {
      const l = garantir(f.nome);
      l.fichaId = f.id;
      l.arquivado = Boolean(f.arquivado);
      l.nome = f.nome;
    }

    // Quem a sala mediu, inclusive o segundo condutor de uma dupla, que as
    // telas antigas perdiam porque só liam o primeiro alocado.
    for (const c of sala?.condutores ?? []) {
      const l = garantir(c.nome);
      l.medido = c;
    }

    // Quem tem nota no formulário.
    condutorStats.forEach((v, nome) => {
      const l = garantir(nome);
      l.notas = v.total;
      l.somaNotas = v.soma;
    });

    return Array.from(acc.values())
      .filter((l) => !l.arquivado || l.medido || l.notas > 0)
      .sort(
        (a, b) =>
          (b.medido?.encontros ?? 0) - (a.medido?.encontros ?? 0) ||
          b.notas - a.notas ||
          a.nome.localeCompare(b.nome),
      );
  }, [sala, condutorStats, fichas]);

  const semFicha = linhas.filter((l) => !l.fichaId).length;
  const comSala = linhas.filter((l) => l.medido).length;

  if (linhas.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <Card>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Users className="h-4 w-4" style={{ color: ROXO }} />
          <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
            Lado a lado
          </h2>
        </div>
        <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
          Ordenado por quantos encontros cada um conduziu, não por nota. Quórum é
          gente que entrou na sala, sem contar quem conduz, e um encontro de dupla
          conta para os dois.
        </p>

        <div
          className="hidden sm:grid gap-2 px-3 pb-2 font-dm text-[10px] uppercase tracking-wider text-cream/25"
          style={{ gridTemplateColumns: "1fr 72px 76px 84px 76px 92px" }}
        >
          <span>Condutor</span>
          <span className="text-right">Encontros</span>
          <span className="text-right">Na sala</span>
          <span className="text-right">Tendência</span>
          <span className="text-right">Fala</span>
          <span className="text-right">Feedbacks</span>
        </div>

        <div className="space-y-1.5">
          {linhas.map((l) => {
            const m = l.medido;
            const media = l.notas >= PISO_DE_NOTAS ? l.somaNotas / l.notas : null;
            const Conteudo = (
              <>
                <div className="min-w-0">
                  <p className="font-dm text-xs text-cream/80 truncate">
                    {l.nome}
                    {l.arquivado && (
                      <span className="text-cream/25 font-dm text-[10px]"> · arquivado</span>
                    )}
                  </p>
                  <p className="font-dm text-[10px] text-cream/25 truncate">
                    {/* A frase precisa dizer a verdade sobre CADA caso. Antes
                        havia só dois ramos, e quem tinha nota no formulário sem
                        ficha era descrito como "aparece na sala", que é outra
                        coisa e mandaria procurar no lugar errado. */}
                    {m?.atividades.length
                      ? m.atividades.join(", ")
                      : l.fichaId
                        ? "nenhum encontro capturado ainda"
                        : l.notas > 0
                          ? "citado no formulário, sem ficha no cadastro"
                          : "sem ficha no cadastro"}
                  </p>
                </div>
                <span className="font-dm text-xs text-cream/50 tabular-nums text-right hidden sm:block">
                  {m?.encontros ?? 0}
                </span>
                <span className="font-fraunces font-bold text-sm text-cream tabular-nums text-right hidden sm:block">
                  {m?.quorumMedio?.toFixed(1) ?? "—"}
                </span>
                <span className="text-right hidden sm:block">
                  {m?.tendencia == null ? (
                    <span className="font-dm text-[11px] text-cream/20">—</span>
                  ) : (
                    <span
                      className="font-dm text-xs tabular-nums"
                      style={{ color: m.tendencia >= 0 ? TEAL : "#E07A5F" }}
                    >
                      {m.tendencia > 0 ? "↑" : m.tendencia < 0 ? "↓" : ""}{" "}
                      {Math.abs(m.tendencia).toFixed(1)}
                    </span>
                  )}
                </span>
                <span
                  className="font-dm text-xs tabular-nums text-right hidden sm:block"
                  style={{ color: ROXO }}
                >
                  {/* Zero aqui seria "não reconheci quem conduzia", não silêncio.
                      A leitura já converte esse zero em ausência. */}
                  {m?.falaCondutorPct === null || m?.falaCondutorPct === undefined
                    ? "—"
                    : `${m.falaCondutorPct.toFixed(0)}%`}
                </span>
                <span className="font-dm text-xs text-cream/50 tabular-nums text-right hidden sm:block">
                  {l.notas === 0 ? (
                    "—"
                  ) : media === null ? (
                    <span className="text-cream/25">{l.notas} nota{l.notas > 1 ? "s" : ""}</span>
                  ) : (
                    <>
                      {media.toFixed(1)}{" "}
                      <span className="text-cream/25">({l.notas})</span>
                    </>
                  )}
                </span>
              </>
            );

            return (
              <div
                key={l.chave}
                className="px-3 py-2.5 rounded-[10px]"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                {l.fichaId ? (
                  <button
                    onClick={() => aoAbrir(l.fichaId as string)}
                    className="w-full text-left sm:grid gap-2 items-center hover:opacity-80 transition-opacity"
                    style={{ gridTemplateColumns: "1fr 72px 76px 84px 76px 92px" }}
                  >
                    {Conteudo}
                  </button>
                ) : (
                  <div
                    className="sm:grid gap-2 items-center"
                    style={{ gridTemplateColumns: "1fr 72px 76px 84px 76px 92px" }}
                  >
                    {Conteudo}
                  </div>
                )}

                {/* No celular a grade vira uma linha de números soltos. */}
                <div className="sm:hidden flex flex-wrap gap-x-4 gap-y-1 pt-1.5">
                  {m && (
                    <>
                      <span className="font-dm text-[11px] text-cream/45">
                        <strong className="font-fraunces text-cream">
                          {m.quorumMedio?.toFixed(1) ?? "—"}
                        </strong>{" "}
                        na sala
                      </span>
                      <span className="font-dm text-[11px] text-cream/45">
                        {m.encontros} {m.encontros === 1 ? "encontro" : "encontros"}
                      </span>
                    </>
                  )}
                  {l.notas > 0 && (
                    <span className="font-dm text-[11px] text-cream/45">
                      {media === null
                        ? `${l.notas} nota${l.notas > 1 ? "s" : ""}`
                        : `nota ${media.toFixed(1)} em ${l.notas}`}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="mt-4 pt-3 font-dm text-[11px] text-cream/30 leading-relaxed space-y-1.5"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p>
            A nota aparece só a partir de {PISO_DE_NOTAS} avaliações. Abaixo disso o
            número existe e não quer dizer nada, e mostrar assim mesmo convida a
            comparar quem não dá para comparar. Nenhuma coluna daqui ordena a lista,
            de propósito.
          </p>
          {semFicha > 0 && (
            <p style={{ color: DOURADO }}>
              {semFicha} {semFicha === 1 ? "nome apareceu" : "nomes apareceram"} na sala
              ou no formulário sem ficha no cadastro. Sem ficha não há como ligar a
              conta da pessoa, e a área do condutor não abre para ela. Um deles é
              &quot;Outros&quot;, que é opção do formulário e não uma pessoa: as
              avaliações que caíram ali não têm dono e não somam para ninguém.
            </p>
          )}
          {comSala === 0 && (
            <p>
              Nenhum encontro capturado ainda no período. A captura pela API do Meet
              começou em 3 de agosto de 2026.
            </p>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
