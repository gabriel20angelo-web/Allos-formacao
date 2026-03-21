"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  BookOpen,
  Users,
  Award,
  Star,
  Plus,
  Eye,
  Settings,
  CheckCircle,
  DollarSign,
  AlertTriangle,
  UserX,
  GraduationCap,
  MessageSquare,
  Pencil,
  Clock,
} from "lucide-react";

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

interface AttentionCourse {
  id: string;
  title: string;
  slug: string;
  reason: "empty_draft" | "low_rating" | "no_enrollments";
  avgRating?: number;
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

export default function AdminDashboard() {
  const { profile, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentEnrollments, setRecentEnrollments] = useState<
    { date: string; count: number }[]
  >([]);
  const [completionTrend, setCompletionTrend] = useState<
    { date: string; count: number }[]
  >([]);
  const [activityFeed, setActivityFeed] = useState<ActivityEvent[]>([]);
  const [attentionCourses, setAttentionCourses] = useState<AttentionCourse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const supabase = createClient();

      // Published courses count
      let coursesQuery = supabase
        .from("courses")
        .select("id", { count: "exact", head: true })
        .eq("status", "published");
      if (!isAdmin) {
        coursesQuery = coursesQuery.eq("instructor_id", profile.id);
      }
      const { count: courseCount } = await coursesQuery;

      // All course IDs (published) for stats
      let courseIdsQuery = supabase
        .from("courses")
        .select("id")
        .eq("status", "published");
      if (!isAdmin) {
        courseIdsQuery = courseIdsQuery.eq("instructor_id", profile.id);
      }
      const { data: courseIds } = await courseIdsQuery;
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

        const [enrollmentsRes, completionsRes, recentEnrollFeed, recentReviewsFeed] =
          await Promise.all([
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
            // Activity feed: recent enrollments + completions
            supabase
              .from("enrollments")
              .select("id, enrolled_at, status, completed_at, user:profiles!user_id(full_name), course:courses!course_id(title)")
              .in("course_id", ids)
              .order("enrolled_at", { ascending: false })
              .limit(12),
            supabase
              .from("reviews")
              .select("id, rating, created_at, user:profiles!user_id(full_name), course:courses!course_id(title)")
              .in("course_id", ids)
              .order("created_at", { ascending: false })
              .limit(5),
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

        // Sort by timestamp descending and take 8
        events.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setActivityFeed(events.slice(0, 8));
      }

      // Courses needing attention
      let allCoursesQuery = supabase
        .from("courses")
        .select("id, title, slug, status");
      if (!isAdmin) {
        allCoursesQuery = allCoursesQuery.eq("instructor_id", profile.id);
      }
      const { data: allCourses } = await allCoursesQuery;

      const attention: AttentionCourse[] = [];

      if (allCourses) {
        // Draft courses with no lessons
        const draftCourses = allCourses.filter((c) => c.status === "draft");
        if (draftCourses.length > 0) {
          const draftIds = draftCourses.map((c) => c.id);
          const { data: sectionsWithLessons } = await supabase
            .from("sections")
            .select("course_id, lessons(id)")
            .in("course_id", draftIds);

          const coursesWithLessons = new Set<string>();
          sectionsWithLessons?.forEach((s: any) => {
            if (s.lessons && s.lessons.length > 0) {
              coursesWithLessons.add(s.course_id);
            }
          });

          draftCourses.forEach((c) => {
            if (!coursesWithLessons.has(c.id)) {
              attention.push({
                id: c.id,
                title: c.title,
                slug: c.slug,
                reason: "empty_draft",
              });
            }
          });
        }

        // Published courses with low rating or no enrollments
        const publishedCourses = allCourses.filter(
          (c) => c.status === "published"
        );
        if (publishedCourses.length > 0) {
          const pubIds = publishedCourses.map((c) => c.id);

          const [reviewsForAttention, enrollCountsForAttention] =
            await Promise.all([
              supabase
                .from("reviews")
                .select("course_id, rating")
                .in("course_id", pubIds),
              supabase
                .from("enrollments")
                .select("course_id")
                .in("course_id", pubIds),
            ]);

          // Avg rating per course
          const ratingMap: Record<string, { sum: number; count: number }> = {};
          reviewsForAttention.data?.forEach((r) => {
            if (!ratingMap[r.course_id]) {
              ratingMap[r.course_id] = { sum: 0, count: 0 };
            }
            ratingMap[r.course_id].sum += r.rating;
            ratingMap[r.course_id].count += 1;
          });

          // Enrollment count per course
          const enrollMap: Record<string, number> = {};
          enrollCountsForAttention.data?.forEach((e) => {
            enrollMap[e.course_id] = (enrollMap[e.course_id] || 0) + 1;
          });

          publishedCourses.forEach((c) => {
            const ratingData = ratingMap[c.id];
            if (ratingData && ratingData.count > 0) {
              const avg = ratingData.sum / ratingData.count;
              if (avg < 3.0) {
                attention.push({
                  id: c.id,
                  title: c.title,
                  slug: c.slug,
                  reason: "low_rating",
                  avgRating: avg,
                });
              }
            }

            if (!enrollMap[c.id]) {
              attention.push({
                id: c.id,
                title: c.title,
                slug: c.slug,
                reason: "no_enrollments",
              });
            }
          });
        }
      }

      setAttentionCourses(attention);
      setLoading(false);
    }

    fetchStats().catch(() => setLoading(false));
  }, [profile, isAdmin]);

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-8">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Cursos publicados",
      value: stats?.totalCourses || 0,
      icon: BookOpen,
      iconBg: "rgba(200,75,49,0.1)",
      iconColor: "#C84B31",
    },
    {
      label: "Alunos matriculados",
      value: stats?.totalStudents || 0,
      icon: Users,
      iconBg: "rgba(212,133,74,0.1)",
      iconColor: "#D4854A",
    },
    {
      label: "Certificados emitidos",
      value: stats?.totalCertificates || 0,
      icon: Award,
      iconBg: "rgba(46,158,143,0.1)",
      iconColor: "#2E9E8F",
    },
    {
      label: "Rating médio",
      value: stats?.avgRating ? stats.avgRating.toFixed(1) : "—",
      icon: Star,
      iconBg: "rgba(251,191,36,0.1)",
      iconColor: "#F59E0B",
    },
    {
      label: "Taxa de conclusão",
      value: stats?.completionRate
        ? `${stats.completionRate.toFixed(1)}%`
        : "—",
      icon: CheckCircle,
      iconBg: "rgba(46,158,143,0.1)",
      iconColor: "#2E9E8F",
    },
  ];

  // Conditionally add revenue card
  if (stats?.hasRevenue) {
    statCards.push({
      label: "Receita total",
      value: formatCurrency(stats.totalRevenue),
      icon: DollarSign,
      iconBg: "rgba(34,197,94,0.1)",
      iconColor: "#22C55E",
    });
  }

  const quickActions = [
    {
      label: "Novo curso",
      href: "/formacao/admin/cursos/novo",
      icon: Plus,
      color: "#C84B31",
    },
    {
      label: "Ver alunos",
      href: "/formacao/admin/alunos",
      icon: Users,
      color: "#D4854A",
    },
    {
      label: "Ver site",
      href: "/formacao",
      icon: Eye,
      color: "#2E9E8F",
    },
    {
      label: "Configurações",
      href: "/formacao/admin/configuracoes",
      icon: Settings,
      color: "#5C5C5C",
    },
  ];

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

  const attentionReasonLabel = {
    empty_draft: "Rascunho sem aulas",
    low_rating: "Avaliação baixa",
    no_enrollments: "Sem matrículas",
  };

  // Determine grid columns for stat cards
  const statGridCols = statCards.length <= 5 ? "lg:grid-cols-5" : "lg:grid-cols-6";

  return (
    <div>
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          {getGreeting()}, {profile?.full_name.split(" ")[0]}
        </h1>
        <p className="text-sm text-cream/35 mt-1 font-dm">
          Aqui está o resumo da sua plataforma.
        </p>
      </motion.div>

      {/* Stat cards with staggered animation */}
      <div
        className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 ${statGridCols} gap-5 mb-8`}
      >
        {statCards.map((stat, i) => (
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
                  <p className="text-xs text-cream/40">{stat.label}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Inactive students alert */}
      {stats && stats.inactiveStudents > 0 && (
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
            <UserX className="h-5 w-5 flex-shrink-0" style={{ color: "#F59E0B" }} />
            <div>
              <p className="text-sm font-dm text-cream">
                <span className="font-semibold">{stats.inactiveStudents}</span>{" "}
                aluno{stats.inactiveStudents !== 1 ? "s" : ""} inativo
                {stats.inactiveStudents !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-cream/35 mt-0.5">
                Matriculados há mais de 30 dias sem concluir o curso.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Chart + Activity feed row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
        {/* Chart section — 2 cols */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="lg:col-span-2 space-y-5"
        >
          <Card>
            <h2 className="font-fraunces font-bold text-lg text-cream mb-4">
              Matrículas nos últimos 30 dias
            </h2>
            {recentEnrollments.length > 0 ? (
              <div className="flex items-end gap-1 h-40">
                {recentEnrollments.map((item) => {
                  const maxCount = recentEnrollments.length > 0
                    ? Math.max(...recentEnrollments.map((e) => e.count))
                    : 1;
                  const height =
                    maxCount > 0 ? (item.count / maxCount) * 100 : 0;
                  const dateLabel = item.date.split("-").slice(1).join("/");
                  return (
                    <div
                      key={item.date}
                      className="flex-1 flex flex-col items-center justify-end group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div
                          className="px-2 py-1 rounded-md text-[10px] font-dm font-medium text-cream whitespace-nowrap"
                          style={{
                            background: "rgba(30,30,30,0.95)",
                            border: "1px solid rgba(200,75,49,0.2)",
                          }}
                        >
                          {item.count} matrícula{item.count !== 1 ? "s" : ""} ·{" "}
                          {dateLabel}
                        </div>
                      </div>
                      <div
                        className="w-full rounded-t min-h-[4px] transition-all duration-200 bg-[rgba(200,75,49,0.2)] hover:bg-[rgba(200,75,49,0.5)]"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      {recentEnrollments.indexOf(item) % 5 === 0 && (
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

          {/* Completion trend mini-chart */}
          <Card padding="sm">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-4 w-4" style={{ color: "#2E9E8F" }} />
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
                    maxCount > 0 ? (item.count / maxCount) * 100 : 0;
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
                            border: "1px solid rgba(46,158,143,0.2)",
                          }}
                        >
                          {item.count} · {item.date.split("-").slice(1).join("/")}
                        </div>
                      </div>
                      <div
                        className="w-full rounded-t min-h-[3px] transition-all duration-200 bg-[rgba(46,158,143,0.2)] hover:bg-[rgba(46,158,143,0.5)]"
                        style={{ height: `${Math.max(height, 5)}%` }}
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

        {/* Right column: Activity feed + Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="space-y-5"
        >
          {/* Activity feed */}
          <Card>
            <h2 className="font-fraunces font-bold text-lg text-cream mb-3">
              Atividade recente
            </h2>
            {activityFeed.length > 0 ? (
              <div className="space-y-1">
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
                        style={{ background: `${color}15` }}
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

          {/* Quick actions — compact */}
          <Card padding="sm">
            <h2 className="font-fraunces font-bold text-sm text-cream mb-2">
              Ações rápidas
            </h2>
            <div className="grid grid-cols-2 gap-1.5">
              {quickActions.map((action) => (
                <Link
                  key={action.label}
                  href={action.href}
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[8px] text-xs font-dm text-cream/60 hover:text-cream hover:bg-white/[.03] transition-all duration-200"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{
                      background: `${action.color}15`,
                      border: `1px solid ${action.color}25`,
                    }}
                  >
                    <action.icon
                      className="h-3 w-3"
                      style={{ color: action.color }}
                    />
                  </div>
                  {action.label}
                </Link>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Courses needing attention */}
      {attentionCourses.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mb-8"
        >
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle
                className="h-5 w-5"
                style={{ color: "#F59E0B" }}
              />
              <h2 className="font-fraunces font-bold text-lg text-cream">
                Cursos que precisam de atenção
              </h2>
            </div>
            <div className="space-y-1">
              {attentionCourses.map((course) => (
                <div
                  key={`${course.id}-${course.reason}`}
                  className="flex items-center justify-between px-3 py-2.5 rounded-[10px] hover:bg-white/[.02] transition-colors duration-150"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{
                        background:
                          course.reason === "low_rating"
                            ? "#EF4444"
                            : course.reason === "empty_draft"
                              ? "#F59E0B"
                              : "#6B7280",
                      }}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-dm text-cream/80 truncate">
                        {course.title}
                      </p>
                      <p className="text-[11px] text-cream/30">
                        {attentionReasonLabel[course.reason]}
                        {course.reason === "low_rating" && course.avgRating
                          ? ` (${course.avgRating.toFixed(1)}★)`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/formacao/admin/cursos/${course.slug}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-dm text-cream/50 hover:text-accent hover:bg-[rgba(200,75,49,0.08)] transition-all duration-200 flex-shrink-0"
                  >
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Link>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
