"use client";

// A pessoa por trás do nome de tela.
//
// Abre ao clicar num nome da lista de presença e responde o que a lista não
// responde: veio quantas vezes, fala ou fica calada, chega atrasada, e o que
// escreveu ao pedir o certificado.
//
// Para quem tem conta, a presença é a menor parte da história, e por isso a
// ficha tem duas metades. A segunda junta o que a plataforma inteira sabe:
// matrícula, aulas, prova, certificado, permanência medida, avaliações,
// dúvidas, ocorrências e bloqueio. Ver só os encontros é decidir sobre alguém
// com um terço do que se sabe dela.
//
// É o mesmo componente no painel e na área de quem conduz. Muda a rota, e com
// ela o recorte: quem conduz vê a pessoa dentro do próprio grupo e não recebe a
// metade da plataforma, que é da coordenação. O aviso no rodapé diz isso em voz
// alta, para ninguém ler "dois encontros" como "só veio duas vezes na vida".
//
// A primeira aba é a linha do tempo, porque as listas temáticas respondem
// "quanto de cada coisa" e a pergunta que se faz ao clicar num nome é outra:
// "o que essa pessoa andou fazendo". Matrícula, encontro, prova e desabafo em
// ordem cronológica contam uma história que as abas separadas escondem.

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  Clock3,
  GraduationCap,
  Lock,
  Mic,
  Star,
  TriangleAlert,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
// Direto da lib, e não do componente do dashboard: importar de lá arrastaria
// framer-motion e o painel de anotações do dia para esta ficha, que também abre
// no celular de quem conduz um grupo.
import { TYPE_META } from "@/lib/utils/activity-meta";
import {
  groupByDay,
  hourLabel,
  type TimelineEvent,
} from "@/lib/utils/activity";
import type { PlataformaUI, RetratoUI } from "./tipos";
import { minutos, ROXO } from "./tipos";

type AbaFicha = "atividade" | "encontros" | "plataforma" | "certificado";

