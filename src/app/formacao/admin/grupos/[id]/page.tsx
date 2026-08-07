"use client";

/**
 * Um grupo, numa tela.
 *
 * Antes desta página, saber tudo sobre um grupo exigia abrir cinco telas e
 * saber de cor qual guardava o quê: o cadastro em Atividades, o horário e os
 * condutores no Calendário, a sala e os encontros no Meet, o quórum em Grupos,
 * e os relatos em Envios. O grupo é a coisa; as outras telas são recortes dela.
 *
 * As abas são estado de cliente e não rota, de propósito: cada uma é uma tela
 * curta e trocar entre elas não deve custar uma ida ao servidor. O dossiê
 * inteiro vem de uma chamada só.
 */

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  CalendarDays,
  Video,
  MessageSquare,
  Clock,
  Mic,
  MicOff,
  FileText,
  AlertTriangle,
  ExternalLink,
  Folder,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { DIAS_DA_SEMANA } from "@/lib/meet/quorum";
import { toast } from "sonner";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";
const ROXO = "#6C5CE7";

type Aba = "geral" | "encontros" | "sala";

const ABAS: { id: Aba; rotulo: string; icone: typeof Users }[] = [
  { id: "geral", rotulo: "Visão geral", icone: Users },
  { id: "encontros", rotulo: "Encontros", icone: CalendarDays },
  { id: "sala", rotulo: "Sala", icone: Video },
];

interface Sala {
  id: string;
  space_name: string;
  meeting_code: string | null;
  meeting_uri: string | null;
  gravar: boolean;
  transcrever: boolean;
  notas: boolean;
  access_type: string | null;
  janela_automatica: boolean | null;
  duracao_min: number | null;
  pasta_drive_url: string | null;
  curso_id: string | null;
  subir_youtube: boolean | null;
}

interface Dossie {
  atividade: {
    id: string;
    nome: string;
    carga_horaria: number | null;
    descricao: string | null;
    ativo: boolean;
    arquivado: boolean;
  };
  chaveForte: boolean;
  grade: {
    id: string;
    diaSemana: number;
    hora: string | null;
    ativo: boolean;
    status: string | null;
    statusAutomatico: boolean;
    meetLink: string | null;
    condutores: { id: string; nome: string; telefone: string | null }[];
    sala: Sala | null;
  }[];
  medido: {
    encontros: number;
    quorumMedio: number | null;
    quorumMaximo: number;
    tendencia: number | null;
    vozesAtivasPct: number | null;
    encontrosComTranscricao: number;
    falaCondutorPct: number | null;
    duracaoMediaMin: number | null;
    permanenciaMediaPct: number | null;
    coberturaPct: number | null;
    primeiro: string | null;
    ultimo: string | null;
  };
  encontros: {
    id: string;
    data: string;
    quorum: number;
    declararam: number;
    duracaoMin: number | null;
    duracaoPrevistaMin: number | null;
    permanenciaMediaPct: number | null;
    sessoesMedia: number | null;
    falaram: number;
    temTranscricao: boolean;
    falaCondutorPct: number | null;
    condutores: string[];
  }[];
  pessoas: { chave: string; nome: string; encontros: number; caladaEm: number; comTranscricao: number; ultima: string }[];
  feedbacks: {
    id: string;
    created_at: string;
    nome_completo: string | null;
    nota_grupo: number | null;
    nota_condutor: number | null;
    relato: string | null;
    condutores: string[] | null;
  }[];
  notas: {
    grupo: number | null;
    grupoN: number;
    condutor: number | null;
    condutorN: number;
    semCondutor: number;
    relatos: number;
  };
}

