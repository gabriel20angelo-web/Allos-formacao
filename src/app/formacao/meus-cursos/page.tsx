"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  BookOpen,
  Play,
  CheckCircle2,
  Clock,
  Award,
  ChevronRight,
  GraduationCap,
  Flame,
  Download,
  ArrowRight,
  Users,
  FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDuration } from "@/lib/utils/format";
import CourseBackground from "@/components/course/CourseBackground";
import Skeleton from "@/components/ui/Skeleton";
import type { Course, EnrollmentStatus, Certificate } from "@/types";

interface EnrolledCourse {
  course: Course;
  enrollmentStatus: EnrollmentStatus;
  completedLessons: number;
  totalLessons: number;
  enrolledAt: string;
}

interface CertificateWithCourse {
  id: string;
  certificate_code: string;
  issued_at: string;
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail_url: string | null;
    certificate_hours: number | null;
  };
}

interface LastWatched {
  courseTitle: string;
  courseSlug: string;
  courseThumbnail: string | null;
  lessonTitle: string;
  completedLessons: number;
  totalLessons: number;
}

interface HoursSummary {
  asyncMinutes: number;
  syncHours: number;
}

type Tab = "active" | "completed" | "certificates";

export default function MeusCursosPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [courses, setCourses] = useState<EnrolledCourse[]>([]);
  const [certificates, setCertificates] = useState<CertificateWithCourse[]>([]);
  const [lastWatched, setLastWatched] = useState<LastWatched | null>(null);
  const [totalStudiedMinutes, setTotalStudiedMinutes] = useState(0);
  const [studyStreak, setStudyStreak] = useState(0);
  const [hours, setHours] = useState<HoursSummary>({ asyncMinutes: 0, syncHours: 0 });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("active");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/formacao/auth");
      return;
    }

    async function fetchAll() {
      const client = createClient();

      // ── 1. Enrollments (same as before) ──────────────────────
      const { data: enrollments } = await client
        .from("enrollments")
        .select(`
          course_id,
          status,
          enrolled_at,
          course:courses!enrollments_course_id_fkey(
            id, title, slug, thumbnail_url, total_duration_minutes, certificate_enabled, status,
            instructor:profiles!courses_instructor_id_fkey(full_name)
          )
        `)
        .eq("user_id", user!.id)
        .in("status", ["active", "completed"])
        .order("enrolled_at", { ascending: false });

      const validEnrollments = (enrollments || []).filter(
        (e) => (e.course as unknown as { status?: string })?.status !== "archived"
      );

      const courseIds = validEnrollments.map((e) => e.course_id);

      // ── 2. Parallel fetches ──────────────────────────────────
      const [sectionsRes, progressRes, certsRes, lastProgressRes] = await Promise.all([
        courseIds.length > 0
          ? client
              .from("sections")
              .select("course_id, is_extra, lessons(id, duration_minutes)")
              .in("course_id", courseIds)
          : Promise.resolve({ data: [] }),
        client
          .from("lesson_progress")
          .select("lesson_id, completed_at")
          .eq("user_id", user!.id)
          .eq("completed", true),
        client
          .from("certificates")
          .select(`
            id, certificate_code, issued_at,
            course:courses!certificates_course_id_fkey(id, title, slug, thumbnail_url, certificate_hours)
          `)
          .eq("user_id", user!.id)
          .order("issued_at", { ascending: false }),
        client
          .from("lesson_progress")
          .select(`
            lesson_id, completed_at,
            lesson:lessons!lesson_progress_lesson_id_fkey(
              id, title, duration_minutes,
              section:sections!lessons_section_id_fkey(
                id, course_id, is_extra,
                course:courses!sections_course_id_fkey(id, title, slug, thumbnail_url)
              )
            )
          `)
          .eq("user_id", user!.id)
          .eq("completed", true)
          .order("completed_at", { ascending: false })
          .limit(1),
      ]);

      // ── 3. Build course lesson stats ─────────────────────────
      const completedSet = new Set(
        (progressRes.data || []).map((p: { lesson_id: string }) => p.lesson_id)
      );

      const courseLessons: Record<string, { total: number; completed: number }> = {};
      const allLessonDurations: Record<string, number> = {};

      (sectionsRes.data || []).forEach((s: { course_id: string; is_extra: boolean; lessons: { id: string; duration_minutes: number | null }[] }) => {
        const lessons = (s.lessons as { id: string; duration_minutes: number | null }[]) || [];
        lessons.forEach((l) => {
          allLessonDurations[l.id] = l.duration_minutes || 0;
        });
        if (s.is_extra) return;
        const cid = s.course_id;
        if (!courseLessons[cid]) courseLessons[cid] = { total: 0, completed: 0 };
        courseLessons[cid].total += lessons.length;
        lessons.forEach((l) => {
          if (completedSet.has(l.id)) courseLessons[cid].completed += 1;
        });
      });

      const enriched: EnrolledCourse[] = validEnrollments
        .filter((e) => e.course)
        .map((e) => {
          const c = e.course as unknown as Course;
          const stats = courseLessons[c.id] || { total: 0, completed: 0 };
          return {
            course: c,
            enrollmentStatus: e.status as EnrollmentStatus,
            completedLessons: stats.completed,
            totalLessons: stats.total,
            enrolledAt: e.enrolled_at,
          };
        });

      setCourses(enriched);

      // ── 4. Certificates ──────────────────────────────────────
      setCertificates(
        ((certsRes.data || []) as unknown as CertificateWithCourse[]).filter((c) => c.course)
      );

      // ── 5. Total studied minutes (completed lessons) ────────
      let studiedMins = 0;
      (progressRes.data || []).forEach((p: { lesson_id: string }) => {
        studiedMins += allLessonDurations[p.lesson_id] || 0;
      });
      setTotalStudiedMinutes(studiedMins);

      // ── 6. Study streak ──────────────────────────────────────
      const completedDates = (progressRes.data || [])
        .map((p: { completed_at: string | null }) => p.completed_at)
        .filter((d): d is string => d !== null)
        .map((d: string) => {
          const dt = new Date(d);
          return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
        });
      const uniqueDays = Array.from(new Set(completedDates)).sort().reverse();

      let streak = 0;
      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      // Check consecutive days from today backwards
      const daySet = new Set(uniqueDays);
      const cursor = new Date(today);
      // Allow starting from today or yesterday
      if (!daySet.has(todayStr)) {
        cursor.setDate(cursor.getDate() - 1);
        const yesterdayStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (!daySet.has(yesterdayStr)) {
          streak = 0;
        } else {
          streak = 1;
          cursor.setDate(cursor.getDate() - 1);
          while (true) {
            const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
            if (daySet.has(ds)) {
              streak++;
              cursor.setDate(cursor.getDate() - 1);
            } else break;
          }
        }
      } else {
        streak = 1;
        cursor.setDate(cursor.getDate() - 1);
        while (true) {
          const ds = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
          if (daySet.has(ds)) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
          } else break;
        }
      }
      setStudyStreak(streak);

      // ── 7. Last watched ──────────────────────────────────────
      if (lastProgressRes.data && lastProgressRes.data.length > 0) {
        const lp = lastProgressRes.data[0] as unknown as {
          lesson_id: string;
          lesson: {
            id: string;
            title: string;
            section: {
              course_id: string;
              is_extra: boolean;
              course: { id: string; title: string; slug: string; thumbnail_url: string | null };
            };
          };
        };
        if (lp.lesson?.section?.course) {
          const crs = lp.lesson.section.course;
          const stats = courseLessons[crs.id] || { total: 0, completed: 0 };
          setLastWatched({
            courseTitle: crs.title,
            courseSlug: crs.slug,
            courseThumbnail: crs.thumbnail_url,
            lessonTitle: lp.lesson.title,
            completedLessons: stats.completed,
            totalLessons: stats.total,
          });
        }
      }

      // ── 8. Hours summary (async + sync) ──────────────────────
      // Async hours = total studied minutes from completed lessons
      // We already have studiedMins

      // Sync hours via endpoint server-side (RLS de certificado_submissions
      // bloqueia leitura direta — migration 023).
      let syncHoursTotal = 0;
      try {
        const syncRes = await fetch("/formacao/api/my-sync-hours", { credentials: "include" });
        if (syncRes.ok) {
          const payload: { syncHours: number } = await syncRes.json();
          syncHoursTotal = payload.syncHours || 0;
        }
      } catch (err) {
        console.warn("[meus-cursos] sync-hours fetch failed:", err);
      }

      setHours({ asyncMinutes: studiedMins, syncHours: syncHoursTotal });
      setLoading(false);
    }

    fetchAll().catch(() => setLoading(false));
  }, [user, profile, authLoading, router]);

  const activeCourses = courses.filter((c) => c.enrollmentStatus === "active");
  const completedCourses = courses.filter((c) => c.enrollmentStatus === "completed");

  const displayed =
    tab === "active"
      ? activeCourses
      : tab === "completed"
        ? completedCourses
        : [];

  const asyncHours = Math.round(hours.asyncMinutes / 60);
  const totalFormacao = asyncHours + hours.syncHours;

  if (authLoading || loading) {
    return (
      <div className="relative min-h-screen">
        <CourseBackground />
        <div className="relative z-10 max-w-[1000px] mx-auto px-5 sm:px-6 md:px-10 py-16">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-40 w-full mb-6" />
          <Skeleton className="h-28 w-full mb-4" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <CourseBackground />

      <div className="relative z-10 max-w-[1000px] mx-auto px-5 sm:px-6 md:px-10 py-12 sm:py-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(46,158,143,0.12)", border: "1px solid rgba(46,158,143,0.25)" }}
            >
              <GraduationCap className="h-5 w-5 text-teal" />
            </div>
            <div>
              <h1 className="font-fraunces font-bold text-2xl sm:text-3xl text-cream tracking-tight">
                Meus cursos
              </h1>
            </div>
          </div>
          <p className="text-sm text-cream/40 ml-[52px]">
            {courses.length === 0
              ? "Você ainda não está matriculado em nenhum curso."
              : `${activeCourses.length} em andamento · ${completedCourses.length} concluído${completedCourses.length !== 1 ? "s" : ""}`}
          </p>
        </motion.div>

        {courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-20"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.15)" }}
            >
              <BookOpen className="h-7 w-7 text-accent/50" />
            </div>
            <h3 className="font-fraunces font-bold text-xl text-cream mb-2">
              Nenhum curso ainda
            </h3>
            <p className="text-cream/40 text-sm mb-6 max-w-sm mx-auto">
              Explore nosso catálogo e comece sua formação clínica.
            </p>
            <Link
              href="/formacao#cursos"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-dm font-semibold text-sm text-white transition-all hover:scale-[1.03]"
              style={{
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
                boxShadow: "0 4px 16px rgba(200,75,49,0.25)",
              }}
            >
              Ver cursos
            </Link>
          </motion.div>
        ) : (
          <>
            {/* ── Summary Card ──────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="rounded-2xl p-5 sm:p-6 mb-6"
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                {/* Active */}
                <div className="flex flex-col items-center text-center gap-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "rgba(46,158,143,0.1)" }}
                  >
                    <Play className="h-4 w-4 text-teal" />
                  </div>
                  <span className="font-fraunces font-bold text-xl text-cream">{activeCourses.length}</span>
                  <span className="text-xs text-cream/40">Em andamento</span>
                </div>
                {/* Completed */}
                <div className="flex flex-col items-center text-center gap-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "rgba(46,158,143,0.1)" }}
                  >
                    <CheckCircle2 className="h-4 w-4 text-teal" />
                  </div>
                  <span className="font-fraunces font-bold text-xl text-cream">{completedCourses.length}</span>
                  <span className="text-xs text-cream/40">Concluídos</span>
                </div>
                {/* Certificates */}
                <div className="flex flex-col items-center text-center gap-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "rgba(200,75,49,0.1)" }}
                  >
                    <Award className="h-4 w-4 text-accent" />
                  </div>
                  <span className="font-fraunces font-bold text-xl text-cream">{certificates.length}</span>
                  <span className="text-xs text-cream/40">Certificados</span>
                </div>
                {/* Hours */}
                <div className="flex flex-col items-center text-center gap-1">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                    style={{ background: "rgba(46,158,143,0.1)" }}
                  >
                    <Clock className="h-4 w-4 text-teal" />
                  </div>
                  <span className="font-fraunces font-bold text-xl text-cream">
                    {formatDuration(totalStudiedMinutes)}
                  </span>
                  <span className="text-xs text-cream/40">Estudadas</span>
                </div>
              </div>

              {/* Streak */}
              {studyStreak > 0 && (
                <div
                  className="mt-4 pt-4 flex items-center justify-center gap-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  <Flame className="h-4 w-4 text-orange-400" />
                  <span className="text-sm text-cream/60">
                    Você estudou nos últimos <strong className="text-cream">{studyStreak} dia{studyStreak !== 1 ? "s" : ""}</strong>
                  </span>
                </div>
              )}

              {/* Hours breakdown */}
              {(asyncHours > 0 || hours.syncHours > 0) && (
                <div
                  className="mt-4 pt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-cream/40"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                >
                  {asyncHours > 0 && (
                    <span className="flex items-center gap-1">
                      <BookOpen className="h-3 w-3" />
                      {asyncHours}h em cursos
                    </span>
                  )}
                  {hours.syncHours > 0 && (
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {hours.syncHours}h em grupos
                    </span>
                  )}
                  {asyncHours > 0 && hours.syncHours > 0 && (
                    <span className="text-cream/60 font-medium">
                      = {totalFormacao}h de formação
                    </span>
                  )}
                </div>
              )}
            </motion.div>

            {/* ── Continue where you left off ───────────────── */}
            {lastWatched && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mb-8"
              >
                <Link
                  href={`/formacao/curso/${lastWatched.courseSlug}/assistir`}
                  className="group flex gap-5 rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.04]"
                  style={{
                    background: "linear-gradient(135deg, rgba(200,75,49,0.06), rgba(200,75,49,0.02))",
                    border: "1px solid rgba(200,75,49,0.15)",
                  }}
                >
                  {/* Thumbnail */}
                  <div className="relative w-28 h-20 sm:w-40 sm:h-28 rounded-xl overflow-hidden flex-shrink-0">
                    {lastWatched.courseThumbnail ? (
                      <Image
                        src={lastWatched.courseThumbnail}
                        alt={lastWatched.courseTitle}
                        fill
                        className="object-cover"
                        sizes="160px"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ background: "rgba(200,75,49,0.08)" }}
                      >
                        <BookOpen className="h-6 w-6 text-accent/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Play className="h-8 w-8 text-white fill-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-xs text-accent font-semibold uppercase tracking-wider mb-1">
                      Continue de onde parou
                    </p>
                    <h3 className="font-fraunces font-bold text-base sm:text-lg text-cream line-clamp-1 mb-1 group-hover:text-teal-light transition-colors">
                      {lastWatched.courseTitle}
                    </h3>
                    <p className="text-xs text-cream/40 mb-3 line-clamp-1">
                      {lastWatched.lessonTitle}
                    </p>

                    {/* Progress bar */}
                    {lastWatched.totalLessons > 0 && (
                      <div className="flex items-center gap-3 mb-3">
                        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <motion.div
                            className="h-full rounded-full"
                            style={{ background: "linear-gradient(90deg, #C84B31, #E8673D)" }}
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.round((lastWatched.completedLessons / lastWatched.totalLessons) * 100)}%`,
                            }}
                            transition={{ duration: 0.8, delay: 0.3 }}
                          />
                        </div>
                        <span className="text-xs text-cream/30 font-medium w-10 text-right">
                          {Math.round((lastWatched.completedLessons / lastWatched.totalLessons) * 100)}%
                        </span>
                      </div>
                    )}

                    <div
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-dm font-semibold text-sm text-white w-fit transition-all group-hover:scale-[1.03]"
                      style={{
                        background: "linear-gradient(135deg, #C84B31, #A33D27)",
                        boxShadow: "0 2px 10px rgba(200,75,49,0.3)",
                      }}
                    >
                      Continuar
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            )}

            {/* ── Tabs ──────────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="flex gap-1 mb-8 p-1 rounded-xl w-fit"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { id: "active" as Tab, label: "Em andamento", count: activeCourses.length },
                { id: "completed" as Tab, label: "Concluídos", count: completedCourses.length },
                { id: "certificates" as Tab, label: "Certificados", count: certificates.length },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`px-4 sm:px-5 py-2 rounded-lg text-sm font-dm font-medium transition-all ${
                    tab === t.id
                      ? "text-white"
                      : "text-cream/40 hover:text-cream/60"
                  }`}
                  style={
                    tab === t.id
                      ? { background: "linear-gradient(135deg, #C84B31, #A33D27)", boxShadow: "0 2px 8px rgba(200,75,49,0.3)" }
                      : {}
                  }
                >
                  {t.label} ({t.count})
                </button>
              ))}
            </motion.div>

            {/* ── Course list (active & completed tabs) ─────── */}
            {(tab === "active" || tab === "completed") && (
              <div className="space-y-4">
                {displayed.length === 0 ? (
                  <p className="text-cream/30 text-sm py-10 text-center">
                    {tab === "active"
                      ? "Nenhum curso em andamento."
                      : "Nenhum curso concluído ainda."}
                  </p>
                ) : (
                  displayed.map((item, i) => {
                    const pct = item.totalLessons > 0
                      ? Math.round((item.completedLessons / item.totalLessons) * 100)
                      : 0;
                    const isCompleted = item.enrollmentStatus === "completed";

                    return (
                      <motion.div
                        key={item.course.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06, duration: 0.4 }}
                      >
                        <Link
                          href={`/formacao/curso/${item.course.slug}`}
                          className="group flex gap-5 rounded-2xl p-5 transition-all duration-300 hover:bg-white/[0.03]"
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.06)",
                          }}
                        >
                          {/* Thumbnail */}
                          <div className="relative w-28 h-20 sm:w-36 sm:h-24 rounded-xl overflow-hidden flex-shrink-0">
                            {item.course.thumbnail_url ? (
                              <Image
                                src={item.course.thumbnail_url}
                                alt={item.course.title}
                                fill
                                className="object-cover"
                                sizes="144px"
                              />
                            ) : (
                              <div
                                className="w-full h-full flex items-center justify-center"
                                style={{ background: "rgba(200,75,49,0.08)" }}
                              >
                                <BookOpen className="h-6 w-6 text-accent/40" />
                              </div>
                            )}
                            {/* Overlay */}
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <Play className="h-6 w-6 text-white fill-white" />
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="font-fraunces font-bold text-base text-cream line-clamp-1 mb-1 group-hover:text-teal-light transition-colors">
                              {item.course.title}
                            </h3>
                            {item.course.instructor && item.course.show_instructor && (
                              <p className="text-xs text-cream/35 mb-3">
                                {item.course.instructor.full_name}
                              </p>
                            )}

                            <div className="flex items-center gap-4 text-xs text-cream/40 mb-3">
                              <span className="flex items-center gap-1">
                                {isCompleted ? (
                                  <CheckCircle2 className="h-3.5 w-3.5 text-teal" />
                                ) : (
                                  <Play className="h-3.5 w-3.5" />
                                )}
                                {item.completedLessons}/{item.totalLessons} aulas
                              </span>
                              {item.course.total_duration_minutes && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" />
                                  {formatDuration(item.course.total_duration_minutes)}
                                </span>
                              )}
                              {isCompleted && item.course.certificate_enabled && (
                                <Link
                                  href={`/formacao/curso/${item.course.slug}/certificado`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-accent hover:text-accent-light transition-colors"
                                >
                                  <Award className="h-3.5 w-3.5" />
                                  Certificado
                                </Link>
                              )}
                            </div>

                            {/* Progress bar */}
                            {!isCompleted && (
                              <div className="flex items-center gap-3">
                                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                                  <motion.div
                                    className="h-full rounded-full"
                                    style={{ background: "linear-gradient(90deg, #2E9E8F, #3ECFBE)" }}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.8, delay: 0.2 + i * 0.06 }}
                                  />
                                </div>
                                <span className="text-xs text-cream/30 font-medium w-10 text-right">{pct}%</span>
                              </div>
                            )}
                            {isCompleted && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-teal" />
                                <span className="text-xs text-teal font-medium">Concluído</span>
                              </div>
                            )}
                          </div>

                          <ChevronRight className="h-5 w-5 text-cream/15 group-hover:text-teal self-center flex-shrink-0 transition-colors" />
                        </Link>
                      </motion.div>
                    );
                  })
                )}
              </div>
            )}

            {/* ── Certificates tab ──────────────────────────── */}
            {tab === "certificates" && (
              <div className="space-y-4">
                {certificates.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                      style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.18)" }}
                    >
                      <Award className="h-7 w-7 text-accent/60" />
                    </div>
                    <h3 className="font-fraunces font-bold text-cream text-lg mb-2">
                      Nenhum certificado ainda
                    </h3>
                    <p className="text-cream/50 text-sm max-w-md mb-6">
                      Quando você concluir um curso e for aprovado na prova, o
                      certificado fica disponível aqui.
                    </p>
                    <Link
                      href="/formacao"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium text-cream"
                      style={{
                        background: "linear-gradient(135deg, #C84B31, #A33D27)",
                        boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
                      }}
                    >
                      Explorar cursos <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ) : (
                  certificates.map((cert, i) => (
                    <motion.div
                      key={cert.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.4 }}
                    >
                      <div
                        className="group flex gap-5 rounded-2xl p-5"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {/* Icon */}
                        <div
                          className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.12)" }}
                        >
                          <Award className="h-7 w-7 text-accent" />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-fraunces font-bold text-base text-cream line-clamp-1 mb-1">
                            {cert.course.title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cream/40 mb-3">
                            <span className="flex items-center gap-1">
                              <FileText className="h-3.5 w-3.5" />
                              {cert.certificate_code}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(cert.issued_at).toLocaleDateString("pt-BR")}
                            </span>
                            {cert.course.certificate_hours && (
                              <span className="flex items-center gap-1">
                                <GraduationCap className="h-3.5 w-3.5" />
                                {cert.course.certificate_hours}h
                              </span>
                            )}
                          </div>

                          <Link
                            href={`/formacao/curso/${cert.course.slug}/certificado`}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-dm font-semibold text-xs text-white transition-all hover:scale-[1.03]"
                            style={{
                              background: "linear-gradient(135deg, #C84B31, #A33D27)",
                              boxShadow: "0 2px 8px rgba(200,75,49,0.25)",
                            }}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Baixar PDF
                          </Link>
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
