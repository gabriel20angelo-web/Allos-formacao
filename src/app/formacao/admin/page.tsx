"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BookOpen,
  Users,
  Award,
  Star,
  CheckCircle,
  DollarSign,
  UserX,
  GraduationCap,
  MessageSquare,
  Clock,
  FileText,
  TrendingUp,
  Trophy,
  Calendar,
  Activity,
  BarChart3,
  Flame,
  StickyNote,
  Plus,
  Trash2,
  Save,
  X,
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

interface ActivityEvent {
  id: string;
  type: "enrollment" | "completion" | "review";
  userName: string;
  courseTitle: string;
  rating?: number;
  timestamp: string;
}

interface AdminNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

type DashMode = "sync" | "async";
type DashPeriod = "week" | "month" | "quarter" | "semester" | "year";

const PERIOD_LABELS: Record<DashPeriod, string> = {
  week: "Semana",
  month: "Mês",
  quarter: "Trimestre",
  semester: "Semestre",
  year: "Ano",
};

// ═══════════════════════════════════════════════════════════════
// Utility functions
// ═══════════════════════════════════════════════════════════════

function getPeriodDate(p: DashPeriod): Date {
  const now = new Date();
  switch (p) {
    case "week": {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case "quarter":
      return new Date(
        now.getFullYear(),
        Math.floor(now.getMonth() / 3) * 3,
        1
      );
    case "semester":
      return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
    case "year":
      return new Date(now.getFullYear(), 0, 1);
  }
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function relativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return "há 1 dia";
  if (diffD < 30) return `há ${diffD} dias`;
  return `há ${Math.floor(diffD / 30)} mês${Math.floor(diffD / 30) > 1 ? "es" : ""}`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

// ═══════════════════════════════════════════════════════════════
// AdminRankingCard sub-component
// ═══════════════════════════════════════════════════════════════

function AdminRankingCard({
  period,
  initialData,
}: {
  period: string;
  initialData: { nome: string; horas: number; count: number }[];
}) {
  type RType = "all" | "sync" | "async";
  const labels: Record<RType, string> = {
    all: "Geral",
    sync: "Síncronos",
    async: "Assíncronos",
  };
  const [type, setType] = useState<RType>("all");
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (type === "all") {
      setData(initialData);
      return;
    }
    fetch(`/formacao/api/ranking?period=${period}&type=${type}&_t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d);
      })
      .catch(() => setData([]));
  }, [type, period, initialData]);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4" style={{ color: "#FBBC05" }} />
        <h3 className="font-dm text-sm font-semibold text-cream/70">
          Top Participantes
        </h3>
        <div className="flex gap-1 ml-auto">
          {(Object.keys(labels) as RType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="font-dm text-[9px] px-2 py-0.5 rounded-full transition-all"
              style={{
                backgroundColor:
                  type === t ? "rgba(46,158,143,0.12)" : "transparent",
                color:
                  type === t ? "#2E9E8F" : "rgba(253,251,247,0.25)",
              }}
            >
              {labels[t]}
            </button>
          ))}
        </div>
      </div>
      {data.length > 0 ? (
        <div className="space-y-2">
          {data.map((p, i) => {
            const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];
            const isMedal = i < 3;
            const maxHoras = data[0]?.horas || 1;
            const barWidth = (p.horas / maxHoras) * 100;
            return (
              <div key={p.nome} className="space-y-1">
                <div className="flex items-center gap-3">
                  <span
                    className="font-dm text-sm font-bold w-5 text-center"
                    style={{
                      color: isMedal
                        ? medals[i]
                        : "rgba(253,251,247,0.3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-dm text-sm flex-1 text-cream/70 truncate">
                    {p.nome}
                  </span>
                  <span
                    className="font-fraunces font-bold text-sm"
                    style={{
                      color: isMedal
                        ? medals[i]
                        : "rgba(253,251,247,0.4)",
                    }}
                  >
                    {p.horas}h
                  </span>
                  <span className="font-dm text-[10px] text-cream/25">
                    {p.count}x
                  </span>
                </div>
                <div
                  className="ml-8 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: isMedal
                        ? medals[i]
                        : "rgba(253,251,247,0.15)",
                      opacity: isMedal ? 0.6 : 0.3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-cream/30 text-center py-4">
          Nenhum participante no período.
        </p>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// StatCard helper
// ═══════════════════════════════════════════════════════════════

function HintButton({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setShow(!show); }}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold transition-colors"
        style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,251,247,0.3)" }}
      >?</button>
      {show && (
        <div
          className="absolute z-50 bottom-6 left-1/2 -translate-x-1/2 w-52 px-3 py-2 rounded-lg text-[11px] font-dm leading-relaxed"
          style={{ background: "#222", border: "1px solid #444", color: "rgba(253,251,247,0.7)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
        >
          {text}
          <button onClick={() => setShow(false)} className="absolute top-1 right-1.5 text-cream/30 hover:text-cream text-[10px]">x</button>
        </div>
      )}
    </span>
  );
}

function StatCard({
  card,
  delay,
}: {
  card: {
    label: string;
    value: string;
    suffix?: string;
    subtitle?: string;
    hint?: string;
    icon: any;
    iconColor: string;
    iconBg: string;
    trend?: number;
  };
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: card.iconBg }}
          >
            <card.icon
              className="h-5 w-5"
              style={{ color: card.iconColor }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-fraunces font-bold text-xl text-cream tabular-nums">
                <span style={{ color: card.iconColor }}>{card.value}</span>
                {card.suffix && (
                  <span className="text-sm text-cream/30">{card.suffix}</span>
                )}
              </p>
              {card.trend !== undefined && card.trend !== 0 && (
                <span
                  className="font-dm text-[10px] font-semibold"
                  style={{
                    color: card.trend > 0 ? "#00b894" : "#e74c3c",
                  }}
                >
                  {card.trend > 0 ? "+" : ""}
                  {card.trend.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-dm text-cream/40">{card.label}</p>
              {card.hint && <HintButton text={card.hint} />}
            </div>
            {card.subtitle && (
              <p className="text-[10px] font-dm text-cream/25">
                {card.subtitle}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MiniBarChart helper
// ═══════════════════════════════════════════════════════════════

function MiniBarChart({
  data,
  color,
  height = "h-28",
  labelInterval,
}: {
  data: { date: string; count: number }[];
  color: string;
  height?: string;
  labelInterval?: number;
}) {
  if (data.length === 0) return null;
  const maxCount = Math.max(...data.map((e) => e.count), 1);
  const interval = labelInterval || Math.max(1, Math.floor(data.length / 6));

  return (
    <div className={`flex items-end gap-1 ${height}`}>
      {data.map((item, idx) => {
        const h = maxCount > 0 ? (item.count / maxCount) * 100 : 0;
        const dateLabel = item.date.split("-").slice(1).join("/");
        return (
          <div
            key={item.date}
            className="flex-1 flex flex-col items-center justify-end group relative"
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
              <div
                className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                style={{
                  background: "rgba(30,30,30,0.95)",
                  border: `1px solid ${color}33`,
                }}
              >
                {item.count} &middot; {dateLabel}
              </div>
            </div>
            <div
              className="w-full rounded-t-md min-h-[4px] transition-all duration-200"
              style={{
                height: `${Math.max(h, 8)}%`,
                background: `linear-gradient(180deg, ${color}cc 0%, ${color}66 100%)`,
                boxShadow: `0 0 6px ${color}22`,
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = `linear-gradient(180deg, ${color} 0%, ${color}aa 100%)`)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = `linear-gradient(180deg, ${color}cc 0%, ${color}66 100%)`)
              }
            />
            {idx % interval === 0 && (
              <span className="text-[8px] text-cream/20 mt-1 font-dm">
                {dateLabel}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════

export default function AdminDashboard() {
  const { profile, isAdmin } = useAuth();

  // ── Mode toggle ──
  const [mode, setMode] = useState<DashMode>("sync");

  // ── Async stats ──
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<
    { date: string; count: number }[]
  >([]);
  const [completionTrend, setCompletionTrend] = useState<
    { date: string; count: number }[]
  >([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [asyncEngagement, setAsyncEngagement] = useState<{
    avgProgress: number;
    topCourses: { title: string; slug: string; watchCount: number; avgProgress: number }[];
    topViewers: { name: string; lessonsWatched: number; hoursWatched: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // ── Sync (Formação Base) stats ──
  const [dashPeriod, setDashPeriod] = useState<DashPeriod>("month");
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
    enrollmentTrend: { date: string; count: number }[];
    submissionsTrend: { date: string; count: number }[];
    activityDist: { name: string; count: number }[];
    totalSessions: number;
    avgParticipantsPerSession: number;
    avgFrequencyPerStudent: number;
    uniqueParticipants: number;
    activeStudents: number;
    inactiveStudents: number;
    retentionRate: number;
    newStudentsThisPeriod: number;
    topGroups: { name: string; avgNota: number; count: number }[];
    topGroupsByParticipation: { name: string; count: number }[];
    ratingDistribution: { rating: number; count: number }[];
    conductorRatingDist: { rating: number; count: number }[];
    heatmapData: { dia: number; hora: string; count: number }[];
    retentionByMonth: { month: string; active: number; churned: number }[];
  } | null>(null);
  const [selectedCondutor, setSelectedCondutor] = useState<string | null>(null);

  // ── Meet quorum stats ──
  const [quorumStats, setQuorumStats] = useState<{
    gruposEstaSemana: number;
    mediaEstaSemana: number;
    picoEstaSemana: number;
    participantesUnicos: number;
    tendencia: number;
  } | null>(null);

  // ── Admin Notes ──
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [notesLoading, setNotesLoading] = useState(false);

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
          totalRevenue = paidEnrollmentsRes.data.reduce((sum, e: any) => {
            const price = e.courses?.price_cents || 0;
            return sum + price;
          }, 0);
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

      // Enrollment chart + completion trend + activity feed
      if (ids.length > 0) {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const [
          enrollmentsRes,
          completionsRes,
          recentEnrollFeed,
          recentReviewsFeed,
        ] = await Promise.all([
          supabase
            .from("enrollments")
            .select("enrolled_at")
            .in("course_id", ids)
            .gte("enrolled_at", thirtyDaysAgo.toISOString())
            .order("enrolled_at"),
          supabase
            .from("enrollments")
            .select("completed_at")
            .in("course_id", ids)
            .eq("status", "completed")
            .not("completed_at", "is", null)
            .gte("completed_at", thirtyDaysAgo.toISOString())
            .order("completed_at"),
          supabase
            .from("enrollments")
            .select(
              "id, enrolled_at, status, completed_at, user:profiles!user_id(full_name), course:courses!course_id(title)"
            )
            .in("course_id", ids)
            .order("enrolled_at", { ascending: false })
            .limit(40),
          supabase
            .from("reviews")
            .select(
              "id, rating, created_at, user:profiles!user_id(full_name), course:courses!course_id(title)"
            )
            .in("course_id", ids)
            .order("created_at", { ascending: false })
            .limit(15),
        ]);

        // Enrollment chart data
        if (enrollmentsRes.data) {
          const byDay: Record<string, number> = {};
          enrollmentsRes.data.forEach((e) => {
            const day = e.enrolled_at.split("T")[0];
            byDay[day] = (byDay[day] || 0) + 1;
          });
          setRecentEnrollments(
            Object.entries(byDay).map(([date, count]) => ({ date, count }))
          );
        }

        // Completion trend data
        if (completionsRes.data) {
          const byDay: Record<string, number> = {};
          completionsRes.data.forEach((e: any) => {
            if (e.completed_at) {
              const day = e.completed_at.split("T")[0];
              byDay[day] = (byDay[day] || 0) + 1;
            }
          });
          setCompletionTrend(
            Object.entries(byDay).map(([date, count]) => ({ date, count }))
          );
        }

        // Build activity feed
        const events: ActivityEvent[] = [];

        if (recentEnrollFeed.data) {
          recentEnrollFeed.data.forEach((e: any) => {
            const userName = e.user?.full_name || "Aluno";
            const courseTitle = e.course?.title || "Curso";

            events.push({
              id: `enroll-${e.id}`,
              type: "enrollment",
              userName,
              courseTitle,
              timestamp: e.enrolled_at,
            });

            if (e.status === "completed" && e.completed_at) {
              events.push({
                id: `complete-${e.id}`,
                type: "completion",
                userName,
                courseTitle,
                timestamp: e.completed_at,
              });
            }
          });
        }

        if (recentReviewsFeed.data) {
          recentReviewsFeed.data.forEach((r: any) => {
            events.push({
              id: `review-${r.id}`,
              type: "review",
              userName: r.user?.full_name || "Aluno",
              courseTitle: r.course?.title || "Curso",
              rating: r.rating,
              timestamp: r.created_at,
            });
          });
        }

        events.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setActivityFeed(events.slice(0, 30));
      }

      setLoading(false);
    }

    fetchStats().catch(() => setLoading(false));
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
      const periodStart = getPeriodDate(dashPeriod);

      try {
        const [subsRes, atividadesRes, enrollRes, slotsRes, horariosRes] =
          await Promise.all([
            // submissions stay unfiltered here — the inactive/retention math
            // below needs the full participant history to detect first/last
            // appearance per person.
            supabase
              .from("certificado_submissions")
              .select(
                "nome_completo, atividade_nome, nota_grupo, nota_condutor, condutores, relato, created_at"
              ),
            supabase
              .from("certificado_atividades")
              .select("nome, carga_horaria"),
            // enrollments are only used for the period-window trend chart, so
            // we can safely filter at the DB level and skip the client-side
            // pass over the entire enrollments table.
            supabase
              .from("enrollments")
              .select("enrolled_at")
              .gte("enrolled_at", periodStart.toISOString()),
            supabase
              .from("formacao_slots")
              .select(
                "id, status, dia_semana, horario_id, atividade_nome, formacao_horarios(hora)"
              ),
            supabase.from("formacao_horarios").select("id, hora, ordem"),
          ]);

        const allSubs = subsRes.data || [];
        const atividades = atividadesRes.data || [];
        const enrollData = enrollRes.data || [];
        const slotsData = slotsRes.data || [];
        const horariosData = horariosRes.data || [];

        // Filter submissions by period
        const subs = allSubs.filter(
          (s: any) => new Date(s.created_at) >= periodStart
        );

        const total = subs.length;
        const avgG =
          total > 0
            ? subs.reduce((a: number, x: any) => a + (x.nota_grupo || 0), 0) /
              total
            : 0;
        const avgC =
          total > 0
            ? subs.reduce(
                (a: number, x: any) => a + (x.nota_condutor || 0),
                0
              ) / total
            : 0;
        const totalRelatos = subs.filter(
          (s: any) => s.relato && s.relato.trim().length > 0
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
        subs.forEach((x: any) => {
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
        (atividades || []).forEach((a: any) =>
          horasMap.set(a.nome.toLowerCase(), a.carga_horaria)
        );
        const pMap = new Map<string, { count: number; horas: number }>();
        subs.forEach((s: any) => {
          const nome = (s.nome_completo || "").trim();
          if (!nome) return;
          const e = pMap.get(nome) || { count: 0, horas: 0 };
          e.count++;
          e.horas += horasMap.get(s.atividade_nome?.toLowerCase()) || 2;
          pMap.set(nome, e);
        });
        const topP = Array.from(pMap.entries())
          .map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
          .sort((a, b) => b.horas - a.horas || b.count - a.count)
          .slice(0, 5);

        // Activity distribution
        const actMap = new Map<string, number>();
        subs.forEach((s: any) => {
          const name = s.atividade_nome || "Sem nome";
          actMap.set(name, (actMap.get(name) || 0) + 1);
        });
        const activityDist = Array.from(actMap.entries())
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count);

        // Submissions trend (group by day within period)
        const subsByDay: Record<string, number> = {};
        subs.forEach((s: any) => {
          const day = s.created_at.split("T")[0];
          subsByDay[day] = (subsByDay[day] || 0) + 1;
        });
        const submissionsTrend = Object.entries(subsByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Enrollment trend (based on period window)
        const enrollByDay: Record<string, number> = {};
        (enrollData || []).forEach((e: any) => {
          if (new Date(e.enrolled_at) >= periodStart) {
            const day = e.enrolled_at.split("T")[0];
            enrollByDay[day] = (enrollByDay[day] || 0) + 1;
          }
        });
        const enrollmentTrend = Object.entries(enrollByDay)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        // Session metrics
        const conductedSlots = (slotsData || []).filter(
          (s: any) =>
            s.status === "conduzido" &&
            new Date(s.created_at) >= periodStart
        );
        const totalSessions = conductedSlots.length;

        // Unique participants in period
        const uniqueNames = new Set<string>();
        subs.forEach((s: any) => {
          const nome = (s.nome_completo || "").trim();
          if (nome) uniqueNames.add(nome.toLowerCase());
        });
        const uniqueParticipants = uniqueNames.size;

        const avgParticipantsPerSession =
          totalSessions > 0 ? total / totalSessions : 0;
        const avgFrequencyPerStudent =
          uniqueParticipants > 0 ? total / uniqueParticipants : 0;

        // Active vs inactive (based on ALL submissions)
        const thirtyDaysAgoDate = new Date();
        thirtyDaysAgoDate.setDate(thirtyDaysAgoDate.getDate() - 30);

        const allParticipantDates = new Map<
          string,
          { first: Date; last: Date }
        >();
        (allSubs || []).forEach((s: any) => {
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
        subs.forEach((s: any) => {
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

        const topGroupsByParticipation = Array.from(groupNotaMap.entries())
          .map(([name, d]) => ({ name, count: d.count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Rating distribution (nota_grupo 1-10)
        const ratingDistribution: { rating: number; count: number }[] = [];
        for (let r = 1; r <= 10; r++) {
          ratingDistribution.push({
            rating: r,
            count: subs.filter(
              (s: any) => Math.round(s.nota_grupo || 0) === r
            ).length,
          });
        }

        // Conductor rating distribution (nota_condutor 1-10)
        const conductorRatingDist: { rating: number; count: number }[] = [];
        for (let r = 1; r <= 10; r++) {
          conductorRatingDist.push({
            rating: r,
            count: subs.filter(
              (s: any) => Math.round(s.nota_condutor || 0) === r
            ).length,
          });
        }

        // Heatmap: dia x hora engagement
        const heatmapMap = new Map<string, number>();
        const submissionCountByAtividade = new Map<string, number>();
        subs.forEach((s: any) => {
          const name = (s.atividade_nome || "").toLowerCase();
          submissionCountByAtividade.set(
            name,
            (submissionCountByAtividade.get(name) || 0) + 1
          );
        });

        const activeSlots = (slotsData || []).filter(
          (s: any) => s.atividade_nome
        );
        activeSlots.forEach((slot: any) => {
          const hora = slot.formacao_horarios?.hora || "";
          const key = `${slot.dia_semana}-${hora}`;
          const atividadeName = (slot.atividade_nome || "").toLowerCase();
          const count = submissionCountByAtividade.get(atividadeName) || 0;
          heatmapMap.set(key, (heatmapMap.get(key) || 0) + count);
        });

        if (heatmapMap.size === 0 && horariosData) {
          horariosData.forEach((h: any) => {
            for (let d = 0; d < 5; d++) {
              const key = `${d}-${h.hora}`;
              if (!heatmapMap.has(key)) heatmapMap.set(key, 0);
            }
          });
        }

        const heatmapData = Array.from(heatmapMap.entries()).map(
          ([key, count]) => {
            const [dia, hora] = key.split("-");
            return { dia: parseInt(dia), hora, count };
          }
        );

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

          (allSubs || []).forEach((s: any) => {
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
          enrollmentTrend,
          submissionsTrend,
          activityDist,
          totalSessions,
          avgParticipantsPerSession,
          avgFrequencyPerStudent,
          uniqueParticipants,
          activeStudents,
          inactiveStudents: inactiveFormacaoStudents,
          retentionRate,
          newStudentsThisPeriod,
          topGroups,
          topGroupsByParticipation,
          ratingDistribution,
          conductorRatingDist,
          heatmapData,
          retentionByMonth,
        });
      } catch {
        // Formação tables may not exist yet
      }
    }

    fetchFormacaoStats();
  }, [profile, dashPeriod]);

  // ═══════════════════════════════════════════════════════════
  // Data fetching: Meet quorum
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    async function fetchQuorum() {
      try {
        const supabase = createClient();
        const now = new Date();
        const jsDay = now.getDay();
        const mondayOffset = jsDay === 0 ? 6 : jsDay - 1;
        const monday = new Date(now);
        monday.setDate(now.getDate() - mondayOffset);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        const inicioSemana = monday.toISOString().split("T")[0];
        const fimSemana = sunday.toISOString().split("T")[0];

        const prevMonday = new Date(monday);
        prevMonday.setDate(monday.getDate() - 7);
        const prevSunday = new Date(monday);
        prevSunday.setDate(monday.getDate() - 1);

        const [{ data: current }, { data: prev }] = await Promise.all([
          supabase
            .from("formacao_meet_presencas")
            .select("*")
            .gte("data_reuniao", inicioSemana)
            .lte("data_reuniao", fimSemana),
          supabase
            .from("formacao_meet_presencas")
            .select("media_participantes")
            .gte(
              "data_reuniao",
              prevMonday.toISOString().split("T")[0]
            )
            .lte(
              "data_reuniao",
              prevSunday.toISOString().split("T")[0]
            ),
        ]);

        const presencas = current || [];
        const prevPresencas = prev || [];

        if (presencas.length === 0 && prevPresencas.length === 0) {
          setQuorumStats(null);
          return;
        }

        const gruposEstaSemana = presencas.length;
        const mediaEstaSemana =
          gruposEstaSemana > 0
            ? presencas.reduce(
                (s: number, p: any) => s + (p.media_participantes || 0),
                0
              ) / gruposEstaSemana
            : 0;
        const picoEstaSemana =
          gruposEstaSemana > 0
            ? Math.max(
                ...presencas.map((p: any) => p.pico_participantes || 0)
              )
            : 0;

        const nomes = new Set<string>();
        presencas.forEach((p: any) => {
          (p.participantes || []).forEach((part: any) =>
            nomes.add(part.nome)
          );
        });

        const mediaPrev =
          prevPresencas.length > 0
            ? prevPresencas.reduce(
                (s: number, p: any) => s + (p.media_participantes || 0),
                0
              ) / prevPresencas.length
            : 0;
        const tendencia =
          mediaPrev > 0
            ? ((mediaEstaSemana - mediaPrev) / mediaPrev) * 100
            : 0;

        setQuorumStats({
          gruposEstaSemana,
          mediaEstaSemana,
          picoEstaSemana,
          participantesUnicos: nomes.size,
          tendencia,
        });
      } catch {
        // table may not exist yet
      }
    }
    if (profile) fetchQuorum();
  }, [profile]);

  // ═══════════════════════════════════════════════════════════
  // Data fetching: Admin Notes
  // ═══════════════════════════════════════════════════════════

  const fetchNotes = useCallback(async () => {
    if (!profile) return;
    setNotesLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admin_notes")
        .select("*")
        .eq("user_id", profile.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch {
      // table may not exist yet
    } finally {
      setNotesLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const addNote = async () => {
    if (!profile || !newNoteText.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("admin_notes").insert({
        user_id: profile.id,
        content: newNoteText.trim(),
      });
      if (error) throw error;
      setNewNoteText("");
      toast.success("Nota adicionada");
      fetchNotes();
    } catch {
      toast.error("Erro ao adicionar nota");
    }
  };

  const updateNote = async (id: string) => {
    if (!editingNoteText.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admin_notes")
        .update({ content: editingNoteText.trim(), updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setEditingNoteId(null);
      setEditingNoteText("");
      toast.success("Nota atualizada");
      fetchNotes();
    } catch {
      toast.error("Erro ao atualizar nota");
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admin_notes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Nota removida");
      fetchNotes();
    } catch {
      toast.error("Erro ao remover nota");
    }
  };

  // ═══════════════════════════════════════════════════════════
  // CSV Export (sync mode)
  // ═══════════════════════════════════════════════════════════

  const exportCSV = () => {
    if (!formacaoStats) return;
    const lines: string[] = [];
    lines.push("=== RESUMO GERAL ===");
    lines.push(`Período,${PERIOD_LABELS[dashPeriod]}`);
    lines.push(`Total Feedbacks,${formacaoStats.totalFeedbacks}`);
    lines.push(
      `Nota Média Grupo,${formacaoStats.avgNotaGrupo.toFixed(1)}`
    );
    lines.push(
      `Nota Média Condutor,${formacaoStats.avgNotaCondutor.toFixed(1)}`
    );
    lines.push(`Total Relatos,${formacaoStats.totalRelatos}`);
    lines.push(
      `Sessões Realizadas,${formacaoStats.totalSessions}`
    );
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
    lines.push("");
    lines.push("=== HEATMAP ENGAJAMENTO ===");
    lines.push("Dia,Horário,Quantidade");
    const dias = ["Seg", "Ter", "Qua", "Qui", "Sex"];
    formacaoStats.heatmapData.forEach((h) =>
      lines.push(`${dias[h.dia] || h.dia},${h.hora},${h.count}`)
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

  const activityIcon = {
    enrollment: GraduationCap,
    completion: CheckCircle,
    review: MessageSquare,
  };

  const activityColor = {
    enrollment: "#D4854A",
    completion: "#2E9E8F",
    review: "#F59E0B",
  };

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
        className="flex gap-2 mb-8"
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
              {(Object.keys(PERIOD_LABELS) as DashPeriod[]).map((p) => (
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
                  {PERIOD_LABELS[p]}
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
              {/* ── Stat cards: Feedbacks, Nota grupo, Nota condutor, Taxa de relatos ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Feedbacks",
                    value: String(formacaoStats.totalFeedbacks),
                    icon: FileText,
                    iconColor: "#C84B31",
                    iconBg: "rgba(200,75,49,0.1)",
                  },
                  {
                    label: "Nota Grupo",
                    value: formacaoStats.avgNotaGrupo.toFixed(1),
                    suffix: "/10",
                    icon: Star,
                    iconColor: "#C84B31",
                    iconBg: "rgba(200,75,49,0.1)",
                  },
                  {
                    label: "Nota Condutores",
                    value: formacaoStats.avgNotaCondutor.toFixed(1),
                    suffix: "/10",
                    icon: Users,
                    iconColor: "#2E9E8F",
                    iconBg: "rgba(46,158,143,0.1)",
                  },
                  {
                    label: "Taxa de Relatos",
                    value:
                      formacaoStats.totalFeedbacks > 0
                        ? `${Math.round(
                            (formacaoStats.totalRelatos /
                              formacaoStats.totalFeedbacks) *
                              100
                          )}%`
                        : "0%",
                    subtitle: `${formacaoStats.totalRelatos} de ${formacaoStats.totalFeedbacks}`,
                    icon: MessageSquare,
                    iconColor: "#D4854A",
                    iconBg: "rgba(212,133,74,0.1)",
                  },
                ].map((card, i) => (
                  <StatCard key={card.label} card={card} delay={0.15 + i * 0.06} />
                ))}
              </div>

              {/* ── Metrics: Sessões, Média por sessão, Frequência, Participantes únicos ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Grupos conduzidos",
                    hint: "Total de feedbacks/presenças registrados no formulário de certificado no período selecionado.",
                    value: String(formacaoStats.totalSessions),
                    icon: Calendar,
                    iconColor: "#C84B31",
                    iconBg: "rgba(200,75,49,0.1)",
                  },
                  {
                    label: "Pessoas por grupo",
                    hint: "Média de participantes por grupo conduzido no período.",
                    value:
                      formacaoStats.avgParticipantsPerSession.toFixed(1),
                    icon: Users,
                    iconColor: "#2E9E8F",
                    iconBg: "rgba(46,158,143,0.1)",
                  },
                  {
                    label: "Vezes que cada pessoa participou",
                    hint: "Em média, quantas vezes cada pessoa participou de grupos no período (total de presenças / participantes únicos).",
                    value:
                      formacaoStats.avgFrequencyPerStudent.toFixed(1) +
                      "x",
                    icon: TrendingUp,
                    iconColor: "#D4854A",
                    iconBg: "rgba(212,133,74,0.1)",
                  },
                  {
                    label: "Pessoas diferentes",
                    hint: "Total de pessoas únicas que participaram de pelo menos um grupo no período.",
                    value: String(formacaoStats.uniqueParticipants),
                    icon: GraduationCap,
                    iconColor: "#C84B31",
                    iconBg: "rgba(200,75,49,0.1)",
                  },
                ].map((card, i) => (
                  <StatCard key={card.label} card={card} delay={0.35 + i * 0.06} />
                ))}
              </div>

              {/* ── Retention cards ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {[
                  {
                    label: "Primeira vez no período",
                    hint: "Pessoas que apareceram pela primeira vez nos grupos síncronos durante este período.",
                    value: String(formacaoStats.newStudentsThisPeriod),
                    icon: Plus,
                    iconColor: "#22C55E",
                    iconBg: "rgba(34,197,94,0.1)",
                  },
                  {
                    label: "Participaram nos últimos 30 dias",
                    hint: "Pessoas que enviaram pelo menos 1 feedback/presença nos últimos 30 dias.",
                    value: String(formacaoStats.activeStudents),
                    icon: CheckCircle,
                    iconColor: "#22C55E",
                    iconBg: "rgba(34,197,94,0.1)",
                  },
                  {
                    label: "Sumiram",
                    hint: "Pessoas que já participaram antes mas não aparecem há mais de 30 dias.",
                    value: String(formacaoStats.inactiveStudents),
                    icon: UserX,
                    iconColor: "#EF4444",
                    iconBg: "rgba(239,68,68,0.1)",
                  },
                  {
                    label: "Taxa de retenção",
                    hint: "Porcentagem de participantes que continuam ativos (últimos 30 dias) em relação ao total histórico.",
                    value:
                      formacaoStats.retentionRate.toFixed(0) + "%",
                    icon: TrendingUp,
                    iconColor:
                      formacaoStats.retentionRate > 70
                        ? "#22C55E"
                        : formacaoStats.retentionRate > 40
                          ? "#F59E0B"
                          : "#EF4444",
                    iconBg:
                      formacaoStats.retentionRate > 70
                        ? "rgba(34,197,94,0.1)"
                        : formacaoStats.retentionRate > 40
                          ? "rgba(245,158,11,0.1)"
                          : "rgba(239,68,68,0.1)",
                  },
                ].map((card, i) => (
                  <StatCard key={card.label} card={card} delay={0.55 + i * 0.06} />
                ))}
              </div>

              {/* ── Quórum do Meet ── */}
              {quorumStats && quorumStats.gruposEstaSemana > 0 && (
                <>
                  <div className="mb-2 mt-2">
                    <h3 className="font-fraunces font-semibold text-sm text-cream/60">
                      Quórum do Meet
                    </h3>
                    <p className="font-dm text-[11px] text-cream/25">
                      Presença capturada automaticamente nas reuniões do
                      Google Meet esta semana.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    {[
                      {
                        label: "Grupos realizados",
                        value: String(quorumStats.gruposEstaSemana),
                        icon: Calendar,
                        iconColor: "#6c5ce7",
                        iconBg: "rgba(108,92,231,0.1)",
                      },
                      {
                        label: "Média por grupo",
                        value: quorumStats.mediaEstaSemana.toFixed(1),
                        icon: Users,
                        iconColor: "#00b894",
                        iconBg: "rgba(0,184,148,0.1)",
                        trend: quorumStats.tendencia,
                      },
                      {
                        label: "Pico da semana",
                        value: String(quorumStats.picoEstaSemana),
                        icon: TrendingUp,
                        iconColor: "#fdcb6e",
                        iconBg: "rgba(253,203,110,0.1)",
                      },
                      {
                        label: "Participantes únicos",
                        value: String(quorumStats.participantesUnicos),
                        icon: GraduationCap,
                        iconColor: "#e17055",
                        iconBg: "rgba(225,112,85,0.1)",
                      },
                    ].map((card: any, i) => (
                      <StatCard key={card.label} card={card} delay={0.7 + i * 0.06} />
                    ))}
                  </div>
                </>
              )}

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
                    <AdminRankingCard
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

                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0, duration: 0.4 }}
                >
                  <Card>
                    <div className="flex items-center gap-2 mb-3">
                      <Activity
                        className="h-4 w-4"
                        style={{ color: "#2E9E8F" }}
                      />
                      <h3 className="font-fraunces text-sm font-bold text-cream/70">
                        Grupos com maior adesão
                      </h3>
                    </div>
                    {formacaoStats.topGroupsByParticipation.length > 0 ? (
                      <div className="space-y-2.5">
                        {formacaoStats.topGroupsByParticipation.map(
                          (g) => {
                            const maxCount =
                              formacaoStats
                                .topGroupsByParticipation[0]?.count ||
                              1;
                            const barWidth =
                              (g.count / maxCount) * 100;
                            return (
                              <div key={g.name}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-dm text-xs text-cream/60 truncate flex-1 mr-2">
                                    {g.name}
                                  </span>
                                  <span className="font-fraunces font-bold text-xs text-cream/50 tabular-nums">
                                    {g.count}
                                  </span>
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
                                      width: `${barWidth}%`,
                                      background:
                                        "rgba(46,158,143,0.5)",
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          }
                        )}
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

              {/* ── Heatmap ── */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.15, duration: 0.4 }}
                className="mb-6"
              >
                <Card>
                  <div className="flex items-center gap-2 mb-4">
                    <Flame
                      className="h-4 w-4"
                      style={{ color: "#C84B31" }}
                    />
                    <h3 className="font-fraunces text-sm font-bold text-cream/70">
                      Mapa de engajamento por horário
                    </h3>
                  </div>
                  {formacaoStats.heatmapData.length > 0
                    ? (() => {
                        const dayLabels = [
                          "Seg",
                          "Ter",
                          "Qua",
                          "Qui",
                          "Sex",
                        ];
                        const horas = Array.from(
                          new Set(
                            formacaoStats.heatmapData.map(
                              (h) => h.hora
                            )
                          )
                        ).sort();
                        const maxHeat = Math.max(
                          ...formacaoStats.heatmapData.map(
                            (h) => h.count
                          ),
                          1
                        );

                        const getCount = (
                          dia: number,
                          hora: string
                        ) => {
                          const found =
                            formacaoStats.heatmapData.find(
                              (h) =>
                                h.dia === dia && h.hora === hora
                            );
                          return found ? found.count : 0;
                        };

                        return (
                          <div className="overflow-x-auto">
                            <div className="min-w-[400px]">
                              <div className="flex items-center gap-1 mb-2">
                                <div className="w-14" />
                                {dayLabels.map((d) => (
                                  <div
                                    key={d}
                                    className="flex-1 text-center font-dm text-[10px] text-cream/40 font-semibold"
                                  >
                                    {d}
                                  </div>
                                ))}
                              </div>
                              {horas.map((hora) => (
                                <div
                                  key={hora}
                                  className="flex items-center gap-1 mb-1"
                                >
                                  <div className="w-14 text-right pr-2 font-dm text-[10px] text-cream/40 flex-shrink-0">
                                    {hora}
                                  </div>
                                  {[1, 2, 3, 4, 5].map((dia) => {
                                    const count = getCount(
                                      dia,
                                      hora
                                    );
                                    const intensity =
                                      maxHeat > 0
                                        ? count / maxHeat
                                        : 0;
                                    const bg =
                                      count === 0
                                        ? "rgba(255,255,255,0.02)"
                                        : intensity < 0.33
                                          ? "rgba(200,75,49,0.1)"
                                          : intensity < 0.66
                                            ? "rgba(200,75,49,0.3)"
                                            : "rgba(200,75,49,0.6)";
                                    return (
                                      <div
                                        key={dia}
                                        className="flex-1 h-8 rounded-[6px] flex items-center justify-center group relative transition-all duration-200"
                                        style={{ background: bg }}
                                      >
                                        {count > 0 && (
                                          <span className="font-fraunces font-bold text-[10px] text-cream/60">
                                            {count}
                                          </span>
                                        )}
                                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                          <div
                                            className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                                            style={{
                                              background:
                                                "rgba(30,30,30,0.95)",
                                              border:
                                                "1px solid rgba(200,75,49,0.2)",
                                            }}
                                          >
                                            {dayLabels[dia - 1]}{" "}
                                            {hora}: {count} feedback
                                            {count !== 1 ? "s" : ""}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
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
                            <div className="flex items-end gap-3 h-36">
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

              {/* ── Presenças registradas no período ── */}
              <div className="grid grid-cols-1 gap-4 mb-6">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.25, duration: 0.4 }}
                >
                  <Card>
                    <div className="flex items-center gap-2 mb-3">
                      <FileText
                        className="h-4 w-4"
                        style={{ color: "#C84B31" }}
                      />
                      <h3 className="font-dm text-sm font-semibold text-cream/70">
                        Presenças registradas no período
                      </h3>
                      <HintButton text="Quantidade de feedbacks/presenças enviados por dia no formulário de certificado." />
                    </div>
                    {formacaoStats.submissionsTrend.length > 0 ? (
                      <MiniBarChart
                        data={formacaoStats.submissionsTrend}
                        color="#C84B31"
                      />
                    ) : (
                      <p className="text-xs text-cream/30 text-center py-6">
                        Nenhuma presença registrada no período.
                      </p>
                    )}
                  </Card>
                </motion.div>
              </div>
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
          {/* Stat cards */}
          {stats && (
            <>
              <div
                className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${
                  stats.hasRevenue ? "lg:grid-cols-6" : "lg:grid-cols-5"
                } gap-5 mb-8`}
              >
                {[
                  {
                    label: "Cursos publicados",
                    value: String(stats.totalCourses),
                    icon: BookOpen,
                    iconColor: "#C84B31",
                    iconBg: "rgba(200,75,49,0.1)",
                  },
                  {
                    label: "Alunos matriculados",
                    value: String(stats.totalStudents),
                    icon: Users,
                    iconColor: "#D4854A",
                    iconBg: "rgba(212,133,74,0.1)",
                  },
                  {
                    label: "Certificados emitidos",
                    value: String(stats.totalCertificates),
                    icon: Award,
                    iconColor: "#2E9E8F",
                    iconBg: "rgba(46,158,143,0.1)",
                  },
                  {
                    label: "Rating médio",
                    value: stats.avgRating
                      ? stats.avgRating.toFixed(1)
                      : "\u2014",
                    icon: Star,
                    iconColor: "#F59E0B",
                    iconBg: "rgba(251,191,36,0.1)",
                  },
                  {
                    label: "Taxa de conclusão",
                    value: stats.completionRate
                      ? `${stats.completionRate.toFixed(1)}%`
                      : "\u2014",
                    icon: CheckCircle,
                    iconColor: "#2E9E8F",
                    iconBg: "rgba(46,158,143,0.1)",
                  },
                  ...(stats.hasRevenue
                    ? [
                        {
                          label: "Receita total",
                          value: formatCurrency(stats.totalRevenue),
                          icon: DollarSign,
                          iconColor: "#22C55E",
                          iconBg: "rgba(34,197,94,0.1)",
                        },
                      ]
                    : []),
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.08,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                  >
                    <Card>
                      <div className="flex items-center gap-4">
                        <div
                          className="w-12 h-12 rounded-[12px] flex items-center justify-center flex-shrink-0"
                          style={{ background: stat.iconBg }}
                        >
                          <stat.icon
                            className="h-6 w-6"
                            style={{ color: stat.iconColor }}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="text-2xl font-bold text-cream tabular-nums truncate">
                            {stat.value}
                          </p>
                          <p className="text-xs text-cream/40">
                            {stat.label}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>

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

              {/* Chart + Activity feed row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
                {/* Charts column */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="lg:col-span-2 space-y-5"
                >
                  {/* Enrollment chart */}
                  <Card>
                    <h2 className="font-fraunces font-bold text-lg text-cream mb-4">
                      Matrículas nos últimos 30 dias
                    </h2>
                    {recentEnrollments.length > 0 ? (
                      <div className="flex items-end gap-1 h-40">
                        {recentEnrollments.map((item) => {
                          const maxCount =
                            recentEnrollments.length > 0
                              ? Math.max(
                                  ...recentEnrollments.map(
                                    (e) => e.count
                                  )
                                )
                              : 1;
                          const height =
                            maxCount > 0
                              ? (item.count / maxCount) * 100
                              : 0;
                          const dateLabel = item.date
                            .split("-")
                            .slice(1)
                            .join("/");
                          return (
                            <div
                              key={item.date}
                              className="flex-1 flex flex-col items-center justify-end group relative"
                            >
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <div
                                  className="px-2 py-1 rounded-md text-[10px] font-dm font-medium text-cream whitespace-nowrap"
                                  style={{
                                    background:
                                      "rgba(30,30,30,0.95)",
                                    border:
                                      "1px solid rgba(200,75,49,0.2)",
                                  }}
                                >
                                  {item.count} matrícula
                                  {item.count !== 1 ? "s" : ""} &middot;{" "}
                                  {dateLabel}
                                </div>
                              </div>
                              <div
                                className="w-full rounded-t-md min-h-[5px] transition-all duration-200"
                                style={{
                                  height: `${Math.max(height, 8)}%`,
                                  background: "linear-gradient(180deg, rgba(200,75,49,0.85) 0%, rgba(200,75,49,0.4) 100%)",
                                  boxShadow: "0 0 6px rgba(200,75,49,0.2)",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = "linear-gradient(180deg, rgba(200,75,49,1) 0%, rgba(200,75,49,0.65) 100%)")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = "linear-gradient(180deg, rgba(200,75,49,0.85) 0%, rgba(200,75,49,0.4) 100%)")
                                }
                              />
                              {recentEnrollments.indexOf(item) %
                                5 ===
                                0 && (
                                <span className="text-[9px] text-cream/20 mt-1 font-dm">
                                  {dateLabel}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-cream/35 text-center py-8">
                        Nenhuma matrícula nos últimos 30 dias.
                      </p>
                    )}
                  </Card>

                  {/* Completion trend */}
                  <Card padding="sm">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle
                        className="h-4 w-4"
                        style={{ color: "#2E9E8F" }}
                      />
                      <h3 className="font-dm font-semibold text-sm text-cream/70">
                        Conclusões nos últimos 30 dias
                      </h3>
                    </div>
                    {completionTrend.length > 0 ? (
                      <div className="flex items-end gap-[3px] h-16">
                        {completionTrend.map((item) => {
                          const maxCount = Math.max(
                            ...completionTrend.map((e) => e.count)
                          );
                          const height =
                            maxCount > 0
                              ? (item.count / maxCount) * 100
                              : 0;
                          return (
                            <div
                              key={item.date}
                              className="flex-1 flex flex-col items-center justify-end group relative"
                            >
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                <div
                                  className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap"
                                  style={{
                                    background:
                                      "rgba(30,30,30,0.95)",
                                    border:
                                      "1px solid rgba(46,158,143,0.2)",
                                  }}
                                >
                                  {item.count} &middot;{" "}
                                  {item.date
                                    .split("-")
                                    .slice(1)
                                    .join("/")}
                                </div>
                              </div>
                              <div
                                className="w-full rounded-t-md min-h-[4px] transition-all duration-200"
                                style={{
                                  height: `${Math.max(height, 10)}%`,
                                  background: "linear-gradient(180deg, rgba(46,158,143,0.85) 0%, rgba(46,158,143,0.4) 100%)",
                                  boxShadow: "0 0 6px rgba(46,158,143,0.2)",
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.background = "linear-gradient(180deg, rgba(46,158,143,1) 0%, rgba(46,158,143,0.65) 100%)")
                                }
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = "linear-gradient(180deg, rgba(46,158,143,0.85) 0%, rgba(46,158,143,0.4) 100%)")
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-xs text-cream/30 text-center py-3">
                        Nenhuma conclusão nos últimos 30 dias.
                      </p>
                    )}
                  </Card>
                </motion.div>

                {/* Enrollment trend */}
                {formacaoStats && formacaoStats.enrollmentTrend.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45, duration: 0.4 }}
                    className="lg:col-span-2 mb-4"
                  >
                    <Card>
                      <div className="flex items-center gap-2 mb-3">
                        <TrendingUp className="h-4 w-4" style={{ color: "#2E9E8F" }} />
                        <h3 className="font-dm text-sm font-semibold text-cream/70">Matrículas em cursos no período</h3>
                        <HintButton text="Novas matrículas em cursos gravados ao longo do tempo." />
                      </div>
                      <MiniBarChart data={formacaoStats.enrollmentTrend} color="#2E9E8F" />
                    </Card>
                  </motion.div>
                )}

                {/* Activity feed column */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5, duration: 0.5 }}
                >
                  <Card>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-fraunces font-bold text-lg text-cream">
                        Atividade recente
                      </h2>
                      {activityFeed.length > 0 && (
                        <span className="font-dm text-[10px] text-cream/30">
                          {activityFeed.length} eventos
                        </span>
                      )}
                    </div>
                    {activityFeed.length > 0 ? (
                      <div
                        className="space-y-1 max-h-[640px] overflow-y-auto pr-1 -mr-1"
                        style={{
                          scrollbarWidth: "thin",
                          scrollbarColor: "rgba(253,251,247,0.1) transparent",
                        }}
                      >
                        {activityFeed.map((event) => {
                          const Icon = activityIcon[event.type];
                          const color = activityColor[event.type];
                          let description = "";
                          if (event.type === "enrollment") {
                            description = `${event.userName} se matriculou em ${event.courseTitle}`;
                          } else if (event.type === "completion") {
                            description = `${event.userName} concluiu ${event.courseTitle}`;
                          } else if (event.type === "review") {
                            description = `Nova avaliação ${"★".repeat(event.rating || 0)}${event.rating && event.rating < 5 ? "☆".repeat(5 - event.rating) : ""} em ${event.courseTitle}`;
                          }

                          return (
                            <div
                              key={event.id}
                              className="flex items-start gap-2.5 px-2 py-2 rounded-[8px] hover:bg-white/[.02] transition-colors duration-150"
                            >
                              <div
                                className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                                style={{
                                  background: `${color}15`,
                                }}
                              >
                                <Icon
                                  className="h-3 w-3"
                                  style={{ color }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-dm text-cream/70 leading-snug line-clamp-2">
                                  {description}
                                </p>
                                <p className="text-[10px] text-cream/25 mt-0.5 flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5" />
                                  {relativeTime(event.timestamp)}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-cream/35 text-center py-6">
                        Nenhuma atividade recente.
                      </p>
                    )}
                  </Card>
                </motion.div>
              </div>

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

      {/* ════════════════════════════════════════════════════════
          ADMIN NOTES (both modes)
         ════════════════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.4, duration: 0.4 }}
        className="mt-8"
      >
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <StickyNote
              className="h-4 w-4"
              style={{ color: "#D4854A" }}
            />
            <h3 className="font-fraunces font-bold text-base text-cream">
              Notas do Admin
            </h3>
          </div>

          {/* Add new note */}
          <div className="flex gap-2 mb-4">
            <textarea
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="Adicionar uma nota..."
              className="flex-1 font-dm text-sm text-cream bg-transparent rounded-[10px] px-3 py-2 resize-none placeholder:text-cream/20 focus:outline-none"
              style={{
                border: "1px solid rgba(255,255,255,0.08)",
                minHeight: "60px",
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  addNote();
                }
              }}
            />
            <button
              onClick={addNote}
              disabled={!newNoteText.trim()}
              className="self-end flex items-center gap-1.5 font-dm text-xs px-3 py-2 rounded-[8px] transition-all disabled:opacity-30"
              style={{
                background: "rgba(200,75,49,0.12)",
                color: "#C84B31",
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Adicionar
            </button>
          </div>

          {/* Notes list */}
          {notesLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : notes.length > 0 ? (
            <div className="space-y-2">
              {notes.map((note) => (
                <div
                  key={note.id}
                  className="px-3 py-2.5 rounded-[10px] group"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  {editingNoteId === note.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={editingNoteText}
                        onChange={(e) =>
                          setEditingNoteText(e.target.value)
                        }
                        className="w-full font-dm text-sm text-cream bg-transparent rounded-[8px] px-2 py-1.5 resize-none focus:outline-none"
                        style={{
                          border:
                            "1px solid rgba(200,75,49,0.2)",
                          minHeight: "60px",
                        }}
                        autoFocus
                        onKeyDown={(e) => {
                          if (
                            e.key === "Enter" &&
                            (e.metaKey || e.ctrlKey)
                          ) {
                            updateNote(note.id);
                          }
                          if (e.key === "Escape") {
                            setEditingNoteId(null);
                            setEditingNoteText("");
                          }
                        }}
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updateNote(note.id)}
                          className="flex items-center gap-1 font-dm text-[11px] px-2 py-1 rounded-md transition-all"
                          style={{
                            background:
                              "rgba(46,158,143,0.12)",
                            color: "#2E9E8F",
                          }}
                        >
                          <Save className="h-3 w-3" />
                          Salvar
                        </button>
                        <button
                          onClick={() => {
                            setEditingNoteId(null);
                            setEditingNoteText("");
                          }}
                          className="flex items-center gap-1 font-dm text-[11px] px-2 py-1 rounded-md text-cream/40 hover:text-cream/60 transition-all"
                        >
                          <X className="h-3 w-3" />
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <p className="font-dm text-sm text-cream/70 leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <p className="font-dm text-[10px] text-cream/20">
                          {new Date(
                            note.updated_at || note.created_at
                          ).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingNoteId(note.id);
                              setEditingNoteText(note.content);
                            }}
                            className="font-dm text-[10px] px-1.5 py-0.5 rounded text-cream/30 hover:text-cream/60 hover:bg-white/[.03] transition-all"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => deleteNote(note.id)}
                            className="font-dm text-[10px] px-1.5 py-0.5 rounded text-red-400/40 hover:text-red-400 hover:bg-red-400/[.05] transition-all"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-cream/25 text-center py-4 font-dm">
              Nenhuma nota ainda. Use o campo acima para adicionar lembretes.
            </p>
          )}
        </Card>
      </motion.div>
    </div>
  );
}
