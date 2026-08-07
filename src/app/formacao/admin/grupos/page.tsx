"use client";

/**
 * Os grupos síncronos.
 *
 * A tela responde uma pergunta só: **qual grupo está morrendo, e é o horário ou
 * é a condução?** Por isso a tendência e o quórum por dia da semana vêm antes de
 * tudo. Tendência diz qual grupo cai; dia da semana diz se a culpa é do horário.
 * Sozinhos são dois números, juntos são um diagnóstico.
 *
 * Três decisões de desenho que valem explicar:
 *
 * **Agrupa por atividade, não por slot.** A rota antiga de métricas agrupava por
 * `slot_id`, e isso parte em dois todo grupo que mudou de horário. O grupo é a
 * coisa; o horário é onde ela está na grade nesta semana.
 *
 * **Não existe ranking por nota.** Nem de grupo, nem de condutor. Vinte e um
 * condutores entre 9,14 e 10 é ruído com nomes, e ordenar por isso faz o
 * primeiro lugar ser decidido por sorte.
 *
 * **Quórum relativo não existe, e a tela diz isso.** Não há nenhuma tabela de
 * inscrição em grupo, então "presentes sobre inscritos" é dado que falta, não
 * conta que ninguém fez. Comparar grupo de 8 com grupo de 30 continua sendo
 * comparação de números crus, e é honesto avisar.
 */

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Users,
  TrendingDown,
  CalendarDays,
  MicOff,
  UserMinus,
  Clock,
  AlertTriangle,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { SeletorJanela, JanelaPropria } from "@/components/admin/SeletorJanela";
import { useAuth } from "@/hooks/useAuth";
import { useSala, type GrupoSala } from "@/hooks/useSala";
import { DIAS_DA_SEMANA } from "@/lib/meet/quorum";
import { janelaEmDias, RANGE_LABELS, type ActivityRange } from "@/lib/utils/activity";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";
const ROXO = "#6C5CE7";

function num(n: number | null, casas = 1): string {
  return n === null ? "—" : n.toFixed(casas);
}

