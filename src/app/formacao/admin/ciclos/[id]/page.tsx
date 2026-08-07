"use client";

/**
 * Um ciclo de cronograma, e o anterior ao lado.
 *
 * ⭐ Esta tela existe para uma frase: "este ciclo foi melhor que o anterior, e
 * onde". Por isso quase tudo aqui é par, e o número sozinho quase nunca aparece
 * sem o número de antes ao lado.
 *
 * A anotação fica no topo, e não no rodapé, porque é a única coisa aqui que
 * nenhum cálculo produz. Tudo o mais o banco sabe; o que o cronograma ensinou só
 * quem estava lá sabe.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertTriangle,
  Square,
  Play,
  CalendarDays,
  Users,
  Mic,
  Trash2,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useAuth } from "@/hooks/useAuth";
import { DIAS_DA_SEMANA } from "@/lib/meet/quorum";
import { toast } from "sonner";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";
const ROXO = "#6C5CE7";

interface Resumo {
  encontros: number;
  quorumMedio: number | null;
  quorumMaximo: number;
  vozesAtivasPct: number | null;
  encontrosComTranscricao: number;
  interacaoMin: number | null;
  interacaoPorPessoaMin: number | null;
  permanenciaMedianaPct: number | null;
  falaCondutorPct: number | null;
  coberturaPct: number | null;
  primeiro: string | null;
  ultimo: string | null;
}

interface GrupoCiclo extends Resumo {
  chave: string;
  nome: string;
}

interface Lado {
  resumo: Resumo;
  grupos: GrupoCiclo[];
  condutores: { chave: string; nome: string; encontros: number }[];
  pessoas: number;
}

interface Dossie {
  migracaoPendente?: boolean;
  ciclo: {
    id: string;
    nome: string;
    inicio: string;
    fim: string | null;
    status: "planejado" | "ativo" | "encerrado";
    observacoes: string | null;
    encerrado_em: string | null;
  };
  anterior: { id: string; nome: string; inicio: string; fim: string | null } | null;
  atual: Lado;
  passado: Lado | null;
  atravessaram: number | null;
  semanas: { id: string; semana_inicio: string; semana_fim: string; observacoes: string | null; origem: string }[];
  grade: {
    atividade: string | null;
    diaSemana: number;
    hora: string;
    condutores: string[];
    semanas: number;
    conduzidas: number;
  }[];
  regua: {
    podeComparar: boolean;
    faltaNoAtual: string | null;
    faltaNoAnterior: string | null;
    porque: string;
  };
}

const dia = (s: string | null) =>
  s ? new Date(s + "T12:00:00").toLocaleDateString("pt-BR") : "—";

/** Um número com o de antes ao lado, e a diferença dita em palavras. */
function Par({
  rotulo,
  agora,
  antes,
  sufixo = "",
  casas = 1,
  maiorEhMelhor = true,
}: {
  rotulo: string;
  agora: number | null;
  antes: number | null | undefined;
  sufixo?: string;
  casas?: number;
  maiorEhMelhor?: boolean;
}) {
  const fmt = (n: number | null | undefined) =>
    n === null || n === undefined ? "—" : `${n.toFixed(casas)}${sufixo}`;
  const delta =
    agora !== null && antes !== null && antes !== undefined ? agora - antes : null;
  const bom = delta === null ? null : maiorEhMelhor ? delta > 0 : delta < 0;
  return (
    <div>
      <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
        {fmt(agora)}
      </p>
      <p className="font-dm text-[11px] text-cream/30 mt-1.5">{rotulo}</p>
      {antes !== null && antes !== undefined && (
        <p className="font-dm text-[11px] mt-0.5 tabular-nums">
          <span className="text-cream/25">antes {fmt(antes)}</span>
          {delta !== null && Math.abs(delta) >= Math.pow(10, -casas) && (
            <span style={{ color: bom ? TEAL : "#E07A5F" }}>
              {" "}
              {delta > 0 ? "+" : ""}
              {delta.toFixed(casas)}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export default function PaginaCiclo() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [d, setD] = useState<Dossie | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [fecharAberto, setFecharAberto] = useState(false);
  const [nomeEditado, setNomeEditado] = useState("");
  const [inicioEditado, setInicioEditado] = useState("");
  const [salvandoCadastro, setSalvandoCadastro] = useState(false);
  const [apagarAberto, setApagarAberto] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const r = await fetch(`/formacao/api/admin/ciclos/${id}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "falha ao ler o ciclo");
      setD(j);
      setNota(j.ciclo?.observacoes ?? "");
      setNomeEditado(j.ciclo?.nome ?? "");
      setInicioEditado(j.ciclo?.inicio ?? "");
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "falha ao ler");
    } finally {
      setCarregando(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) carregar();
  }, [id, carregar]);

  async function salvarNota() {
    setSalvando(true);
    try {
      const r = await fetch(`/formacao/api/admin/ciclos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observacoes: nota }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "não consegui salvar");
      toast.success("Anotação guardada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui salvar");
    } finally {
      setSalvando(false);
    }
  }

  async function salvarCadastro() {
    setSalvandoCadastro(true);
    try {
      const r = await fetch(`/formacao/api/admin/ciclos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: nomeEditado, inicio: inicioEditado }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "não consegui salvar");
      await carregar();
      toast.success("Cadastro do ciclo atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui salvar");
    } finally {
      setSalvandoCadastro(false);
    }
  }

  async function apagar() {
    try {
      const r = await fetch(`/formacao/api/admin/ciclos/${id}`, { method: "DELETE" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "não consegui apagar");
      toast.success(`Ciclo "${j.nome}" apagado.`);
      router.push("/formacao/admin/grupos");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui apagar");
      setApagarAberto(false);
    }
  }

  async function encerrar() {
    try {
      const r = await fetch(`/formacao/api/admin/ciclos/${id}/encerrar`, { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "não consegui encerrar");
      setFecharAberto(false);
      await carregar();
      toast.success(`Ciclo encerrado, com ${j.congelou} grupos no retrato final.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui encerrar");
    }
  }

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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (d?.migracaoPendente) {
    return (
      <Card>
        <p className="font-dm text-sm text-cream/60 mb-3">
          A migration 095 ainda não foi aplicada no banco.
        </p>
        <Button onClick={() => router.push("/formacao/admin/grupos")}>Voltar</Button>
      </Card>
    );
  }

  if (erro || !d?.ciclo) {
    return (
      <Card>
        <p className="font-dm text-sm text-cream/60 mb-3">{erro ?? "Ciclo não encontrado."}</p>
        <Button onClick={() => router.push("/formacao/admin/grupos")}>Voltar</Button>
      </Card>
    );
  }

  const c = d.ciclo;
  const a = d.atual.resumo;
  const p = d.passado?.resumo;
  const aberto = c.status === "ativo";

  return (
    <div className="space-y-4 pb-10">
      <button
        onClick={() => router.push("/formacao/admin/grupos")}
        className="flex items-center gap-1.5 font-dm text-xs text-cream/40 hover:text-cream/70 transition-colors min-h-[44px] sm:min-h-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Grupos
      </button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          {aberto ? (
            <Play className="h-4 w-4" style={{ color: TEAL }} />
          ) : (
            <Square className="h-4 w-4 text-cream/25" />
          )}
          <h1 className="font-fraunces text-2xl font-bold text-cream">{c.nome}</h1>
        </div>
        <p className="font-dm text-xs text-cream/40 mt-1">
          {dia(c.inicio)} até {c.fim ? dia(c.fim) : "hoje"}
          {d.anterior && ` · vem depois de ${d.anterior.nome}`}
        </p>
      </div>

      {/* ⭐ A anotação primeiro. É a única coisa nesta tela que nenhum cálculo
          produz, e a coluna existia no banco desde a migration 014 sem nunca ter
          tido nem escritor nem leitor. */}
      <Card>
        <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-3">
          O que este cronograma ensinou
        </h2>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={4}
          placeholder="O que funcionou, o que não funcionou, o que você mudaria no próximo. Isto não sai de número nenhum."
          className="dark-input w-full rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm leading-relaxed resize-y"
        />
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <button
            onClick={salvarNota}
            disabled={salvando || nota === (c.observacoes ?? "")}
            className="font-dm text-xs px-4 py-2 rounded-[10px] transition-all min-h-[40px] disabled:opacity-30"
            style={{ background: "rgba(200,75,49,0.12)", color: TERRACOTA, border: "1px solid rgba(200,75,49,0.3)" }}
          >
            Guardar anotação
          </button>
          {aberto && (
            <button
              onClick={() => setFecharAberto(true)}
              className="font-dm text-xs px-4 py-2 rounded-[10px] transition-all min-h-[40px] text-cream/45 hover:text-cream/70"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              Encerrar este ciclo
            </button>
          )}
          {!aberto && c.encerrado_em && (
            <span className="font-dm text-[11px] text-cream/25">
              Encerrado em {new Date(c.encerrado_em).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      </Card>

      {/* ⛔ A régua, antes dos números pareados. */}
      {!d.regua.podeComparar && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
          style={{ background: "rgba(212,133,74,0.06)", border: "1px solid rgba(212,133,74,0.15)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: DOURADO }} />
          <p className="font-dm text-[11px] text-cream/50 leading-relaxed">
            {!d.anterior ? (
              <>
                <strong className="text-cream/75">Este é o primeiro ciclo.</strong> Não
                há anterior contra o qual comparar, e os números abaixo são o ponto
                de partida, não um resultado.
              </>
            ) : (
              <>
                <strong className="text-cream/75">Ainda não dá para comparar os dois.</strong>{" "}
                {d.regua.faltaNoAtual && `Este ciclo tem ${d.regua.faltaNoAtual}. `}
                {d.regua.faltaNoAnterior && `O anterior tem ${d.regua.faltaNoAnterior}. `}
                O motivo é que {d.regua.porque}. Os números continuam certos e a
                diferença entre eles é que ainda não quer dizer nada.
              </>
            )}
          </p>
        </div>
      )}

      <Card>
        <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
          O ciclo em números{d.anterior && `, contra ${d.anterior.nome}`}
        </h2>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
          <Par rotulo="encontros" agora={a.encontros} antes={p?.encontros} casas={0} />
          <Par rotulo="pessoas distintas" agora={d.atual.pessoas} antes={d.passado?.pessoas} casas={0} />
          <Par rotulo="pessoas por encontro" agora={a.quorumMedio} antes={p?.quorumMedio} />
          <Par rotulo="falaram" agora={a.vozesAtivasPct} antes={p?.vozesAtivasPct} sufixo="%" casas={0} />
          <Par
            rotulo="fala por pessoa"
            agora={a.interacaoPorPessoaMin}
            antes={p?.interacaoPorPessoaMin}
            sufixo=" min"
            casas={2}
          />
          <Par
            rotulo="permanência típica"
            agora={a.permanenciaMedianaPct}
            antes={p?.permanenciaMedianaPct}
            sufixo="%"
            casas={0}
          />
          <Par
            rotulo="fala de quem conduz"
            agora={a.falaCondutorPct}
            antes={p?.falaCondutorPct}
            sufixo="%"
            casas={0}
            maiorEhMelhor={false}
          />
        </div>

        {d.atravessaram !== null && (
          <p className="font-dm text-[11px] text-cream/40 mt-4 leading-relaxed">
            <strong className="text-cream/70">{d.atravessaram}</strong>{" "}
            {d.atravessaram === 1 ? "pessoa atravessou" : "pessoas atravessaram"} os dois
            ciclos, de {d.atual.pessoas} que passaram por este. É o número que diz se o
            cronograma novo levou junto a comunidade do anterior ou recomeçou do zero.
          </p>
        )}
        <p className="font-dm text-[11px] text-cream/25 mt-2 leading-relaxed">
          Fala de quem conduz cai na coluna verde quando DIMINUI: um encontro em que
          quem conduz fala oitenta por cento do tempo não é o mesmo objeto que um em
          que fala trinta e cinco.
        </p>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Users className="h-4 w-4" style={{ color: TERRACOTA }} />
          <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
            Grupo a grupo, neste ciclo
          </h2>
        </div>
        <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
          Em ordem alfabética. Quando o mesmo grupo existiu no ciclo anterior, o
          número de lá aparece embaixo.
        </p>
        {d.atual.grupos.length === 0 ? (
          <p className="font-dm text-xs text-cream/30 py-2">
            Nenhum encontro medido dentro deste período.
          </p>
        ) : (
          <>
            <div
              className="hidden sm:grid gap-2 px-3 pb-2 font-dm text-[10px] uppercase tracking-wider text-cream/25"
              style={{ gridTemplateColumns: "1fr 60px 72px 66px 80px 76px" }}
            >
              <span>Grupo</span>
              <span className="text-right">Enc.</span>
              <span className="text-right">Na sala</span>
              <span className="text-right">Falaram</span>
              <span className="text-right">Fala/pes.</span>
              <span className="text-right">Perman.</span>
            </div>
            <div className="space-y-1.5">
              {d.atual.grupos.map((g) => {
                const antes = d.passado?.grupos.find((x) => x.chave === g.chave);
                return (
                  <div
                    key={g.chave}
                    className="px-3 py-2.5 rounded-[10px]"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div
                      className="hidden sm:grid gap-2 items-center"
                      style={{ gridTemplateColumns: "1fr 60px 72px 66px 80px 76px" }}
                    >
                      <span className="font-dm text-xs text-cream/80 truncate" title={g.nome}>
                        {g.nome}
                        {!antes && d.passado && (
                          <span className="text-cream/25"> · novo neste ciclo</span>
                        )}
                      </span>
                      <span className="font-dm text-xs text-cream/50 tabular-nums text-right">
                        {g.encontros}
                      </span>
                      <span className="font-fraunces font-bold text-sm text-cream tabular-nums text-right">
                        {g.quorumMedio?.toFixed(1) ?? "—"}
                      </span>
                      <span
                        className="font-dm text-xs tabular-nums text-right"
                        style={{ color: g.vozesAtivasPct == null ? "rgba(253,251,247,0.2)" : ROXO }}
                      >
                        {g.vozesAtivasPct == null ? "—" : `${g.vozesAtivasPct.toFixed(0)}%`}
                      </span>
                      <span
                        className="font-dm text-xs tabular-nums text-right"
                        style={{
                          color: g.interacaoPorPessoaMin == null ? "rgba(253,251,247,0.2)" : ROXO,
                        }}
                      >
                        {g.interacaoPorPessoaMin == null
                          ? "—"
                          : `${g.interacaoPorPessoaMin.toFixed(1)} min`}
                      </span>
                      <span className="font-dm text-xs tabular-nums text-right text-cream/50">
                        {g.permanenciaMedianaPct == null
                          ? "—"
                          : `${g.permanenciaMedianaPct.toFixed(0)}%`}
                      </span>
                    </div>

                    <div className="sm:hidden space-y-1">
                      <p className="font-dm text-xs text-cream/80">{g.nome}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 font-dm text-[11px] text-cream/40">
                        <span>{g.encontros} enc.</span>
                        <span>{g.quorumMedio?.toFixed(1) ?? "—"} na sala</span>
                        {g.interacaoPorPessoaMin != null && (
                          <span style={{ color: ROXO }}>
                            {g.interacaoPorPessoaMin.toFixed(1)} min de fala por pessoa
                          </span>
                        )}
                      </div>
                    </div>

                    {antes && (
                      <p className="font-dm text-[10px] text-cream/25 mt-1 tabular-nums">
                        no ciclo anterior: {antes.encontros} encontros ·{" "}
                        {antes.quorumMedio?.toFixed(1) ?? "—"} na sala
                        {antes.interacaoPorPessoaMin != null &&
                          ` · ${antes.interacaoPorPessoaMin.toFixed(1)} min de fala por pessoa`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <CalendarDays className="h-4 w-4" style={{ color: DOURADO }} />
          <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
            A grade que rodou
          </h2>
        </div>
        <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
          Reconstruída dos retratos semanais, e não congelada de novo: um grupo que
          entrou no meio do ciclo fez parte dele, e um que saiu também.
        </p>
        {d.grade.length === 0 ? (
          <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
            Nenhuma semana foi arquivada dentro deste ciclo ainda. O retrato semanal
            é gravado na madrugada de segunda, e é dele que esta grade sai.
          </p>
        ) : (
          <div className="space-y-1">
            {d.grade.map((g, i) => (
              <div
                key={`${g.atividade}-${g.diaSemana}-${g.hora}-${i}`}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-[10px] flex-wrap"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="min-w-0">
                  <p className="font-dm text-xs text-cream/75 truncate">
                    {g.atividade ?? "Sem atividade"}
                  </p>
                  <p className="font-dm text-[10px] text-cream/25">
                    {DIAS_DA_SEMANA[g.diaSemana] ?? `dia ${g.diaSemana}`} às {g.hora}
                    {g.condutores.length > 0 && ` · ${g.condutores.join(", ")}`}
                  </p>
                </div>
                <span className="font-dm text-[11px] text-cream/40 tabular-nums shrink-0">
                  conduzido em {g.conduzidas} de {g.semanas}{" "}
                  {g.semanas === 1 ? "semana" : "semanas"}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      {d.semanas.some((s) => s.observacoes) && (
        <Card>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Mic className="h-4 w-4" style={{ color: ROXO }} />
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Anotações das semanas
            </h2>
          </div>
          <div className="space-y-2">
            {d.semanas
              .filter((s) => s.observacoes)
              .map((s) => (
                <div key={s.id} className="px-3 py-2 rounded-[10px]" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <p className="font-dm text-[10px] text-cream/25">
                    semana de {dia(s.semana_inicio)}
                  </p>
                  <p className="font-dm text-[11px] text-cream/50 mt-1 leading-relaxed whitespace-pre-wrap">
                    {s.observacoes}
                  </p>
                </div>
              ))}
          </div>
        </Card>
      )}

      {/* ── cadastro ──
          Fica por último de propósito: mudar nome e data é raro, e apagar é
          raríssimo. O que se usa toda semana está no topo. */}
      <Card>
        <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
          Cadastro do ciclo
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={nomeEditado}
            onChange={(e) => setNomeEditado(e.target.value)}
            placeholder="Nome do ciclo"
            className="dark-input flex-1 rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
          />
          <input
            type="date"
            value={inicioEditado}
            onChange={(e) => setInicioEditado(e.target.value)}
            className="dark-input rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
          />
          <button
            onClick={salvarCadastro}
            disabled={
              salvandoCadastro ||
              !nomeEditado.trim() ||
              (nomeEditado === c.nome && inicioEditado === c.inicio)
            }
            className="font-dm text-xs px-4 rounded-[10px] transition-all min-h-[40px] shrink-0 disabled:opacity-30"
            style={{ background: "rgba(200,75,49,0.12)", color: TERRACOTA, border: "1px solid rgba(200,75,49,0.3)" }}
          >
            Salvar
          </button>
        </div>
        <p className="font-dm text-[11px] text-cream/30 mt-3 leading-relaxed">
          Mudar a data de início muda quais encontros pertencem a este ciclo, porque
          a divisão é por data. Nada é reprocessado: a conta é refeita na hora.
        </p>

        <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <button
            onClick={() => setApagarAberto(true)}
            className="font-dm text-xs px-4 py-2 rounded-[10px] transition-all min-h-[40px]"
            style={{ color: "#E0604F", border: "1px solid rgba(224,96,79,0.25)" }}
          >
            <Trash2 className="h-3.5 w-3.5 inline mr-1.5" />
            Apagar este ciclo
          </button>
        </div>
      </Card>

      <ConfirmDialog
        open={apagarAberto}
        onClose={() => setApagarAberto(false)}
        onConfirm={apagar}
        title={`Apagar ${c.nome}?`}
        description={
          <div className="font-dm text-cream-70 space-y-2">
            <p>
              Nenhum encontro, presença ou fala é tocado: o ciclo é só um recorte de
              período, e os encontros pertencem a ele pela data. Os retratos semanais
              também sobrevivem, e apenas deixam de estar agrupados aqui.
            </p>
            <p>
              O que se perde é <strong>a anotação que você escreveu</strong>
              {c.status === "encerrado" && " e o retrato final da grade"}. Isso não sai
              de conta nenhuma e não tem como recuperar.
            </p>
          </div>
        }
      />

      <ConfirmDialog
        open={fecharAberto}
        onClose={() => setFecharAberto(false)}
        onConfirm={encerrar}
        title={`Encerrar ${c.nome}?`}
        description={
          <p className="font-dm text-cream-70">
            O ciclo é fechado com a data de hoje, e o retrato final da grade é
            congelado junto: ele sobrevive mesmo que alguém apague um horário
            depois. Os encontros continuam sendo capturados normalmente, e passam a
            ficar fora deste período. Não há como reabrir.
          </p>
        }
      />
    </div>
  );
}
