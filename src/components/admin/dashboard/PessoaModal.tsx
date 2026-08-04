// Dossiê da pessoa — tudo o que ela fez na plataforma, num lugar só.
//
// A chave é o e-mail, não o nome: o formulário de /certificado aceita o nome
// digitado na hora, então a mesma conta aparece como "Sabrina Sales" e
// "Sabrina Sales Bezerra". Agrupar por nome esconderia metade da atividade —
// que foi exatamente o que fez parecer que faltavam dados.

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import ActivityTimeline from "./ActivityTimeline";
import TempoPorCurso from "./TempoPorCurso";
import { detectarSinais, type Sinal } from "@/lib/utils/suspeita";
import { formatDuration, getUsageTotals } from "@/lib/queries/usage";
import type { ActivityRange, TimelineEvent } from "@/lib/utils/activity";
import {
  anotarPresencaMedida,
  carregarEventosDeEncontros,
  type ResultadoEventosMeet,
} from "@/lib/meet/eventos";
import { AlertTriangle, Download, Lock, Mail, UserCircle } from "lucide-react";
import { hourLabel } from "@/lib/utils/activity";
import { TYPE_META } from "./ActivityTimeline";
import AcoesPessoa from "./AcoesPessoa";

export interface PessoaRef {
  nome: string;
  email?: string;
}

/**
 * Duração para a tela. `formatDuration` devolve um traço quando não há tempo
 * algum, e num quadro de presença o zero precisa ser lido como zero: ausência
 * medida é informação, não dado faltando.
 */
function minutosLegiveis(minutos: number): string {
  return minutos > 0 ? formatDuration(minutos * 60) : "0min";
}

interface Dossie {
  /** id da conta — null quando a pessoa só existe nos feedbacks, sem cadastro. */
  userId: string | null;
  nome: string;
  email: string | null;
  papel: string | null;
  bloqueado: boolean;
  bloqueadoMotivo: string | null;
  membroDesde: string | null;
  aliases: string[];
  eventos: TimelineEvent[];
  /** A captura do Meet bateu no teto de linhas: a linha do tempo avisa. */
  encontrosTruncados: boolean;
  resumo: {
    matriculas: number;
    concluidos: number;
    certificados: number;
    aulas: number;
    feedbacks: number;
    horasSincronas: number;
    /** Permanência ativa medida na plataforma (migration 042). */
    tempoUsoSegundos: number;
    diasComAcesso: number;
    /** Encontros do Meet em que a captura registrou esta pessoa. */
    encontros: number;
    /**
     * Minutos de sala somados. Vem da presença medida, que exclui quem conduziu:
     * o condutor entra em todo encontro e infla qualquer comparação com o que os
     * alunos declaram, então aqui ele conta zero minuto de propósito.
     */
    minutosEmEncontro: number;
  };
  sinais: Sinal[];
}