function dataCurta(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

/** A seta da tendência, com a cor do que ela significa e não do que ela é. */
function Tendencia({ v }: { v: number | null }) {
  if (v === null) {
    // Um travessão, e não "faltam encontros": o texto quebrava em duas linhas
    // dentro da coluna e, com quase todo grupo tendo um encontro só, repetia a
    // mesma frase em todas as linhas. A explicação vive uma vez, no rodapé.
    return (
      <span
        className="font-dm text-[11px] text-cream/20"
        title="Precisa de quatro encontros para medir tendência"
      >
        —
      </span>
    );
  }
  if (v === 0) return <span className="font-dm text-xs text-cream/40">estável</span>;
  const sobe = v > 0;
  return (
    <span
      className="font-dm text-xs tabular-nums"
      style={{ color: sobe ? TEAL : "#E07A5F" }}
    >
      {sobe ? "↑" : "↓"} {Math.abs(v).toFixed(1)}
    </span>
  );
}

export default function GruposPage() {
  const { isAdmin } = useAuth();
  const router = useRouter();
  const [janela, setJanela] = useState<ActivityRange>("all");
  const dias = useMemo(() => janelaEmDias(janela), [janela]);
  const { sala, carregando, erro } = useSala(dias);

  const grupos: GrupoSala[] = useMemo(() => sala?.grupos ?? [], [sala]);

  // A pior notícia primeiro: quem está caindo. Sem isso a tela é um relatório,
  // e relatório não muda a semana de ninguém.
  const caindo = useMemo(
    () =>
      grupos
        .filter((g) => g.tendencia !== null && g.tendencia < 0)
        .sort((a, b) => (a.tendencia ?? 0) - (b.tendencia ?? 0)),
    [grupos],
  );

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="font-dm text-cream/50">Acesso restrito.</p>
      </div>
    );
  }

  if (carregando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (erro || !sala) {
    return (
      <Card>
        <p className="font-dm text-sm text-cream/60">
          Não consegui ler a sala. {erro}
        </p>
      </Card>
    );
  }

  const vazio = grupos.length === 0;
  const g = sala.geral;

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="font-fraunces text-2xl font-bold text-cream">Grupos</h1>
        <p className="font-dm text-xs text-cream/40 mt-1 leading-relaxed">
          Os encontros síncronos, medidos na sala do Meet. Quórum aqui é gente que
          entrou, sem contar quem conduz.
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <SeletorJanela valor={janela} onChange={setJanela} />
      </div>

      {vazio ? (
        <Card>
          <p className="font-dm text-sm text-cream/50 leading-relaxed">
            Nenhum encontro capturado {janela === "all" ? "ainda" : `nos últimos ${RANGE_LABELS[janela].toLowerCase()}`}.
            A captura pela API do Meet começou em 3 de agosto de 2026, e só grava
            encontro de sala configurada.
          </p>
        </Card>
      ) : (
        <>
          {/* ── o retrato geral ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <Card>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Users className="h-4 w-4" style={{ color: TERRACOTA }} />
                <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                  No período
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
                {[
                  { r: "grupos com encontro", v: String(grupos.length) },
                  { r: "encontros medidos", v: String(g.encontros) },
                  { r: "pessoas por encontro", v: num(g.quorumMedio) },
                  { r: "encontro mais cheio", v: String(g.quorumMaximo) },
                  {
                    r: `falaram${g.encontrosComTranscricao ? ` (${g.encontrosComTranscricao} c/ transcrição)` : ""}`,
                    v: g.vozesAtivasPct === null ? "—" : `${g.vozesAtivasPct.toFixed(0)}%`,
                  },
                  {
                    r: "preencheram o formulário",
                    v: g.coberturaPct === null ? "—" : `${g.coberturaPct.toFixed(0)}%`,
                    cor: g.coberturaPct !== null && g.coberturaPct < 40 ? DOURADO : undefined,
                  },
                ].map((x) => (
                  <div key={x.r}>
                    <p
                      className="font-fraunces font-bold text-2xl tabular-nums leading-none"
                      style={{ color: x.cor ?? "rgba(253,251,247,0.85)" }}
                    >
                      {x.v}
                    </p>
                    <p className="font-dm text-[11px] text-cream/30 mt-1.5">{x.r}</p>
                  </div>
                ))}
              </div>
              <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
                Preencher o formulário é hábito de pessoa, não sorteio: quando a
                cobertura está baixa, qualquer média tirada do formulário fala por
                uma parte da sala que se repete.
              </p>
            </Card>
          </motion.div>

          {/* ── quem está caindo ── */}
          {caindo.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}>
              <Card>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <TrendingDown className="h-4 w-4" style={{ color: "#E07A5F" }} />
                  <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                    Encolhendo
                  </h2>
                </div>
                <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                  A metade recente dos encontros contra a metade antiga, em pessoas.
                  Precisa de quatro encontros para dizer alguma coisa.
                </p>
                <div className="space-y-1.5">
                  {caindo.map((x) => (
                    <div
                      key={x.chave}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px]"
                      style={{ background: "rgba(224,122,95,0.06)" }}
                    >
                      <span className="font-dm text-xs text-cream/75 truncate">{x.nome}</span>
                      <span className="font-dm text-xs shrink-0" style={{ color: "#E07A5F" }}>
                        {x.tendencia?.toFixed(1)} pessoas
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── grupo a grupo ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
            <Card>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Users className="h-4 w-4" style={{ color: TERRACOTA }} />
                <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                  Grupo a grupo
                </h2>
                <JanelaPropria motivo="agrupado por atividade, não por horário" />
              </div>
              <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                Ordenado por quórum. Um grupo que mudou de horário continua sendo um
                grupo só, e aparece com os dois horários somados. Tendência com
                travessão é grupo que ainda não tem os quatro encontros que ela
                precisa para significar alguma coisa.
              </p>

              {/* Cabeçalho só no desktop: no celular cada grupo vira um cartão. */}
              <div
                className="hidden sm:grid gap-2 px-3 pb-2 font-dm text-[10px] uppercase tracking-wider text-cream/25"
                style={{ gridTemplateColumns: "1fr 64px 76px 84px 72px 72px" }}
              >
                <span>Grupo</span>
                <span className="text-right">Encontros</span>
                <span className="text-right">Na sala</span>
                <span className="text-right">Tendência</span>
                <span className="text-right">Falaram</span>
                <span className="text-right">Formulário</span>
              </div>

              <div className="space-y-1.5">
                {grupos.map((x) => (
                  <div
                    key={x.chave}
                    onClick={() => x.atividadeId && router.push(`/formacao/admin/grupos/${x.atividadeId}`)}
                    role={x.atividadeId ? "button" : undefined}
                    tabIndex={x.atividadeId ? 0 : undefined}
                    onKeyDown={(ev) => {
                      if (x.atividadeId && (ev.key === "Enter" || ev.key === " ")) {
                        ev.preventDefault();
                        router.push(`/formacao/admin/grupos/${x.atividadeId}`);
                      }
                    }}
                    className={`px-3 py-2.5 rounded-[10px] ${x.atividadeId ? "cursor-pointer transition-colors hover:bg-white/[0.04]" : ""}`}
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div
                      className="hidden sm:grid gap-2 items-center"
                      style={{ gridTemplateColumns: "1fr 64px 76px 84px 72px 72px" }}
                    >
                      <div className="min-w-0">
                        <p className="font-dm text-xs text-cream/80 truncate">{x.nome}</p>
                        <p className="font-dm text-[10px] text-cream/25 truncate">
                          {x.condutores.length ? x.condutores.join(", ") : "sem condutor reconhecido"}
                          {x.slots > 1 ? ` · ${x.slots} horários` : ""}
                        </p>
                      </div>
                      <span className="font-dm text-xs text-cream/50 tabular-nums text-right">
                        {x.encontros}
                      </span>
                      <span className="font-fraunces font-bold text-sm text-cream tabular-nums text-right">
                        {num(x.quorumMedio)}
                      </span>
                      <span className="text-right">
                        <Tendencia v={x.tendencia} />
                      </span>
                      <span className="font-dm text-xs tabular-nums text-right" style={{ color: ROXO }}>
                        {x.vozesAtivasPct === null ? "—" : `${x.vozesAtivasPct.toFixed(0)}%`}
                      </span>
                      <span
                        className="font-dm text-xs tabular-nums text-right"
                        style={{
                          color:
                            x.coberturaPct !== null && x.coberturaPct < 40
                              ? DOURADO
                              : "rgba(253,251,247,0.4)",
                        }}
                      >
                        {x.coberturaPct === null ? "—" : `${x.coberturaPct.toFixed(0)}%`}
                      </span>
                    </div>

                    {/* celular */}
                    <div className="sm:hidden space-y-1">
                      <p className="font-dm text-xs text-cream/80">{x.nome}</p>
                      <p className="font-dm text-[10px] text-cream/25">
                        {x.condutores.length ? x.condutores.join(", ") : "sem condutor reconhecido"}
                      </p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        <span className="font-dm text-[11px] text-cream/45">
                          <strong className="font-fraunces text-cream">{num(x.quorumMedio)}</strong> na sala
                        </span>
                        <span className="font-dm text-[11px] text-cream/45">
                          {x.encontros} {x.encontros === 1 ? "encontro" : "encontros"}
                        </span>
                        <Tendencia v={x.tendencia} />
                        {x.vozesAtivasPct !== null && (
                          <span className="font-dm text-[11px]" style={{ color: ROXO }}>
                            {x.vozesAtivasPct.toFixed(0)}% falaram
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="font-dm text-[11px] text-cream/25 mt-4 leading-relaxed">
                Não dá para dizer quórum relativo, que seria presentes sobre inscritos:
                não existe nenhuma tabela de quem deveria estar num grupo. Comparar um
                grupo de oito com um de trinta continua sendo comparação de números
                crus, e isso é falta de dado, não conta que ninguém fez.
              </p>
            </Card>
          </motion.div>

          {/* ── horário contra condução ── */}
          {sala.diaSemana.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
              <Card>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CalendarDays className="h-4 w-4" style={{ color: DOURADO }} />
                  <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                    Por dia da semana
                  </h2>
                </div>
                <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                  Serve para separar efeito de horário de efeito de condução. Se o dia
                  inteiro está baixo, o problema não é de quem conduz.
                </p>
                <div className="space-y-2">
                  {sala.diaSemana.map((d) => {
                    const maior = Math.max(...sala.diaSemana.map((x) => x.quorumMedio ?? 0), 1);
                    const pct = ((d.quorumMedio ?? 0) / maior) * 100;
                    return (
                      <div key={d.dia} className="flex items-center gap-3">
                        <span className="font-dm text-[11px] text-cream/40 w-16 shrink-0">
                          {DIAS_DA_SEMANA[d.dia] ?? `dia ${d.dia}`}
                        </span>
                        <div className="flex-1 h-5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.03)" }}>
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${pct}%`, background: `${DOURADO}66` }}
                          />
                        </div>
                        <span className="font-dm text-[11px] text-cream/50 tabular-nums w-24 text-right shrink-0">
                          {num(d.quorumMedio)} em {d.encontros}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── alcance por semana ── */}
          {sala.semanas.length > 1 && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }}>
              <Card>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <Users className="h-4 w-4" style={{ color: TEAL }} />
                  <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                    Pessoas por semana
                  </h2>
                </div>
                <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                  Gente distinta que a formação alcançou, contando uma vez quem veio a
                  dois grupos na mesma semana. Semana sem encontro aparece como zero,
                  e não como uma linha reta por cima do buraco.
                </p>
                <div className="flex gap-1 h-24">
                  {sala.semanas.map((s) => {
                    const maior = Math.max(...sala.semanas.map((x) => x.pessoas), 1);
                    return (
                      <div key={s.semana} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                        <span className="font-dm text-[10px] text-cream/40 tabular-nums">{s.pessoas}</span>
                        <div
                          className="w-full rounded-t transition-all"
                          style={{
                            height: `${(s.pessoas / maior) * 100}%`,
                            minHeight: s.pessoas > 0 ? 3 : 0,
                            background: `${TEAL}66`,
                          }}
                        />
                        <span className="font-dm text-[9px] text-cream/20 tabular-nums">
                          {s.semana.slice(8)}/{s.semana.slice(5, 7)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Card>
            </motion.div>
          )}

          {/* ── real contra previsto ── */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <Clock className="h-4 w-4" style={{ color: DOURADO }} />
                <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                  Encontro a encontro
                </h2>
              </div>
              <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                Quanto durou contra quanto estava previsto, quanto tempo a pessoa média
                ficou, e quantas vezes ela entrou e saiu. São colunas que o banco grava
                desde sempre e que nenhuma tela olhava.
              </p>
              <div className="space-y-1.5">
                {sala.encontros.map((e) => {
                  const curto =
                    e.duracaoMin !== null &&
                    e.duracaoPrevistaMin !== null &&
                    e.duracaoMin < e.duracaoPrevistaMin * 0.8;
                  return (
                    <div
                      key={e.id}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] flex-wrap"
                      style={{ background: "rgba(255,255,255,0.02)" }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-dm text-xs text-cream/75 truncate">
                          {dataCurta(e.data)} · {e.atividade ?? "Sem atividade"}
                        </p>
                        <p className="font-dm text-[10px] text-cream/25">
                          {e.condutores.length ? e.condutores.join(", ") : "sem condutor reconhecido"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 flex-wrap shrink-0">
                        <span className="font-dm text-[11px] text-cream/50 tabular-nums">
                          {e.quorum} na sala
                        </span>
                        <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                          {e.declararam} no formulário
                        </span>
                        <span
                          className="font-dm text-[11px] tabular-nums"
                          style={{ color: curto ? DOURADO : "rgba(253,251,247,0.35)" }}
                        >
                          {e.duracaoMin ?? "—"} min
                          {e.duracaoPrevistaMin ? ` de ${e.duracaoPrevistaMin}` : ""}
                        </span>
                        {e.permanenciaMediaPct !== null && (
                          <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                            ficaram {e.permanenciaMediaPct.toFixed(0)}%
                          </span>
                        )}
                        {e.sessoesMedia !== null && e.sessoesMedia > 1.2 && (
                          <span className="font-dm text-[11px]" style={{ color: DOURADO }}>
                            entra e sai ({e.sessoesMedia.toFixed(1)}x)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </motion.div>

          {/* ── quem sumiu e quem não fala ── */}
          <div className="grid gap-4 lg:grid-cols-2">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }}>
              <Card>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <UserMinus className="h-4 w-4" style={{ color: "#E07A5F" }} />
                  <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                    Vinham e pararam
                  </h2>
                  <JanelaPropria motivo="21 dias, por definição" />
                </div>
                <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                  Três encontros ou mais, e há mais de vinte e um dias sem aparecer na
                  sala. O relógio é hoje, não o último encontro capturado: se a
                  ingestão parar, ninguém deve virar assíduo por acidente.
                </p>
                {sala.sumindo.length === 0 ? (
                  <p className="font-dm text-xs text-cream/25 py-2">Ninguém nessa situação.</p>
                ) : (
                  <div className="space-y-1">
                    {sala.sumindo.map((p) => (
                      <div key={p.chave} className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="font-dm text-xs text-cream/70 truncate">{p.nome}</span>
                        <span className="font-dm text-[11px] text-cream/30 shrink-0">
                          {p.encontros}x · sumiu em {dataCurta(p.ultima)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
              <Card>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <MicOff className="h-4 w-4" style={{ color: ROXO }} />
                  <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                    Vêm e não falam
                  </h2>
                </div>
                <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                  Estiveram em três ou mais encontros com transcrição e não falaram em
                  nenhum. Isso é uso pedagógico, não punitivo: serve para chamar, não
                  para cobrar.
                </p>
                {sala.calados.length === 0 ? (
                  <p className="font-dm text-xs text-cream/25 py-2">Ninguém nessa situação.</p>
                ) : (
                  <div className="space-y-1">
                    {sala.calados.map((p) => (
                      <div key={p.chave} className="flex items-center justify-between gap-2 px-2 py-1.5">
                        <span className="font-dm text-xs text-cream/70 truncate">{p.nome}</span>
                        <span className="font-dm text-[11px] text-cream/30 shrink-0">
                          calada em {p.caladaEm} de {p.comTranscricao}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </motion.div>
          </div>

          <div className="flex items-start gap-2 px-1">
            <AlertTriangle className="h-3.5 w-3.5 text-cream/20 shrink-0 mt-0.5" />
            <p className="font-dm text-[11px] text-cream/25 leading-relaxed">
              Toda contagem de presença desta tela vem da sala do Meet e exclui quem
              conduz. O formulário de certificado aparece só como cobertura, nunca
              somado ao quórum: são duas portas do mesmo encontro, e contar as duas
              contaria a mesma pessoa duas vezes.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
