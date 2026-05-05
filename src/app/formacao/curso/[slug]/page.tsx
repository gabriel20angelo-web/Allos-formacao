"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CourseBackground from "@/components/course/CourseBackground";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Award,
  Play,
  Search,
  ChevronDown,
  ChevronUp,
  BookOpen,
  CheckCircle2,
  Clock,
  Lock,
  Sparkles,
  GraduationCap,
  Radio,
  Video,
  MessageCircle,
  Calendar,
  Users,
} from "lucide-react";
import type { Course, Section, Lesson, LessonProgress, Enrollment, CourseMeeting } from "@/types";
import { formatDuration } from "@/lib/utils/format";

export default function CourseOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({});
  const [loading, setLoading] = useState(true);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"conteudos" | "sobre">("conteudos");
  const [meetings, setMeetings] = useState<CourseMeeting[]>([]);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const allLessons = useMemo(
    () => sections.flatMap((s) => s.lessons || []),
    [sections]
  );

  const requiredLessons = useMemo(
    () => sections.filter((s) => !s.is_extra).flatMap((s) => s.lessons || []),
    [sections]
  );

  const totalLessons = allLessons.length;
  const requiredTotal = requiredLessons.length;
  const requiredCompleted = requiredLessons.filter(
    (l) => progressMap[l.id]?.completed
  ).length;
  const progressPercent = requiredTotal > 0 ? Math.round((requiredCompleted / requiredTotal) * 100) : 0;

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const client = createClient();

        const { data: courseData } = await client
          .from("courses")
          .select(`
            *,
            instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url, email)
          `)
          .eq("slug", slug)
          .single();

        if (cancelled) return;

        if (!courseData) {
          router.push("/formacao");
          return;
        }

        setCourse(courseData);

        const { data: sectionsData } = await client
          .from("sections")
          .select(`
            *,
            lessons(
              *,
              attachments:lesson_attachments(*)
            )
          `)
          .eq("course_id", courseData.id)
          .order("position")
          .order("position", { referencedTable: "lessons" });

        if (cancelled) return;

        if (sectionsData) {
          setSections(sectionsData);
          // Expand all sections by default
          const expanded: Record<string, boolean> = {};
          sectionsData.forEach((s) => { expanded[s.id] = true; });
          setExpandedSections(expanded);
        }

        // Sync course: carrega encontros (passados+futuros) pra detectar
        // "ao vivo agora" e mostrar a lista de próximos.
        if (courseData.course_type === "sync") {
          const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
          const { data: meetingsData } = await client
            .from("course_meetings")
            .select("*")
            .eq("course_id", courseData.id)
            .gte("starts_at", past24h)
            .order("starts_at", { ascending: true });
          if (!cancelled && meetingsData) setMeetings(meetingsData as CourseMeeting[]);
        }

        const userId = user?.id;
        if (userId) {
          const { data: enrollData } = await client
            .from("enrollments")
            .select("*")
            .eq("course_id", courseData.id)
            .eq("user_id", userId)
            .single();

          if (cancelled) return;

          if (enrollData) {
            setEnrollment(enrollData);
          }

          const allLessonIds = sectionsData
            ?.flatMap((s) => s.lessons?.map((l: Lesson) => l.id) || [])
            || [];

          if (allLessonIds.length > 0) {
            const { data: progressData } = await client
              .from("lesson_progress")
              .select("*")
              .eq("user_id", userId)
              .in("lesson_id", allLessonIds);

            if (!cancelled && progressData) {
              const map: Record<string, LessonProgress> = {};
              progressData.forEach((p) => {
                map[p.lesson_id] = p;
              });
              setProgressMap(map);
            }
          }
        }
      } catch (err) {
        console.error("Erro ao carregar curso:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [slug, user?.id, router]);

  // Tick do relógio pro estado "ao vivo agora" — atualiza a cada 30s
  useEffect(() => {
    if (course?.course_type !== "sync") return;
    const i = setInterval(() => setNowMs(Date.now()), 30_000);
    return () => clearInterval(i);
  }, [course?.course_type]);

  const isSync = course?.course_type === "sync";
  const liveDurationMs = (course?.live_session_duration_minutes ?? 120) * 60 * 1000;

  const { liveMeeting, futureMeetings } = useMemo(() => {
    let live: CourseMeeting | null = null;
    const future: CourseMeeting[] = [];
    for (const m of meetings) {
      const startMs = new Date(m.starts_at).getTime();
      const endMs = startMs + liveDurationMs;
      if (startMs <= nowMs && nowMs < endMs) {
        live = m;
      } else if (startMs > nowMs) {
        future.push(m);
      }
    }
    return { liveMeeting: live, futureMeetings: future };
  }, [meetings, nowMs, liveDurationMs]);

  const liveEndsAt = liveMeeting
    ? new Date(new Date(liveMeeting.starts_at).getTime() + liveDurationMs)
    : null;

  const handleAssistir = () => {
    if (!user) {
      toast.error("Faça login para acessar o curso.");
      return;
    }
    if (!enrollment && course && !course.is_free) {
      router.push(`/formacao/curso/${slug}/comprar`);
      return;
    }
    router.push(`/formacao/curso/${slug}/assistir`);
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections
      .map((s) => ({
        ...s,
        lessons: (s.lessons || []).filter((l) =>
          l.title.toLowerCase().includes(q)
        ),
      }))
      .filter((s) => s.lessons.length > 0);
  }, [sections, searchQuery]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="relative min-h-screen">
        <CourseBackground />
        <div className="relative z-10">
          <div className="h-[400px] sm:h-[480px] animate-shimmer" style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)",
            backgroundSize: "200% 100%",
          }} />
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  if (!course) return null;

  const description = course.description || "";
  const longDescription = course.long_description || "";
  const isDescriptionLong = description.length > 200;
  const isEnrolled = !!enrollment;
  // Sync tem precedência sobre premium gold — identidade roxa exclusiva.
  const isPremium = !isSync && (course.featured || course.is_structured);
  const meetHrefForLive = liveMeeting?.meet_url_override || course.meet_url || null;

  return (
    <div className="relative min-h-screen">
      <CourseBackground />

      <div className="relative z-10">
        {/* Banner "AO VIVO AGORA" — só pra cursos sync com encontro ativo */}
        {isSync && liveMeeting && (
          <div
            className="relative w-full px-5 sm:px-10 py-3"
            style={{
              background: "linear-gradient(90deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.04) 60%)",
              borderBottom: "1px solid rgba(139,92,246,0.3)",
            }}
          >
            <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-dm text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{
                  background: "rgba(139,92,246,0.85)",
                  color: "#FFFFFF",
                }}
              >
                <Radio size={10} className="animate-pulse" />
                Ao vivo agora
              </span>
              {liveMeeting.title && (
                <span className="font-dm text-sm" style={{ color: "rgba(253,251,247,0.85)" }}>
                  {liveMeeting.title}
                </span>
              )}
              {liveEndsAt && (
                <span className="font-dm text-xs" style={{ color: "rgba(167,139,250,0.7)" }}>
                  {(() => {
                    const remainingMin = Math.max(0, Math.floor((liveEndsAt.getTime() - nowMs) / 60_000));
                    if (remainingMin >= 60) return `Termina em ${Math.floor(remainingMin / 60)}h${remainingMin % 60 ? `${remainingMin % 60}min` : ""}`;
                    return `Termina em ${remainingMin}min`;
                  })()}
                </span>
              )}
              {meetHrefForLive && (
                <a
                  href={meetHrefForLive}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg font-dm text-xs font-bold transition-all hover:-translate-y-0.5"
                  style={{
                    background: "#8B5CF6",
                    color: "#FFFFFF",
                    boxShadow: "0 4px 14px rgba(139,92,246,0.4)",
                  }}
                >
                  <Video size={12} /> Entrar no Meet
                </a>
              )}
            </div>
          </div>
        )}

        {/* ─── Hero Banner ─── */}
        <div className="relative w-full h-[420px] sm:h-[500px] overflow-hidden">
          {/* Background image */}
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: isPremium
                  ? "linear-gradient(135deg, #1a1508 0%, #1C1414 50%, #0F0F0F 100%)"
                  : "linear-gradient(135deg, #1C1414 0%, #2a1a1a 50%, #0F0F0F 100%)",
              }}
            />
          )}

          {/* Dark gradient overlay for text readability */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0.2) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, transparent 30%, transparent 70%, rgba(15,15,15,1) 100%)",
            }}
          />

          {/* Premium gold ambient glow */}
          {isPremium && (
            <>
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse 50% 60% at 15% 80%, rgba(212,175,55,0.08) 0%, transparent 70%)",
                }}
              />
              {/* Top gold shimmer line */}
              <div
                className="absolute top-0 left-0 right-0 h-[2px] z-20"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.4) 20%, rgba(255,215,0,0.6) 50%, rgba(212,175,55,0.4) 80%, transparent 100%)",
                }}
              />
              {/* Bottom gold accent */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[1px] z-20"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.2) 30%, rgba(212,175,55,0.15) 70%, transparent 100%)",
                }}
              />
            </>
          )}

          {/* Content overlay */}
          <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 md:px-16 max-w-3xl">
            {/* Back button */}
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Link
                href="/formacao"
                className="inline-flex items-center gap-2 text-sm font-medium text-white/70 hover:text-white transition-all hover:-translate-x-0.5 mb-6 font-dm px-3 py-1.5 rounded-xl hover:bg-white/[0.06]"
              >
                <ArrowLeft className="h-4 w-4" />
                Explorar outros cursos
              </Link>
            </motion.div>

            {/* Premium badge */}
            {isPremium && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="mb-4"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.1))",
                    color: "#d4af37",
                    border: "1px solid rgba(212,175,55,0.3)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  {course.featured ? (
                    <>
                      <Sparkles className="h-3 w-3" />
                      {course.featured_label || "Em destaque"}
                    </>
                  ) : (
                    <>
                      <GraduationCap className="h-3 w-3" />
                      Curso estruturado
                    </>
                  )}
                </span>
              </motion.div>
            )}

            {/* Sync badge — identidade roxa */}
            {isSync && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.05 }}
                className="mb-4"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                  style={{
                    background: "rgba(139,92,246,0.15)",
                    color: "#A78BFA",
                    border: "1px solid rgba(139,92,246,0.35)",
                    backdropFilter: "blur(8px)",
                  }}
                >
                  <Radio className="h-3 w-3" />
                  Ao vivo + Gravação
                </span>
              </motion.div>
            )}

            {/* Course title */}
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="font-fraunces font-bold text-2xl sm:text-3xl md:text-4xl leading-tight mb-4"
              style={isPremium ? {
                background: "linear-gradient(135deg, #FDFBF7 30%, #d4af37 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              } : isSync ? {
                background: "linear-gradient(135deg, #FDFBF7 30%, #A78BFA 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              } : { color: "white" }}
            >
              {course.title}
            </motion.h1>

            {/* Description */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="mb-5"
            >
              <p className="font-dm text-sm sm:text-base text-white/70 leading-relaxed">
                {showFullDescription || !isDescriptionLong
                  ? description
                  : description.slice(0, 200) + "..."}
              </p>
              {isDescriptionLong && (
                <button
                  onClick={() => setShowFullDescription(!showFullDescription)}
                  className="text-sm font-dm font-medium text-teal hover:text-teal-light transition-colors mt-1"
                >
                  {showFullDescription ? "Mostrar menos" : "Mostrar mais"}
                </button>
              )}
            </motion.div>

            {/* Progress + count */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="flex items-center gap-3 mb-6"
            >
              <span className={`font-dm text-sm ${isPremium ? "text-amber-200/60" : "text-white/60"}`}>
                {totalLessons} conteúdo{totalLessons !== 1 ? "s" : ""}
                {isEnrolled && ` — ${progressPercent}%`}
              </span>
              {isEnrolled && (
                <div className="w-32 h-1.5 rounded-full overflow-hidden" style={{ background: isPremium ? "rgba(212,175,55,0.15)" : "rgba(255,255,255,0.15)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${progressPercent}%`,
                      background: isPremium
                        ? "linear-gradient(90deg, #d4af37, #f0d060)"
                        : "linear-gradient(90deg, #2E9E8F, #3ECFBE)",
                    }}
                  />
                </div>
              )}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="flex flex-wrap items-center gap-3 sm:gap-5"
            >
              {isPremium ? (
                <button
                  onClick={handleAssistir}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-dm font-semibold text-sm transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, #d4af37, #b8860b)",
                    color: "#1a1508",
                    boxShadow: "0 4px 20px rgba(212,175,55,0.3)",
                  }}
                >
                  <Play className="h-4 w-4" />
                  Assistir
                </button>
              ) : isSync ? (
                <button
                  onClick={handleAssistir}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-dm font-semibold text-sm text-white transition-all hover:scale-[1.03] active:scale-[0.97]"
                  style={{
                    background: "#8B5CF6",
                    boxShadow: "0 4px 20px rgba(139,92,246,0.35)",
                  }}
                >
                  <Play className="h-4 w-4" />
                  {sections.length > 0 ? "Ver gravações" : "Acessar curso"}
                </button>
              ) : (
                <Button onClick={handleAssistir} size="md">
                  <Play className="h-4 w-4" />
                  Assistir
                </Button>
              )}

              {/* Botões de comunidade pro sync */}
              {isSync && course.whatsapp_group_url && (
                <a
                  href={course.whatsapp_group_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-dm font-semibold text-sm transition-all hover:-translate-y-0.5"
                  style={{
                    background: "rgba(37,211,102,0.12)",
                    color: "#25D366",
                    border: "1px solid rgba(37,211,102,0.25)",
                  }}
                >
                  <MessageCircle className="h-4 w-4" />
                  Grupo WhatsApp
                </a>
              )}
              {isSync && !liveMeeting && course.meet_url && (
                <a
                  href={course.meet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-dm font-semibold text-sm transition-all hover:-translate-y-0.5"
                  style={{
                    background: "rgba(139,92,246,0.12)",
                    color: "#A78BFA",
                    border: "1px solid rgba(139,92,246,0.3)",
                  }}
                >
                  <Video className="h-4 w-4" />
                  Link do Meet
                </a>
              )}
              {course.study_link_slug && course.study_link_url && (
                <a
                  href={`/formacao/${course.study_link_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-xl font-dm font-semibold text-sm transition-all hover:-translate-y-0.5"
                  style={{
                    background: "rgba(46,158,143,0.12)",
                    color: "#5ECEB8",
                    border: "1px solid rgba(46,158,143,0.3)",
                  }}
                >
                  <Users className="h-4 w-4" />
                  {course.study_link_label || "Grupo de estudo"}
                </a>
              )}

              {course.certificate_enabled && isEnrolled && (
                <Link
                  href={`/formacao/curso/${slug}/certificado`}
                  className={`flex flex-col items-center gap-1 transition-colors ${isPremium ? "text-amber-400/50 hover:text-amber-400/80" : "text-white/50 hover:text-white/80"}`}
                >
                  <Award className="h-6 w-6" />
                  <span className="font-dm text-xs">Certificado</span>
                </Link>
              )}
            </motion.div>
          </div>
        </div>

        {/* ─── Tabs + Content ─── */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-8">
          {/* Tabs */}
          <div className="flex gap-6 border-b mb-8" style={{ borderColor: isPremium ? "rgba(212,175,55,0.1)" : "rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => setActiveTab("conteudos")}
              className={`pb-3 font-dm font-semibold text-sm transition-colors relative ${
                activeTab === "conteudos" ? "text-cream" : "text-cream/40 hover:text-cream/60"
              }`}
            >
              Conteúdos
              {activeTab === "conteudos" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: isPremium ? "#d4af37" : "#2E9E8F" }} />
              )}
            </button>
            <button
              onClick={() => setActiveTab("sobre")}
              className={`pb-3 font-dm font-semibold text-sm transition-colors relative ${
                activeTab === "sobre" ? "text-cream" : "text-cream/40 hover:text-cream/60"
              }`}
            >
              Sobre
              {activeTab === "sobre" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full" style={{ background: isPremium ? "#d4af37" : "#2E9E8F" }} />
              )}
            </button>
          </div>

          {activeTab === "conteudos" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              {/* Próximos encontros — só pra cursos sync */}
              {isSync && futureMeetings.length > 0 && (
                <div
                  className="mb-8 rounded-2xl overflow-hidden"
                  style={{
                    background: "rgba(139,92,246,0.04)",
                    border: "1px solid rgba(139,92,246,0.18)",
                  }}
                >
                  <div className="px-5 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(139,92,246,0.12)" }}>
                    <Calendar size={14} style={{ color: "#A78BFA" }} />
                    <h3 className="font-dm font-semibold text-sm text-cream">Próximos encontros</h3>
                    <span className="ml-auto font-dm text-[11px]" style={{ color: "rgba(167,139,250,0.6)" }}>
                      {course.live_session_duration_minutes ?? 120}min cada
                    </span>
                  </div>
                  <div className="divide-y" style={{ borderColor: "rgba(139,92,246,0.1)" }}>
                    {futureMeetings.slice(0, 6).map((m) => {
                      const date = new Date(m.starts_at);
                      const dia = date.toLocaleDateString("pt-BR", {
                        weekday: "short", day: "2-digit", month: "short",
                        timeZone: "America/Sao_Paulo",
                      });
                      const hora = date.toLocaleTimeString("pt-BR", {
                        hour: "2-digit", minute: "2-digit",
                        timeZone: "America/Sao_Paulo",
                      });
                      return (
                        <div key={m.id} className="px-5 py-3 flex items-center gap-4">
                          <div className="min-w-[80px]">
                            <p className="font-dm text-[10px] uppercase tracking-wider" style={{ color: "rgba(167,139,250,0.6)" }}>
                              {dia.replace(".", "")}
                            </p>
                            <p className="font-fraunces font-bold text-base text-cream">{hora}</p>
                          </div>
                          <div className="flex-1">
                            <p className="font-dm text-sm text-cream/80">
                              {m.title || "Encontro ao vivo"}
                            </p>
                          </div>
                          {(m.meet_url_override || course.meet_url) && (
                            <a
                              href={m.meet_url_override || course.meet_url || "#"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-dm text-xs font-semibold transition-all hover:-translate-y-0.5"
                              style={{ background: "rgba(139,92,246,0.12)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}
                            >
                              <Video size={11} /> Link
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Modelo do curso sync — explicação rápida */}
              {isSync && (
                <div
                  className="mb-8 px-5 py-4 rounded-2xl flex items-start gap-3"
                  style={{
                    background: "rgba(139,92,246,0.025)",
                    border: "1px solid rgba(139,92,246,0.1)",
                  }}
                >
                  <Radio size={14} className="mt-0.5 flex-shrink-0" style={{ color: "#A78BFA" }} />
                  <div className="font-dm text-xs leading-relaxed" style={{ color: "rgba(253,251,247,0.55)" }}>
                    <span className="font-semibold" style={{ color: "#A78BFA" }}>Como funciona:</span> os encontros acontecem ao vivo no Google Meet. As gravações sobem aqui após cada encontro pra você assistir no seu tempo.
                  </div>
                </div>
              )}

              {/* Header + search */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-fraunces font-bold text-lg text-cream">
                  {isSync ? "Gravações no acervo" : "Todos os conteúdos"}
                </h2>
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl w-64"
                  style={{
                    background: "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <Search className="h-4 w-4 text-cream/30" />
                  <input
                    type="text"
                    placeholder="Buscar conteúdo"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-sm text-cream placeholder-cream/30 outline-none w-full font-dm"
                  />
                </div>
              </div>

              {/* Sections & Lessons list */}
              <div className="space-y-2">
                {filteredSections.map((section, sIdx) => {
                  const sectionLessons = section.lessons || [];
                  const sectionCompleted = sectionLessons.filter(
                    (l) => progressMap[l.id]?.completed
                  ).length;
                  const isExpanded = expandedSections[section.id] ?? true;
                  // Calculate global lesson index
                  let globalOffset = 0;
                  for (let i = 0; i < sIdx; i++) {
                    globalOffset += (sections[i]?.lessons?.length || 0);
                  }

                  return (
                    <div key={section.id}>
                      {/* Section header (only show if more than 1 section) */}
                      {sections.length > 1 && (
                        <button
                          onClick={() => toggleSection(section.id)}
                          className="w-full flex items-center justify-between px-4 py-3 rounded-xl mb-1 transition-colors hover:bg-white/[0.03]"
                          style={{
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-dm font-semibold text-sm text-cream">
                              {section.title}
                            </span>
                            {section.is_extra && (
                              <span
                                className="text-[10px] font-dm font-medium px-2 py-0.5 rounded-full"
                                style={{
                                  background: "rgba(139,92,246,0.1)",
                                  color: "rgba(167,139,250,0.8)",
                                  border: "1px solid rgba(139,92,246,0.2)",
                                }}
                              >
                                Extra
                              </span>
                            )}
                            {isEnrolled && (
                              <span className="font-dm text-xs text-cream/30">
                                {sectionCompleted}/{sectionLessons.length}
                              </span>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-cream/30" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-cream/30" />
                          )}
                        </button>
                      )}

                      {/* Lessons */}
                      {isExpanded && (
                        <div className="space-y-1">
                          {sectionLessons.map((lesson, lIdx) => {
                            const globalIndex = globalOffset + lIdx + 1;
                            const isCompleted = progressMap[lesson.id]?.completed;
                            const lessonProgress = isEnrolled
                              ? isCompleted
                                ? 100
                                : 0
                              : 0;

                            return (
                              <div
                                key={lesson.id}
                                className="group flex items-center gap-4 px-4 py-3 rounded-xl transition-colors hover:bg-white/[0.03] cursor-pointer"
                                onClick={() => {
                                  if (isEnrolled || course.is_free) {
                                    router.push(`/formacao/curso/${slug}/assistir`);
                                  } else {
                                    router.push(`/formacao/curso/${slug}/comprar`);
                                  }
                                }}
                              >
                                {/* Number / check */}
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                                  style={{
                                    background: isCompleted
                                      ? "rgba(46,158,143,0.15)"
                                      : "rgba(255,255,255,0.05)",
                                    border: isCompleted
                                      ? "1px solid rgba(46,158,143,0.3)"
                                      : "1px solid rgba(255,255,255,0.08)",
                                  }}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-4 w-4 text-teal" />
                                  ) : (
                                    <span className="font-dm text-xs font-medium text-cream/50">
                                      {globalIndex}
                                    </span>
                                  )}
                                </div>

                                {/* Lesson info */}
                                <div className="flex-1 min-w-0">
                                  <p className="font-dm text-sm text-cream group-hover:text-white transition-colors truncate">
                                    {lesson.title}
                                  </p>
                                  {/* Progress bar for enrolled users */}
                                  {isEnrolled && (
                                    <div className="w-full h-1 rounded-full mt-1.5 overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                                      <div
                                        className="h-full rounded-full transition-all duration-500"
                                        style={{
                                          width: `${lessonProgress}%`,
                                          background: "linear-gradient(90deg, #2E9E8F, #3ECFBE)",
                                        }}
                                      />
                                    </div>
                                  )}
                                </div>

                                {/* Duration */}
                                {lesson.duration_minutes && (
                                  <span className="flex items-center gap-1 text-xs text-cream/30 flex-shrink-0">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(lesson.duration_minutes)}
                                  </span>
                                )}

                                {/* Lock icon for non-enrolled paid courses */}
                                {!isEnrolled && !course.is_free && !lesson.is_preview && (
                                  <Lock className="h-4 w-4 text-cream/20 flex-shrink-0" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredSections.length === 0 && searchQuery && (
                  <div className="text-center py-12">
                    <Search className="h-8 w-8 text-cream/20 mx-auto mb-3" />
                    <p className="font-dm text-sm text-cream/40">
                      Nenhum conteúdo encontrado para &ldquo;{searchQuery}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === "sobre" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
              className="space-y-8"
            >
              {/* Long description */}
              {longDescription && (
                <div>
                  <h3 className="font-fraunces font-bold text-lg text-cream mb-4">
                    Sobre o curso
                  </h3>
                  <div className="font-dm text-sm text-cream/60 leading-relaxed prose prose-invert prose-sm max-w-none whitespace-pre-line">
                    {longDescription}
                  </div>
                </div>
              )}

              {/* Learning points */}
              {course.learning_points && course.learning_points.length > 0 && (
                <div>
                  <h3 className="font-fraunces font-bold text-lg text-cream mb-4">
                    O que você vai aprender
                  </h3>
                  <ul className="space-y-3">
                    {course.learning_points.map((point, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-teal mt-0.5 flex-shrink-0" />
                        <span className="font-dm text-sm text-cream/60">{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Instructor */}
              {course.instructor && course.show_instructor && (
                <div>
                  <h3 className="font-fraunces font-bold text-lg text-cream mb-4">
                    {isSync ? "Sobre o(a) professor(a)" : "Instrutor"}
                  </h3>
                  <div className="flex items-start gap-4">
                    {course.instructor.avatar_url ? (
                      <Image
                        src={course.instructor.avatar_url}
                        alt={course.instructor.full_name || ""}
                        width={56}
                        height={56}
                        className="rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: isSync ? "rgba(139,92,246,0.1)" : "rgba(200,75,49,0.1)" }}
                      >
                        <BookOpen
                          className="h-5 w-5"
                          style={{ color: isSync ? "rgba(167,139,250,0.5)" : "rgba(200,75,49,0.5)" }}
                        />
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-dm font-semibold text-sm text-cream mb-1">
                        {course.instructor.full_name}
                      </p>
                      {course.instructor_bio && (
                        <div className="font-dm text-sm leading-relaxed whitespace-pre-line" style={{ color: "rgba(253,251,247,0.55)" }}>
                          {course.instructor_bio}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Course meta */}
              <div
                className="rounded-xl p-5"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="font-dm text-xs text-cream/30 mb-1">Conteúdos</p>
                    <p className="font-dm text-sm font-medium text-cream">{totalLessons} aulas</p>
                  </div>
                  {course.total_duration_minutes && course.total_duration_minutes > 0 && (
                    <div>
                      <p className="font-dm text-xs text-cream/30 mb-1">Duração total</p>
                      <p className="font-dm text-sm font-medium text-cream">
                        {formatDuration(course.total_duration_minutes)}
                      </p>
                    </div>
                  )}
                  {course.certificate_enabled && (
                    <div>
                      <p className="font-dm text-xs text-cream/30 mb-1">Certificado</p>
                      <p className="font-dm text-sm font-medium text-cream">
                        {course.certificate_hours ? `${course.certificate_hours}h` : "Incluso"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
