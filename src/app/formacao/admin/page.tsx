// Dashboard admin — landing page do /admin. Dois modos lado a lado:
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

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDayNotes } from "@/hooks/useDayNotes";
import { formatPrice } from "@/lib/utils/format";
import {
  getGreeting,
  type DashMode,
} from "@/lib/utils/dashboard";
import {
  ACTIVITY_RANGES,
  RANGE_LABELS,
  getRangeStart,
  type ActivityRange,
  type TimelineEvent,
} from "@/lib/utils/activity";
import StatStrip from "@/components/admin/dashboard/StatStrip";
import HintButton from "@/components/admin/dashboard/HintButton";
import RankingCard from "@/components/admin/dashboard/RankingCard";
import ActivityTimeline from "@/components/admin/dashboard/ActivityTimeline";
import AdminNotesSection from "@/components/admin/dashboard/AdminNotesSection";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  Award,
  Star,
  UserX,
  TrendingUp,
  Trophy,
  Activity,
  BarChart3,
  Flame,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface DashboardStats {
  totalCourses: number;
  totalStudents: number;
  totalCertificates: number;
  avgRating: number;
  completionRate: number;
  totalRevenue: number;
  hasRevenue: boolean;
  inactiveStudents: number;
}

// ─── Tipos locais pras queries Supabase ─────────────────────────────────
// Subset dos campos das tabelas que essa página realmente lê.
type SubmissionRow = {
  id: string;
  created_at: string;
  nome_completo: string | null;
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
  user?: { full_name: string | null } | null;
  course?: { title: string | null } | null;
};

type PaidEnrollmentRow = { courses?: { price_cents: number | null } | null };

type AtividadeRow = { nome: string; carga_horaria: number };

// ─── Fontes da timeline assíncrona ──────────────────────────────────────
type NamedUser = { full_name: string | null } | null;

