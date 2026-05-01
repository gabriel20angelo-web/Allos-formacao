"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingDown,
  Users,
  Star,
  MessageSquare,
  CheckCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  GraduationCap,
  Target,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CourseOption {
  id: string;
  title: string;
  slug: string;
  status: string;
  course_type: string;
  exam_enabled: boolean;
}

interface EnrollmentRow {
  user_id: string;
  course_id: string;
  status: string;
  enrolled_at: string;
  completed_at: string | null;
}

interface LessonProgressRow {
  user_id: string;
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
}

interface ReviewRow {
  id: string;
  user_id: string;
  course_id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface ExamAttemptRow {
  id: string;
  user_id: string;
  course_id: string;
  score: number;
  passed: boolean;
  answers: { question_id: string; selected_option_id: string; correct: boolean }[];
  attempted_at: string;
}

interface ExamQuestionRow {
  id: string;
  course_id: string;
  question_text: string;
  options: { id: string; text: string; is_correct: boolean }[];
  position: number;
}

interface SectionRow {
  id: string;
  course_id: string;
  title: string;
  position: number;
}

interface LessonRow {
  id: string;
  section_id: string;
  title: string;
  position: number;
  duration_minutes: number | null;
}

interface ProfileRow {
  id: string;
  full_name: string;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function pct(n: number, total: number): number {
  return total === 0 ? 0 : Math.round((n / total) * 100);
}

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24)
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Tiny bar component
function Bar({ value, max, color }: { value: number; max: number; color?: string }) {
  const w = max === 0 ? 0 : (value / max) * 100;
  return (
    <div
      className="w-full h-3 rounded-full overflow-hidden"
      style={{ background: "rgba(255,255,255,0.06)" }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${w}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: color || "#C84B31" }}
      />
    </div>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className="w-3 h-3"
          style={{
            fill: i < rating ? "#C84B31" : "transparent",
            color: i < rating ? "#C84B31" : "rgba(253,251,247,0.2)",
          }}
        />
      ))}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function AnalyticsPage() {
  const supabase = createClient();

  // ── State ──────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>("");
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [lessonProgress, setLessonProgress] = useState<LessonProgressRow[]>([]);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [examAttempts, setExamAttempts] = useState<ExamAttemptRow[]>([]);
  const [examQuestions, setExamQuestions] = useState<ExamQuestionRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [profiles, setProfiles] = useState<Map<string, string>>(new Map());
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ── Fetch all data ────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [
        coursesRes,
        enrollmentsRes,
        progressRes,
        reviewsRes,
        attemptsRes,
        questionsRes,
        sectionsRes,
        lessonsRes,
        profilesRes,
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("id, title, slug, status, course_type, exam_enabled")
          .eq("status", "published")
          .order("title"),
        supabase.from("enrollments").select("user_id, course_id, status, enrolled_at, completed_at"),
        supabase.from("lesson_progress").select("user_id, lesson_id, completed, completed_at"),
        supabase
          .from("reviews")
          .select("id, user_id, course_id, rating, comment, created_at")
          .order("created_at", { ascending: false }),
        supabase
          .from("exam_attempts")
          .select("id, user_id, course_id, score, passed, answers, attempted_at")
          .order("attempted_at", { ascending: false }),
        supabase
          .from("exam_questions")
          .select("id, course_id, question_text, options, position")
          .order("position"),
        supabase.from("sections").select("id, course_id, title, position").order("position"),
        supabase
          .from("lessons")
          .select("id, section_id, title, position, duration_minutes")
          .order("position"),
        supabase.from("profiles").select("id, full_name"),
      ]);

      setCourses((coursesRes.data as CourseOption[]) || []);
      setEnrollments((enrollmentsRes.data as EnrollmentRow[]) || []);
      setLessonProgress((progressRes.data as LessonProgressRow[]) || []);
      setReviews((reviewsRes.data as ReviewRow[]) || []);
      setExamAttempts((attemptsRes.data as ExamAttemptRow[]) || []);
      setExamQuestions((questionsRes.data as ExamQuestionRow[]) || []);
      setSections((sectionsRes.data as SectionRow[]) || []);
      setLessons((lessonsRes.data as LessonRow[]) || []);

      const pMap = new Map<string, string>();
      ((profilesRes.data as ProfileRow[]) || []).forEach((p) => pMap.set(p.id, p.full_name));
      setProfiles(pMap);
    } catch (err) {
      console.error("Analytics fetch error", err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived: course name map ──────────────────────────────
  const courseMap = useMemo(() => {
    const m = new Map<string, CourseOption>();
    courses.forEach((c) => m.set(c.id, c));
    return m;
  }, [courses]);

  // ── Selected course ───────────────────────────────────────
  const selectedCourse = selectedCourseId ? courseMap.get(selectedCourseId) : null;

  // ═══════════════════════════════════════════════════════════
  // OVERVIEW MODE computed data
  // ═══════════════════════════════════════════════════════════

  const overviewData = useMemo(() => {
    if (selectedCourseId) return null;

    // Per-course enrollment & completion
    const courseStats = courses.map((c) => {
      const courseEnrollments = enrollments.filter((e) => e.course_id === c.id);
      const completed = courseEnrollments.filter((e) => e.status === "completed").length;
      const total = courseEnrollments.length;
      return {
        id: c.id,
        title: c.title,
        enrolled: total,
        completed,
        completionRate: pct(completed, total),
      };
    });

    // Sorted by completion rate ascending (worst first) for dropout
    const dropoutSorted = [...courseStats]
      .filter((c) => c.enrolled > 0)
      .sort((a, b) => a.completionRate - b.completionRate);

    // Most popular
    const popularSorted = [...courseStats].sort((a, b) => b.enrolled - a.enrolled);

    // Low completion alert (below 30%)
    const lowCompletion = dropoutSorted.filter(
      (c) => c.completionRate < 30 && c.enrolled >= 2
    );

    // Recent reviews with comments
    const recentReviews = reviews
      .filter((r) => r.comment && r.comment.trim().length > 0)
      .slice(0, 10);

    return { courseStats, dropoutSorted, popularSorted, lowCompletion, recentReviews };
  }, [selectedCourseId, courses, enrollments, reviews]);

  // ═══════════════════════════════════════════════════════════
  // COURSE DETAIL MODE computed data
  // ═══════════════════════════════════════════════════════════

  const detailData = useMemo(() => {
    if (!selectedCourseId) return null;

    const courseEnrollments = enrollments.filter((e) => e.course_id === selectedCourseId);
    const enrolledUserIds = new Set(courseEnrollments.map((e) => e.user_id));
    const totalEnrolled = enrolledUserIds.size;

    // Get lessons in order for this course
    const courseSections = sections
      .filter((s) => s.course_id === selectedCourseId)
      .sort((a, b) => a.position - b.position);

    const orderedLessons: (LessonRow & { sectionTitle: string })[] = [];
    courseSections.forEach((sec) => {
      const sectionLessons = lessons
        .filter((l) => l.section_id === sec.id)
        .sort((a, b) => a.position - b.position);
      sectionLessons.forEach((l) =>
        orderedLessons.push({ ...l, sectionTitle: sec.title })
      );
    });

    const lessonIds = new Set(orderedLessons.map((l) => l.id));

    // Lesson-by-lesson completion
    const relevantProgress = lessonProgress.filter(
      (p) => lessonIds.has(p.lesson_id) && enrolledUserIds.has(p.user_id) && p.completed
    );
    const completionByLesson = new Map<string, number>();
    relevantProgress.forEach((p) => {
      completionByLesson.set(p.lesson_id, (completionByLesson.get(p.lesson_id) || 0) + 1);
    });

    const lessonCompletionData = orderedLessons.map((l, idx) => ({
      index: idx + 1,
      lessonId: l.id,
      title: l.title,
      sectionTitle: l.sectionTitle,
      completed: completionByLesson.get(l.id) || 0,
      rate: pct(completionByLesson.get(l.id) || 0, totalEnrolled),
    }));

    // Exam performance
    const courseAttempts = examAttempts.filter((a) => a.course_id === selectedCourseId);
    const courseQuestions = examQuestions
      .filter((q) => q.course_id === selectedCourseId)
      .sort((a, b) => a.position - b.position);
    const avgScore =
      courseAttempts.length > 0
        ? Math.round(courseAttempts.reduce((s, a) => s + a.score, 0) / courseAttempts.length)
        : 0;
    const passRate = pct(
      courseAttempts.filter((a) => a.passed).length,
      courseAttempts.length
    );

    // Per-question difficulty
    const questionDifficulty = courseQuestions.map((q) => {
      let totalAnswers = 0;
      let wrongAnswers = 0;
      courseAttempts.forEach((attempt) => {
        const answer = attempt.answers?.find((a) => a.question_id === q.id);
        if (answer) {
          totalAnswers++;
          if (!answer.correct) wrongAnswers++;
        }
      });
      return {
        id: q.id,
        position: q.position,
        text: q.question_text,
        totalAnswers,
        wrongAnswers,
        errorRate: pct(wrongAnswers, totalAnswers),
      };
    });

    // Time analysis: average days from enrollment to completion
    const completedEnrollments = courseEnrollments.filter(
      (e) => e.status === "completed" && e.completed_at
    );
    const avgDays =
      completedEnrollments.length > 0
        ? Math.round(
            completedEnrollments.reduce(
              (sum, e) => sum + daysBetween(e.enrolled_at, e.completed_at!),
              0
            ) / completedEnrollments.length
          )
        : null;

    // Student list with progress
    const students = Array.from(enrolledUserIds).map((uid) => {
      const enr = courseEnrollments.find((e) => e.user_id === uid)!;
      const userProgress = relevantProgress.filter((p) => p.user_id === uid);
      const progressPct = pct(userProgress.length, orderedLessons.length);

      // Last activity
      const completedDates = userProgress
        .filter((p) => p.completed_at)
        .map((p) => new Date(p.completed_at!).getTime());
      const lastActivity =
        completedDates.length > 0
          ? new Date(Math.max(...completedDates)).toISOString()
          : enr.enrolled_at;

      return {
        userId: uid,
        name: profiles.get(uid) || "Desconhecido",
        enrolledAt: enr.enrolled_at,
        status: enr.status,
        progress: progressPct,
        completedLessons: userProgress.length,
        totalLessons: orderedLessons.length,
        lastActivity,
      };
    });
    students.sort((a, b) => b.progress - a.progress);

    // Reviews for this course
    const courseReviews = reviews
      .filter((r) => r.course_id === selectedCourseId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return {
      totalEnrolled,
      orderedLessons,
      lessonCompletionData,
      courseAttempts,
      courseQuestions,
      avgScore,
      passRate,
      questionDifficulty,
      avgDays,
      completedCount: completedEnrollments.length,
      students,
      courseReviews,
    };
  }, [
    selectedCourseId,
    enrollments,
    sections,
    lessons,
    lessonProgress,
    examAttempts,
    examQuestions,
    reviews,
    profiles,
  ]);

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-8"
    >
      {/* ── Course Selector ──────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <h2 className="font-fraunces text-xl text-[#FDFBF7]">Analytics</h2>
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="font-dm text-sm px-4 py-2 rounded-xl flex items-center gap-2 min-w-[240px] justify-between"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              color: "#FDFBF7",
            }}
          >
            <span className="truncate">
              {selectedCourse ? selectedCourse.title : "Todos os cursos"}
            </span>
            <ChevronDown
              className="w-4 h-4 flex-shrink-0 transition-transform"
              style={{ transform: dropdownOpen ? "rotate(180deg)" : "none" }}
            />
          </button>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-xl py-1"
              style={{
                background: "rgba(30,28,26,0.98)",
                border: "1px solid rgba(255,255,255,0.08)",
                backdropFilter: "blur(16px)",
              }}
            >
              <button
                onClick={() => {
                  setSelectedCourseId("");
                  setDropdownOpen(false);
                }}
                className="w-full text-left font-dm text-sm px-4 py-2 hover:bg-white/5 transition-colors"
                style={{
                  color: !selectedCourseId ? "#C84B31" : "rgba(253,251,247,0.7)",
                }}
              >
                Todos os cursos
              </button>
              {courses.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCourseId(c.id);
                    setDropdownOpen(false);
                  }}
                  className="w-full text-left font-dm text-sm px-4 py-2 hover:bg-white/5 transition-colors truncate"
                  style={{
                    color:
                      selectedCourseId === c.id ? "#C84B31" : "rgba(253,251,247,0.7)",
                  }}
                >
                  {c.title}
                </button>
              ))}
            </motion.div>
          )}
        </div>
      </div>

      {/* ── OVERVIEW MODE ────────────────────────────────────── */}
      {!selectedCourseId && overviewData && (
        <div className="space-y-8">
          {/* Dropout / Completion Analysis */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingDown className="w-5 h-5 text-[#C84B31]" />
              <h3 className="font-fraunces text-lg text-[#FDFBF7]">
                Taxa de Conclusao por Curso
              </h3>
            </div>
            {overviewData.dropoutSorted.length === 0 ? (
              <p className="font-dm text-sm text-[#FDFBF7]/40">Nenhum curso com inscricoes.</p>
            ) : (
              <div className="space-y-3">
                {overviewData.dropoutSorted.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex justify-between items-center">
                      <button
                        onClick={() => setSelectedCourseId(c.id)}
                        className="font-dm text-sm text-[#FDFBF7]/80 hover:text-[#C84B31] transition-colors text-left truncate max-w-[70%]"
                      >
                        {c.title}
                      </button>
                      <span className="font-dm text-xs text-[#FDFBF7]/50">
                        {c.completionRate}% ({c.completed}/{c.enrolled})
                      </span>
                    </div>
                    <Bar
                      value={c.completionRate}
                      max={100}
                      color={
                        c.completionRate < 30
                          ? "#ef4444"
                          : c.completionRate < 60
                          ? "#f59e0b"
                          : "#22c55e"
                      }
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Most Popular Courses */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-5 h-5 text-[#C84B31]" />
                <h3 className="font-fraunces text-lg text-[#FDFBF7]">Cursos Mais Populares</h3>
              </div>
              {overviewData.popularSorted.length === 0 ? (
                <p className="font-dm text-sm text-[#FDFBF7]/40">Sem dados.</p>
              ) : (
                <div className="space-y-2">
                  {overviewData.popularSorted.slice(0, 10).map((c, i) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5"
                      style={{
                        borderBottom:
                          i < Math.min(overviewData.popularSorted.length, 10) - 1
                            ? "1px solid rgba(255,255,255,0.04)"
                            : "none",
                      }}
                    >
                      <button
                        onClick={() => setSelectedCourseId(c.id)}
                        className="font-dm text-sm text-[#FDFBF7]/80 hover:text-[#C84B31] transition-colors truncate max-w-[70%] text-left"
                      >
                        {c.title}
                      </button>
                      <span className="font-dm text-xs text-[#C84B31] font-medium">
                        {c.enrolled} inscritos
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Low Completion Alert */}
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                <h3 className="font-fraunces text-lg text-[#FDFBF7]">
                  Alerta: Baixa Conclusao
                </h3>
              </div>
              {overviewData.lowCompletion.length === 0 ? (
                <p className="font-dm text-sm text-[#FDFBF7]/40">
                  Nenhum curso com taxa abaixo de 30%.
                </p>
              ) : (
                <div className="space-y-2">
                  {overviewData.lowCompletion.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between py-1.5 px-3 rounded-lg"
                      style={{ background: "rgba(239,68,68,0.06)" }}
                    >
                      <button
                        onClick={() => setSelectedCourseId(c.id)}
                        className="font-dm text-sm text-[#FDFBF7]/80 hover:text-[#C84B31] transition-colors truncate max-w-[65%] text-left"
                      >
                        {c.title}
                      </button>
                      <span className="font-dm text-xs text-red-400 font-medium">
                        {c.completionRate}% concluido
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Recent Reviews */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-[#C84B31]" />
              <h3 className="font-fraunces text-lg text-[#FDFBF7]">Avaliacoes Recentes</h3>
            </div>
            {overviewData.recentReviews.length === 0 ? (
              <p className="font-dm text-sm text-[#FDFBF7]/40">Nenhuma avaliacao com comentario.</p>
            ) : (
              <div className="space-y-4">
                {overviewData.recentReviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="font-dm text-xs text-[#FDFBF7]/50">
                          {profiles.get(r.user_id) || "Anonimo"}
                        </span>
                      </div>
                      <span className="font-dm text-xs text-[#FDFBF7]/30">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    <p className="font-dm text-xs text-[#C84B31]/80 mb-1">
                      {courseMap.get(r.course_id)?.title || "Curso"}
                    </p>
                    <p className="font-dm text-sm text-[#FDFBF7]/70">{r.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── COURSE DETAIL MODE ───────────────────────────────── */}
      {selectedCourseId && detailData && (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: Users,
                label: "Inscritos",
                value: detailData.totalEnrolled,
              },
              {
                icon: CheckCircle,
                label: "Concluiram",
                value: detailData.completedCount,
              },
              {
                icon: Clock,
                label: "Tempo medio",
                value: detailData.avgDays !== null ? `${detailData.avgDays}d` : "N/A",
              },
              {
                icon: Star,
                label: "Avaliacoes",
                value: detailData.courseReviews.length,
              },
            ].map((stat, i) => (
              <Card key={i} padding="sm">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="w-4 h-4 text-[#C84B31]" />
                  <span className="font-dm text-xs text-[#FDFBF7]/50">{stat.label}</span>
                </div>
                <p className="font-fraunces text-2xl text-[#FDFBF7]">{stat.value}</p>
              </Card>
            ))}
          </div>

          {/* Lesson-by-lesson completion */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-5 h-5 text-[#C84B31]" />
              <h3 className="font-fraunces text-lg text-[#FDFBF7]">
                Conclusao por Aula (Ponto de Abandono)
              </h3>
            </div>
            {detailData.lessonCompletionData.length === 0 ? (
              <p className="font-dm text-sm text-[#FDFBF7]/40">Nenhuma aula neste curso.</p>
            ) : (
              <div className="space-y-2">
                {detailData.lessonCompletionData.map((l, idx) => {
                  const prev = idx > 0 ? detailData.lessonCompletionData[idx - 1].rate : null;
                  const drop = prev !== null && prev - l.rate >= 15;
                  return (
                    <div key={l.lessonId} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 max-w-[70%]">
                          <span className="font-dm text-xs text-[#FDFBF7]/30 w-6 text-right flex-shrink-0">
                            {l.index}
                          </span>
                          <span className="font-dm text-sm text-[#FDFBF7]/80 truncate">
                            {l.title}
                          </span>
                          {drop && (
                            <TrendingDown className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                          )}
                        </div>
                        <span
                          className="font-dm text-xs font-medium"
                          style={{ color: drop ? "#ef4444" : "rgba(253,251,247,0.5)" }}
                        >
                          {l.rate}%
                        </span>
                      </div>
                      <div className="ml-8">
                        <Bar
                          value={l.rate}
                          max={100}
                          color={drop ? "#ef4444" : "#C84B31"}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Exam performance */}
          {selectedCourse?.exam_enabled && detailData.courseQuestions.length > 0 && (
            <Card>
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-5 h-5 text-[#C84B31]" />
                <h3 className="font-fraunces text-lg text-[#FDFBF7]">
                  Desempenho no Exame
                </h3>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div
                  className="p-3 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <p className="font-dm text-xs text-[#FDFBF7]/50 mb-1">Nota media</p>
                  <p className="font-fraunces text-2xl text-[#FDFBF7]">
                    {detailData.avgScore}%
                  </p>
                </div>
                <div
                  className="p-3 rounded-lg"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <p className="font-dm text-xs text-[#FDFBF7]/50 mb-1">Taxa de aprovacao</p>
                  <p className="font-fraunces text-2xl text-[#FDFBF7]">
                    {detailData.passRate}%
                  </p>
                </div>
              </div>

              <p className="font-dm text-xs text-[#FDFBF7]/40 mb-3">
                Dificuldade por questao (% de erro)
              </p>
              <div className="space-y-2">
                {detailData.questionDifficulty.map((q) => (
                  <div key={q.id} className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-dm text-sm text-[#FDFBF7]/70 truncate max-w-[75%]">
                        Q{q.position}: {q.text}
                      </span>
                      <span
                        className="font-dm text-xs font-medium"
                        style={{
                          color:
                            q.errorRate > 60
                              ? "#ef4444"
                              : q.errorRate > 30
                              ? "#f59e0b"
                              : "#22c55e",
                        }}
                      >
                        {q.errorRate}% erro
                      </span>
                    </div>
                    <Bar
                      value={q.errorRate}
                      max={100}
                      color={
                        q.errorRate > 60
                          ? "#ef4444"
                          : q.errorRate > 30
                          ? "#f59e0b"
                          : "rgba(255,255,255,0.15)"
                      }
                    />
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Student list */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <GraduationCap className="w-5 h-5 text-[#C84B31]" />
              <h3 className="font-fraunces text-lg text-[#FDFBF7]">Alunos Inscritos</h3>
            </div>
            {detailData.students.length === 0 ? (
              <p className="font-dm text-sm text-[#FDFBF7]/40">Nenhum aluno inscrito.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr
                      className="font-dm text-xs text-[#FDFBF7]/40"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                    >
                      <th className="text-left py-2 pr-4">Nome</th>
                      <th className="text-left py-2 pr-4">Status</th>
                      <th className="text-left py-2 pr-4">Progresso</th>
                      <th className="text-left py-2 pr-4">Aulas</th>
                      <th className="text-left py-2">Ultima atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailData.students.map((s) => (
                      <tr
                        key={s.userId}
                        className="font-dm text-sm"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                      >
                        <td className="py-2 pr-4 text-[#FDFBF7]/80">{s.name}</td>
                        <td className="py-2 pr-4">
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{
                              background:
                                s.status === "completed"
                                  ? "rgba(34,197,94,0.1)"
                                  : s.status === "cancelled"
                                  ? "rgba(239,68,68,0.1)"
                                  : "rgba(200,75,49,0.1)",
                              color:
                                s.status === "completed"
                                  ? "#22c55e"
                                  : s.status === "cancelled"
                                  ? "#ef4444"
                                  : "#C84B31",
                            }}
                          >
                            {s.status === "completed"
                              ? "Concluido"
                              : s.status === "cancelled"
                              ? "Cancelado"
                              : "Ativo"}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <Bar value={s.progress} max={100} />
                            </div>
                            <span className="text-xs text-[#FDFBF7]/50">
                              {s.progress}%
                            </span>
                          </div>
                        </td>
                        <td className="py-2 pr-4 text-xs text-[#FDFBF7]/50">
                          {s.completedLessons}/{s.totalLessons}
                        </td>
                        <td className="py-2 text-xs text-[#FDFBF7]/40">
                          {formatDate(s.lastActivity)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Course Reviews */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="w-5 h-5 text-[#C84B31]" />
              <h3 className="font-fraunces text-lg text-[#FDFBF7]">Avaliacoes</h3>
            </div>
            {detailData.courseReviews.length === 0 ? (
              <p className="font-dm text-sm text-[#FDFBF7]/40">Nenhuma avaliacao para este curso.</p>
            ) : (
              <div className="space-y-3">
                {detailData.courseReviews.map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.02)" }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="font-dm text-xs text-[#FDFBF7]/50">
                          {profiles.get(r.user_id) || "Anonimo"}
                        </span>
                      </div>
                      <span className="font-dm text-xs text-[#FDFBF7]/30">
                        {formatDate(r.created_at)}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="font-dm text-sm text-[#FDFBF7]/70 mt-1">{r.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </motion.div>
  );
}
