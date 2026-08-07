"use client";

/**
 * Uma pessoa, numa tela.
 *
 * Pessoa era a única das três entidades comparáveis sem página própria: grupo
 * tem a dele, condutor tem a dele, e pessoa vivia dentro de um modal que já
 * carregava dez números, consultava do navegador e chaveava por e-mail. Duas
 * coisas não cabiam ali: o histórico dela e, principalmente, a comparação da
 * mesma pessoa entre os grupos que ela frequenta.
 *
 * ⭐ A aba "Nos grupos" é a razão desta página existir. Ela responde a pergunta
 * que o painel nunca soube responder: esta pessoa fala mais no grupo A que no
 * grupo B? E o que isso mede é o GRUPO, não a pessoa.
 *
 * As abas são estado de cliente, como na página do grupo: cada uma é curta e
 * trocar entre elas não deve custar uma ida ao servidor.
 */

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  CalendarDays,
  FileText,
  Mic,
  MicOff,
  AlertTriangle,
  Clock,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";

const TERRACOTA = "#C84B31";
const DOURADO = "#D4854A";
const ROXO = "#6C5CE7";

type Aba = "grupos" | "encontros" | "formularios";

const ABAS: { id: Aba; rotulo: string; icone: typeof Users }[] = [
  { id: "grupos", rotulo: "Nos grupos", icone: Users },
  { id: "encontros", rotulo: "Encontros", icone: CalendarDays },
  { id: "formularios", rotulo: "Formulários", icone: FileText },
];

interface LinhaGrupo {
  grupo: string;
  nome: string;
  encontros: number;
  minutos: number;
  minutosFala: number;
  segmentosFala: number;
  comTranscricao: number;
  caladaEm: number;
  permanencias: number[];
  permanenciaMedianaPct: number | null;
  permanenciaMediaPct: number | null;
  falaPorEncontroMin: number;
  primeira: string;
  ultima: string;
}

interface Dossie {
  pessoa: {
    id: string;
    nome: string;
    emails: string[];
    temConta: boolean;
    chaveForteNaSala: boolean;
    chavesNaSala: number;
    observacao: string | null;
  };
  naFormacao: {
    encontros: number;
    grupos: number;
    minutos: number;
    minutosFala: number;
    permanenciaMedianaPct: number | null;
    comTranscricao: number;
    caladaEm: number;
    primeira: string | null;
    ultima: string | null;
  };
  grupos: LinhaGrupo[];
  outrosGrupos: { chave: string; nome: string }[];
  comparacao: {
    amplitudeFalaMin: number;
    amplitudePermanenciaPct: number;
    falaEmUmCalaEmOutro: boolean;
  } | null;
  encontros: {
    id: string;
    data: string;
    grupo: string | null;
    quorum: number;
    temTranscricao: boolean;
    condutores: string[];
  }[];
  formularios: {
    id: string;
    data: string;
    grupo: string | null;
    notaGrupo: number | null;
    notaCondutor: number | null;
    relato: string | null;
    condutores: string[];
  }[];
}

const dia = (s: string | null) =>
  s ? new Date(s + (s.length === 10 ? "T12:00:00" : "")).toLocaleDateString("pt-BR") : "—";
const min = (n: number) => `${Math.round(n)} min`;