type SignupRow = { id: string; full_name: string | null; created_at: string };

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

  // ── Mode toggle ──
  const [mode, setMode] = useState<DashMode>("sync");

  // ── Async stats ──
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [asyncEngagement, setAsyncEngagement] = useState<{
    avgProgress: number;
    topCourses: { title: string; slug: string; watchCount: number; avgProgress: number }[];
    topViewers: { name: string; lessonsWatched: number; hoursWatched: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Sync (Formação Base) stats ──
  // A janela vale para a aba inteira: cards, rankings e timeline falam do
  // mesmo recorte de tempo, então não há dois seletores concorrendo.
  const [dashPeriod, setDashPeriod] = useState<ActivityRange>("30d");
  const [formacaoStats, setFormacaoStats] = useState<{
    totalFeedbacks: number;
    avgNotaGrupo: number;
    avgNotaCondutor: number;
    totalRelatos: number;
    topCondutores: {
      name: string;
      avg: number;
      count: number;
      relatos: { text: string; date: string }[];
    }[];
    topParticipantes: { nome: string; horas: number; count: number }[];
    activityDist: { name: string; count: number }[];
    avgFrequencyPerStudent: number;
    uniqueParticipants: number;
    activeStudents: number;
    inactiveStudents: number;
    retentionRate: number;
    newStudentsThisPeriod: number;
    topGroups: { name: string; avgNota: number; count: number }[];
    ratingDistribution: { rating: number; count: number }[];
    conductorRatingDist: { rating: number; count: number }[];
    retentionByMonth: { month: string; active: number; churned: number }[];
  } | null>(null);
  const [selectedCondutor, setSelectedCondutor] = useState<string | null>(null);

  // ── Timelines de atividade ──
  // Os eventos são carregados uma vez e recortados no cliente: trocar de
  // janela é instantâneo e não gera nova ida ao banco.
  const [syncEvents, setSyncEvents] = useState<TimelineEvent[]>([]);
  const [asyncEvents, setAsyncEvents] = useState<TimelineEvent[]>([]);
  const [asyncEventsLoading, setAsyncEventsLoading] = useState(true);
  const [asyncRange, setAsyncRange] = useState<ActivityRange>("30d");
  const [truncatedSources, setTruncatedSources] = useState<string[]>([]);

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

      // Published courses — single query that gives us both the count and the ids
      let coursesQuery = supabase
        .from("courses")
        .select("id", { count: "exact" })
        .eq("status", "published");
      if (!isAdmin) {
        coursesQuery = coursesQuery.eq("instructor_id", profile.id);
      }
      const { data: courseIds, count: courseCount } = await coursesQuery;
      const ids = courseIds?.map((c) => c.id) || [];

      let studentCount = 0;
      let certCount = 0;
      let avgRating = 0;
      let completionRate = 0;
      let totalRevenue = 0;
      let hasRevenue = false;
      let inactiveStudents = 0;

      if (ids.length > 0) {
        const [
          studentsRes,
          certsRes,
          reviewsRes,
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
          supabase.from("reviews").select("rating").in("course_id", ids),
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

        if (reviewsRes.data && reviewsRes.data.length > 0) {
          avgRating =
            reviewsRes.data.reduce((sum, r) => sum + r.rating, 0) /
            reviewsRes.data.length;
        }

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

        // Inactive students: enrolled > 30 days ago, not completed
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const { count: inactiveCount } = await supabase
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .in("course_id", ids)
          .neq("status", "completed")
          .lt("enrolled_at", thirtyDaysAgo.toISOString());
        inactiveStudents = inactiveCount || 0;
      }

      setStats({
        totalCourses: courseCount || 0,
        totalStudents: studentCount,
        totalCertificates: certCount,
        avgRating,
        completionRate,
        totalRevenue,
        hasRevenue,
        inactiveStudents,
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
  // por fonte existe só para o dia em que isso deixar de ser verdade — quando
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
                .select("id, full_name, created_at", opts)
                .order("created_at", { ascending: false })
                .limit(ROW_CAP)
            : Promise.resolve({ data: [], count: 0 }),
          supabase
            .from("enrollments")
            .select(
              "id, enrolled_at, completed_at, status, user:profiles!user_id(full_name), course:courses!course_id(title)",
              opts
            )
            .order("enrolled_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("lesson_progress")
            .select(
              "id, completed_at, user:profiles!user_id(full_name), lesson:lessons!lesson_id(title, section:sections!section_id(course:courses!course_id(title)))",
              opts
            )
            .eq("completed", true)
            .not("completed_at", "is", null)
            .order("completed_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("reviews")
            .select(
              "id, rating, comment, created_at, user:profiles!user_id(full_name), course:courses!course_id(title)",
              opts
            )
            .order("created_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("certificates")
            .select(
              "id, issued_at, user:profiles!user_id(full_name), course:courses!course_id(title)",
              opts
            )
            .order("issued_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("lesson_comments")
            .select(
              "id, content, created_at, user:profiles!user_id(full_name), lesson:lessons!lesson_id(title)",
              opts
            )
            .order("created_at", { ascending: false })
            .limit(ROW_CAP),
          supabase
            .from("exam_attempts")
            .select(
              "id, score, passed, attempted_at, user:profiles!user_id(full_name), course:courses!course_id(title)",
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
          title: "",
        });
      });
      flagIfCapped("cadastros", signups.count);

      ((enrolls.data ?? []) as unknown as EnrollmentEventRow[]).forEach((e) => {
        const person = e.user?.full_name || "Aluno";
        const course = e.course?.title || "Curso";
        events.push({
          id: `enroll-${e.id}`,
          type: "enrollment",
          timestamp: e.enrolled_at,
          person,
          title: course,
        });
        if (e.status === "completed" && e.completed_at) {
          events.push({
            id: `complete-${e.id}`,
            type: "completion",
            timestamp: e.completed_at,
            person,
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

      // Lessons + profiles em paralelo (ambos só dependem de progress).
      const lessonIds = Array.from(new Set(progress.map(p => p.lesson_id)));
      const userIdsForProgress = Array.from(new Set(progress.map(p => p.user_id)));
      const [{ data: lessons }, { data: profilesData }] = await Promise.all([
        supabase
          .from("lessons")
          .select("id, section_id, duration_minutes")
          .in("id", lessonIds),
        supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIdsForProgress),
      ]);

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
      const lessonDuration = new Map(lessons.map(l => [l.id, l.duration_minutes || 0]));
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

      // Top viewers (users) — profiles já buscado em paralelo lá em cima.
      const nameMap = new Map((profilesData || []).map(p => [p.id, p.full_name]));

      const userStats = new Map<string, { lessonsWatched: number; minutes: number }>();
      progress.filter(p => p.completed).forEach(p => {
        const e = userStats.get(p.user_id) || { lessonsWatched: 0, minutes: 0 };
        e.lessonsWatched++;
        e.minutes += lessonDuration.get(p.lesson_id) || 0;
        userStats.set(p.user_id, e);
      });

      const topViewers = Array.from(userStats.entries())
        .map(([uid, d]) => ({
          name: nameMap.get(uid) || "?",
          lessonsWatched: d.lessonsWatched,
          hoursWatched: Math.round(d.minutes / 60 * 10) / 10,
        }))
        .sort((a, b) => b.lessonsWatched - a.lessonsWatched)
        .slice(0, 5);

      setAsyncEngagement({ avgProgress, topCourses, topViewers });
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
        // Só o que nasce no formulário de /certificado alimenta esta aba.
        const [subsRes, atividadesRes] = await Promise.all([
          // submissions stay unfiltered here — the inactive/retention math
          // below needs the full participant history to detect first/last
          // appearance per person.
          supabase
            .from("certificado_submissions")
            .select(
              "id, nome_completo, atividade_nome, nota_grupo, nota_condutor, condutores, relato, created_at"
            ),
          supabase
            .from("certificado_atividades")
            .select("nome, carga_horaria"),
        ]);

        const allSubs = (subsRes.data ?? []) as SubmissionRow[];
        const atividades = (atividadesRes.data ?? []) as AtividadeRow[];

        // A timeline recorta a janela sozinha, então recebe o histórico inteiro.
        setSyncEvents(
          allSubs
            .map((s) => {
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
                title: s.atividade_nome || "atividade",
                detail: partes.join(" · ") || undefined,
                body: s.relato?.trim() || undefined,
                score: s.nota_grupo ?? undefined,
                scoreSuffix: "/10",
              };
            })
            .sort(
              (a, b) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            )
        );

        // Filter submissions by period
        const subs = allSubs.filter(
          (s) => new Date(s.created_at) >= periodStart
        );

        const total = subs.length;
        const avgG =
          total > 0
            ? subs.reduce((a, x) => a + (x.nota_grupo || 0), 0) / total
            : 0;
        const avgC =
          total > 0
            ? subs.reduce((a, x) => a + (x.nota_condutor || 0), 0) / total
            : 0;
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
        const topC = Array.from(cMap.entries())
          .map(([name, d]) => ({
            name,
            avg: d.count > 0 ? d.sum / d.count : 0,
            count: d.count,
            relatos: d.relatos,
          }))
          .sort((a, b) => b.avg - a.avg || b.count - a.count)
          .slice(0, 10);

        // Participant ranking (hours)
        const horasMap = new Map<string, number>();
        atividades.forEach((a) =>
          horasMap.set(a.nome.toLowerCase(), a.carga_horaria)
        );
        const pMap = new Map<string, { count: number; horas: number }>();
        subs.forEach((s) => {
          const nome = (s.nome_completo || "").trim();
          if (!nome) return;
          const e = pMap.get(nome) || { count: 0, horas: 0 };
          e.count++;
          e.horas += horasMap.get(s.atividade_nome?.toLowerCase() || "") || 2;
          pMap.set(nome, e);
        });
        const topP = Array.from(pMap.entries())
          .map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
          .sort((a, b) => b.horas - a.horas || b.count - a.count)
          .slice(0, 5);

        // Activity distribution
        const actMap = new Map<string, number>();
        subs.forEach((s) => {
          const name = s.atividade_nome || "Sem nome";
          actMap.set(name, (actMap.get(name) || 0) + 1);
        });
        const activityDist = Array.from(actMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Unique participants in period
        const uniqueNames = new Set<string>();
        subs.forEach((s) => {
          const nome = (s.nome_completo || "").trim();
          if (nome) uniqueNames.add(nome.toLowerCase());
        });
        const uniqueParticipants = uniqueNames.size;

        const avgFrequencyPerStudent =
          uniqueParticipants > 0 ? total / uniqueParticipants : 0;

        // Active vs inactive (based on ALL submissions)
        const thirtyDaysAgoDate = new Date();
        thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);

        const allParticipantDates = new Map<
          string,
          { first: Date; last: Date }
        >();
        allSubs.forEach((s) => {
          const nome = (s.nome_completo || "").trim().toLowerCase();
          if (!nome) return;
          const d = new Date(s.created_at);
          const existing = allParticipantDates.get(nome);
          if (!existing) {
            allParticipantDates.set(nome, { first: d, last: d });
          } else {
            if (d < existing.first) existing.first = d;
            if (d > existing.last) existing.last = d;
          }
        });

        let activeStudents = 0;
        let inactiveFormacaoStudents = 0;
        let newStudentsThisPeriod = 0;

        allParticipantDates.forEach((dates) => {
          if (dates.last >= thirtyDaysAgoDate) {
            activeStudents++;
          } else {
            inactiveFormacaoStudents++;
          }
          if (dates.first >= periodStart) {
            newStudentsThisPeriod++;
          }
        });

        const retentionRate =
          activeStudents + inactiveFormacaoStudents > 0
            ? (activeStudents /
                (activeStudents + inactiveFormacaoStudents)) *
              100
            : 0;

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

        // Conductor rating distribution (nota_condutor 1-10)
        const conductorRatingDist: { rating: number; count: number }[] = [];
        for (let r = 1; r <= 10; r++) {
          conductorRatingDist.push({
            rating: r,
            count: subs.filter(
              (s) => Math.round(s.nota_condutor || 0) === r
            ).length,
          });
        }

        // Retention by month (last 6 months)
        const retentionByMonth: {
          month: string;
          active: number;
          churned: number;
        }[] = [];
        const now = new Date();
        for (let i = 5; i >= 0; i--) {
          const monthStart = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            1
          );
          const monthEnd = new Date(
            now.getFullYear(),
            now.getMonth() - i + 1,
            0,
            23,
            59,
            59
          );
          const prevMonthStart = new Date(
            now.getFullYear(),
            now.getMonth() - i - 1,
            1
          );
          const prevMonthEnd = new Date(
            now.getFullYear(),
            now.getMonth() - i,
            0,
            23,
            59,
            59
          );

          const activeInMonth = new Set<string>();
          const activeInPrev = new Set<string>();

          allSubs.forEach((s) => {
            const nome = (s.nome_completo || "").trim().toLowerCase();
            if (!nome) return;
            const d = new Date(s.created_at);
            if (d >= monthStart && d <= monthEnd) activeInMonth.add(nome);
            if (d >= prevMonthStart && d <= prevMonthEnd)
              activeInPrev.add(nome);
          });

          let churned = 0;
          activeInPrev.forEach((nome) => {
            if (!activeInMonth.has(nome)) churned++;
          });

          const monthLabel = monthStart.toLocaleDateString("pt-BR", {
            month: "short",
            year: "2-digit",
          });
          retentionByMonth.push({
            month: monthLabel,
            active: activeInMonth.size,
            churned,
          });
        }

        setFormacaoStats({
          totalFeedbacks: total,
          avgNotaGrupo: avgG,
          avgNotaCondutor: avgC,
          totalRelatos,
          topCondutores: topC,
          topParticipantes: topP,
          activityDist,
          avgFrequencyPerStudent,
          uniqueParticipants,
          activeStudents,
          inactiveStudents: inactiveFormacaoStudents,
          retentionRate,
          newStudentsThisPeriod,
          topGroups,
          ratingDistribution,
          conductorRatingDist,
          retentionByMonth,
        });
      } catch {
        // Formação tables may not exist yet
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
    lines.push(
      `Participantes Únicos,${formacaoStats.uniqueParticipants}`
    );
    lines.push(`Ativos (30d),${formacaoStats.activeStudents}`);
    lines.push(`Inativos,${formacaoStats.inactiveStudents}`);
    lines.push(
      `Taxa de Retenção,${formacaoStats.retentionRate.toFixed(0)}%`
    );
    lines.push("");
    lines.push("=== RANKING CONDUTORES ===");
    lines.push("Nome,Nota Média,Avaliações");
    formacaoStats.topCondutores.forEach((c) =>
      lines.push(`${c.name},${c.avg.toFixed(1)},${c.count}`)
    );
    lines.push("");
    lines.push("=== TOP PARTICIPANTES ===");
    lines.push("Nome,Horas,Participações");
    formacaoStats.topParticipantes.forEach((p) =>
      lines.push(`${p.nome},${p.horas},${p.count}`)
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
    lines.push("=== DISTRIBUIÇÃO NOTAS CONDUTOR (1-10) ===");
    lines.push("Nota,Quantidade");
    formacaoStats.conductorRatingDist.forEach((r) =>
      lines.push(`${r.rating},${r.count}`)
    );
    lines.push("");
    lines.push("=== RETENÇÃO MENSAL ===");
    lines.push("Mês,Ativos,Inativos");
    formacaoStats.retentionByMonth.forEach((r) =>
      lines.push(`${r.month},${r.active},${r.churned}`)
    );
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `formacao_dados_${dashPeriod}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ═══════════════════════════════════════════════════════════
  // Derived values
  // ═══════════════════════════════════════════════════════════

  const selectedCondutorData = selectedCondutor
    ? formacaoStats?.topCondutores.find((c) => c.name === selectedCondutor)
    : null;

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
              {ACTIVITY_RANGES.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setDashPeriod(p);
                    setSelectedCondutor(null);
                  }}
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
                  {
                    label: "Nota do grupo",
                    value: formacaoStats.avgNotaGrupo.toFixed(1),
                    suffix: "/10",
                  },
                  {
                    label: "Nota dos condutores",
                    value: formacaoStats.avgNotaCondutor.toFixed(1),
                    suffix: "/10",
                    color: "#2E9E8F",
                  },
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

              <StatStrip
                title="Pessoas"
                delay={0.16}
                items={[
                  {
                    label: "Pessoas diferentes",
                    value: String(formacaoStats.uniqueParticipants),
                    hint: "Total de pessoas únicas que participaram de pelo menos um grupo no período.",
                  },
                  {
                    label: "Vezes por pessoa",
                    value: formacaoStats.avgFrequencyPerStudent.toFixed(1) + "x",
                    hint: "Em média, quantas vezes cada pessoa participou de grupos no período (presenças / participantes únicos).",
                    color: "#D4854A",
                  },
                  {
                    label: "Primeira vez",
                    value: String(formacaoStats.newStudentsThisPeriod),
                    hint: "Pessoas que apareceram pela primeira vez nos grupos síncronos durante este período.",
                    color: "#22C55E",
                  },
                  {
                    label: "Ativas (30 dias)",
                    value: String(formacaoStats.activeStudents),
                    hint: "Pessoas que enviaram pelo menos 1 feedback nos últimos 30 dias.",
                    color: "#22C55E",
                  },
                  {
                    label: "Sumiram",
                    value: String(formacaoStats.inactiveStudents),
                    hint: "Pessoas que já participaram antes mas não aparecem há mais de 30 dias.",
                    color: "#EF4444",
                  },
                  {
                    label: "Retenção",
                    value: formacaoStats.retentionRate.toFixed(0) + "%",
                    hint: "Participantes ativos nos últimos 30 dias sobre o total histórico.",
                    color:
                      formacaoStats.retentionRate > 70
                        ? "#22C55E"
                        : formacaoStats.retentionRate > 40
                          ? "#F59E0B"
                          : "#EF4444",
                  },
                ]}
              />

              <div className="h-5" />

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
                  subtitle="Cada feedback enviado no formulário de certificação, do mais recente para o mais antigo. A janela é a mesma escolhida no topo da aba."
                />
              </motion.div>

              {/* ── Rankings: Condutores + Participantes + Activity Dist ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {/* Left: Conductor ranking */}
                <div className="space-y-4">
                  {!selectedCondutor ? (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8, duration: 0.4 }}
                    >
                      <Card>
                        <div className="flex items-center gap-2 mb-3">
                          <TrendingUp
                            className="h-4 w-4"
                            style={{ color: "#C84B31" }}
                          />
                          <h3 className="font-dm text-sm font-semibold text-cream/70">
                            Ranking Condutores
                          </h3>
                        </div>
                        {formacaoStats.topCondutores.length > 0 ? (
                          <div className="space-y-0.5">
                            {formacaoStats.topCondutores.map((c, i) => (
                              <button
                                key={c.name}
                                onClick={() =>
                                  setSelectedCondutor(c.name)
                                }
                                className="flex items-center gap-3 py-2 px-2 w-full text-left rounded-[8px] hover:bg-white/[.03] transition-colors duration-150"
                              >
                                <span
                                  className="font-dm text-sm font-bold w-5 text-center"
                                  style={{
                                    color:
                                      i < 3
                                        ? "#C84B31"
                                        : "rgba(253,251,247,0.3)",
                                  }}
                                >
                                  {i + 1}
                                </span>
                                <span className="font-dm text-sm flex-1 text-cream/70 truncate">
                                  {c.name}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Star
                                    className="h-3 w-3"
                                    fill="#C84B31"
                                    stroke="#C84B31"
                                  />
                                  <span
                                    className="font-dm text-sm font-bold"
                                    style={{ color: "#C84B31" }}
                                  >
                                    {c.avg.toFixed(1)}
                                  </span>
                                </div>
                                <span
                                  className="font-dm text-xs px-1.5 py-0.5 rounded-full"
                                  style={{
                                    backgroundColor:
                                      "rgba(255,255,255,0.04)",
                                    color: "rgba(253,251,247,0.4)",
                                  }}
                                >
                                  {c.count}x
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-cream/30 text-center py-4">
                            Nenhum condutor no período.
                          </p>
                        )}
                        <p className="text-[10px] text-cream/20 mt-3 font-dm text-center">
                          Ranking pondera nota e volume
                        </p>
                      </Card>
                    </motion.div>
                  ) : (
                    /* Conductor detail view */
                    <motion.div
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card>
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="font-fraunces font-bold text-base text-cream">
                              {selectedCondutor}
                            </h3>
                            {selectedCondutorData && (
                              <div className="flex items-center gap-3 mt-1">
                                <div className="flex items-center gap-1">
                                  <Star
                                    className="h-3 w-3"
                                    fill="#C84B31"
                                    stroke="#C84B31"
                                  />
                                  <span
                                    className="font-dm text-sm font-bold"
                                    style={{ color: "#C84B31" }}
                                  >
                                    {selectedCondutorData.avg.toFixed(1)}
                                  </span>
                                  <span className="text-xs text-cream/30">
                                    /10
                                  </span>
                                </div>
                                <span className="text-xs text-cream/40 font-dm">
                                  {selectedCondutorData.count} feedback
                                  {selectedCondutorData.count !== 1
                                    ? "s"
                                    : ""}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedCondutor(null)}
                            className="font-dm text-xs px-3 py-1.5 rounded-full transition-all hover:bg-white/[.05]"
                            style={{
                              color: "rgba(253,251,247,0.5)",
                              border:
                                "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            Voltar
                          </button>
                        </div>

                        {selectedCondutorData &&
                        selectedCondutorData.relatos.length > 0 ? (
                          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                            {selectedCondutorData.relatos.map(
                              (r, i) => (
                                <div
                                  key={i}
                                  className="px-3 py-2.5 rounded-[10px]"
                                  style={{
                                    background:
                                      "rgba(255,255,255,0.02)",
                                    border:
                                      "1px solid rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <p className="font-dm text-xs text-cream/60 leading-relaxed italic">
                                    &ldquo;{r.text}&rdquo;
                                  </p>
                                  <p className="font-dm text-[10px] text-cream/20 mt-1.5">
                                    {new Date(
                                      r.date
                                    ).toLocaleDateString("pt-BR")}
                                  </p>
                                </div>
                              )
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-cream/30 text-center py-6">
                            Nenhum relato para este condutor.
                          </p>
                        )}
                      </Card>
                    </motion.div>
                  )}
                </div>

                {/* Right: Participant ranking + Activity distribution */}
                <div className="space-y-4">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.85, duration: 0.4 }}
                  >
                    <RankingCard
                      period={dashPeriod}
                      initialData={formacaoStats.topParticipantes}
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9, duration: 0.4 }}
                  >
                    <Card>
                      <div className="flex items-center gap-2 mb-3">
                        <Award
                          className="h-4 w-4"
                          style={{ color: "#2E9E8F" }}
                        />
                        <h3 className="font-dm text-sm font-semibold text-cream/70">
                          Distribuição por Atividade
                        </h3>
                      </div>
                      {formacaoStats.activityDist.length > 0 ? (
                        <div className="space-y-2.5">
                          {formacaoStats.activityDist.map((act) => {
                            const totalAct =
                              formacaoStats.activityDist.reduce(
                                (s, a) => s + a.count,
                                0
                              );
                            const pct =
                              totalAct > 0
                                ? (act.count / totalAct) * 100
                                : 0;
                            return (
                              <div key={act.name}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-dm text-xs text-cream/60 truncate flex-1 mr-2">
                                    {act.name}
                                  </span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <span className="font-dm text-xs font-bold text-cream/50 tabular-nums">
                                      {act.count}
                                    </span>
                                    <span className="font-dm text-[10px] text-cream/25 tabular-nums w-10 text-right">
                                      {pct.toFixed(0)}%
                                    </span>
                                  </div>
                                </div>
                                <div
                                  className="h-1.5 rounded-full overflow-hidden"
                                  style={{
                                    background:
                                      "rgba(255,255,255,0.04)",
                                  }}
                                >
                                  <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                      width: `${pct}%`,
                                      background:
                                        "rgba(46,158,143,0.5)",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-cream/30 text-center py-4">
                          Nenhuma atividade no período.
                        </p>
                      )}
                    </Card>
                  </motion.div>
                </div>
              </div>

              {/* ── Groups: Top by rating + Top by participation ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.95, duration: 0.4 }}
                >
                  <Card>
                    <div className="flex items-center gap-2 mb-3">
                      <Star
                        className="h-4 w-4"
                        style={{ color: "#C84B31" }}
                      />
                      <h3 className="font-fraunces text-sm font-bold text-cream/70">
                        Grupos mais bem avaliados
                      </h3>
                    </div>
                    {formacaoStats.topGroups.length > 0 ? (
                      <div className="space-y-2">
                        {formacaoStats.topGroups.map((g, i) => (
                          <div
                            key={g.name}
                            className="flex items-center gap-3 py-1.5 px-2 rounded-[8px] hover:bg-white/[.02] transition-colors"
                          >
                            <span
                              className="font-dm text-sm font-bold w-5 text-center"
                              style={{
                                color:
                                  i < 3
                                    ? "#C84B31"
                                    : "rgba(253,251,247,0.3)",
                              }}
                            >
                              {i + 1}
                            </span>
                            <span className="font-dm text-sm flex-1 text-cream/70 truncate">
                              {g.name}
                            </span>
                            <div className="flex items-center gap-1">
                              <Star
                                className="h-3 w-3"
                                fill="#C84B31"
                                stroke="#C84B31"
                              />
                              <span
                                className="font-fraunces font-bold text-sm"
                                style={{ color: "#C84B31" }}
                              >
                                {g.avgNota.toFixed(1)}
                              </span>
                            </div>
                            <span className="font-dm text-xs text-cream/30">
                              {g.count}x
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-cream/30 text-center py-4">
                        Sem dados
                      </p>
                    )}
                  </Card>
                </motion.div>

              </div>

              {/* ── Rating distributions ── */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.05, duration: 0.4 }}
                >
                  <Card>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3
                        className="h-4 w-4"
                        style={{ color: "#C84B31" }}
                      />
                      <h3 className="font-fraunces text-sm font-bold text-cream/70">
                        Distribuição Nota Grupo
                      </h3>
                    </div>
                    {(() => {
                      const maxRatingCount = Math.max(
                        ...formacaoStats.ratingDistribution.map(
                          (r) => r.count
                        ),
                        1
                      );
                      return formacaoStats.ratingDistribution.some(
                        (r) => r.count > 0
                      ) ? (
                        <div className="space-y-1.5">
                          {formacaoStats.ratingDistribution.map(
                            (r) => {
                              const barWidth =
                                maxRatingCount > 0
                                  ? (r.count / maxRatingCount) * 100
                                  : 0;
                              const hue =
                                ((r.rating - 1) / 9) * 120;
                              const barColor = `hsl(${hue}, 70%, 50%)`;
                              return (
                                <div
                                  key={r.rating}
                                  className="flex items-center gap-2"
                                >
                                  <span className="font-fraunces font-bold text-xs text-cream/50 w-5 text-right tabular-nums">
                                    {r.rating}
                                  </span>
                                  <div
                                    className="flex-1 h-4 rounded overflow-hidden"
                                    style={{
                                      background:
                                        "rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    <div
                                      className="h-full rounded transition-all duration-500"
                                      style={{
                                        width: `${barWidth}%`,
                                        background: barColor,
                                        opacity: 0.7,
                                      }}
                                    />
                                  </div>
                                  <span className="font-dm text-[10px] text-cream/30 w-6 text-right tabular-nums">
                                    {r.count}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-cream/30 text-center py-4">
                          Sem dados
                        </p>
                      );
                    })()}
                  </Card>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                >
                  <Card>
                    <div className="flex items-center gap-2 mb-3">
                      <BarChart3
                        className="h-4 w-4"
                        style={{ color: "#2E9E8F" }}
                      />
                      <h3 className="font-fraunces text-sm font-bold text-cream/70">
                        Distribuição Nota Condutores
                      </h3>
                    </div>
                    {(() => {
                      const maxRatingCount = Math.max(
                        ...formacaoStats.conductorRatingDist.map(
                          (r) => r.count
                        ),
                        1
                      );
                      return formacaoStats.conductorRatingDist.some(
                        (r) => r.count > 0
                      ) ? (
                        <div className="space-y-1.5">
                          {formacaoStats.conductorRatingDist.map(
                            (r) => {
                              const barWidth =
                                maxRatingCount > 0
                                  ? (r.count / maxRatingCount) * 100
                                  : 0;
                              const hue =
                                ((r.rating - 1) / 9) * 120;
                              const barColor = `hsl(${hue}, 70%, 50%)`;
                              return (
                                <div
                                  key={r.rating}
                                  className="flex items-center gap-2"
                                >
                                  <span className="font-fraunces font-bold text-xs text-cream/50 w-5 text-right tabular-nums">
                                    {r.rating}
                                  </span>
                                  <div
                                    className="flex-1 h-4 rounded overflow-hidden"
                                    style={{
                                      background:
                                        "rgba(255,255,255,0.04)",
                                    }}
                                  >
                                    <div
                                      className="h-full rounded transition-all duration-500"
                                      style={{
                                        width: `${barWidth}%`,
                                        background: barColor,
                                        opacity: 0.7,
                                      }}
                                    />
                                  </div>
                                  <span className="font-dm text-[10px] text-cream/30 w-6 text-right tabular-nums">
                                    {r.count}
                                  </span>
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-cream/30 text-center py-4">
                          Sem dados
                        </p>
                      );
                    })()}
                  </Card>
                </motion.div>
              </div>

              {/* ── Retention trend ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2, duration: 0.4 }}
                className="mb-6"
              >
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Activity
                      className="h-4 w-4"
                      style={{ color: "#2E9E8F" }}
                    />
                    <h3 className="font-fraunces text-sm font-bold text-cream/70">
                      Retenção mensal
                    </h3>
                  </div>
                  {formacaoStats.retentionByMonth.length > 0 &&
                  formacaoStats.retentionByMonth.some(
                    (m) => m.active > 0 || m.churned > 0
                  )
                    ? (() => {
                        const maxVal = Math.max(
                          ...formacaoStats.retentionByMonth.map((m) =>
                            Math.max(m.active, m.churned)
                          ),
                          1
                        );
                        return (
                          <div className="space-y-3">
                            {/* sem items-end: ele tira a altura das colunas e
                                as barras percentuais colapsam no min-h */}
                            <div className="flex gap-3 h-36">
                              {formacaoStats.retentionByMonth.map(
                                (m) => {
                                  const activeH =
                                    maxVal > 0
                                      ? (m.active / maxVal) * 100
                                      : 0;
                                  const churnedH =
                                    maxVal > 0
                                      ? (m.churned / maxVal) * 100
                                      : 0;
                                  return (
                                    <div
                                      key={m.month}
                                      className="flex-1 flex flex-col items-center justify-end gap-1"
                                    >
                                      <div
                                        className="flex items-end gap-0.5 w-full justify-center"
                                        style={{ height: "100%" }}
                                      >
                                        <div
                                          className="flex flex-col items-center justify-end flex-1"
                                          style={{ height: "100%" }}
                                        >
                                          <div
                                            className="w-full rounded-t-md min-h-[5px] transition-all duration-500"
                                            style={{
                                              height: `${Math.max(activeH, 6)}%`,
                                              background:
                                                "linear-gradient(180deg, rgba(34,197,94,0.95) 0%, rgba(34,197,94,0.55) 100%)",
                                              boxShadow:
                                                "0 0 8px rgba(34,197,94,0.25)",
                                            }}
                                          />
                                        </div>
                                        <div
                                          className="flex flex-col items-center justify-end flex-1"
                                          style={{ height: "100%" }}
                                        >
                                          <div
                                            className="w-full rounded-t-md min-h-[5px] transition-all duration-500"
                                            style={{
                                              height: `${Math.max(churnedH, 6)}%`,
                                              background:
                                                "linear-gradient(180deg, rgba(239,68,68,0.85) 0%, rgba(239,68,68,0.45) 100%)",
                                              boxShadow:
                                                "0 0 8px rgba(239,68,68,0.2)",
                                            }}
                                          />
                                        </div>
                                      </div>
                                      <span className="text-[8px] text-cream/30 font-dm mt-1 whitespace-nowrap">
                                        {m.month}
                                      </span>
                                    </div>
                                  );
                                }
                              )}
                            </div>
                            <div className="flex items-center justify-center gap-6">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm"
                                  style={{
                                    background:
                                      "rgba(34,197,94,0.5)",
                                  }}
                                />
                                <span className="font-dm text-[10px] text-cream/40">
                                  Ativos
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm"
                                  style={{
                                    background:
                                      "rgba(239,68,68,0.4)",
                                  }}
                                />
                                <span className="font-dm text-[10px] text-cream/40">
                                  Saíram
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })()
                    : (
                      <p className="text-xs text-cream/30 text-center py-6">
                        Sem dados
                      </p>
                    )}
                </Card>
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
                  { label: "Alunos matriculados", value: String(stats.totalStudents) },
                  {
                    label: "Certificados emitidos",
                    value: String(stats.totalCertificates),
                  },
                  {
                    label: "Rating médio",
                    value: stats.avgRating ? stats.avgRating.toFixed(1) : "\u2014",
                    suffix: stats.avgRating ? "/5" : undefined,
                    color: "#F59E0B",
                  },
                  {
                    label: "Taxa de conclusão",
                    value: stats.completionRate
                      ? `${stats.completionRate.toFixed(1)}%`
                      : "\u2014",
                    hint: "Matrículas concluídas sobre o total de matrículas.",
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

              {/* Inactive students alert */}
              {stats.inactiveStudents > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.55, duration: 0.5 }}
                  className="mb-8"
                >
                  <div
                    className="flex items-center gap-3 px-5 py-3.5 rounded-[12px]"
                    style={{
                      background: "rgba(251,191,36,0.06)",
                      border: "1px solid rgba(251,191,36,0.15)",
                    }}
                  >
                    <UserX
                      className="h-5 w-5 flex-shrink-0"
                      style={{ color: "#F59E0B" }}
                    />
                    <div>
                      <p className="text-sm font-dm text-cream">
                        <span className="font-semibold">
                          {stats.inactiveStudents}
                        </span>{" "}
                        aluno
                        {stats.inactiveStudents !== 1 ? "s" : ""}{" "}
                        inativo
                        {stats.inactiveStudents !== 1 ? "s" : ""}
                      </p>
                      <p className="text-xs text-cream/35 mt-0.5">
                        Matriculados há mais de 30 dias sem concluir o
                        curso.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

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

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
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

                    {/* Top viewers */}
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75, duration: 0.4 }}>
                      <Card>
                        <div className="flex items-center gap-2 mb-4">
                          <Trophy className="h-4 w-4" style={{ color: "#D4854A" }} />
                          <h3 className="font-dm text-sm font-semibold text-cream/70">Quem mais assiste</h3>
                        </div>
                        {asyncEngagement.topViewers.length > 0 ? (
                          <div className="space-y-3">
                            {asyncEngagement.topViewers.map((viewer, i) => {
                              const medals = ["#D4854A", "rgba(253,251,247,0.5)", "rgba(212,133,74,0.6)"];
                              const isMedal = i < 3;
                              const maxLessons = asyncEngagement.topViewers[0]?.lessonsWatched || 1;
                              return (
                                <div key={viewer.name} className="space-y-1">
                                  <div className="flex items-center gap-3">
                                    <span className="font-fraunces font-bold text-sm w-5 text-center" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.2)" }}>{i + 1}</span>
                                    <span className="font-dm text-xs flex-1 text-cream/70 truncate">{viewer.name.split(" ").slice(0, 2).join(" ")}</span>
                                    <span className="font-dm text-[10px] text-cream/30">{viewer.lessonsWatched} aulas</span>
                                    <span className="font-dm text-[10px] font-semibold" style={{ color: "#D4854A" }}>{viewer.hoursWatched}h</span>
                                  </div>
                                  <div className="ml-8 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                                    <div className="h-full rounded-full" style={{ width: `${(viewer.lessonsWatched / maxLessons) * 100}%`, background: isMedal ? medals[i] : "rgba(253,251,247,0.15)", opacity: isMedal ? 0.6 : 0.3 }} />
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
    </div>
  );
}