export default function PessoaModal({
  pessoa,
  onClose,
  onEmailEnviado,
}: {
  pessoa: PessoaRef | null;
  onClose: () => void;
  /** Recebe os sinais que entraram no e-mail, para saírem da lista aberta. */
  onEmailEnviado?: (sinais: Sinal[]) => void;
}) {
  const [dossie, setDossie] = useState<Dossie | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<ActivityRange>("all");

  const carregar = useCallback(async (ref: PessoaRef) => {
    setLoading(true);
    setDossie(null);
    const sb = createClient();

    // 1. Encontrar a conta. Por e-mail quando temos; senão pelo nome.
    const perfilQuery = ref.email
      ? sb.from("profiles").select("id, full_name, email, role, created_at, bloqueado, bloqueado_motivo").eq("email", ref.email)
      : sb.from("profiles").select("id, full_name, email, role, created_at, bloqueado, bloqueado_motivo").ilike("full_name", ref.nome);
    const { data: perfis } = await perfilQuery.limit(1);
    const perfil = perfis?.[0] as
      | {
          id: string;
          full_name: string;
          email: string;
          role: string;
          created_at: string;
          bloqueado?: boolean;
          bloqueado_motivo?: string | null;
        }
      | undefined;

    const email = ref.email || perfil?.email || null;
    const userId = perfil?.id;

    // A captura do Meet responde a dois vínculos: a conta, quando a pessoa
    // entrou logada, e a grafia do nome de tela reconhecida pelo certificado.
    // Sem nenhum dos dois não dá para filtrar, e uma chamada sem filtro traz o
    // encontro de todo mundo, ou seja, o dossiê de uma pessoa mostrando a
    // presença das outras.
    const encontrosPromise: Promise<ResultadoEventosMeet> =
      userId || email
        ? carregarEventosDeEncontros(sb, { alunoId: userId ?? null, email })
        : Promise.resolve({
            eventos: [],
            presencas: [],
            encontrosCapturados: new Map(),
            truncado: false,
          });

    // 2. Tudo o que ela fez, em paralelo.
    const [subsRes, enrollRes, lessonsRes, certsRes, revsRes, atividadesRes, encontros] =
      await Promise.all([
        email
          ? sb
              .from("certificado_submissions")
              .select("id, nome_completo, email, atividade_nome, nota_grupo, nota_condutor, condutores, relato, created_at")
              .eq("email", email)
              .order("created_at", { ascending: false })
          : sb
              .from("certificado_submissions")
              .select("id, nome_completo, email, atividade_nome, nota_grupo, nota_condutor, condutores, relato, created_at")
              .ilike("nome_completo", ref.nome)
              .order("created_at", { ascending: false }),
        userId
          ? sb
              .from("enrollments")
              .select("id, enrolled_at, completed_at, status, course:courses!course_id(title)")
              .eq("user_id", userId)
          : Promise.resolve({ data: [] }),
        userId
          ? sb
              .from("lesson_progress")
              .select("id, completed_at, lesson:lessons!lesson_id(title, section:sections!section_id(course:courses!course_id(title)))")
              .eq("user_id", userId)
              .eq("completed", true)
              .not("completed_at", "is", null)
          : Promise.resolve({ data: [] }),
        userId
          ? sb
              .from("certificates")
              .select("id, issued_at, certificate_code, course:courses!course_id(title)")
              .eq("user_id", userId)
          : Promise.resolve({ data: [] }),
        userId
          ? sb
              .from("reviews")
              .select("id, rating, comment, created_at, course:courses!course_id(title)")
              .eq("user_id", userId)
          : Promise.resolve({ data: [] }),
        sb.from("certificado_atividades").select("nome, carga_horaria"),
        encontrosPromise,
      ]);

    type SubRow = {
      id: string;
      nome_completo: string | null;
      email: string | null;
      atividade_nome: string | null;
      nota_grupo: number | null;
      nota_condutor: number | null;
      condutores: string[] | null;
      relato: string | null;
      created_at: string;
    };
    const subs = (subsRes.data ?? []) as SubRow[];

    const horasPorAtividade = new Map<string, number>();
    ((atividadesRes.data ?? []) as { nome: string; carga_horaria: number }[]).forEach(
      (a) => horasPorAtividade.set(a.nome.toLowerCase(), a.carga_horaria)
    );

    const eventos: TimelineEvent[] = [];

    subs.forEach((s) => {
      const cond = (s.condutores || []).filter(Boolean);
      const partes = [
        cond.length ? `com ${cond.join(", ")}` : "",
        s.nota_condutor ? `condutor ${s.nota_condutor}/10` : "",
      ].filter(Boolean);
      eventos.push({
        id: `sub-${s.id}`,
        type: "feedback",
        timestamp: s.created_at,
        person: (s.nome_completo || ref.nome).trim(),
        personEmail: s.email || undefined,
        title: s.atividade_nome || "atividade",
        detail: partes.join(" · ") || undefined,
        body: s.relato?.trim() || undefined,
        score: s.nota_grupo ?? undefined,
        scoreSuffix: "/10",
      });
    });

    type EnrollRow = {
      id: string;
      enrolled_at: string;
      completed_at: string | null;
      status: string;
      course?: { title: string | null } | null;
    };
    const enrolls = (enrollRes.data ?? []) as unknown as EnrollRow[];
    const nome = perfil?.full_name || ref.nome;
    enrolls.forEach((e) => {
      eventos.push({
        id: `enr-${e.id}`,
        type: "enrollment",
        timestamp: e.enrolled_at,
        person: nome,
        personEmail: email || undefined,
        title: e.course?.title || "Curso",
      });
      if (e.status === "completed" && e.completed_at) {
        eventos.push({
          id: `cmp-${e.id}`,
          type: "completion",
          timestamp: e.completed_at,
          person: nome,
          personEmail: email || undefined,
          title: e.course?.title || "Curso",
        });
      }
    });

    type LessonRow = {
      id: string;
      completed_at: string;
      lesson?: {
        title: string | null;
        section?: { course?: { title: string | null } | null } | null;
      } | null;
    };
    const aulas = (lessonsRes.data ?? []) as unknown as LessonRow[];
    aulas.forEach((l) => {
      eventos.push({
        id: `les-${l.id}`,
        type: "lesson",
        timestamp: l.completed_at,
        person: nome,
        personEmail: email || undefined,
        title: l.lesson?.title?.trim() || "aula",
        detail: l.lesson?.section?.course?.title || undefined,
      });
    });

    type CertRow = {
      id: string;
      issued_at: string;
      certificate_code: string;
      course?: { title: string | null } | null;
    };
    const certs = (certsRes.data ?? []) as unknown as CertRow[];
    certs.forEach((c) => {
      eventos.push({
        id: `cert-${c.id}`,
        type: "certificate",
        timestamp: c.issued_at,
        person: nome,
        personEmail: email || undefined,
        title: c.course?.title || "Curso",
        detail: `código ${c.certificate_code}`,
      });
    });

    type RevRow = {
      id: string;
      rating: number;
      comment: string | null;
      created_at: string;
      course?: { title: string | null } | null;
    };
    const revs = (revsRes.data ?? []) as unknown as RevRow[];
    revs.forEach((r) => {
      eventos.push({
        id: `rev-${r.id}`,
        type: "review",
        timestamp: r.created_at,
        person: nome,
        personEmail: email || undefined,
        title: r.course?.title || "Curso",
        body: r.comment?.trim() || undefined,
        score: r.rating,
        scoreSuffix: "/5",
      });
    });

    // O medido entra na mesma lista do declarado, e não num quadro à parte: é
    // lado a lado, no mesmo dia, que a distância entre o que a pessoa disse ter
    // feito e o que ela fez na sala aparece sem ninguém precisar cruzar nada.
    eventos.push(...encontros.eventos);

    eventos.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Só agora, com a lista fechada: a anotação procura o feedback do mesmo dia
    // e da mesma atividade, e feedback que ainda não tivesse entrado ficaria sem
    // a presença medida ao lado.
    const eventosAnotados = anotarPresencaMedida(eventos, {
      presencas: encontros.presencas,
      encontrosCapturados: encontros.encontrosCapturados,
    });

    const aliases = Array.from(
      new Set(
        subs
          .map((s) => (s.nome_completo || "").trim())
          .filter((n) => n && n.toLowerCase() !== (perfil?.full_name || "").toLowerCase())
      )
    );

    // Tempo real de permanência: só existe para quem usou a plataforma depois
    // de o rastreio entrar no ar, então zero aqui não quer dizer ausência.
    const uso = userId
      ? await getUsageTotals(userId)
      : { totalSeconds: 0, sessions: 0, firstAt: null, lastAt: null, byDay: [] };

    const horasSincronas = subs.reduce(
      (soma, s) =>
        soma + (horasPorAtividade.get((s.atividade_nome || "").toLowerCase()) ?? 2),
      0
    );

    // Somado a partir da presença, onde o minuto é número; no evento ele já
    // virou texto e teria de ser lido de volta.
    const minutosEmEncontro = encontros.presencas.reduce(
      (soma, p) => soma + (p.minutos || 0),
      0
    );

    setDossie({
      userId: perfil?.id ?? null,
      bloqueado: !!perfil?.bloqueado,
      bloqueadoMotivo: perfil?.bloqueado_motivo ?? null,
      nome: perfil?.full_name || ref.nome,
      email,
      papel: perfil?.role ?? null,
      membroDesde: perfil?.created_at ?? null,
      aliases,
      eventos: eventosAnotados,
      encontrosTruncados: encontros.truncado,
      resumo: {
        matriculas: enrolls.length,
        concluidos: enrolls.filter((e) => e.status === "completed").length,
        certificados: certs.length,
        aulas: aulas.length,
        feedbacks: subs.length,
        horasSincronas,
        tempoUsoSegundos: uso.totalSeconds,
        diasComAcesso: uso.byDay.length,
        encontros: encontros.eventos.length,
        minutosEmEncontro,
      },
      sinais: detectarSinais(eventosAnotados),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (pessoa) carregar(pessoa);
  }, [pessoa, carregar]);

  /**
   * CSV do dossiê inteiro, em blocos: identidade, resumo, sinais e o histórico
   * completo. É o documento que se manda para a própria pessoa quando ela pede
   * explicação — por isso sai tudo, não só a tela.
   */
  function baixarDossie() {
    if (!dossie) return;
    const esc = (v: string | number | undefined) =>
      `"${String(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
    const linhas: string[] = [];

    linhas.push("=== PESSOA ===");
    linhas.push(`Nome,${esc(dossie.nome)}`);
    linhas.push(`E-mail,${esc(dossie.email || "")}`);
    linhas.push(`Papel,${esc(dossie.papel || "")}`);
    linhas.push(
      `Membro desde,${esc(
        dossie.membroDesde
          ? new Date(dossie.membroDesde).toLocaleDateString("pt-BR")
          : ""
      )}`
    );
    if (dossie.aliases.length > 0) {
      linhas.push(`Outros nomes usados,${esc(dossie.aliases.join(" / "))}`);
    }
    linhas.push(
      `Emitido em,${esc(new Date().toLocaleString("pt-BR"))}`
    );

    linhas.push("");
    linhas.push("=== RESUMO ===");
    linhas.push(`Matrículas,${dossie.resumo.matriculas}`);
    linhas.push(`Cursos concluídos,${dossie.resumo.concluidos}`);
    linhas.push(`Certificados de curso,${dossie.resumo.certificados}`);
    linhas.push(`Aulas concluídas,${dossie.resumo.aulas}`);
    linhas.push(`Feedbacks de certificação,${dossie.resumo.feedbacks}`);
    linhas.push(`Horas síncronas declaradas,${dossie.resumo.horasSincronas}`);
    linhas.push(`Encontros no Meet com presença medida,${dossie.resumo.encontros}`);
    // Em minutos crus: quem abre o CSV vai somar e comparar, não ler.
    linhas.push(
      `Minutos medidos em encontro,${dossie.resumo.minutosEmEncontro}`
    );
    linhas.push(
      `Tempo de permanência na plataforma,${esc(formatDuration(dossie.resumo.tempoUsoSegundos))}`
    );
    linhas.push(`Dias com acesso registrado,${dossie.resumo.diasComAcesso}`);

    if (dossie.sinais.length > 0) {
      linhas.push("");
      linhas.push("=== SINAIS DE ATENÇÃO ===");
      linhas.push("Data,Ocorrência,Detalhe");
      dossie.sinais.forEach((s) => {
        const [y, m, d] = s.dia.split("-");
        linhas.push(
          [`${d}/${m}/${y}`, esc(s.titulo), esc(s.detalhe)].join(",")
        );
      });
    }

    linhas.push("");
    linhas.push("=== ATIVIDADE COMPLETA ===");
    linhas.push("Data,Hora,Tipo,Referência,Contexto,Texto,Nota");
    dossie.eventos.forEach((e) => {
      const d = new Date(e.timestamp);
      linhas.push(
        [
          d.toLocaleDateString("pt-BR"),
          hourLabel(e.timestamp),
          esc(TYPE_META[e.type].label),
          esc(e.title),
          esc(e.detail || ""),
          esc(e.body || ""),
          e.score !== undefined ? `${e.score}${e.scoreSuffix || ""}` : "",
        ].join(",")
      );
    });

    const nomeArquivo = (dossie.email || dossie.nome)
      .split("@")[0]
      .replace(/[^a-zA-Z0-9]+/g, "_");
    const blob = new Blob(["﻿" + linhas.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `dossie_${nomeArquivo}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const resumoItens = dossie
    ? [
        { label: "Matrículas", valor: dossie.resumo.matriculas },
        { label: "Cursos concluídos", valor: dossie.resumo.concluidos },
        { label: "Certificados de curso", valor: dossie.resumo.certificados },
        { label: "Aulas concluídas", valor: dossie.resumo.aulas },
        { label: "Feedbacks enviados", valor: dossie.resumo.feedbacks },
        { label: "Horas síncronas", valor: `${dossie.resumo.horasSincronas}h` },
        // Ao lado das horas declaradas de propósito: a comparação entre as duas
        // é o que o quadro tem de novo a dizer.
        { label: "Encontros no Meet", valor: dossie.resumo.encontros },
        {
          label: "Tempo nos encontros",
          valor: minutosLegiveis(dossie.resumo.minutosEmEncontro),
        },
        {
          label: "Tempo na plataforma",
          valor: formatDuration(dossie.resumo.tempoUsoSegundos),
        },
        {
          label: "Dias com acesso",
          valor: dossie.resumo.diasComAcesso,
        },
      ]
    : [];

  return (
    <Modal
      open={!!pessoa}
      onClose={onClose}
      title={pessoa?.nome || "Pessoa"}
      maxWidth="max-w-4xl"
    >
      {loading || !dossie ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-[12px]" />
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {/* ── Identidade ── */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {dossie.email && (
              <span className="font-dm text-[11px] text-cream/45 flex items-center gap-1.5">
                <Mail className="h-3 w-3" />
                {dossie.email}
              </span>
            )}
            {dossie.papel && (
              <span className="font-dm text-[11px] text-cream/45 flex items-center gap-1.5">
                <UserCircle className="h-3 w-3" />
                {dossie.papel}
              </span>
            )}
            {dossie.membroDesde && (
              <span className="font-dm text-[11px] text-cream/30">
                desde{" "}
                {new Date(dossie.membroDesde).toLocaleDateString("pt-BR", {
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            <div className="flex-1" />
            <AcoesPessoa
              userId={dossie.userId}
              nome={dossie.nome}
              email={dossie.email}
              bloqueado={dossie.bloqueado}
              temSinais={dossie.sinais.length > 0}
              onMudou={() => pessoa && carregar(pessoa)}
              onEmailEnviado={() => onEmailEnviado?.(dossie.sinais)}
            />
            <button
              onClick={baixarDossie}
              className="font-dm text-[11px] px-2.5 py-1.5 rounded-full flex items-center gap-1.5 transition-all hover:bg-white/[.05]"
              style={{
                color: "rgba(253,251,247,0.6)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
              title="Baixar identidade, resumo, sinais e histórico completo"
            >
              <Download className="h-3 w-3" />
              Baixar dossiê (CSV)
            </button>
          </div>

          {dossie.bloqueado && (
            <div
              className="flex items-start gap-2 px-3 py-2 rounded-[10px]"
              style={{ background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.2)" }}
            >
              <Lock className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" style={{ color: "#EF4444" }} />
              <div className="min-w-0">
                <p className="font-dm text-[11px] font-semibold text-red-300/90">Acesso bloqueado</p>
                {dossie.bloqueadoMotivo && (
                  <p className="font-dm text-[11px] text-cream/45 leading-snug">{dossie.bloqueadoMotivo}</p>
                )}
              </div>
            </div>
          )}

          {dossie.aliases.length > 0 && (
            <p className="font-dm text-[11px] text-cream/35">
              Também assinou como{" "}
              <span className="text-cream/60">{dossie.aliases.join(", ")}</span> no
              formulário de certificação — mesma conta, nome digitado diferente.
            </p>
          )}

          {/* ── Resumo ── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {resumoItens.map((item) => (
              <div
                key={item.label}
                className="px-3 py-2 rounded-[10px]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <p className="font-fraunces font-bold text-lg text-cream tabular-nums leading-none">
                  {item.valor}
                </p>
                <p className="font-dm text-[10px] text-cream/35 mt-1 leading-tight">
                  {item.label}
                </p>
              </div>
            ))}
          </div>

          {/* ── Sinais ── */}
          {dossie.sinais.length > 0 && (
            <div className="space-y-1.5">
              {dossie.sinais.map((s) => (
                <div
                  key={s.id}
                  className="flex items-start gap-2 px-3 py-2 rounded-[10px]"
                  style={{
                    background: "rgba(245,158,11,0.05)",
                    border: "1px solid rgba(245,158,11,0.16)",
                  }}
                >
                  <AlertTriangle
                    className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                    style={{ color: "#F59E0B" }}
                  />
                  <div className="min-w-0">
                    <p className="font-dm text-[11px] font-semibold text-amber-200/90">
                      {s.titulo}
                    </p>
                    <p className="font-dm text-[11px] text-cream/40 leading-snug">
                      {s.detalhe}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Tempo por curso ── */}
          <div className="space-y-2">
            <p className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25">
              Tempo por curso
            </p>
            <TempoPorCurso userId={dossie.userId} />
          </div>

          {/* ── Linha do tempo dela ── */}
          <ActivityTimeline
            events={dossie.eventos}
            range={range}
            onRangeChange={setRange}
            accent="#C84B31"
            // O aviso de teto já existe na timeline; repetir a linha aqui em
            // cima seria dizer duas vezes a mesma coisa em dois lugares.
            truncated={dossie.encontrosTruncados ? ["os encontros do Meet"] : []}
            csvName={`atividade_${(dossie.email || dossie.nome).split("@")[0]}`}
            subtitle="Tudo o que esta pessoa fez na plataforma, do mais recente para o mais antigo."
          />
        </div>
      )}
    </Modal>
  );
}