export default function PaginaPessoa() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { isAdmin } = useAuth();
  const [d, setD] = useState<Dossie | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("grupos");

  useEffect(() => {
    let vivo = true;
    (async () => {
      setCarregando(true);
      try {
        const r = await fetch(`/formacao/api/admin/pessoas/${id}`);
        const tipo = r.headers.get("content-type") ?? "";
        if (!r.ok || !tipo.includes("application/json")) {
          throw new Error(`não consegui abrir esta pessoa (${r.status})`);
        }
        const j = (await r.json()) as Dossie;
        if (!vivo) return;
        setD(j);
        setErro(null);
      } catch (e) {
        if (!vivo) return;
        setErro(e instanceof Error ? e.message : "falha ao ler");
      } finally {
        if (vivo) setCarregando(false);
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id]);

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
        <p className="font-dm text-sm text-cream/60 mb-3">{erro ?? "Pessoa não encontrada."}</p>
        <Button onClick={() => router.push("/formacao/admin/pessoas")}>Voltar às pessoas</Button>
      </Card>
    );
  }

  const naSala = d.naFormacao.encontros > 0;
  const varios = d.grupos.length > 1;

  return (
    <div className="space-y-4 pb-10">
      <button
        onClick={() => router.push("/formacao/admin/pessoas")}
        className="flex items-center gap-1.5 font-dm text-xs text-cream/40 hover:text-cream/70 transition-colors min-h-[44px] sm:min-h-0"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Pessoas
      </button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-fraunces text-2xl font-bold text-cream">{d.pessoa.nome}</h1>
          {!d.pessoa.temConta && (
            <span
              className="font-dm text-[10px] px-2 py-0.5 rounded-full text-cream/40"
              style={{ background: "rgba(255,255,255,0.05)" }}
            >
              sem conta na plataforma
            </span>
          )}
        </div>
        <p className="font-dm text-xs text-cream/40 mt-1">
          {d.pessoa.emails[0] ?? "sem e-mail"}
          {d.naFormacao.primeira && ` · desde ${dia(d.naFormacao.primeira)}`}
        </p>
      </div>

      {/* ⚠️ Sem chave forte, ela foi casada por nome, que é a chave que a casa
          proíbe justamente por fundir histórico de duas pessoas em silêncio. */}
      {naSala && !d.pessoa.chaveForteNaSala && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
          style={{ background: "rgba(212,133,74,0.06)", border: "1px solid rgba(212,133,74,0.15)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: DOURADO }} />
          <p className="font-dm text-[11px] text-cream/50 leading-relaxed">
            Esta pessoa é encontrada na sala pelo nome de tela, não por conta.
            Se existir outra pessoa com o mesmo nome, os dois históricos estão
            somados aqui e não há como perceber pela tela.
          </p>
        </div>
      )}

      {d.pessoa.chavesNaSala > 1 && (
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
          style={{ background: "rgba(108,92,231,0.06)", border: "1px solid rgba(108,92,231,0.15)" }}
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: ROXO }} />
          <p className="font-dm text-[11px] text-cream/50 leading-relaxed">
            Ela entra na sala por {d.pessoa.chavesNaSala} identidades diferentes,
            provavelmente dois dispositivos ou duas contas Google. Os números
            abaixo já somam as duas.
          </p>
        </div>
      )}

      {/* ── o retrato, que é o denominador de tudo que vem depois ── */}
      <Card>
        <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
          Na formação inteira
        </h2>
        {!naSala ? (
          <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
            Nenhum encontro medido na sala. Ou ela não participou desde 3 de
            agosto de 2026, quando a captura começou, ou entra no Meet com um
            nome que ainda não foi ligado a ela.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-x-6 sm:gap-x-8 gap-y-5">
            {[
              { r: "encontros", v: String(d.naFormacao.encontros) },
              { r: "grupos", v: String(d.naFormacao.grupos) },
              { r: "tempo na sala", v: min(d.naFormacao.minutos) },
              {
                r: "permanência típica",
                v:
                  d.naFormacao.permanenciaMedianaPct === null
                    ? "—"
                    : `${d.naFormacao.permanenciaMedianaPct.toFixed(0)}%`,
              },
              {
                r:
                  d.naFormacao.comTranscricao === 0
                    ? "sem encontro transcrito"
                    : `fala (em ${d.naFormacao.comTranscricao} c/ transcrição)`,
                v:
                  d.naFormacao.comTranscricao === 0
                    ? "—"
                    : `${d.naFormacao.minutosFala.toFixed(1)} min`,
                cor: ROXO,
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
        )}
        {naSala && (
          <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
            Permanência típica é a mediana, não a média. A média é puxada para
            baixo por quem entra e sai em dois minutos, e num grupo real a
            diferença entre as duas chega a vinte pontos.
          </p>
        )}
      </Card>

      <div className="flex gap-1 flex-wrap">
        {ABAS.map((a) => {
          const ativa = aba === a.id;
          const conta =
            a.id === "grupos"
              ? d.grupos.length
              : a.id === "encontros"
                ? d.encontros.length
                : d.formularios.length;
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
              {conta > 0 && <span className="text-cream/25">{conta}</span>}
            </button>
          );
        })}
      </div>

      {/* ── ⭐ NOS GRUPOS ── */}
      {aba === "grupos" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {d.comparacao?.falaEmUmCalaEmOutro && (
            <div
              className="flex items-start gap-2 px-3 py-2.5 rounded-[10px]"
              style={{ background: "rgba(108,92,231,0.07)", border: "1px solid rgba(108,92,231,0.18)" }}
            >
              <Mic className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: ROXO }} />
              <p className="font-dm text-[11px] text-cream/55 leading-relaxed">
                <strong className="text-cream/75">Ela fala num grupo e fica muda em outro.</strong>{" "}
                A diferença é de {d.comparacao.amplitudeFalaMin.toFixed(1)} minutos
                de fala por encontro
                {d.comparacao.amplitudePermanenciaPct < 15
                  ? `, com permanência parecida nos dois (${d.comparacao.amplitudePermanenciaPct.toFixed(0)} pontos de diferença). Ela fica; ela não fala.`
                  : `, e de ${d.comparacao.amplitudePermanenciaPct.toFixed(0)} pontos de permanência.`}{" "}
                Isso é sobre o grupo, não sobre ela.
              </p>
            </div>
          )}

          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
              Grupo a grupo
            </h2>

            {d.grupos.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2">
                Nenhum grupo medido para esta pessoa.
              </p>
            ) : (
              <>
                {/* cabeçalho, só no desktop, como no resto do painel */}
                <div
                  className="hidden sm:grid gap-3 pb-2 mb-1 font-dm text-[10px] uppercase tracking-[.1em] text-cream/25"
                  style={{ gridTemplateColumns: "1fr 68px 78px 88px 92px" }}
                >
                  <span>Grupo</span>
                  <span className="text-right">Encontros</span>
                  <span className="text-right">Na sala</span>
                  <span className="text-right">Permanência</span>
                  <span className="text-right">Fala/enc.</span>
                </div>

                <div className="divide-y divide-white/[0.04]">
                  {d.grupos.map((g) => {
                    const muda = g.comTranscricao > 0 && g.minutosFala === 0;
                    return (
                      <div key={g.grupo} className="py-2.5">
                        {/* desktop */}
                        <div
                          className="hidden sm:grid gap-3 items-center"
                          style={{ gridTemplateColumns: "1fr 68px 78px 88px 92px" }}
                        >
                          <span className="font-dm text-xs text-cream/75 truncate" title={g.nome}>
                            {g.nome}
                          </span>
                          <span className="font-dm text-xs text-cream/60 text-right tabular-nums">
                            {g.encontros}
                          </span>
                          <span className="font-dm text-xs text-cream/60 text-right tabular-nums">
                            {min(g.minutos)}
                          </span>
                          <span className="font-dm text-xs text-right tabular-nums text-cream/60">
                            {g.permanenciaMedianaPct === null
                              ? "—"
                              : `${g.permanenciaMedianaPct.toFixed(0)}%`}
                          </span>
                          <span
                            className="font-dm text-xs text-right tabular-nums"
                            style={{ color: muda ? "rgba(253,251,247,0.28)" : ROXO }}
                          >
                            {g.comTranscricao === 0
                              ? "—"
                              : muda
                                ? "calada"
                                : `${g.falaPorEncontroMin.toFixed(1)} min`}
                          </span>
                        </div>

                        {/* celular */}
                        <div className="sm:hidden space-y-1">
                          <p className="font-dm text-xs text-cream/75">{g.nome}</p>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 font-dm text-[11px] text-cream/40">
                            <span>{g.encontros} encontro{g.encontros === 1 ? "" : "s"}</span>
                            <span>{min(g.minutos)} na sala</span>
                            {g.permanenciaMedianaPct !== null && (
                              <span>{g.permanenciaMedianaPct.toFixed(0)}% de permanência</span>
                            )}
                            <span style={{ color: muda ? undefined : ROXO }}>
                              {g.comTranscricao === 0
                                ? "sem transcrição"
                                : muda
                                  ? "não falou"
                                  : `${g.falaPorEncontroMin.toFixed(1)} min de fala por encontro`}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
                  {varios ? (
                    <>
                      A comparação entre grupos é a única que já dá para ler hoje,
                      porque não depende de o mesmo grupo ter vários encontros.
                      &quot;Calada&quot; quer dizer que ela esteve num encontro com
                      transcrição e não abriu o microfone nenhuma vez.
                    </>
                  ) : (
                    <>
                      Ela frequenta um grupo só, então não há o que comparar ainda.
                      {d.outrosGrupos.length > 0 &&
                        ` Existem outros ${d.outrosGrupos.length} grupos com sala medida.`}
                    </>
                  )}
                </p>
              </>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── ENCONTROS ── */}
      {aba === "encontros" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
              Encontros em que ela esteve
            </h2>
            {d.encontros.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2">
                Nenhum encontro medido.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {d.encontros.map((e) => (
                  <div key={e.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-dm text-xs text-cream/75 truncate">{e.grupo}</p>
                      <p className="font-dm text-[11px] text-cream/35 mt-0.5">
                        {dia(e.data)}
                        {e.condutores.length > 0 && ` · ${e.condutores.join(", ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 font-dm text-[11px] text-cream/40">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {e.quorum}
                      </span>
                      {e.temTranscricao ? (
                        <Mic className="h-3 w-3" style={{ color: ROXO }} />
                      ) : (
                        <MicOff className="h-3 w-3 text-cream/20" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
              O microfone riscado é encontro sem transcrição. Ali não dá para
              dizer se ela ficou calada ou se ninguém mediu.
            </p>
          </Card>
        </motion.div>
      )}

      {/* ── FORMULÁRIOS ── */}
      {aba === "formularios" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <h2 className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-4">
              O que ela escreveu
            </h2>
            {d.formularios.length === 0 ? (
              <p className="font-dm text-xs text-cream/30 py-2 leading-relaxed">
                Nunca preencheu o formulário de certificado. Cerca de metade de
                quem esteve na sala não preenche, e não por sorteio: preencher é
                hábito de pessoa.
              </p>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {d.formularios.map((f) => (
                  <div key={f.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-dm text-xs text-cream/75 truncate">{f.grupo}</p>
                        <p className="font-dm text-[11px] text-cream/35 mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {dia(f.data)}
                        </p>
                      </div>
                      <div className="shrink-0 font-dm text-[11px] text-cream/45 text-right tabular-nums">
                        {f.notaGrupo !== null && <span>grupo {f.notaGrupo}</span>}
                        {f.notaCondutor !== null && (
                          <span className="ml-2">condutor {f.notaCondutor}</span>
                        )}
                      </div>
                    </div>
                    {f.relato && (
                      <p className="font-dm text-[11px] text-cream/45 mt-2 leading-relaxed whitespace-pre-wrap">
                        {f.relato}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="font-dm text-[11px] text-cream/30 mt-4 leading-relaxed">
              Nota de condutor só aparece quando havia condutor a avaliar: evento
              sem condutor grava 5 fixo, e isso é ausência de pergunta, não
              avaliação.
            </p>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
