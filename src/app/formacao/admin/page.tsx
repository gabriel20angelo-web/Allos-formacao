// Dashboard admin: a porta do /admin. Dois modos lado a lado:
//   - mode="async" (cursos): foca em cursos publicados, matrículas, certificados,
//     receita (se cobrar), reviews, retenção e atividade recente
//   - mode="sync" (formação síncrona): foca em sessões conduzidas, quórum
//     médio, ranking de condutores/participantes, distribuição de notas
//
// Período (dashPeriod) filtra "sync" entre 7d/30d/90d/all. Todos os blocos
// são `useEffect` separados (engagement async, formacao stats, quorum, notes)
// pra cada um falhar isolado sem derrubar a tela. A AdminNotesSection já
// está extraída; o resto ainda vive aqui (~2700 linhas) e deve ser quebrado
// em sub-componentes nos próximos blocos de refactor.

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDayNotes } from "@/hooks/useDayNotes";
import {
  detectarSinais,
  personKey,
  type TempoDeCurso,
} from "@/lib/utils/suspeita";
import { separarSinais, useSinaisResolvidos } from "@/hooks/useSinaisResolvidos";
import { formatPrice } from "@/lib/utils/format";
import {
  getGreeting,
  type DashMode,
} from "@/lib/utils/dashboard";
import {
  JANELAS_PAINEL,
  RANGE_LABELS,
  getRangeStart,
  type ActivityRange,
  type TimelineEvent,
} from "@/lib/utils/activity";
import { anotarPresencaMedida, carregarEventosDeEncontros } from "@/lib/meet/eventos";
import StatStrip from "@/components/admin/dashboard/StatStrip";
import HintButton from "@/components/admin/dashboard/HintButton";
import ActivityTimeline from "@/components/admin/dashboard/ActivityTimeline";
import SinaisAtencao from "@/components/admin/dashboard/SinaisAtencao";
import EmailsEnviados from "@/components/admin/dashboard/EmailsEnviados";
import PessoaModal, { type PessoaRef } from "@/components/admin/dashboard/PessoaModal";
import AdminNotesSection from "@/components/admin/dashboard/AdminNotesSection";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import Link from "next/link";
import {

  Users,

  BarChart3,
  Flame,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Leitura paginada
// ═══════════════════════════════════════════════════════════════

/**
 * Lê a tabela inteira, de mil em mil.
 *
 * O PostgREST desta instância devolve no máximo mil linhas e NÃO avisa que
 * cortou: a resposta chega com status 200 e a tela passa a mostrar números
 * menores que a verdade, sem nenhum sintoma. Pior, o sintoma que ele produz
 * (menos participação, menos progresso) é exatamente o diagnóstico que o
 * painel existe para dar, então o erro se disfarça de descoberta.
 *
 * O teto de páginas existe para que um filtro errado não vire varredura
 * infinita. A ordenação é por chave estável, senão a paginação repete e pula
 * linhas entre uma página e outra.
 */
async function lerTudo<T>(
  sb: ReturnType<typeof createClient>,
  tabela: string,
  colunas: string,
  ordenarPor = "id",
): Promise<T[]> {
  const PAGINA = 1000;
  const TETO = 50;
  const out: T[] = [];
  for (let p = 0; p < TETO; p++) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .order(ordenarPor, { ascending: true })
      .range(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const lote = (data ?? []) as T[];
    out.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface DashboardStats {
  totalCourses: number;
  totalCertificates: number;
  completionRate: number;
  totalRevenue: number;
  hasRevenue: boolean;
}

// ─── Tipos locais pras queries Supabase ─────────────────────────────────
// Subset dos campos das tabelas que essa página realmente lê.
type SubmissionRow = {
  id: string;
  created_at: string;
  nome_completo: string | null;
  email: string | null;
  atividade_nome: string | null;
  nota_grupo: number | null;
  nota_condutor: number | null;
  relato: string | null;
  condutores: string[] | null;
};

type ReviewJoinRow = {
  id: string;
  rating: number;
  created_at: string;
  user?: NamedUser;
  course?: { title: string | null } | null;
};

type PaidEnrollmentRow = { courses?: { price_cents: number | null } | null };

// ─── Fontes da timeline assíncrona ──────────────────────────────────────
type NamedUser = { full_name: string | null; email?: string | null } | null;

type SignupRow = { id: string; full_name: string | null; email: string | null; created_at: string };

type EnrollmentEventRow = {
  id: string;
  enrolled_at: string;
  completed_at: string | null;
  status: string;
  user?: NamedUser;
  course?: { title: string | null } | null;
};

type LessonProgressRow = {
  id: string;
  completed_at: string;
  user?: NamedUser;
  lesson?: {
    title: string | null;
    section?: { course?: { title: string | null } | null } | null;
  } | null;
};

type CertificateRow = {
  id: string;
  issued_at: string;
  user?: NamedUser;
  course?: { title: string | null } | null;
};

type CommentRow = {
  id: string;
  content: string;
  created_at: string;
  user?: NamedUser;
  lesson?: { title: string | null } | null;
};

type ExamRow = {
  id: string;
  score: number;
  passed: boolean;
  attempted_at: string;
  user?: NamedUser;
  course?: { title: string | null } | null;
};

// ═══════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const { profile, isAdmin } = useAuth();

  // Anotações de dia: uma fonte só para as duas abas.
  const dayNotes = useDayNotes(!!profile && isAdmin);
  const sinaisApi = useSinaisResolvidos(!!profile && isAdmin);

  // ── Mode toggle ──
  const [mode, setMode] = useState<DashMode>("sync");

  // ── Async stats ──
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [asyncEngagement, setAsyncEngagement] = useState<{
    avgProgress: number;
    topCourses: { title: string; slug: string; watchCount: number; avgProgress: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Sync (Formação Base) stats ──
  // A janela vale para a aba inteira: cards, rankings e timeline falam do
  // mesmo recorte de tempo, então não há dois seletores concorrendo.
  const [dashPeriod, setDashPeriod] = useState<ActivityRange>("30d");
  const [formacaoStats, setFormacaoStats] = useState<{
    totalFeedbacks: number;
    avgNotaGrupo: number;
    /** Só as submissões que tinham condutor a avaliar. Ver o cálculo. */
    avgNotaCondutor: number;
    notasDeCondutor: number;
    totalRelatos: number;
    topCondutores: {
      name: string;
      avg: number;
      count: number;
      relatos: { text: string; date: string }[];
    }[];
    activityDist: { name: string; count: number }[];
    atividadesOcultas: number;
    topGroups: { name: string; avgNota: number; count: number }[];
    ratingDistribution: { rating: number; count: number }[];
  } | null>(null);
  // O quórum medido saiu daqui para /admin/grupos, junto com a faixa inteira.
  // Ele consumia um campo de nove de uma rota que varria todas as participações
  // do período, e os outros oito eram calculados e jogados fora a cada abertura
  // desta tela.

  // ── Timelines de atividade ──
  // Os eventos são carregados uma vez e recortados no cliente: trocar de
  // janela é instantâneo e não gera nova ida ao banco.
  const [syncEvents, setSyncEvents] = useState<TimelineEvent[]>([]);
  const [asyncEvents, setAsyncEvents] = useState<TimelineEvent[]>([]);
  const [asyncEventsLoading, setAsyncEventsLoading] = useState(true);
  const [asyncRange, setAsyncRange] = useState<ActivityRange>("30d");
  const [truncatedSources, setTruncatedSources] = useState<string[]>([]);
  // Tempo medido por pessoa e curso: alimenta a regra que compara permanência
  // com a duração do que foi marcado como concluído.
  const [tempoPorPessoa, setTempoPorPessoa] = useState<
    Map<string, TempoDeCurso[]>
  >(new Map());
  const [pessoaAberta, setPessoaAberta] = useState<PessoaRef | null>(null);

  // ═══════════════════════════════════════════════════════════
  // Data fetching: Async dashboard stats
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    async function fetchStats() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();

      // Cursos publicados: uma consulta só devolve a contagem e os ids
      let coursesQuery = supabase
        .from("courses")
        .select("id", { count: "exact" })
        .eq("status", "published");
      if (!isAdmin) {
        coursesQuery = coursesQuery.eq("instructor_id", profile.id);
      }
      const { data: courseIds, count: courseCount } = await coursesQuery;
      const ids = courseIds?.map((c) => c.id) || [];

      // Continua existindo mesmo tendo saído da tela: é o denominador da
      // taxa de conclusão. O que saiu foi exibi-lo como "alunos matriculados",
      // porque ele conta linhas de matrícula e não pessoas.
      let studentCount = 0;
      let certCount = 0;
      let completionRate = 0;
      let totalRevenue = 0;
      let hasRevenue = false;

      if (ids.length > 0) {
        const [
          studentsRes,
          certsRes,
          completedRes,
          paidEnrollmentsRes,
        ] = await Promise.all([
          supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .in("course_id", ids),
          supabase
            .from("certificates")
            .select("*", { count: "exact", head: true })
            .in("course_id", ids),
          supabase
            .from("enrollments")
            .select("*", { count: "exact", head: true })
            .in("course_id", ids)
            .eq("status", "completed"),
          supabase
            .from("enrollments")
            .select("course_id, courses!inner(price_cents)")
            .in("course_id", ids)
            .eq("payment_status", "paid"),
        ]);

        studentCount = studentsRes.count || 0;
        certCount = certsRes.count || 0;
        const completedCount = completedRes.count || 0;

        if (studentCount > 0) {
          completionRate = (completedCount / studentCount) * 100;
        }

        // Revenue from paid enrollments
        if (paidEnrollmentsRes.data && paidEnrollmentsRes.data.length > 0) {
          totalRevenue = (paidEnrollmentsRes.data as PaidEnrollmentRow[]).reduce(
            (sum, e) => sum + (e.courses?.price_cents || 0),
            0
          );
          hasRevenue = totalRevenue > 0;
        }

      }

      setStats({
        totalCourses: courseCount || 0,
        totalCertificates: certCount,
        completionRate,
        totalRevenue,
        hasRevenue,
      });

      setLoading(false);
    }

    fetchStats().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  // ═══════════════════════════════════════════════════════════
  // Data fetching: eventos da timeline assíncrona
  // ═══════════════════════════════════════════════════════════
  //
  // Uma passada só, sem filtro de data: o histórico inteiro da Allos cabe
  // folgado em memória e assim trocar de janela não custa ida ao banco. O teto
  // por fonte existe só para o dia em que isso deixar de ser verdade, quando
  // bater, a timeline avisa em vez de mostrar um recorte silencioso.
  // A RLS já limita o instrutor aos alunos dos cursos dele.

  useEffect(() => {
    const ROW_CAP = 2000;

    async function fetchActivity() {
      if (!profile) return;
      const supabase = createClient();
      const opts = { count: "exact" as const };

      const [signups, enrolls, lessonsDone, revs, certs, comments, exams] =
        await Promise.all([
          isAdmin
            ? supabase
                .from("profiles")
                .select("id, full_name, email, created_at", opts)
                .order("created_at", { ascending: false })
                .limit(ROW_CAP)
            : Promise.resolve({ data: [], count: 0 }),
          supabase
            .from("enrollments")
            .select(
              "id, enrolled_at, completed_at, status, user:profiles!user_id(full_name, email), course:courses!course_id(title)",
              opts
            )
            .order("enrolled_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("lesson_progress")
            .select(
              "id, completed_at, user:profiles!user_id(full_name, email), lesson:lessons!lesson_id(title, section:sections!section_id(course:courses!course_id(title)))",
              opts
            )
            .eq("completed", true)
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("reviews")
            .select(
              "id, rating, comment, created_at, user:profiles!user_id(full_name, email), course:courses!course_id(title)",
              opts
            )
            .order("created_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("certificates")
            .select(
              "id, issued_at, user:profiles!user_id(full_name, email), course:courses!course_id(title)",
              opts
            )
            .order("issued_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("lesson_comments")
            .select(
              "id, content, created_at, user:profiles!user_id(full_name, email), lesson:lessons!lesson_id(title)",
              opts
            )
            .order("created_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("exam_attempts")
            .select(
              "id, score, passed, attempted_at, user:profiles!user_id(full_name, email), course:courses!course_id(title)",
              opts
            )
            .order("attempted_at", { ascending: false })
            .limit(ROW_CAP),
        ]);

      const events: TimelineEvent[] = [];
      const capped: string[] = [];
      const flagIfCapped = (label: string, count: number | null | undefined) => {
        if ((count ?? 0) > ROW_CAP) capped.push(label);
      };

      ((signups.data ?? []) as SignupRow[]).forEach((p) => {
        events.push({
          id: `signup-${p.id}`,
          type: "signup",
          timestamp: p.created_at,
          person: p.full_name || "Sem nome",
          personEmail: p.email || undefined,
          title: "",
        });
      });
      flagIfCapped("cadastros", signups.count);

      ((enrolls.data ?? []) as unknown as EnrollmentEventRow[]).forEach((e) => {
        const person = e.user?.full_name || "Aluno";
        const personEmail = e.user?.email || undefined;
        const course = e.course?.title || "Curso";
        events.push({
          id: `enroll-${e.id}`,
          type: "enrollment",
          timestamp: e.enrolled_at,
          person,
          personEmail,
          title: course,
        });
        if (e.status === "completed" && e.completed_at) {
          events.push({
            id: `complete-${e.id}`,
            type: "completion",
            timestamp: e.completed_at,
            person,
            personEmail,
            title: course,
          });
        }
      });
      flagIfCapped("matrículas", enrolls.count);

      ((lessonsDone.data ?? []) as unknown as LessonProgressRow[]).forEach((p) => {
        events.push({
          id: `lesson-${p.id}`,
          type: "lesson",
          timestamp: p.completed_at,
          person: p.user?.full_name || "Aluno",
          personEmail: p.user?.email || undefined,
          title: p.lesson?.title?.trim() || "aula",
          detail: p.lesson?.section?.course?.title || undefined,
        });
      });
      flagIfCapped("aulas concluídas", lessonsDone.count);

      ((revs.data ?? []) as unknown as (ReviewJoinRow & { comment: string | null })[]).forEach(
        (r) => {
          events.push({
            id: `review-${r.id}`,
            type: "review",
            timestamp: r.created_at,
            person: r.user?.full_name || "Aluno",
            personEmail: r.user?.email || undefined,
            title: r.course?.title || "Curso",
            body: r.comment?.trim() || undefined,
            score: r.rating,
            scoreSuffix: "/5",
          });
        }
      );
      flagIfCapped("avaliações", revs.count);

      ((certs.data ?? []) as unknown as CertificateRow[]).forEach((c) => {
        events.push({
          id: `cert-${c.id}`,
          type: "certificate",
          timestamp: c.issued_at,
          person: c.user?.full_name || "Aluno",
          personEmail: c.user?.email || undefined,
          title: c.course?.title || "Curso",
        });
      });
      flagIfCapped("certificados", certs.count);

      ((comments.data ?? []) as unknown as CommentRow[]).forEach((c) => {
        events.push({
          id: `comment-${c.id}`,
          type: "comment",
          timestamp: c.created_at,
          person: c.user?.full_name || "Aluno",
          personEmail: c.user?.email || undefined,
          title: c.lesson?.title?.trim() || "uma aula",
          body: c.content?.trim() || undefined,
        });
      });
      flagIfCapped("comentários", comments.count);

      ((exams.data ?? []) as unknown as ExamRow[]).forEach((e) => {
        events.push({
          id: `exam-${e.id}`,
          type: "exam",
          timestamp: e.attempted_at,
          person: e.user?.full_name || "Aluno",
          personEmail: e.user?.email || undefined,
          title: e.course?.title || "Curso",
          detail: e.passed ? "Aprovado" : "Não atingiu a nota",
          score: e.score,
        });
      });
      flagIfCapped("provas", exams.count);

      events.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      setAsyncEvents(events);
      setTruncatedSources(capped);
      setAsyncEventsLoading(false);
    }

    fetchActivity().catch(() => setAsyncEventsLoading(false));
  }, [profile, isAdmin]);

  // ═══════════════════════════════════════════════════════════
  // Tempo medido por pessoa e curso
  // ═══════════════════════════════════════════════════════════
  //
  // Cruza três coisas: quanto tempo a pessoa ficou em cada curso, quantas
  // aulas marcou como concluídas e quanto dura esse conteúdo. A comparação usa
  // só o que ela concluiu, não o curso inteiro, senão quem fez metade seria
  // cobrado pela outra metade.

  useEffect(() => {
    async function fetchTempo() {
      if (!profile || !isAdmin) return;
      const sb = createClient();

      const [sessoesRes, progressoRes, aulasRes, secoesRes, cursosRes] =
        await Promise.all([
          sb
            .from("usage_sessions")
            .select("user_id, course_id, seconds")
            .not("course_id", "is", null),
          sb
            .from("lesson_progress")
            .select("user_id, lesson_id")
            .eq("completed", true),
          sb.from("lessons").select("id, section_id, duration_minutes"),
          sb.from("sections").select("id, course_id"),
          sb.from("courses").select("id, title"),
        ]);

      // tabela ainda não existe neste ambiente: a regra simplesmente não roda
      if (sessoesRes.error) return;

      type Sessao = { user_id: string; course_id: string; seconds: number };
      type Progresso = { user_id: string; lesson_id: string };
      type Aula = { id: string; section_id: string; duration_minutes: number | null };
      type Secao = { id: string; course_id: string };
      type Curso = { id: string; title: string };

      const cursoDaSecao = new Map<string, string>();
      ((secoesRes.data ?? []) as Secao[]).forEach((sec) =>
        cursoDaSecao.set(sec.id, sec.course_id)
      );
      const tituloDoCurso = new Map<string, string>();
      ((cursosRes.data ?? []) as Curso[]).forEach((c) =>
        tituloDoCurso.set(c.id, c.title)
      );
      const infoDaAula = new Map<string, { curso: string; minutos: number }>();
      ((aulasRes.data ?? []) as Aula[]).forEach((a) => {
        const curso = cursoDaSecao.get(a.section_id);
        if (curso) {
          infoDaAula.set(a.id, { curso, minutos: a.duration_minutes ?? 0 });
        }
      });

      const { data: perfis } = await sb.from("profiles").select("id, email");
      const emailPorId = new Map<string, string>();
      ((perfis ?? []) as { id: string; email: string }[]).forEach((pf) =>
        emailPorId.set(pf.id, pf.email)
      );

      // user+curso → acumulados
      const acc = new Map<
        string,
        { userId: string; courseId: string; segundos: number; aulas: number; minutos: number }
      >();
      const chave = (u: string, c: string) => u + "|" + c;

      ((sessoesRes.data ?? []) as Sessao[]).forEach((se) => {
        const k = chave(se.user_id, se.course_id);
        const atual = acc.get(k) ?? {
          userId: se.user_id,
          courseId: se.course_id,
          segundos: 0,
          aulas: 0,
          minutos: 0,
        };
        atual.segundos += se.seconds ?? 0;
        acc.set(k, atual);
      });

      ((progressoRes.data ?? []) as Progresso[]).forEach((pr) => {
        const info = infoDaAula.get(pr.lesson_id);
        if (!info) return;
        const k = chave(pr.user_id, info.curso);
        const atual = acc.get(k) ?? {
          userId: pr.user_id,
          courseId: info.curso,
          segundos: 0,
          aulas: 0,
          minutos: 0,
        };
        atual.aulas += 1;
        atual.minutos += info.minutos;
        acc.set(k, atual);
      });

      const mapa = new Map<string, TempoDeCurso[]>();
      acc.forEach((v) => {
        const email = emailPorId.get(v.userId);
        if (!email) return;
        const k = personKey({ person: email, personEmail: email });
        const lista = mapa.get(k) ?? [];
        lista.push({
          courseId: v.courseId,
          titulo: tituloDoCurso.get(v.courseId) || "Curso",
          segundos: v.segundos,
          minutosConteudoConcluido: v.minutos,
          aulasConcluidas: v.aulas,
        });
        mapa.set(k, lista);
      });

      setTempoPorPessoa(mapa);
    }

    fetchTempo().catch(() => {});
    // `asyncEvents` saiu daqui junto com o mapa `emailDoUsuario`, que era
    // construído e nunca lido. A dependência existia só por causa dele, e
    // fazia este efeito de seis consultas rodar duas vezes por carregamento.
  }, [profile, isAdmin]);

  // ── Async engagement stats ──
  useEffect(() => {
    async function fetchEngagement() {
      if (!profile) return;
      const supabase = createClient();

      // Get all lesson progress with completion data
      const { data: progress } = await supabase
        .from("lesson_progress")
        .select("user_id, lesson_id, completed")

      if (!progress || progress.length === 0) return;

      // A leitura de perfis saiu junto com o pódio de espectadores: ela
      // existia só para trocar id por nome naquela lista.
      const lessonIds = Array.from(new Set(progress.map(p => p.lesson_id)));
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, section_id")
        .in("id", lessonIds);

      if (!lessons) return;

      const sectionIds = Array.from(new Set(lessons.map(l => l.section_id)));
      const { data: sections } = await supabase
        .from("sections")
        .select("id, course_id")
        .in("id", sectionIds);

      if (!sections) return;

      const courseIds = Array.from(new Set(sections.map(s => s.course_id)));
      const [{ data: courses }, { data: allLessons }] = await Promise.all([
        supabase.from("courses").select("id, title, slug").in("id", courseIds),
        supabase.from("lessons").select("id, section_id").in("section_id", sectionIds),
      ]);

      if (!courses || !allLessons) return;

      // Build maps
      const sectionToCourse = new Map(sections.map(s => [s.id, s.course_id]));
      const lessonToSection = new Map(lessons.map(l => [l.id, l.section_id]));
      const courseMap = new Map(courses.map(c => [c.id, c]));

      // Total lessons per course
      const totalLessonsPerCourse = new Map<string, number>();
      allLessons.forEach(l => {
        const cid = sectionToCourse.get(l.section_id);
        if (cid) totalLessonsPerCourse.set(cid, (totalLessonsPerCourse.get(cid) || 0) + 1);
      });

      // Completed lessons per user per course
      const userCourseProgress = new Map<string, Map<string, number>>();
      progress.filter(p => p.completed).forEach(p => {
        const sid = lessonToSection.get(p.lesson_id);
        if (!sid) return;
        const cid = sectionToCourse.get(sid);
        if (!cid) return;
        if (!userCourseProgress.has(p.user_id)) userCourseProgress.set(p.user_id, new Map());
        const userMap = userCourseProgress.get(p.user_id)!;
        userMap.set(cid, (userMap.get(cid) || 0) + 1);
      });

      // Average progress across all user-course pairs
      let totalPct = 0, pctCount = 0;
      userCourseProgress.forEach((courseMap) => {
        courseMap.forEach((completed, cid) => {
          const total = totalLessonsPerCourse.get(cid) || 1;
          totalPct += (completed / total) * 100;
          pctCount++;
        });
      });
      const avgProgress = pctCount > 0 ? totalPct / pctCount : 0;

      // Top courses by watch count
      const courseWatchCount = new Map<string, { count: number; completedLessons: number }>();
      progress.filter(p => p.completed).forEach(p => {
        const sid = lessonToSection.get(p.lesson_id);
        if (!sid) return;
        const cid = sectionToCourse.get(sid);
        if (!cid) return;
        const e = courseWatchCount.get(cid) || { count: 0, completedLessons: 0 };
        e.count++;
        courseWatchCount.set(cid, e);
      });

      const topCourses = Array.from(courseWatchCount.entries())
        .map(([cid, d]) => {
          const c = courseMap.get(cid);
          const total = totalLessonsPerCourse.get(cid) || 1;
          // unique users who watched this course
          let uniqueUsers = 0;
          userCourseProgress.forEach((um) => { if (um.has(cid)) uniqueUsers++; });
          const avgProg = uniqueUsers > 0
            ? Array.from(userCourseProgress.values()).reduce((s, um) => s + ((um.get(cid) || 0) / total * 100), 0) / uniqueUsers
            : 0;
          return {
            title: c?.title || "?",
            slug: c?.slug || "",
            watchCount: d.count,
            avgProgress: Math.round(avgProg),
          };
        })
        .sort((a, b) => b.watchCount - a.watchCount)
        .slice(0, 5);

      // O pódio de espectadores saiu daqui: aulas assistidas e horas de
      // plataforma agora são duas das ordenações da tabela de
      // /formacao/admin/pessoas, onde a mesma pessoa aparece com o que fez nos
      // grupos e nos cursos na mesma linha.
      setAsyncEngagement({ avgProgress, topCourses });
    }
    if (profile) fetchEngagement();
  }, [profile]);

  // ═══════════════════════════════════════════════════════════
  // Data fetching: Sync (Formação Base) stats
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    async function fetchFormacaoStats() {
      if (!profile) return;
      const supabase = createClient();
      // `null` no "Tudo": sem corte inferior.
      const rangeStart = getRangeStart(dashPeriod);
      const periodStart = rangeStart ?? new Date(0);

      try {
        // Duas fontes, e de propósito. O formulário de /certificado é o que a
        // pessoa DECLARA; a captura do Meet é o que ela de fato fez na sala. A
        // regra antiga desta aba ("só o que nasce no formulário") existia
        // quando a única coisa que vinha do Meet era quórum agregado, sem
        // pessoa. Agora a presença é por pessoa e com identidade resolvida,
        // então ela é do mesmo tipo de informação que o feedback, e ver uma sem
        // a outra é o que faz alguém parecer ausente por não ter preenchido
        // formulário, ou presente por ter preenchido dois.
        // Sem filtro de data: a timeline recorta a janela sozinha e precisa do
        // histórico inteiro. Paginado porque o PostgREST corta em mil linhas
        // sem avisar, e esta é a fonte de toda a aba síncrona: um corte aqui
        // erraria feedbacks, médias, condutores e distribuição de uma vez só,
        // todos para menos e sem nenhum sintoma na tela.
        //
        // O catálogo de atividades saiu daqui junto com o ranking de horas: as
        // 19 atividades cadastradas valem 2 horas cada, então converter
        // participação em hora era multiplicar tudo por dois e chamar de outra
        // métrica.
        const allSubs = await lerTudo<SubmissionRow>(
          supabase,
          "certificado_submissions",
          "id, nome_completo, email, atividade_nome, nota_grupo, nota_condutor, condutores, relato, created_at",
        );

        const eventosDeclarados: TimelineEvent[] = allSubs.map((s) => {
          const condutores = (s.condutores || []).filter(Boolean);
          const partes = [
            condutores.length > 0 ? `com ${condutores.join(", ")}` : "",
            s.nota_condutor ? `condutor ${s.nota_condutor}/10` : "",
          ].filter(Boolean);
          return {
            id: `sub-${s.id}`,
            type: "feedback" as const,
            timestamp: s.created_at,
            person: (s.nome_completo || "Sem nome").trim(),
            personEmail: s.email || undefined,
            title: s.atividade_nome || "atividade",
            detail: partes.join(" · ") || undefined,
            body: s.relato?.trim() || undefined,
            score: s.nota_grupo ?? undefined,
            scoreSuffix: "/10",
          };
        });

        const medido = await carregarEventosDeEncontros(supabase);

        // O cruzamento acontece na própria linha do feedback, e não num
        // relatório à parte: relatório à parte ninguém abre. Quem declarou e
        // esteve ganha os minutos medidos ao lado; quem declarou num dia em que
        // o encontro FOI capturado e não aparece nele fica marcado. Sem captura
        // daquele encontro, nada é afirmado.
        const eventosSincronos = anotarPresencaMedida(
          [...eventosDeclarados, ...medido.eventos],
          medido
        );

        // A timeline recorta a janela sozinha, então recebe o histórico inteiro.
        setSyncEvents(
          eventosSincronos.sort(
            (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        );

        // Filter submissions by period
        const subs = allSubs.filter(
          (s) => new Date(s.created_at) >= periodStart
        );

        const total = subs.length;

        // Feedback sem nota fica fora do numerador E do denominador. Somar
        // zero e dividir por todo mundo é a receita de uma média que cai
        // sozinha toda vez que alguém pula a pergunta.
        const notasG = subs.map((x) => x.nota_grupo).filter((n): n is number => n != null);
        const avgG = notasG.length ? notasG.reduce((a, x) => a + x, 0) / notasG.length : 0;

        // A nota do condutor só conta quando havia condutor a avaliar.
        //
        // Quando a atividade é evento sem condutor, o formulário público grava
        // 5 fixo em `nota_condutor`. São 66 linhas assim, e a prova é que TODAS
        // as 66 submissões sem condutor listado têm nota exatamente 5, contra
        // uma única entre as 402 que têm condutor. Sem este filtro a média sai
        // 9,07 onde a real é 9,74, e o painel subestima os condutores em dois
        // terços de ponto por causa de uma pergunta que nunca foi feita. O
        // filtro é por `condutores` vazio, e não por nota maior que zero: cinco
        // é um valor válido da escala, então testar o valor deixaria as 66
        // linhas passarem inteiras.
        const notasC = subs
          .filter((x) => (x.condutores ?? []).filter(Boolean).length > 0)
          .map((x) => x.nota_condutor)
          .filter((n): n is number => n != null);
        const avgC = notasC.length ? notasC.reduce((a, x) => a + x, 0) / notasC.length : 0;

        const totalRelatos = subs.filter(
          (s) => s.relato && s.relato.trim().length > 0
        ).length;

        // Conductor ranking with relatos
        const cMap = new Map<
          string,
          {
            sum: number;
            count: number;
            relatos: { text: string; date: string }[];
          }
        >();
        // Este laço já era imune ao 5 fixo, porque só entra quem tem nome no
        // array de condutores. Fica registrado para ninguém "consertar" depois.
        subs.forEach((x) => {
          (x.condutores || []).forEach((c: string) => {
            const e = cMap.get(c) || { sum: 0, count: 0, relatos: [] };
            e.sum += x.nota_condutor || 0;
            e.count++;
            if (x.relato && x.relato.trim().length > 0) {
              e.relatos.push({ text: x.relato, date: x.created_at });
            }
            cMap.set(c, e);
          });
        });
        // Por volume, não por nota.
        //
        // Ordenar por média fazia quem tem uma avaliação nota 10 passar na
        // frente de quem tem quarenta avaliações nota 9,8. Com 21 condutores
        // entre 9,14 e 10, a ordem por nota é decidida por ruído, e o rodapé
        // que prometia "pondera nota e volume" descrevia um cálculo que não
        // existia: o volume era só critério de desempate.
        const topC = Array.from(cMap.entries())
          .map(([name, d]) => ({
            name,
            avg: d.count > 0 ? d.sum / d.count : 0,
            count: d.count,
            relatos: d.relatos,
          }))
          .sort((a, b) => b.count - a.count || b.relatos.length - a.relatos.length)
          .slice(0, 10);

        // O ranking de participantes saiu daqui e virou a tabela ordenável de
        // /formacao/admin/pessoas. Ele era pódio de cinco por horas, e como
        // todas as 19 atividades cadastradas valem 2 horas, "por horas" era
        // "por participações" com outra escala. Lá a mesma pessoa aparece uma
        // vez só, com frequência, relatos, aulas, fala no grupo e recência na
        // mesma linha, que é o que serve para decidir com quem conversar.

        // Distribuição por atividade
        const actMap = new Map<string, number>();
        subs.forEach((s) => {
          const name = s.atividade_nome || "Sem nome";
          actMap.set(name, (actMap.get(name) || 0) + 1);
        });
        const activityDistTodas = Array.from(actMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);
        // Doze é onde a lista ainda cabe na tela. Sem corte ela cresce com o
        // catálogo e o card vira rolagem infinita de nomes com uma linha cada.
        const activityDist = activityDistTodas.slice(0, 12);
        const atividadesOcultas = activityDistTodas.length - activityDist.length;

        // A faixa de pessoas saiu daqui inteira: quantas pessoas diferentes,
        // vezes por pessoa, quem veio pela primeira vez, ativas em 30 dias,
        // sumiram e retenção. Ela vive em /formacao/admin/pessoas, onde a
        // unidade é a pessoa e presença conta os dois lados, formulário e sala.
        //
        // Três desses seis números eram calculados sobre janela fixa de trinta
        // dias e ficavam lado a lado com números que obedeciam ao seletor,
        // sem nada na tela dizendo qual era qual. E dois deles, "sumiram" e
        // "retenção", tinham no denominador todo mundo que já participou:
        // ninguém sai desse conjunto, então a conta só podia piorar para
        // sempre. Quem responde a essa pergunta hoje é o retorno por coorte de
        // estreia, que compara cada turma com ela mesma.

        // Group rankings by avg nota_grupo
        const groupNotaMap = new Map<
          string,
          { sum: number; count: number }
        >();
        subs.forEach((s) => {
          const name = s.atividade_nome || "Sem nome";
          const e = groupNotaMap.get(name) || { sum: 0, count: 0 };
          e.sum += s.nota_grupo || 0;
          e.count++;
          groupNotaMap.set(name, e);
        });
        const topGroups = Array.from(groupNotaMap.entries())
          .map(([name, d]) => ({
            name,
            avgNota: d.count > 0 ? d.sum / d.count : 0,
            count: d.count,
          }))
          .sort((a, b) => b.avgNota - a.avgNota)
          .slice(0, 5);

        // Rating distribution (nota_grupo 1-10)
        const ratingDistribution: { rating: number; count: number }[] = [];
        for (let r = 1; r <= 10; r++) {
          ratingDistribution.push({
            rating: r,
            count: subs.filter(
              (s) => Math.round(s.nota_grupo || 0) === r
            ).length,
          });
        }

        // A distribuição da nota do condutor saiu da tela. Ela desenhava uma
        // barra de 67 casos no valor 5 que se lia como insatisfação, e nenhum
        // desses 67 era avaliação ruim: são eventos sem condutor, onde o
        // formulário grava 5 fixo. O gráfico mostrava a ausência de uma
        // pergunta como se fosse uma resposta.
        //
        // A retenção mensal saiu junto, por outro motivo. Ela era o último
        // lugar do arquivo que agrupava pessoa por nome digitado, enquanto os
        // cards logo acima agrupavam por e-mail, então os dois mediam
        // populações diferentes na mesma tela. Quem mudava a forma de assinar
        // virava duas pessoas, uma que apareceu e uma que sumiu, e o churn
        // subia sozinho. O retorno por coorte de estreia, em
        // /formacao/admin/pessoas, responde à mesma pergunta comparando cada
        // turma com ela mesma.

        setFormacaoStats({
          totalFeedbacks: total,
          avgNotaGrupo: avgG,
          avgNotaCondutor: avgC,
          totalRelatos,
          notasDeCondutor: notasC.length,
          topCondutores: topC,
          activityDist,
          atividadesOcultas,
          topGroups,
          ratingDistribution,
        });
      } catch (e) {
        // Sem isto o erro some e a aba fica em "Carregando..." para sempre,
        // sem nada no console: o modo de falha mais caro que existe, porque
        // ninguém sabe se está lento ou quebrado.
        console.error("[dashboard/sincrona]", e);
      }
    }

    fetchFormacaoStats();
  }, [profile, dashPeriod]);

  // ═══════════════════════════════════════════════════════════
  // CSV Export (sync mode)
  // ═══════════════════════════════════════════════════════════

  const exportCSV = () => {
    if (!formacaoStats) return;
    const lines: string[] = [];
    lines.push("=== RESUMO GERAL ===");
    lines.push(`Período,${RANGE_LABELS[dashPeriod]}`);
    lines.push(`Total Feedbacks,${formacaoStats.totalFeedbacks}`);
    lines.push(
      `Nota Média Grupo,${formacaoStats.avgNotaGrupo.toFixed(1)}`
    );
    lines.push(
      `Nota Média Condutor,${formacaoStats.avgNotaCondutor.toFixed(1)}`
    );
    lines.push(`Total Relatos,${formacaoStats.totalRelatos}`);
    lines.push(`Notas de condutor consideradas,${formacaoStats.notasDeCondutor}`);
    lines.push("");
    lines.push("=== CONDUTORES ===");
    lines.push("Nome,Nota Média,Avaliações");
    formacaoStats.topCondutores.forEach((c) =>
      lines.push(`${c.name},${c.avg.toFixed(1)},${c.count}`)
    );
    lines.push("");
    lines.push("=== DISTRIBUIÇÃO POR ATIVIDADE ===");
    lines.push("Atividade,Quantidade");
    formacaoStats.activityDist.forEach((a) =>
      lines.push(`${a.name},${a.count}`)
    );
    lines.push("");
    lines.push("=== GRUPOS POR AVALIAÇÃO ===");
    lines.push("Grupo,Nota Média,Sessões");
    formacaoStats.topGroups.forEach((g) =>
      lines.push(`${g.name},${g.avgNota.toFixed(1)},${g.count}`)
    );
    lines.push("");
    lines.push("=== DISTRIBUIÇÃO NOTAS GRUPO (1-10) ===");
    lines.push("Nota,Quantidade");
    formacaoStats.ratingDistribution.forEach((r) =>
      lines.push(`${r.rating},${r.count}`)
    );
    lines.push("");
    lines.push("O que é por pessoa sai no CSV de /formacao/admin/pessoas,");
    lines.push("onde a mesma gente aparece uma vez só.");
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formacao_dados_${dashPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sinaisSync = useMemo(
    () => separarSinais(detectarSinais(syncEvents), sinaisApi.porSinal),
    [syncEvents, sinaisApi.porSinal]
  );
  const sinaisAsync = useMemo(
    () =>
      separarSinais(
        detectarSinais(asyncEvents, { tempoPorPessoa }),
        sinaisApi.porSinal
      ),
    [asyncEvents, sinaisApi.porSinal, tempoPorPessoa]
  );

  // ═══════════════════════════════════════════════════════════
  // Derived values
  // ═══════════════════════════════════════════════════════════

  // ═══════════════════════════════════════════════════════════
  // Loading state
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-8">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div>
      {/* ── Greeting ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          {getGreeting()}, {profile?.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-cream/35 mt-1 font-dm">
          Aqui está o resumo da sua plataforma.
        </p>
      </motion.div>

      {/* ── Mode Toggle ── */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex flex-wrap gap-2 mb-8"
      >
        {(
          [
            { key: "sync", label: "Formação Síncrona" },
            { key: "async", label: "Formação Assíncrona" },
          ] as const
        ).map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            className="font-dm text-sm px-5 py-2 rounded-full transition-all duration-200"
            style={{
              backgroundColor:
                mode === m.key
                  ? "rgba(200,75,49,0.15)"
                  : "rgba(255,255,255,0.03)",
              color:
                mode === m.key ? "#C84B31" : "rgba(253,251,247,0.4)",
              border: `1px solid ${
                mode === m.key
                  ? "rgba(200,75,49,0.35)"
                  : "rgba(255,255,255,0.06)"
              }`,
            }}
          >
            {m.label}
          </button>
        ))}
      </motion.div>

      {/* ════════════════════════════════════════════════════════
          SÍNCRONA MODE
         ════════════════════════════════════════════════════════ */}
      {mode === "sync" && (
        <motion.div
          key="sync"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Period selector + Export */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex flex-wrap gap-2">
              {JANELAS_PAINEL.map((p) => (
                <button
                  key={p}
                  onClick={() => setDashPeriod(p)}
                  className="font-dm text-xs px-3 py-1.5 rounded-full transition-all"
                  style={{
                    backgroundColor:
                      dashPeriod === p
                        ? "rgba(200,75,49,0.12)"
                        : "rgba(255,255,255,0.03)",
                    color:
                      dashPeriod === p
                        ? "#C84B31"
                        : "rgba(253,251,247,0.4)",
                    border: `1px solid ${
                      dashPeriod === p
                        ? "rgba(200,75,49,0.3)"
                        : "rgba(255,255,255,0.06)"
                    }`,
                  }}
                >
                  {RANGE_LABELS[p]}
                </button>
              ))}
            </div>
            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 font-dm text-xs px-3 py-1.5 rounded-full transition-all hover:bg-white/[.05]"
              style={{
                color: "rgba(253,251,247,0.5)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              Exportar dados (CSV)
            </button>
          </div>

          {formacaoStats ? (
            <>
              {/* ── Números do período, em duas faixas densas ── */}
              <StatStrip
                title="Avaliações"
                delay={0.1}
                items={[
                  {
                    label: "Feedbacks",
                    value: String(formacaoStats.totalFeedbacks),
                    hint: "Formulários de certificação enviados na janela escolhida.",
                  },
                  // "Nota do grupo" foi para /admin/grupos e "Nota dos condutores"
                  // para /admin/condutores. As duas eram médias sobre o
                  // formulário, que pega cerca de metade de quem esteve na sala e
                  // não por sorteio, então elas precisam aparecer ao lado da
                  // cobertura para poderem ser lidas. Aqui não havia esse lado.
                  {
                    label: "Com relato escrito",
                    value:
                      formacaoStats.totalFeedbacks > 0
                        ? `${Math.round(
                            (formacaoStats.totalRelatos /
                              formacaoStats.totalFeedbacks) *
                              100
                          )}%`
                        : "0%",
                    sub: `${formacaoStats.totalRelatos} de ${formacaoStats.totalFeedbacks}`,
                    color: "#D4854A",
                  },
                ]}
              />

              <div className="h-3" />

              {/* ── Ponte para a tela de Pessoas ──
                  Aqui havia seis números sobre pessoas, e eles saíram inteiros.
                  Repetir número é pior que não ter: as duas telas contavam com
                  chaves diferentes e mostravam totais que não fechavam, sem
                  nada explicando por quê. Esta faixa não traz número nenhum de
                  propósito, só a porta. */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
              >
                <Link
                  href="/formacao/admin/pessoas"
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3.5 rounded-[14px] transition-colors hover:bg-white/[.04]"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <Users
                      className="h-4 w-4 mt-0.5 flex-shrink-0"
                      style={{ color: "#C84B31" }}
                    />
                    <div>
                      <p className="font-dm text-sm text-cream/80">Pessoas</p>
                      <p className="font-dm text-[11px] text-cream/35 mt-0.5 leading-relaxed">
                        Núcleo ativo, quem sumiu, retorno da estreia, o processo seletivo
                        e a lista inteira com a mesma gente aparecendo uma vez só.
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-dm text-xs whitespace-nowrap self-start sm:self-center"
                    style={{ color: "#C84B31" }}
                  >
                    Abrir
                  </span>
                </Link>
              </motion.div>

              {/* ── As portas ──
                  Os oito números de quórum que ficavam aqui foram para
                  /admin/grupos, e o de fala do condutor para /admin/condutores.
                  Sete deles eram sobre grupo e um sobre condutor, e nenhum era
                  "informação geral": para serem lidos precisavam da tendência e
                  da cobertura ao lado, que esta tela não tinha onde pôr.

                  No lugar entram caminhos, sem número. Número repetido em duas
                  telas é pior que número em uma só, porque as duas divergem e
                  ninguém sabe qual está certa. */}
              <div className="h-5" />
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="grid gap-3 sm:grid-cols-2"
              >
                {[
                  {
                    href: "/formacao/admin/grupos",
                    titulo: "Grupos",
                    texto:
                      "Quórum por grupo, tendência, quem sumiu, quem não fala e se o problema é o horário.",
                  },
                  {
                    href: "/formacao/admin/condutores",
                    titulo: "Condutores",
                    texto:
                      "Os feedbacks de cada um, o quórum dos grupos dele e quanto ele fala na sala.",
                  },
                ].map((p) => (
                  <Link
                    key={p.href}
                    href={p.href}
                    className="block p-5 rounded-[16px] transition-colors hover:bg-white/[0.05]"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <p className="font-fraunces font-semibold text-cream text-base">
                      {p.titulo}
                    </p>
                    <p className="font-dm text-xs text-cream/40 mt-1 leading-relaxed">
                      {p.texto}
                    </p>
                  </Link>
                ))}
              </motion.div>

              <div className="h-5" />

              <EmailsEnviados />

              <SinaisAtencao abertos={sinaisSync.abertos} avisados={sinaisSync.avisados} arquivados={sinaisSync.arquivados} api={sinaisApi} onPersonClick={setPessoaAberta} />

              {/* ── Atividade recente (feedbacks do /certificado) ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.4 }}
                className="mb-6"
              >
                <ActivityTimeline
                  events={syncEvents}
                  range={dashPeriod}
                  onRangeChange={setDashPeriod}
                  hideRangeSelector
                  accent="#C84B31"
                  csvName="atividade_certificado"
                  notes={dayNotes}
                  onPersonClick={setPessoaAberta}
                  subtitle="Cada feedback enviado no formulário de certificação, do mais recente para o mais antigo. A janela é a mesma escolhida no topo da aba."
                />
              </motion.div>

            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-sm text-cream/30 font-dm">
                Carregando dados da formação síncrona...
              </p>
            </div>
          )}
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════
          ASSÍNCRONA MODE
         ════════════════════════════════════════════════════════ */}
      {mode === "async" && (
        <motion.div
          key="async"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          {/* Números gerais dos cursos, em faixa única */}
          {stats && (
            <>
              <StatStrip
                title="Cursos"
                accent="#2E9E8F"
                delay={0.1}
                items={[
                  { label: "Cursos publicados", value: String(stats.totalCourses) },
                  {
                    label: "Certificados emitidos",
                    value: String(stats.totalCertificates),
                  },
                  {
                    label: "Taxa de conclusão",
                    value: stats.completionRate
                      ? `${stats.completionRate.toFixed(1)}%`
                      : "\u2014",
                    hint: "Matrículas concluídas sobre o total de matrículas. Quem estuda e nunca clica em concluir não aparece aqui, então este número está por baixo do que de fato acontece.",
                  },
                  ...(stats.hasRevenue
                    ? [
                        {
                          label: "Receita total",
                          value: formatPrice(stats.totalRevenue),
                          color: "#22C55E",
                        },
                      ]
                    : []),
                ]}
              />

              <div className="h-5" />

              {/*
                Dois blocos saíram daqui.

                "Alunos matriculados" contava linhas de matrícula e chamava de
                alunos: são 526 matrículas para 272 pessoas, porque quem cria
                conta se matricula em vários cursos de uma vez. "Rating médio"
                exibia a média de oito avaliações em trinta e seis cursos ao
                lado de números de centenas.

                E o alerta de alunos inativos, que contava matrícula sem
                conclusão com mais de trinta dias: como quase toda matrícula
                está nessa condição por construção, ele disparava sempre, e um
                alerta que dispara sempre não é alerta. Quem responde a essa
                pergunta agora é o recorte "só na plataforma" em
                /formacao/admin/pessoas, que conta pessoa e olha tempo de tela
                em vez de conclusão.
              */}

              <EmailsEnviados />

              <SinaisAtencao abertos={sinaisAsync.abertos} avisados={sinaisAsync.avisados} arquivados={sinaisAsync.arquivados} api={sinaisApi} onPersonClick={setPessoaAberta} />

              {/* ── Atividade recente (movimento nos cursos) ── */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                className="mb-8"
              >
                <ActivityTimeline
                  events={asyncEvents}
                  range={asyncRange}
                  onRangeChange={setAsyncRange}
                  loading={asyncEventsLoading}
                  accent="#2E9E8F"
                  csvName="atividade_cursos"
                  notes={dayNotes}
                  onPersonClick={setPessoaAberta}
                  truncated={truncatedSources}
                  subtitle="Quem chegou, quem assistiu e o que concluiu. Troque a janela para virar relatório do dia, da semana ou do histórico inteiro."
                />
              </motion.div>

              {/* Engagement stats */}
              {asyncEngagement && (
                <div className="space-y-5">
                  {/* Avg progress card */}
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6, duration: 0.4 }}>
                    <Card>
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-[10px] flex items-center justify-center" style={{ background: "rgba(46,158,143,0.1)" }}>
                          <BarChart3 className="h-5 w-5" style={{ color: "#2E9E8F" }} />
                        </div>
                        <div>
                          <p className="font-fraunces font-bold text-xl text-cream">
                            <span style={{ color: "#2E9E8F" }}>{asyncEngagement.avgProgress.toFixed(0)}%</span>
                          </p>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[11px] font-dm text-cream/40">Progresso medio dos alunos nos cursos</p>
                            <HintButton text="Porcentagem media de conclusao considerando todos os alunos matriculados em todos os cursos." />
                          </div>
                        </div>
                      </div>
                      <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(asyncEngagement.avgProgress, 100)}%` }}
                          transition={{ duration: 1, delay: 0.8 }}
                          className="h-full rounded-full" style={{ background: "#2E9E8F" }} />
                      </div>
                    </Card>
                  </motion.div>

                  {/* O ranking "Quem mais assiste" saiu daqui: era o segundo
                      pódio de pessoas do painel, e a mesma gente aparecia com
                      um número aqui e outro no ranking síncrono, porque as
                      duas listas usavam chaves de identidade diferentes. Agora
                      a pessoa está em /formacao/admin/pessoas, uma linha só,
                      com aulas e horas de plataforma entre os critérios de
                      ordenação. */}
                  <div className="grid grid-cols-1 gap-5">
                    {/* Top courses */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.4 }}>
                      <Card>
                        <div className="flex items-center gap-2 mb-4">
                          <Flame className="h-4 w-4" style={{ color: "#C84B31" }} />
                          <h3 className="font-dm text-sm font-semibold text-cream/70">Cursos mais assistidos</h3>
                        </div>
                        {asyncEngagement.topCourses.length > 0 ? (
                          <div className="space-y-3">
                            {asyncEngagement.topCourses.map((course, i) => {
                              const medals = ["#C84B31", "rgba(253,251,247,0.5)", "rgba(200,75,49,0.6)"];
                              const isMedal = i < 3;
                              const maxWatch = asyncEngagement.topCourses[0]?.watchCount || 1;
                              return (
                                <div key={course.slug} className="space-y-1">
                                  <div className="flex items-center gap-3">
                                    <span className="font-fraunces font-bold text-sm w-5 text-center" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.2)" }}>{i + 1}</span>
                                    <span className="font-dm text-xs flex-1 text-cream/70 truncate">{course.title}</span>
                                    <span className="font-dm text-[10px] text-cream/30">{course.watchCount} aulas</span>
                                    <span className="font-dm text-[10px] font-semibold" style={{ color: "#2E9E8F" }}>{course.avgProgress}%</span>
                                  </div>
                                  <div className="ml-8 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${(course.watchCount / maxWatch) * 100}%`, background: isMedal ? medals[i] : "rgba(253,251,247,0.15)", opacity: isMedal ? 0.6 : 0.3 }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <p className="text-xs text-cream/30 text-center py-4">Nenhum dado.</p>
                        )}
                      </Card>
                    </motion.div>

                  </div>
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {profile && <AdminNotesSection userId={profile.id} />}

      <PessoaModal
        pessoa={pessoaAberta}
        onClose={() => setPessoaAberta(null)}
        onEmailEnviado={(sinais) => sinaisApi.marcarEmailEnviado(sinais)}
      />
    </div>
  );
}