/** "3h 20min", que é como se fala, e não "200 minutos". */
function duracao(min: number): string {
  if (!min) return "0min";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export default function FichaPessoa({
  aberta,
  aoFechar,
  endpoint,
  norm,
  alunoId,
  nomeProvisorio,
}: {
  aberta: boolean;
  aoFechar: () => void;
  /** "/formacao/api/admin/meet/pessoa" ou "/formacao/api/condutor/pessoa" */
  endpoint: string;
  norm?: string | null;
  alunoId?: string | null;
  /** O nome de tela, para o título não ficar vazio enquanto carrega. */
  nomeProvisorio?: string;
}) {
  const [retrato, setRetrato] = useState<RetratoUI | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [aba, setAba] = useState<AbaFicha>("atividade");

  useEffect(() => {
    if (!aberta || (!norm && !alunoId)) return;

    let cancelado = false;
    setCarregando(true);
    setErro(null);
    setRetrato(null);
    // Volta para a primeira aba a cada pessoa: continuar em "plataforma" ao
    // abrir alguém sem conta mostraria uma aba que não existe para ela.
    setAba("atividade");

    const params = new URLSearchParams();
    if (norm) params.set("norm", norm);
    if (alunoId) params.set("aluno_id", alunoId);

    fetch(`${endpoint}?${params.toString()}`)
      .then(async (r) => {
        const tipo = r.headers.get("content-type") || "";
        if (!tipo.includes("application/json")) {
          throw new Error("O servidor respondeu uma página em vez de dados.");
        }
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Não consegui abrir esta pessoa.");
        return j as RetratoUI;
      })
      .then((j) => {
        if (!cancelado) setRetrato(j);
      })
      .catch((e) => {
        if (!cancelado) setErro(e instanceof Error ? e.message : "Não consegui abrir.");
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [aberta, endpoint, norm, alunoId]);

  const titulo = retrato?.pessoa.nome || nomeProvisorio || "Pessoa";
  const plataforma = retrato?.plataforma || null;

  const abas = useMemo(() => {
    const lista: { chave: AbaFicha; rotulo: string }[] = [
      { chave: "atividade", rotulo: "Atividade" },
      { chave: "encontros", rotulo: "Encontros" },
    ];
    if (plataforma) lista.push({ chave: "plataforma", rotulo: "Na plataforma" });
    if (retrato?.feedback.length) lista.push({ chave: "certificado", rotulo: "Certificados" });
    return lista;
  }, [plataforma, retrato]);

  return (
    <Modal open={aberta} onClose={aoFechar} title={titulo} maxWidth="max-w-2xl">
      {carregando && <p className="text-sm text-cream/40">Juntando o que sabemos dela…</p>}

      {erro && (
        <div className="flex items-start gap-2 text-sm text-cream/60">
          <TriangleAlert className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
          <span>{erro}</span>
        </div>
      )}

      {retrato && (
        <div className="space-y-4">
          {/* Quem é, e por que achamos que é */}
          <div className="text-xs text-cream/50 space-y-1">
            {retrato.pessoa.email && <p className="break-all">{retrato.pessoa.email}</p>}
            <p>
              {retrato.pessoa.tem_conta ? (
                <span style={{ color: ROXO }}>tem conta na plataforma</span>
              ) : (
                <span className="text-amber-400/70">ainda não tem conta na plataforma</span>
              )}
              {retrato.pessoa.nomes_de_tela.length > 1 && (
                <span className="text-cream/35">
                  {" · entra como "}
                  {retrato.pessoa.nomes_de_tela.join(", ")}
                </span>
              )}
            </p>
            {retrato.pessoa.evidencia && (
              <p className="text-cream/30">{retrato.pessoa.evidencia}</p>
            )}
          </div>

          {/* Conta bloqueada é a primeira coisa a saber sobre alguém, antes de
              qualquer número: fica fora das abas de propósito. */}
          {plataforma?.conta.bloqueado && (
            <div
              className="flex items-start gap-2 rounded-[12px] p-3 text-xs"
              style={{ background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.22)" }}
            >
              <Lock className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "#FF6B6B" }} />
              <span className="text-cream/70">
                Conta bloqueada em {data(plataforma.conta.bloqueado_em)}
                {plataforma.conta.bloqueado_motivo ? `: ${plataforma.conta.bloqueado_motivo}` : "."}
              </span>
            </div>
          )}

          {abas.length > 1 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {abas.map(({ chave, rotulo }) => {
                const ativa = aba === chave;
                return (
                  <button
                    key={chave}
                    onClick={() => setAba(chave)}
                    className="px-3 py-1.5 rounded-lg text-[11px]"
                    style={{
                      background: ativa ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                      color: ativa ? ROXO : "rgba(253,251,247,0.4)",
                      border: `1px solid ${ativa ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
                    }}
                  >
                    {rotulo}
                  </button>
                );
              })}
            </div>
          )}

          {aba === "atividade" && <AbaAtividade retrato={retrato} />}
          {aba === "encontros" && <AbaEncontros retrato={retrato} />}
          {aba === "plataforma" && plataforma && <AbaPlataforma dados={plataforma} />}
          {aba === "certificado" && <AbaCertificado retrato={retrato} />}

          {retrato.recortado && (
            <p className="text-[11px] text-cream/30 pt-1 border-t border-white/5">
              Só os encontros dos grupos que você conduz.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}

function Numero({
  icone: Icone,
  valor,
  rotulo,
}: {
  icone: typeof Clock3;
  valor: string;
  rotulo: string;
}) {
  return (
    <div
      className="rounded-[12px] p-2.5"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <Icone className="h-3 w-3 text-cream/30 mb-1" />
      <p className="text-base text-cream tabular-nums leading-none">{valor}</p>
      <p className="text-[10px] text-cream/35 mt-1">{rotulo}</p>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-cream/50 mb-1.5">{titulo}</p>
      <div className="space-y-1 max-h-[280px] overflow-y-auto">{children}</div>
    </div>
  );
}

function Linha({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-[10px] px-2.5 py-2 text-[11px]"
      style={{ background: "rgba(255,255,255,0.02)" }}
    >
      {children}
    </div>
  );
}

/**
 * O retrato já vem inteiro do servidor, então a linha do tempo é só uma leitura
 * diferente do que está na memória: nenhuma chamada nova, nenhum campo a mais.
 * Cada fonte vira TimelineEvent, o formato que a "Atividade recente" do
 * dashboard já usa, para as duas telas contarem a mesma coisa do mesmo jeito.
 */
function linhaDoTempo(retrato: RetratoUI): TimelineEvent[] {
  const eventos: TimelineEvent[] = [];
  const pessoa = retrato.pessoa.nome;
  const email = retrato.pessoa.email || undefined;

  // person e personEmail são iguais em toda a ficha (é uma pessoa só), então
  // ficam fora de cada chamada para não repetir vinte vezes o mesmo par.
  const registrar = (e: Omit<TimelineEvent, "person" | "personEmail">) => {
    eventos.push({ ...e, person: pessoa, personEmail: email });
  };

  retrato.encontros.forEach((e) => {
    const partes: string[] = [`${e.minutos_presentes} min`];
    if (e.permanencia_pct !== null) partes.push(`${e.permanencia_pct}% do encontro`);
    if (e.minutos_fala !== null) {
      partes.push(e.minutos_fala > 0 ? `falou ${minutos(e.minutos_fala)} min` : "não falou");
    }
    if (e.atraso_min !== null && e.atraso_min > 0) {
      partes.push(`entrou ${e.atraso_min} min depois`);
    }
    registrar({
      // Quem entra duas vezes no mesmo encontro aparece com dois nomes de tela,
      // e o id precisa distinguir as duas linhas.
      id: `encontro-${e.encontro_id}-${e.display_name}`,
      type: "encontro",
      // `inicio` é a hora real da sala; sem ela sobra só a data, e meio-dia
      // mantém o evento dentro do dia certo em qualquer fuso.
      timestamp: e.inicio || `${e.data_reuniao}T12:00:00`,
      title: e.atividade_nome || "Encontro",
      detail: partes.join(" · "),
    });
  });

  retrato.feedback.forEach((f, i) => {
    const notas: string[] = [];
    if (f.nota_grupo !== null) notas.push(`grupo ${f.nota_grupo}`);
    if (f.nota_condutor !== null) notas.push(`condutor ${f.nota_condutor}`);
    registrar({
      id: `feedback-${i}`,
      type: "feedback",
      timestamp: f.created_at,
      title: f.atividade_nome || "atividade sem nome",
      detail: notas.length ? notas.join(" · ") : undefined,
      body: f.relato || undefined,
    });
  });

  const p = retrato.plataforma;
  if (p) {
    p.cursos.forEach((c) => {
      if (c.matriculado_em) {
        registrar({
          id: `matricula-${c.curso_id}`,
          type: "enrollment",
          timestamp: c.matriculado_em,
          title: c.titulo,
        });
      }
      if (c.concluido_em) {
        registrar({
          id: `conclusao-${c.curso_id}`,
          type: "completion",
          timestamp: c.concluido_em,
          title: c.titulo,
        });
      }
    });

    p.certificados.forEach((c, i) => {
      if (!c.emitido_em) return;
      registrar({
        id: `certificado-${i}`,
        type: "certificate",
        timestamp: c.emitido_em,
        title: c.curso,
        detail: c.codigo || undefined,
      });
    });

    p.avaliacoes.forEach((a, i) => {
      if (!a.created_at) return;
      registrar({
        id: `avaliacao-${i}`,
        type: "review",
        timestamp: a.created_at,
        title: a.curso,
        score: a.nota ?? undefined,
        scoreSuffix: "/5",
        body: a.comentario || undefined,
      });
    });

    p.provas.forEach((pr, i) => {
      if (!pr.ultima_em) return;
      const partes: string[] = [];
      if (pr.melhor_nota !== null) partes.push(`${pr.melhor_nota} pontos`);
      partes.push(pr.passou ? "passou" : "não passou");
      if (pr.tentativas > 1) partes.push(`${pr.tentativas} tentativas`);
      registrar({
        id: `prova-${i}`,
        type: "exam",
        timestamp: pr.ultima_em,
        title: pr.curso,
        detail: partes.join(" · "),
      });
    });

    // Ocorrência não tem tipo próprio na timeline, e usar "feedback" é honesto:
    // as duas são texto que a pessoa escreveu pedindo alguma coisa. O título diz
    // qual das duas é, para ninguém confundir desabafo com reclamação aberta.
    p.ocorrencias.forEach((o, i) => {
      if (!o.created_at) return;
      registrar({
        id: `ocorrencia-${i}`,
        type: "feedback",
        timestamp: o.created_at,
        title: `ocorrência: ${o.origem || "outro"}`,
        detail: o.status || "nova",
        body: o.relato || undefined,
      });
    });
  }

  return eventos.sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function AbaAtividade({ retrato }: { retrato: RetratoUI }) {
  const [abertos, setAbertos] = useState<Set<string>>(new Set());
  const dias = useMemo(() => groupByDay(linhaDoTempo(retrato)), [retrato]);

  function alternar(id: string) {
    setAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(id)) proximo.delete(id);
      else proximo.add(id);
      return proximo;
    });
  }

  if (dias.length === 0) {
    return (
      <p className="text-xs text-cream/40 py-6 text-center">
        Ainda não há nada registrado no nome dela.
      </p>
    );
  }

  return (
    <div className="space-y-4 max-h-[420px] overflow-y-auto pr-1">
      {dias.map((dia) => (
        <div key={dia.key}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-semibold text-cream/50">{dia.label}</span>
            <span className="text-[10px] text-cream/25">
              {dia.events.length} evento{dia.events.length > 1 ? "s" : ""}
            </span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
          </div>

          <div className="relative pl-[13px]">
            <div
              className="absolute left-[5px] top-1 bottom-1 w-px"
              style={{ background: "rgba(255,255,255,0.06)" }}
            />
            {dia.events.map((e) => {
              const meta = TYPE_META[e.type];
              // Só vira botão a linha que tem texto para ler: clicar numa
              // matrícula e nada acontecer ensina que clicar não serve.
              const legivel = !!e.body;
              const aberto = abertos.has(e.id);

              return (
                <div
                  key={e.id}
                  onClick={legivel ? () => alternar(e.id) : undefined}
                  role={legivel ? "button" : undefined}
                  tabIndex={legivel ? 0 : undefined}
                  onKeyDown={
                    legivel
                      ? (ev) => {
                          if (ev.key === "Enter" || ev.key === " ") {
                            ev.preventDefault();
                            alternar(e.id);
                          }
                        }
                      : undefined
                  }
                  className={`relative flex items-start gap-2.5 py-1.5 pl-3 pr-2 rounded-[10px] transition-colors group ${
                    legivel ? "cursor-pointer hover:bg-white/[.04]" : "hover:bg-white/[.02]"
                  }`}
                >
                  <span
                    className="absolute -left-[12px] top-[11px] w-[9px] h-[9px] rounded-full border-2"
                    style={{ background: "#1a1a1a", borderColor: meta.color }}
                  />
                  <meta.icon
                    className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                    style={{ color: meta.color }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-cream/75 leading-snug break-words">
                      <span className="text-cream/40">{meta.verb} </span>
                      <span className="text-cream">{e.title}</span>
                      {e.score !== undefined && (
                        <span
                          className="ml-1.5 text-[10px] font-semibold"
                          style={{ color: meta.color }}
                        >
                          {e.score}
                          {e.scoreSuffix || ""}
                        </span>
                      )}
                    </p>
                    {e.detail && (
                      <p className="text-[11px] text-cream/30 leading-snug mt-0.5 break-words">
                        {e.detail}
                      </p>
                    )}
                    {legivel &&
                      (aberto ? (
                        <div
                          className="mt-1.5 pl-2.5 py-1 border-l-2"
                          style={{ borderColor: `${meta.color}55` }}
                        >
                          <p className="text-[11px] text-cream/60 leading-relaxed whitespace-pre-wrap break-words">
                            {e.body}
                          </p>
                          <span
                            className="text-[10px] mt-1 inline-block"
                            style={{ color: meta.color }}
                          >
                            ocultar
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5 mt-0.5">
                          <p className="text-[11px] text-cream/30 leading-snug truncate min-w-0">
                            “{e.body}”
                          </p>
                          <span
                            className="text-[10px] flex-shrink-0 group-hover:underline"
                            style={{ color: meta.color }}
                          >
                            ler
                          </span>
                        </div>
                      ))}
                  </div>
                  <span className="text-[10px] text-cream/25 tabular-nums flex-shrink-0 mt-0.5">
                    {hourLabel(e.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AbaEncontros({ retrato }: { retrato: RetratoUI }) {
  const r = retrato.resumo;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Numero
          icone={CalendarDays}
          valor={String(r.encontros)}
          rotulo={r.encontros === 1 ? "encontro" : "encontros"}
        />
        <Numero icone={Clock3} valor={`${r.minutos_totais}`} rotulo="minutos presentes" />
        <Numero
          icone={Mic}
          valor={r.minutos_fala === null ? "—" : minutos(r.minutos_fala)}
          rotulo={
            r.minutos_fala === null
              ? "sem transcrição"
              : `min de fala em ${r.encontros_em_que_falou}`
          }
        />
        <Numero
          icone={Star}
          valor={r.media_permanencia_pct === null ? "—" : `${r.media_permanencia_pct}%`}
          rotulo="permanência média"
        />
      </div>

      {r.atrasos > 0 && (
        <p className="text-xs text-cream/40">
          Chegou depois do horário em {r.atrasos} de {r.encontros}{" "}
          {r.encontros === 1 ? "encontro" : "encontros"}.
        </p>
      )}

      <Secao titulo="Encontro a encontro">
        {retrato.encontros.map((e) => (
          <Linha key={`${e.encontro_id}-${e.display_name}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-cream/70">
                {new Date(e.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "2-digit",
                })}
                {e.atividade_nome ? <span className="text-cream/35"> · {e.atividade_nome}</span> : null}
              </span>
              <span className="text-cream/50 tabular-nums">
                {e.minutos_presentes} min
                {e.permanencia_pct !== null ? ` · ${e.permanencia_pct}%` : ""}
                {e.minutos_fala !== null && e.minutos_fala > 0
                  ? ` · falou ${minutos(e.minutos_fala)} min`
                  : e.minutos_fala === 0
                    ? " · não falou"
                    : ""}
              </span>
            </div>
          </Linha>
        ))}
      </Secao>
    </div>
  );
}

function AbaCertificado({ retrato }: { retrato: RetratoUI }) {
  return (
    <Secao titulo="O que escreveu ao pedir o certificado">
      {retrato.feedback.map((f, i) => (
        <Linha key={i}>
          <div className="flex items-center justify-between gap-2 flex-wrap text-cream/50">
            <span>{f.atividade_nome || "Sem atividade"}</span>
            <span className="tabular-nums">
              {data(f.created_at)}
              {f.nota_grupo !== null ? ` · grupo ${f.nota_grupo}` : ""}
              {f.nota_condutor !== null ? ` · condutor ${f.nota_condutor}` : ""}
            </span>
          </div>
          {f.relato && <p className="text-cream/60 mt-1 break-words">{f.relato}</p>}
        </Linha>
      ))}
    </Secao>
  );
}

function AbaPlataforma({ dados }: { dados: PlataformaUI }) {
  const emCurso = dados.cursos.filter((c) => (c.pct ?? 0) < 100 && c.status !== "completed");
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Numero icone={Clock3} valor={duracao(dados.uso.minutos_totais)} rotulo="na plataforma" />
        <Numero
          icone={CalendarDays}
          valor={String(dados.uso.dias_com_acesso)}
          rotulo="dias com acesso"
        />
        <Numero
          icone={GraduationCap}
          valor={String(dados.cursos.length)}
          rotulo={dados.cursos.length === 1 ? "curso" : "cursos"}
        />
        <Numero
          icone={BadgeCheck}
          valor={String(dados.horas_sincronas.horas)}
          rotulo={`horas síncronas em ${dados.horas_sincronas.encontros}`}
        />
      </div>

      <p className="text-[11px] text-cream/35">
        Membro desde {data(dados.conta.membro_desde)}
        {dados.uso.ultimo_acesso ? ` · último acesso em ${data(dados.uso.ultimo_acesso)}` : ""}
        {dados.conta.papel ? ` · ${dados.conta.papel}` : ""}
        {dados.conta.cargos.length ? ` (${dados.conta.cargos.join(", ")})` : ""}
        {dados.conta.termos_aceito_em
          ? ` · aceitou os termos ${dados.conta.termos_versao || ""} em ${data(dados.conta.termos_aceito_em)}`
          : " · ainda não aceitou os termos"}
      </p>

      {dados.cursos.length > 0 && (
        <Secao titulo={`Cursos (${emCurso.length} em andamento)`}>
          {dados.cursos.map((c) => (
            <Linha key={c.curso_id}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-cream/70 break-words">{c.titulo}</span>
                <span className="text-cream/45 tabular-nums shrink-0">
                  {c.aulas_total
                    ? `${c.aulas_concluidas}/${c.aulas_total} aulas`
                    : "sem aulas cadastradas"}
                  {c.minutos_uso ? ` · ${duracao(c.minutos_uso)}` : ""}
                  {c.tem_certificado ? " · certificado" : ""}
                </span>
              </div>
              {c.pct !== null && (
                <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${c.pct}%`, background: ROXO }}
                  />
                </div>
              )}
              <p className="text-cream/30 mt-1">
                matriculada em {data(c.matriculado_em)}
                {c.concluido_em ? ` · concluiu em ${data(c.concluido_em)}` : ""}
                {c.status && c.status !== "active" ? ` · ${c.status}` : ""}
              </p>
            </Linha>
          ))}
        </Secao>
      )}

      {dados.certificados.length > 0 && (
        <Secao titulo="Certificados emitidos">
          {dados.certificados.map((c, i) => (
            <Linha key={i}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-cream/70 break-words">{c.curso}</span>
                <span className="text-cream/45 tabular-nums">
                  {data(c.emitido_em)}
                  {c.codigo ? ` · ${c.codigo}` : ""}
                </span>
              </div>
            </Linha>
          ))}
        </Secao>
      )}

      {dados.verificacoes.length > 0 && (
        <Secao titulo="Certificados retidos para verificação">
          {dados.verificacoes.map((v, i) => (
            <Linha key={i}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-cream/70 break-words">{v.curso}</span>
                <span className="text-amber-400/70">{v.status || "retido"}</span>
              </div>
              {v.motivo && <p className="text-cream/45 mt-1">{v.motivo}</p>}
            </Linha>
          ))}
        </Secao>
      )}

      {dados.provas.length > 0 && (
        <Secao titulo="Provas">
          {dados.provas.map((p, i) => (
            <Linha key={i}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-cream/70 break-words">{p.curso}</span>
                <span className="tabular-nums" style={{ color: p.passou ? "#4ADE80" : "rgba(253,251,247,0.45)" }}>
                  {p.melhor_nota !== null ? `${p.melhor_nota} pontos` : "sem nota"}
                  {p.passou ? " · passou" : ""}
                  {p.tentativas > 1 ? ` · ${p.tentativas} tentativas` : ""}
                </span>
              </div>
            </Linha>
          ))}
        </Secao>
      )}

      {dados.avaliacoes.length > 0 && (
        <Secao titulo="O que avaliou">
          {dados.avaliacoes.map((a, i) => (
            <Linha key={i}>
              <div className="flex items-center justify-between gap-2 flex-wrap text-cream/50">
                <span className="break-words">{a.curso}</span>
                <span className="tabular-nums">
                  {a.nota !== null ? `${a.nota}/5` : "sem nota"} · {data(a.created_at)}
                </span>
              </div>
              {a.comentario && <p className="text-cream/60 mt-1 break-words">{a.comentario}</p>}
            </Linha>
          ))}
        </Secao>
      )}

      {dados.ocorrencias.length > 0 && (
        <Secao titulo="Ocorrências que abriu">
          {dados.ocorrencias.map((o, i) => (
            <Linha key={i}>
              <div className="flex items-center justify-between gap-2 flex-wrap text-cream/50">
                <span>{o.origem || "outro"}</span>
                <span className="tabular-nums">
                  {o.status || "nova"} · {data(o.created_at)}
                </span>
              </div>
              {o.relato && <p className="text-cream/60 mt-1 break-words line-clamp-4">{o.relato}</p>}
            </Linha>
          ))}
        </Secao>
      )}

      {(dados.participacao.comentarios > 0 ||
        dados.participacao.duvidas > 0 ||
        dados.participacao.favoritos > 0) && (
        <p className="text-[11px] text-cream/35">
          {dados.participacao.comentarios} comentários · {dados.participacao.duvidas} dúvidas ·{" "}
          {dados.participacao.favoritos} aulas favoritadas
        </p>
      )}

      {dados.bloqueios.length > 0 && (
        <Secao titulo="Histórico de bloqueio">
          {dados.bloqueios.map((b, i) => (
            <Linha key={i}>
              <div className="flex items-center justify-between gap-2 flex-wrap text-cream/50">
                <span>{b.acao}</span>
                <span className="tabular-nums">{data(b.created_at)}</span>
              </div>
              {b.motivo && <p className="text-cream/45 mt-1">{b.motivo}</p>}
            </Linha>
          ))}
        </Secao>
      )}
    </div>
  );
}
