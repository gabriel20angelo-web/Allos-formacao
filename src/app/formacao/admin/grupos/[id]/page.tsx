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
  UserMinus,
  Settings,
  Archive,
  Eye,
  EyeOff,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import { DIAS_DA_SEMANA } from "@/lib/meet/quorum";
import {
  REGUA,
  atende,
  porQueNaoDaParaLer,
  DIAS_ESFRIANDO,
} from "@/lib/meet/regua";
import { toast } from "sonner";

const TERRACOTA = "#C84B31";
const TEAL = "#2E9E8F";
const DOURADO = "#D4854A";
const ROXO = "#6C5CE7";

type Aba = "geral" | "encontros" | "pessoas" | "feedbacks" | "sala" | "cadastro";

const ABAS: { id: Aba; rotulo: string; icone: typeof Users }[] = [
  { id: "geral", rotulo: "Visão geral", icone: Users },
  { id: "encontros", rotulo: "Encontros", icone: CalendarDays },
  { id: "pessoas", rotulo: "Pessoas", icone: UserMinus },
  { id: "feedbacks", rotulo: "Feedbacks", icone: MessageSquare },
  { id: "sala", rotulo: "Sala", icone: Video },
  { id: "cadastro", rotulo: "Cadastro", icone: Settings },
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
  /** A interação e a permanência medidas POR PESSOA. `medido` agrega encontros. */
  interacao: {
    pessoas: number;
    falaram: number;
    minutosFala: number;
    permanenciaMedianaPct: number | null;
    permanenciaMediaPct: number | null;
    mudas: number;
    comTranscricao: number;
  } | null;
  /** Estreou, voltou, retomou e sumiu contra o encontro anterior deste grupo. */
  fluxo: {
    encontroId: string;
    data: string;
    presentes: number;
    estrearam: number | null;
    voltaram: number | null;
    retomaram: number | null;
    sumiram: number | null;
  }[];
  pessoas: {
    chave: string;
    nome: string;
    alunoId: string | null;
    encontros: number;
    minutos: number;
    minutosFala: number;
    segmentosFala: number;
    permanenciaMedianaPct: number | null;
    caladaEm: number;
    comTranscricao: number;
    primeira: string;
    ultima: string;
    /** O denominador que faltava: "veio 4 vezes" sem "de 12 na vida" não diz nada. */
    encontrosNaFormacao: number;
    gruposNaFormacao: number;
  }[];
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

/** Mesmo corte da tela de Pessoas. Uma lista longa é a queixa mais antiga daqui. */
const PAGINA_PESSOAS = 25;

const ORDENS_PESSOA = [
  ["frequencia", "Vem mais"],
  ["fala", "Fala mais"],
  ["permanencia", "Fica mais"],
  ["nome", "Nome"],
] as const;

export default function GrupoPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [d, setD] = useState<Dossie | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("geral");
  const [ocupado, setOcupado] = useState<string | null>(null);
  // A aba Pessoas renderizava 76 linhas sem busca, sem ordem e sem corte, com
  // quatro encontros no mundo. O padrão de corte em 25 já existia na tela de
  // Pessoas; aqui ele faltava, e era a aba que mais ia crescer.
  const [buscaPessoa, setBuscaPessoa] = useState("");
  const [ordemPessoa, setOrdemPessoa] = useState<"frequencia" | "fala" | "permanencia" | "nome">("frequencia");
  const [mostrandoPessoas, setMostrandoPessoas] = useState(PAGINA_PESSOAS);

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

          {/* ⭐ Interação e permanência, medidas POR PESSOA.
              O cartão de cima agrega encontros e responde "como foram os
              encontros deste grupo". Este responde "quanto as pessoas deste
              grupo falam e quanto tempo elas ficam", que é a pergunta do
              pedido, e por isso o denominador aqui é gente e não sessão. */}
          {d.interacao && d.interacao.comTranscricao > 0 && (
            <Card>
              <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
                Como as pessoas ficam e falam aqui
              </h2>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
                {[
                  {
                    r: "pessoas medidas",
                    v: String(d.interacao.pessoas),
                  },
                  {
                    r: "permanência típica",
                    v:
                      d.interacao.permanenciaMedianaPct === null
                        ? "—"
                        : `${d.interacao.permanenciaMedianaPct.toFixed(0)}%`,
                  },
                  {
                    r: "fala de quem não conduz",
                    v: `${d.interacao.minutosFala.toFixed(1)} min`,
                    cor: ROXO,
                  },
                  {
                    r: "fala por pessoa presente",
                    v: `${(d.interacao.minutosFala / Math.max(1, d.interacao.pessoas)).toFixed(2)} min`,
                    cor: ROXO,
                  },
                  {
                    r: `nunca falaram, de ${d.interacao.comTranscricao}`,
                    v: String(d.interacao.mudas),
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
                A fala aqui é a de quem não é a conta institucional, e a conta
                institucional é o microfone de quem conduz. Permanência típica é a
                mediana: a média é puxada para baixo por quem entra e sai em dois
                minutos.
                {!atende(d.medido.encontrosComTranscricao, REGUA.comparacaoEntreGrupos) && (
                  <span style={{ color: DOURADO }}>
                    {" "}Com{" "}
                    {porQueNaoDaParaLer(
                      d.medido.encontrosComTranscricao,
                      REGUA.comparacaoEntreGrupos,
                    )}
                    , estes números medem o dia e não o grupo: {REGUA.comparacaoEntreGrupos.porque}.
                  </span>
                )}
              </p>
            </Card>
          )}

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
                  {atende(d.notas.grupoN, REGUA.nota) ? num(d.notas.grupo) : "—"}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">
                  {atende(d.notas.grupoN, REGUA.nota)
                    ? `nota do grupo, em ${d.notas.grupoN}`
                    : porQueNaoDaParaLer(d.notas.grupoN, REGUA.nota)}
                </p>
              </div>
              <div>
                <p className="font-fraunces font-bold text-2xl tabular-nums leading-none text-cream/85">
                  {atende(d.notas.condutorN, REGUA.nota) ? num(d.notas.condutor) : "—"}
                </p>
                <p className="font-dm text-[11px] text-cream/30 mt-1.5">
                  {atende(d.notas.condutorN, REGUA.nota)
                    ? `nota do condutor, em ${d.notas.condutorN}`
                    : porQueNaoDaParaLer(d.notas.condutorN, REGUA.nota)}
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

                      {/* ⭐ O fluxo de pessoas, sempre contra o encontro ANTERIOR
                          DESTE GRUPO. No primeiro encontro medido os quatro
                          números são nulos e não zero: sem anterior, "0
                          estrearam" leria como "ninguém novo apareceu", que é o
                          oposto da verdade. */}
                      {(() => {
                        const f = d.fluxo.find((x) => x.encontroId === e.id);
                        if (!f) return null;
                        if (f.estrearam === null) {
                          return (
                            <p className="font-dm text-[11px] text-cream/25 mt-1.5">
                              Primeiro encontro medido deste grupo. Não há anterior
                              contra o qual dizer quem estreou ou sumiu.
                            </p>
                          );
                        }
                        return (
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                            <span className="font-dm text-[11px] tabular-nums" style={{ color: TEAL }}>
                              {f.estrearam} estrearam
                            </span>
                            <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                              {f.voltaram} voltaram
                            </span>
                            {(f.retomaram ?? 0) > 0 && (
                              <span className="font-dm text-[11px] text-cream/35 tabular-nums">
                                {f.retomaram} retomaram
                              </span>
                            )}
                            <span
                              className="font-dm text-[11px] tabular-nums"
                              style={{ color: (f.sumiram ?? 0) > 0 ? "#E07A5F" : "rgba(253,251,247,0.35)" }}
                            >
                              {f.sumiram} não vieram
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })}
              </div>
            )}
            <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
              Estreou, voltou e não veio são sempre contra o encontro anterior deste
              grupo, nunca contra o anterior no calendário: duas turmas na mesma
              semana não têm nada a ver uma com a outra. Retomou é quem faltou ao
              anterior e já tinha vindo antes dele, e existe porque grupo que perde
              gente e grupo que tem gente indo e voltando pedem providências opostas.
            </p>
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

      {/* ── PESSOAS ── */}
      {aba === "pessoas" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-1">
              Quem frequenta este grupo
            </h2>
            <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
              Contado pela sala do Meet, que mede quem entrou. Quem só preenche o
              formulário e não é capturado na sala não aparece aqui. Minutos e fala
              são <strong className="text-cream/60">neste grupo</strong>, e ao lado
              vem quantas vezes a pessoa veio na formação inteira: sem esse
              denominador, &quot;veio 4 vezes&quot; não diz se ela é da casa ou se
              passou por aqui.
            </p>

            {d.pessoas.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2">
                Nenhuma presença medida ainda neste grupo.
              </p>
            ) : (
              (() => {
                const q = buscaPessoa.trim().toLowerCase();
                const lista = d.pessoas
                  .filter((p) => !q || p.nome.toLowerCase().includes(q))
                  .sort((a, b) => {
                    if (ordemPessoa === "nome") return a.nome.localeCompare(b.nome, "pt-BR");
                    if (ordemPessoa === "fala") return b.minutosFala - a.minutosFala || b.encontros - a.encontros;
                    if (ordemPessoa === "permanencia")
                      return (b.permanenciaMedianaPct ?? -1) - (a.permanenciaMedianaPct ?? -1);
                    return b.encontros - a.encontros || b.minutos - a.minutos;
                  });
                return (
                  <>
                    <div className="flex flex-col sm:flex-row gap-2 mb-3">
                      <input
                        value={buscaPessoa}
                        onChange={(e) => {
                          setBuscaPessoa(e.target.value);
                          setMostrandoPessoas(PAGINA_PESSOAS);
                        }}
                        placeholder="Buscar pessoa"
                        className="dark-input flex-1 rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap mb-3">
                      {ORDENS_PESSOA.map(([v, rotulo]) => (
                        <button
                          key={v}
                          onClick={() => setOrdemPessoa(v)}
                          className="font-dm text-[11px] px-3 py-1.5 rounded-full transition-all"
                          style={{
                            background: ordemPessoa === v ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
                            color: ordemPessoa === v ? TERRACOTA : "rgba(253,251,247,0.35)",
                            border: `1px solid ${ordemPessoa === v ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
                          }}
                        >
                          {rotulo}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1">
                      {lista.slice(0, mostrandoPessoas).map((p) => {
                        const sumiu =
                          d.medido.ultimo !== null &&
                          p.ultima < d.medido.ultimo &&
                          Date.now() - new Date(p.ultima + "T12:00:00").getTime() >
                            DIAS_ESFRIANDO * 86400000;
                        // O silêncio precisa da régua: uma vez calada é um dia,
                        // não um jeito de estar ali.
                        const muda =
                          atende(p.comTranscricao, REGUA.silencio) &&
                          p.caladaEm === p.comTranscricao;
                        return (
                          <div
                            key={p.chave}
                            className="flex items-center gap-3 px-3 py-2 rounded-[10px]"
                            style={{ background: "rgba(255,255,255,0.02)" }}
                          >
                            <span className="font-fraunces font-bold text-sm text-cream tabular-nums w-8 text-right shrink-0">
                              {p.encontros}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-dm text-xs text-cream/75 truncate">{p.nome}</p>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                <span className="font-dm text-[10px] text-cream/25">
                                  {p.encontrosNaFormacao > p.encontros
                                    ? `${p.encontros} de ${p.encontrosNaFormacao} na formação`
                                    : p.encontros === 1
                                      ? "veio uma vez"
                                      : `veio ${p.encontros} vezes`}
                                  {" · "}
                                  {Math.round(p.minutos)} min aqui
                                  {p.permanenciaMedianaPct !== null &&
                                    ` · ${p.permanenciaMedianaPct.toFixed(0)}% de permanência`}
                                </span>
                                {p.comTranscricao > 0 && p.minutosFala > 0 && (
                                  <span className="font-dm text-[10px]" style={{ color: ROXO }}>
                                    {p.minutosFala.toFixed(1)} min de fala
                                  </span>
                                )}
                                {muda && (
                                  <span className="font-dm text-[10px]" style={{ color: ROXO }}>
                                    nunca falou ({p.caladaEm} c/ transcrição)
                                  </span>
                                )}
                                {p.gruposNaFormacao > 1 && (
                                  <span className="font-dm text-[10px] text-cream/25">
                                    também em {p.gruposNaFormacao - 1} outro
                                    {p.gruposNaFormacao > 2 ? "s" : ""}
                                  </span>
                                )}
                                {sumiu && (
                                  <span className="font-dm text-[10px]" style={{ color: "#E07A5F" }}>
                                    não vem há mais de {DIAS_ESFRIANDO} dias
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {lista.length === 0 && (
                      <p className="font-dm text-xs text-cream/30 py-3">
                        Ninguém com esse nome neste grupo.
                      </p>
                    )}
                    {lista.length > mostrandoPessoas && (
                      <button
                        onClick={() => setMostrandoPessoas((n) => n + PAGINA_PESSOAS)}
                        className="w-full mt-3 font-dm text-xs py-2.5 rounded-[10px] transition-colors hover:bg-white/[.04]"
                        style={{ color: "rgba(253,251,247,0.5)", border: "1px solid rgba(255,255,255,0.08)" }}
                      >
                        Carregar mais ({lista.length - mostrandoPessoas} restantes)
                      </button>
                    )}
                  </>
                );
              })()
            )}
          </Card>
        </motion.div>
      )}

      {/* ── FEEDBACKS ── */}
      {aba === "feedbacks" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-1">
              O que escreveram sobre este grupo
            </h2>
            <p className="font-dm text-xs text-cream/40 mb-4 leading-relaxed">
              Do mais recente para o mais antigo. Quem não escreveu nada aparece só
              como nota, e as duas coisas contam a mesma quantidade de gente.
            </p>
            {d.feedbacks.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2">Nenhum feedback ainda.</p>
            ) : (
              <div className="space-y-1.5">
                {d.feedbacks.map((f) => (
                  <div key={f.id} className="px-3 py-2.5 rounded-[10px]" style={{ background: "rgba(255,255,255,0.02)" }}>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="font-dm text-xs text-cream/75">
                        {f.nome_completo ?? "sem nome"}
                      </span>
                      <span className="font-dm text-[10px] text-cream/25 tabular-nums">
                        {new Date(f.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                        {f.nota_grupo != null && ` · grupo ${f.nota_grupo}`}
                        {(f.condutores ?? []).filter(Boolean).length > 0 && f.nota_condutor != null && ` · condutor ${f.nota_condutor}`}
                      </span>
                      {(f.condutores ?? []).filter(Boolean).length > 0 && (
                        <span className="font-dm text-[10px] text-cream/25">
                          com {(f.condutores ?? []).filter(Boolean).join(", ")}
                        </span>
                      )}
                    </div>
                    {f.relato && f.relato.trim() && (
                      <p className="font-dm text-xs text-cream/55 italic mt-1.5 leading-relaxed break-words">
                        &ldquo;{f.relato.trim()}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── CADASTRO ── */}
      {aba === "cadastro" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Cadastro
            atividade={d.atividade}
            aoSalvar={async (mudanca) => {
              const r = await fetch(`/formacao/api/admin/grupos/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(mudanca),
              });
              const j = await r.json().catch(() => ({}));
              if (!r.ok) {
                toast.error(j.error ?? "não consegui salvar");
                return false;
              }
              await carregar();
              toast.success("Salvo.");
              return true;
            }}
          />
        </motion.div>
      )}
    </div>
  );
}

/**
 * O cadastro do grupo.
 *
 * Estes campos saíram da tela de Atividades para cá porque são propriedades de
 * UM grupo, e a tela de Atividades era um catálogo onde eles ficavam escondidos
 * atrás de um ícone que só aparecia no hover.
 */
function Cadastro({
  atividade,
  aoSalvar,
}: {
  atividade: Dossie["atividade"];
  aoSalvar: (m: Record<string, unknown>) => Promise<boolean>;
}) {
  const [nome, setNome] = useState(atividade.nome);
  const [carga, setCarga] = useState(String(atividade.carga_horaria ?? 2));
  const [descricao, setDescricao] = useState(atividade.descricao ?? "");
  const [salvando, setSalvando] = useState(false);

  const mudou =
    nome !== atividade.nome ||
    Number(carga) !== (atividade.carga_horaria ?? 2) ||
    descricao !== (atividade.descricao ?? "");

  return (
    <Card>
      <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
        Cadastro
      </h2>

      <div className="space-y-3 max-w-lg">
        <div>
          <label className="font-dm text-[11px] text-cream/40 block mb-1">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="dark-input w-full rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
          />
          <p className="font-dm text-[10px] text-cream/25 mt-1 leading-relaxed">
            Desde a migration 093 o grupo tem identidade própria, então renomear não
            perde mais o histórico. Dois grupos não podem ter o mesmo nome.
          </p>
        </div>

        <div>
          <label className="font-dm text-[11px] text-cream/40 block mb-1">
            Horas por encontro
          </label>
          <input
            type="number"
            min={1}
            max={100}
            value={carga}
            onChange={(e) => setCarga(e.target.value)}
            className="dark-input w-28 rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm"
          />
          <p className="font-dm text-[10px] text-cream/25 mt-1 leading-relaxed">
            Este número vira carga horária no certificado de quem participa. Mudar
            aqui muda o documento que sai daqui em diante.
          </p>
        </div>

        <div>
          <label className="font-dm text-[11px] text-cream/40 block mb-1">Descrição</label>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={3}
            className="dark-input w-full rounded-[10px] px-3 py-2.5 font-dm text-base sm:text-sm resize-y"
          />
        </div>

        <Button
          onClick={async () => {
            setSalvando(true);
            await aoSalvar({ nome, carga_horaria: Number(carga), descricao });
            setSalvando(false);
          }}
          disabled={!mudou || salvando || !nome.trim()}
          loading={salvando}
        >
          Salvar
        </Button>
      </div>

      <div className="mt-6 pt-4 space-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-dm text-xs text-cream/70">
              {atividade.ativo ? "Aparece no formulário de certificação" : "Fora do formulário de certificação"}
            </p>
            <p className="font-dm text-[10px] text-cream/25 leading-relaxed">
              É por aqui que quem participou pede o certificado. Fora do formulário,
              o grupo continua acontecendo e ninguém consegue registrar presença.
            </p>
          </div>
          <button
            onClick={() => aoSalvar({ ativo: !atividade.ativo })}
            className="font-dm text-xs px-3 py-2 rounded-full flex items-center gap-1.5 transition-all min-h-[40px] shrink-0"
            style={{
              background: atividade.ativo ? "rgba(46,158,143,0.12)" : "rgba(255,255,255,0.03)",
              color: atividade.ativo ? TEAL : "rgba(253,251,247,0.4)",
              border: `1px solid ${atividade.ativo ? "rgba(46,158,143,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}
          >
            {atividade.ativo ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {atividade.ativo ? "Publicado" : "Despublicado"}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <p className="font-dm text-xs text-cream/70">
              {atividade.arquivado ? "Arquivado" : "Em uso"}
            </p>
            <p className="font-dm text-[10px] text-cream/25 leading-relaxed">
              Arquivar some da lista e não apaga nada. O histórico, os feedbacks e os
              encontros continuam onde estão.
            </p>
          </div>
          <button
            onClick={() => aoSalvar({ arquivado: !atividade.arquivado })}
            className="font-dm text-xs px-3 py-2 rounded-full flex items-center gap-1.5 transition-all min-h-[40px] shrink-0"
            style={{
              background: "rgba(255,255,255,0.03)",
              color: "rgba(253,251,247,0.4)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <Archive className="h-3.5 w-3.5" />
            {atividade.arquivado ? "Desarquivar" : "Arquivar"}
          </button>
        </div>
      </div>
    </Card>
  );
}
