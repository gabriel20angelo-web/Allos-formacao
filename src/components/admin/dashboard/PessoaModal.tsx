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
import { detectarSinais, type Sinal } from "@/lib/utils/suspeita";
import type { ActivityRange, TimelineEvent } from "@/lib/utils/activity";
import { AlertTriangle, Mail, UserCircle } from "lucide-react";

export interface PessoaRef {
  nome: string;
  email?: string;
}

interface Dossie {
  nome: string;
  email: string | null;
  papel: string | null;
  membroDesde: string | null;
  aliases: string[];
  eventos: TimelineEvent[];
  resumo: {
    matriculas: number;
    concluidos: number;
    certificados: number;
    aulas: number;
    feedbacks: number;
    horasSincronas: number;
  };
  sinais: Sinal[];
}

export default function PessoaModal({
  pessoa,
  onClose,
}: {
  pessoa: PessoaRef | null;
  onClose: () => void;
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
      ? sb.from("profiles").select("id, full_name, email, role, created_at").eq("email", ref.email)
      : sb.from("profiles").select("id, full_name, email, role, created_at").ilike("full_name", ref.nome);
    const { data: perfis } = await perfilQuery.limit(1);
    const perfil = perfis?.[0] as
      | { id: string; full_name: string; email: string; role: string; created_at: string }
      | undefined;

    const email = ref.email || perfil?.email || null;
    const userId = perfil?.id;

    // 2. Tudo o que ela fez, em paralelo.
    const [subsRes, enrollRes, lessonsRes, certsRes, revsRes, atividadesRes] =
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

    eventos.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const aliases = Array.from(
      new Set(
        subs
          .map((s) => (s.nome_completo || "").trim())
          .filter((n) => n && n.toLowerCase() !== (perfil?.full_name || "").toLowerCase())
      )
    );

    const horasSincronas = subs.reduce(
      (soma, s) =>
        soma + (horasPorAtividade.get((s.atividade_nome || "").toLowerCase()) ?? 2),
      0
    );

    setDossie({
      nome: perfil?.full_name || ref.nome,
      email,
      papel: perfil?.role ?? null,
      membroDesde: perfil?.created_at ?? null,
      aliases,
      eventos,
      resumo: {
        matriculas: enrolls.length,
        concluidos: enrolls.filter((e) => e.status === "completed").length,
        certificados: certs.length,
        aulas: aulas.length,
        feedbacks: subs.length,
        horasSincronas,
      },
      sinais: detectarSinais(eventos),
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    if (pessoa) carregar(pessoa);
  }, [pessoa, carregar]);

  const resumoItens = dossie
    ? [
        { label: "Matrículas", valor: dossie.resumo.matriculas },
        { label: "Cursos concluídos", valor: dossie.resumo.concluidos },
        { label: "Certificados de curso", valor: dossie.resumo.certificados },
        { label: "Aulas concluídas", valor: dossie.resumo.aulas },
        { label: "Feedbacks enviados", valor: dossie.resumo.feedbacks },
        { label: "Horas síncronas", valor: `${dossie.resumo.horasSincronas}h` },
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
          </div>

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

          {/* ── Linha do tempo dela ── */}
          <ActivityTimeline
            events={dossie.eventos}
            range={range}
            onRangeChange={setRange}
            accent="#C84B31"
            csvName={`atividade_${(dossie.email || dossie.nome).split("@")[0]}`}
            subtitle="Tudo o que esta pessoa fez na plataforma, do mais recente para o mais antigo."
          />
        </div>
      )}
    </Modal>
  );
}