function dataCurta(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

function num(n: number | null, casas = 1): string {
  return n === null ? "—" : n.toFixed(casas);
}

export default function GrupoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [d, setD] = useState<Dossie | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("geral");
  const [ocupado, setOcupado] = useState<string | null>(null);

  async function carregar() {
    try {
      const r = await fetch(`/formacao/api/admin/grupos/${id}`);
      const tipo = r.headers.get("content-type") ?? "";
      if (!tipo.includes("application/json")) throw new Error("resposta inesperada");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "falha");
      setD(j);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "não consegui carregar");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    if (id) carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /** Os interruptores da sala falam com a mesma rota que a tela do Meet usa. */
  async function alternar(sala: Sala, campo: "gravar" | "transcrever" | "notas" | "subir_youtube") {
    setOcupado(`${sala.space_name}:${campo}`);
    try {
      const r = await fetch("/formacao/api/admin/meet/spaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ space_name: sala.space_name, [campo]: !sala[campo] }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? `erro ${r.status}`);
      }
      await carregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "não consegui mudar");
    } finally {
      setOcupado(null);
    }
  }

  const proximo = useMemo(() => d?.grade.find((g) => g.ativo) ?? d?.grade[0] ?? null, [d]);

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

  if (erro || !d) {
    return (
      <Card>
        <p className="font-dm text-sm text-cream/60 mb-3">{erro ?? "Grupo não encontrado."}</p>
        <Button onClick={() => router.push("/formacao/admin/grupos")}>Voltar aos grupos</Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-10">
      {/* ── cabeçalho ── */}
      <button
        onClick={() => router.push("/formacao/admin/grupos")}
        className="flex items-center gap-1.5 font-dm text-xs text-cream/40 hover:text-cream/70 transition-colors min-h-[44px] sm:min-h-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Grupos
      </button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-fraunces text-2xl font-bold text-cream">{d.atividade.nome}</h1>
          {d.atividade.arquivado && (
            <span className="font-dm text-[10px] px-2 py-0.5 rounded-full text-cream/40" style={{ background: "rgba(255,255,255,0.05)" }}>
              arquivado
            </span>
          )}
          {!d.atividade.ativo && !d.atividade.arquivado && (
            <span className="font-dm text-[10px] px-2 py-0.5 rounded-full" style={{ background: "rgba(212,133,74,0.1)", color: DOURADO }}>
              fora do formulário
            </span>
          )}
        </div>
        <p className="font-dm text-xs text-cream/40 mt-1">
          {d.atividade.carga_horaria ?? 2}h por encontro
          {proximo?.hora && ` · ${DIAS_DA_SEMANA[proximo.diaSemana] ?? ""} às ${proximo.hora}`}
          {proximo?.condutores.length ? ` · ${proximo.condutores.map((c) => c.nome).join(", ")}` : ""}
        </p>
      </div>

      {/* ⚠️ Enquanto a 093 não roda, o histórico deste grupo depende do nome. */}
      {!d.chaveForte && (
        <div className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]" style={{ background: "rgba(212,133,74,0.06)", border: "1px solid rgba(212,133,74,0.15)" }}>
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: DOURADO }} />
          <p className="font-dm text-[11px] text-cream/50 leading-relaxed">
            Este grupo ainda é encontrado pelo nome, e não por identidade própria.
            Renomear a atividade agora separa o histórico dela do grupo. A migration
            093 conserta isso e ainda não foi aplicada.
          </p>
        </div>
      )}

      {/* ── abas ── */}
      <div className="flex gap-1 flex-wrap">
        {ABAS.map((a) => {
          const ativa = aba === a.id;
          return (
            <button
              key={a.id}
              onClick={() => setAba(a.id)}
              className="font-dm text-xs px-3 py-2 rounded-full flex items-center gap-1.5 transition-all min-h-[40px]"
              style={{
                background: ativa ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                color: ativa ? TERRACOTA : "rgba(253,251,247,0.4)",
                border: `1px solid ${ativa ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              <a.icone className="h-3.5 w-3.5" />
              {a.rotulo}
              {a.id === "encontros" && d.encontros.length > 0 && (
                <span className="text-cream/25">{d.encontros.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── VISÃO GERAL ── */}
      {aba === "geral" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
              Presença medida na sala
            </h2>
            {d.medido.encontros === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
                Nenhum encontro capturado ainda. A captura pela API do Meet começou em
                3 de agosto de 2026 e só grava encontro de sala configurada.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
                  {[
                    { r: "encontros", v: String(d.medido.encontros) },
                    { r: "pessoas por encontro", v: num(d.medido.quorumMedio) },
                    { r: "o mais cheio", v: String(d.medido.quorumMaximo) },
                    {
                      r: d.medido.tendencia === null ? "faltam encontros p/ tendência" : "tendência",
                      v: d.medido.tendencia === null ? "—" : `${d.medido.tendencia > 0 ? "+" : ""}${d.medido.tendencia.toFixed(1)}`,
                      cor: d.medido.tendencia === null ? undefined : d.medido.tendencia >= 0 ? TEAL : "#E07A5F",
                    },
                    {
                      r: `falaram${d.medido.encontrosComTranscricao ? ` (${d.medido.encontrosComTranscricao} c/ transcrição)` : ""}`,
                      v: d.medido.vozesAtivasPct === null ? "—" : `${d.medido.vozesAtivasPct.toFixed(0)}%`,
                      cor: ROXO,
                    },
                    {
                      r: "preencheram o formulário",
                      v: d.medido.coberturaPct === null ? "—" : `${d.medido.coberturaPct.toFixed(0)}%`,
                      cor: d.medido.coberturaPct !== null && d.medido.coberturaPct < 40 ? DOURADO : undefined,
                    },
                  ].map((x) => (
                    <div key={x.r}>
                      <p className="font-fraunces font-bold text-2xl tabular-nums leading-none" style={{ color: x.cor ?? "rgba(253,251,247,0.85)" }}>
                        {x.v}
                      </p>
                      <p className="font-dm text-[11px] text-cream/30 mt-1.5">{x.r}</p>
                    </div>
                  ))}
                </div>
                <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
                  Quórum é gente que entrou na sala, sem contar quem conduz.
                  {d.medido.coberturaPct !== null && d.medido.coberturaPct < 40 && (
                    <span style={{ color: DOURADO }}>
                      {" "}A cobertura do formulário está baixa, então qualquer nota deste
                      grupo fala por uma parte pequena de quem esteve.
                    </span>
                  )}
                </p>
              </>
            )}
          </Card>

          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
              O que escrevem no formulário
            </h2>
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
              <div>
                <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
                  {d.feedbacks.length}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">feedbacks</p>
              </div>
              <div>
                <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
                  {d.notas.grupoN >= 5 ? num(d.notas.grupo) : "—"}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">
                  {d.notas.grupoN >= 5 ? `nota do grupo, em ${d.notas.grupoN}` : `${d.notas.grupoN} notas só`}
                </p>
              </div>
              <div>
                <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
                  {d.notas.condutorN >= 5 ? num(d.notas.condutor) : "—"}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">
                  {d.notas.condutorN >= 5 ? `nota do condutor, em ${d.notas.condutorN}` : `${d.notas.condutorN} notas só`}
                </p>
              </div>
              <div>
                <p className="font-fraunces font-bold text-2xl tabular-nums leading-none" style={{ color: DOURADO }}>
                  {d.notas.relatos}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">com relato escrito</p>
              </div>
            </div>
            <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
              A média só aparece a partir de cinco notas: abaixo disso o número existe e
              não quer dizer nada.
              {d.notas.semCondutor > 0 &&
                ` ${d.notas.semCondutor} ${d.notas.semCondutor === 1 ? "feedback não listou" : "feedbacks não listaram"} condutor e ${d.notas.semCondutor === 1 ? "fica" : "ficam"} fora da nota dele: o formulário grava 5 fixo quando não há condutor a avaliar.`}
            </p>
          </Card>

          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
              Onde e quando
            </h2>
            {d.grade.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
                Este grupo não tem posição na grade. Ele existe no cadastro e não
                acontece em nenhum horário fixo.
              </p>
            ) : (
              <div className="space-y-2">
                {d.grade.map((g) => (
                  <div key={g.id} className="px-3 py-2.5 rounded-[10px]" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-dm text-sm text-cream/80">
                        {DIAS_DA_SEMANA[g.diaSemana] ?? `dia ${g.diaSemana}`}
                        {g.hora && ` às ${g.hora}`}
                      </span>
                      {!g.ativo && <span className="font-dm text-[10px] text-cream/30">inativo</span>}
                      {g.status && (
                        <span className="font-dm text-[10px] px-2 py-0.5 rounded-full text-cream/40" style={{ background: "rgba(255,255,255,0.04)" }}>
                          {g.status}
                          {g.statusAutomatico && " · auto"}
                        </span>
                      )}
                    </div>
                    <p className="font-dm text-[11px] text-cream/35 mt-1">
                      {g.condutores.length
                        ? g.condutores.map((c) => c.nome).join(", ")
                        : "sem condutor alocado"}
                      {g.sala ? " · sala criada" : " · sem sala do Meet"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── ENCONTROS ── */}
      {aba === "encontros" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-1">
              Encontro a encontro
            </h2>
            <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
              Quantos entraram na sala, quantos preencheram o formulário depois, quanto
              durou contra o previsto, e quanto da turma falou.
            </p>
            {d.encontros.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2">Nenhum encontro capturado ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {d.encontros.map((e) => {
                  const curto =
                    e.duracaoMin !== null &&
                    e.duracaoPrevistaMin !== null &&
                    e.duracaoMin < e.duracaoPrevistaMin * 0.8;
                  return (
                    <div key={e.id} className="px-3 py-2.5 rounded-[10px]" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span className="font-fraunces font-bold text-lg text-cream tabular-nums">{e.quorum}</span>
                        <span className="font-dm text-xs text-cream/70">na sala em {dataCurta(e.data)}</span>
                        {e.condutores.length > 0 && (
                          <span className="font-dm text-[10px] text-cream/25">com {e.condutores.join(", ")}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                        <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                          {e.declararam} no formulário
                          {e.quorum > 0 && ` (${Math.round((e.declararam / e.quorum) * 100)}%)`}
                        </span>
                        <span className="font-dm text-[11px] tabular-nums" style={{ color: curto ? DOURADO : "rgba(253,251,247,0.35)" }}>
                          {e.duracaoMin ?? "—"} min{e.duracaoPrevistaMin ? ` de ${e.duracaoPrevistaMin}` : ""}
                        </span>
                        {e.permanenciaMediaPct !== null && (
                          <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                            ficaram {e.permanenciaMediaPct.toFixed(0)}%
                          </span>
                        )}
                        {e.temTranscricao && e.quorum > 0 && (
                          <span className="font-dm text-[11px] tabular-nums" style={{ color: ROXO }}>
                            {Math.round((e.falaram / e.quorum) * 100)}% falaram
                          </span>
                        )}
                        {e.falaCondutorPct !== null && (
                          <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                            condutor {e.falaCondutorPct.toFixed(0)}% da fala
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
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SALA ── */}
      {aba === "sala" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {d.grade.filter((g) => g.sala).length === 0 ? (
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <Video className="h-4 w-4" style={{ color: ROXO }} />
                <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">Sala do Meet</h2>
              </div>
              <p className="font-dm text-xs text-cream/40 leading-relaxed">
                Este grupo ainda não tem sala criada. Sem sala, nenhum encontro dele é
                capturado, e o quórum desta tela fica vazio para sempre. A sala se cria
                na tela do Meet, dentro de Formação.
              </p>
            </Card>
          ) : (
            d.grade
              .filter((g) => g.sala)
              .map((g) => {
                const s = g.sala as Sala;
                return (
                  <Card key={g.id}>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Video className="h-4 w-4" style={{ color: ROXO }} />
                      <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                        Sala de {DIAS_DA_SEMANA[g.diaSemana] ?? ""}
                        {g.hora && ` às ${g.hora}`}
                      </h2>
                    </div>
                    <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
                      A sala é permanente: o mesmo endereço toda semana. O que se liga
                      aqui vale a partir do próximo encontro.
                    </p>

                    {s.meeting_uri && (
                      <a
                        href={s.meeting_uri}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-dm text-xs mb-4 hover:underline"
                        style={{ color: ROXO }}
                      >
                        {s.meeting_code ?? s.meeting_uri}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["gravar", "Gravar", Video],
                          ["transcrever", "Transcrever", Mic],
                          ["notas", "Notas de IA", FileText],
                          ["subir_youtube", "Subir ao YouTube", ExternalLink],
                        ] as const
                      ).map(([campo, rotulo, Icone]) => {
                        const ligado = Boolean(s[campo]);
                        const trabalhando = ocupado === `${s.space_name}:${campo}`;
                        return (
                          <button
                            key={campo}
                            onClick={() => alternar(s, campo)}
                            disabled={trabalhando}
                            className="font-dm text-xs px-3 py-2 rounded-full flex items-center gap-1.5 transition-all min-h-[40px] disabled:opacity-40"
                            style={{
                              background: ligado ? "rgba(46,158,143,0.12)" : "rgba(255,255,255,0.03)",
                              color: ligado ? TEAL : "rgba(253,251,247,0.35)",
                              border: `1px solid ${ligado ? "rgba(46,158,143,0.3)" : "rgba(255,255,255,0.06)"}`,
                            }}
                          >
                            <Icone className="h-3.5 w-3.5" />
                            {rotulo}
                            {trabalhando && <span className="text-cream/30">...</span>}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-4 pt-3 space-y-1.5" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                      <p className="font-dm text-[11px] text-cream/35">
                        <Clock className="h-3 w-3 inline mr-1" />
                        A porta {s.access_type === "OPEN" ? "abre para qualquer pessoa" : "só abre para quem tem convite"}
                        {s.janela_automatica ? ", e segue o horário do grupo automaticamente" : ", e está no controle manual"}.
                        {s.duracao_min && ` Encerra sozinha em ${s.duracao_min} minutos.`}
                      </p>
                      {s.pasta_drive_url ? (
                        <a
                          href={s.pasta_drive_url}
                          target="_blank"
                          rel="noreferrer"
                          className="font-dm text-[11px] inline-flex items-center gap-1 hover:underline"
                          style={{ color: TEAL }}
                        >
                          <Folder className="h-3 w-3" />
                          Pasta das gravações no Drive
                        </a>
                      ) : (
                        <p className="font-dm text-[11px] text-cream/25">
                          <Folder className="h-3 w-3 inline mr-1" />
                          Sem pasta no Drive. As gravações ficam na raiz e não são arquivadas por grupo.
                        </p>
                      )}
                      {!s.curso_id && s.gravar && (
                        <p className="font-dm text-[11px]" style={{ color: DOURADO }}>
                          <AlertTriangle className="h-3 w-3 inline mr-1" />
                          Este grupo grava e não tem curso de destino, então nenhuma gravação
                          dele consegue virar aula.
                        </p>
                      )}
                    </div>
                  </Card>
                );
              })
          )}

          {/* Quem vem e não fala é sinal de condução, e por isso mora perto da sala. */}
          {d.pessoas.filter((p) => p.caladaEm >= 2 && p.caladaEm === p.comTranscricao).length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-1">
                <MicOff className="h-4 w-4" style={{ color: ROXO }} />
                <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
                  Vêm e não falam
                </h2>
              </div>
              <p className="font-dm text-xs text-cream/40 mb-3 leading-relaxed">
                Estiveram em dois ou mais encontros com transcrição e não falaram em
                nenhum. Serve para chamar, não para cobrar.
              </p>
              <div className="space-y-1">
                {d.pessoas
                  .filter((p) => p.caladaEm >= 2 && p.caladaEm === p.comTranscricao)
                  .map((p) => (
                    <div key={p.chave} className="flex items-center justify-between gap-2 px-2 py-1.5">
                      <span className="font-dm text-xs text-cream/70 truncate">{p.nome}</span>
                      <span className="font-dm text-[11px] text-cream/30 shrink-0">
                        calada em {p.caladaEm} de {p.comTranscricao}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          )}
        </motion.div>
      )}

      <p className="font-dm text-[11px] text-cream/20 leading-relaxed px-1 flex items-start gap-1.5">
        <MessageSquare className="h-3 w-3 shrink-0 mt-0.5" />
        As abas Pessoas, Feedbacks e Cadastro entram em seguida. Enquanto isso, os
        relatos escritos continuam em Envios e o cadastro em Formação, aba Atividades.
      </p>
    </div>
  );
}
