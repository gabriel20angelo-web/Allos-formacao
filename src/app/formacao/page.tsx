"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { BookOpen, Bell, Mail, Archive, GraduationCap, Sparkles, Star, Users, Clock } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCategories } from "@/hooks/useCategories";
import HeroFormacao from "@/components/formacao/HeroFormacao";
import CourseBackground from "@/components/course/CourseBackground";
import { toast } from "sonner";
import { formatDuration } from "@/lib/utils/format";
import type { Course } from "@/types";

// Below-the-fold components — defer their JS off the initial bundle.
const CategoryCarousel = dynamic(
  () => import("@/components/formacao/CategoryCarousel"),
  { ssr: false }
);
const SyncGroupsSection = dynamic(
  () => import("@/components/formacao/SyncGroupsSection"),
  { ssr: false }
);
const LiveCoursesShowcase = dynamic(
  () => import("@/components/formacao/LiveCoursesShowcase"),
  { ssr: false }
);
const DownloadAppCard = dynamic(
  () => import("@/components/formacao/DownloadAppCard"),
  { ssr: false }
);


export default function FormacaoPage() {
  const { profile } = useAuth();
  const { categories: hookCategories } = useCategories();
  const [courses, setCourses] = useState<Course[]>([]);
  const [serverCategories, setServerCategories] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);

  // Notify email state
  const [notifyEmail, setNotifyEmail] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  // Prefer server-side categories (fetched in the same call as courses) over
  // the hook's direct Supabase query — the hook can fail for clients whose
  // network blocks *.supabase.co, causing the hook to fall back to defaults.
  const categories = serverCategories ?? hookCategories;

  useEffect(() => {
    let cancelled = false;
    async function fetchHomeData() {
      try {
        // Same-origin server endpoint — bypasses any client-side block of
        // syiaushvzhgyhvsmoegt.supabase.co (Private Relay / adblock / ISP).
        // Cache deixado como default — endpoint server tem
        // s-maxage=30, stale-while-revalidate=300 que o CDN respeita.
        const res = await fetch("/formacao/api/home-data");
        if (!res.ok) throw new Error(`home-data ${res.status}`);
        const payload: { courses: Course[]; categories: string[] } =
          await res.json();
        if (cancelled) return;
        setCourses(payload.courses || []);
        if (Array.isArray(payload.categories)) {
          setServerCategories(payload.categories);
        }
      } catch (err) {
        console.error("Erro ao carregar cursos (fallback pro client):", err);
        // Fallback: try the direct Supabase query so local dev without the
        // route handler still works.
        try {
          const client = createClient();
          const { data } = await client
            .from("courses")
            .select(
              `*, instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url)`
            )
            .eq("status", "published")
            .or("is_discontinued.is.null,is_discontinued.eq.false")
            .order("display_order", { ascending: true })
            .order("created_at", { ascending: false });
          if (!cancelled && data) setCourses(data as Course[]);
        } catch {
          // swallow — UI shows empty state
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHomeData();
    return () => { cancelled = true; };
  }, []);

  // Cursos sync ("Ao vivo + Gravação") aparecem só no LiveCoursesShowcase pra
  // não duplicarem nas outras seções com identidade visual conflitante.
  const nonSyncCourses = useMemo(
    () => courses.filter((c) => c.course_type !== "sync"),
    [courses]
  );

  // Separate structured courses from the rest
  const structuredCourses = useMemo(
    () => nonSyncCourses.filter((c) => c.is_structured),
    [nonSyncCourses]
  );

  const regularCourses = useMemo(
    () => nonSyncCourses.filter((c) => !c.is_structured),
    [nonSyncCourses]
  );

  // Featured courses (from all courses, not just regular)
  const featuredCourses = useMemo(
    () => nonSyncCourses.filter((c) => c.featured),
    [nonSyncCourses]
  );

  // Group regular courses by category (excluding featured)
  const coursesByCategory = useMemo(() => {
    const grouped: { title: string; courses: Course[] }[] = [];

    // Group by each known category
    for (const cat of categories) {
      const catCourses = regularCourses.filter((c) => c.category === cat);
      if (catCourses.length > 0) {
        grouped.push({ title: cat, courses: catCourses });
      }
    }

    // Courses without a known category go into "Sem categoria"
    const categorized = new Set(categories);
    const uncategorized = regularCourses.filter(
      (c) => !c.category || !categorized.has(c.category)
    );
    if (uncategorized.length > 0) {
      grouped.push({ title: "Sem categoria", courses: uncategorized });
    }

    return grouped;
  }, [regularCourses, categories]);

  async function handleNotifySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!notifyEmail.trim()) return;
    setNotifySending(true);
    try {
      const client = createClient();
      await client.from("notify_subscribers").insert({ email: notifyEmail.trim() });
      toast.success("Pronto! Vamos te avisar quando novos cursos lançarem.");
      setNotifyEmail("");
    } catch {
      toast.error("Erro ao registrar. Tente novamente.");
    } finally {
      setNotifySending(false);
    }
  }

  return (
    <div className="relative">
      {/* Starfield + grain background */}
      <CourseBackground />

      {/* Hero */}
      <div className="relative z-10">
        <HeroFormacao />

        {/* Live courses (sync) — Zona 1 (AGORA) + Zona 2 (próximos) */}
        <LiveCoursesShowcase />

        {/* Featured courses - premium gold section */}
        {!loading && featuredCourses.length > 0 && (
          <section className="pt-10 sm:pt-14 pb-6">
            <div className="max-w-[1000px] mx-auto px-5 sm:px-6 md:px-8">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-8"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <h2 className="font-fraunces font-bold text-lg sm:text-xl text-cream tracking-tight">
                    Em destaque
                  </h2>
                  <Sparkles className="h-4 w-4 text-amber-400" />
                </div>
              </motion.div>

              <div
                className={`grid gap-5 sm:gap-6 ${
                  featuredCourses.length === 1
                    ? "grid-cols-1 max-w-[360px] mx-auto"
                    : featuredCourses.length === 2
                    ? "grid-cols-1 sm:grid-cols-2 max-w-[680px] mx-auto"
                    : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
                }`}
              >
                {featuredCourses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1, duration: 0.5 }}
                  >
                    <Link href={`/formacao/curso/${course.slug}`}>
                      <div
                        className="group relative aspect-[9/13] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.03]"
                        style={{
                          border: "1px solid rgba(212,175,55,0.25)",
                          boxShadow: "0 0 30px rgba(212,175,55,0.08), 0 0 60px rgba(212,175,55,0.04)",
                        }}
                      >
                        {/* Image */}
                        {course.thumbnail_url ? (
                          <Image
                            src={course.thumbnail_url}
                            alt={course.title}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 30vw, 240px"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(135deg, #1a1508 0%, #0F0F0F 100%)",
                            }}
                          />
                        )}

                        {/* Gradient overlay */}
                        <div
                          className="absolute inset-0 transition-opacity duration-300"
                          style={{
                            background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.8) 100%)",
                          }}
                        />

                        {/* Gold shimmer on top edge */}
                        <div
                          className="absolute top-0 left-0 right-0 h-[1px]"
                          style={{
                            background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.5) 30%, rgba(255,215,0,0.7) 50%, rgba(212,175,55,0.5) 70%, transparent 100%)",
                          }}
                        />

                        {/* Featured label */}
                        {course.featured_label && (
                          <div className="absolute top-3 left-3 z-10">
                            <span
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider"
                              style={{
                                background: "linear-gradient(135deg, rgba(212,175,55,0.2), rgba(184,134,11,0.15))",
                                color: "#d4af37",
                                border: "1px solid rgba(212,175,55,0.3)",
                                backdropFilter: "blur(8px)",
                              }}
                            >
                              <Sparkles className="h-2.5 w-2.5" />
                              {course.featured_label}
                            </span>
                          </div>
                        )}

                        {/* Bottom content */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                          <h3 className="font-fraunces font-bold text-base sm:text-lg text-cream leading-tight line-clamp-2 mb-1.5">
                            {course.title}
                          </h3>
                          {course.instructor && course.show_instructor && (
                            <p className="text-xs text-cream/50 font-dm mb-3">
                              {course.instructor.full_name}
                            </p>
                          )}

                          {/* Meta row */}
                          <div className="flex items-center gap-3 text-[11px] text-amber-200/40 mb-3">
                            {course.average_rating !== undefined && course.average_rating > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                                <span className="text-amber-200/70 font-medium">
                                  {course.average_rating.toFixed(1)}
                                </span>
                              </span>
                            )}
                            {course.enrollments_count !== undefined && course.enrollments_count > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {course.enrollments_count}
                              </span>
                            )}
                            {course.total_duration_minutes && course.total_duration_minutes > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(course.total_duration_minutes)}
                              </span>
                            )}
                          </div>

                          {/* Description on hover */}
                          {course.description && (
                            <p className="font-dm text-[11px] leading-relaxed text-cream/40 line-clamp-3 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:block">
                              {course.description}
                            </p>
                          )}

                          {/* Gold CTA */}
                          <span
                            className="inline-flex items-center justify-center w-full py-2.5 rounded-xl text-xs font-dm font-semibold transition-all opacity-0 group-hover:opacity-100 duration-300"
                            style={{
                              background: "linear-gradient(135deg, #d4af37, #b8860b)",
                              color: "#1a1508",
                              boxShadow: "0 4px 20px rgba(212,175,55,0.3)",
                            }}
                          >
                            {course.is_free ? "Começar grátis →" : "Ver curso →"}
                          </span>
                        </div>

                        {/* Hover gold border glow */}
                        <div
                          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{
                            border: "1.5px solid rgba(212,175,55,0.4)",
                            boxShadow: "inset 0 0 30px rgba(212,175,55,0.06), 0 0 40px rgba(212,175,55,0.12)",
                          }}
                        />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="max-w-[1200px] mx-auto px-6 mt-10">
              <div
                className="h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.15) 30%, rgba(212,175,55,0.25) 50%, rgba(212,175,55,0.15) 70%, transparent 100%)",
                }}
              />
            </div>
          </section>
        )}

        {/* Structured courses section — premium highlight */}
        {!loading && structuredCourses.length > 0 && (
          <section className="pt-10 sm:pt-14 pb-4 relative">
            {/* Subtle premium background glow */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: "radial-gradient(ellipse 80% 60% at 50% 20%, rgba(212,175,55,0.04) 0%, transparent 70%)",
              }}
            />

            <div className="relative px-5 sm:px-6 md:px-8 max-w-[1400px] mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{
                      background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.08))",
                      border: "1px solid rgba(212,175,55,0.25)",
                    }}
                  >
                    <GraduationCap className="h-4 w-4 text-amber-400" />
                  </div>
                  <h2
                    className="font-fraunces font-bold text-xl sm:text-2xl tracking-tight"
                    style={{
                      background: "linear-gradient(135deg, #FDFBF7 0%, #d4af37 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    Cursos
                  </h2>
                </div>
                <p className="text-sm text-cream/45 font-dm ml-[44px]">
                  Conteúdos estruturados com começo, meio e fim
                </p>
                {/* Gold accent line */}
                <div
                  className="mt-4 ml-[44px] h-[1px] w-32"
                  style={{
                    background: "linear-gradient(90deg, rgba(212,175,55,0.4) 0%, transparent 100%)",
                  }}
                />
              </motion.div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                {structuredCourses.map((course, i) => (
                  <motion.div
                    key={course.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.5 }}
                  >
                    <Link href={`/formacao/curso/${course.slug}`}>
                      <div
                        className="group relative aspect-[3/4] rounded-2xl overflow-hidden cursor-pointer transition-all duration-500 hover:scale-[1.03]"
                        style={{
                          border: "1px solid rgba(212,175,55,0.18)",
                          boxShadow: "0 0 24px rgba(212,175,55,0.05), 0 0 48px rgba(212,175,55,0.03)",
                        }}
                      >
                        {course.thumbnail_url ? (
                          <Image
                            src={course.thumbnail_url}
                            alt={course.title}
                            fill
                            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 260px"
                            className="object-cover transition-transform duration-700 group-hover:scale-110"
                          />
                        ) : (
                          <div
                            className="absolute inset-0"
                            style={{
                              background: "linear-gradient(135deg, #1a1508 0%, #0F0F0F 100%)",
                            }}
                          />
                        )}

                        {/* Gradient overlay */}
                        <div
                          className="absolute inset-0 transition-opacity duration-300"
                          style={{
                            background: "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.15) 40%, rgba(0,0,0,0.82) 100%)",
                          }}
                        />

                        {/* Top gold shimmer line */}
                        <div
                          className="absolute top-0 left-0 right-0 h-[1px]"
                          style={{
                            background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.35) 30%, rgba(255,215,0,0.5) 50%, rgba(212,175,55,0.35) 70%, transparent 100%)",
                          }}
                        />

                        {/* Structured badge */}
                        <div className="absolute top-3 left-3 z-10">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider"
                            style={{
                              background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(184,134,11,0.1))",
                              color: "#d4af37",
                              border: "1px solid rgba(212,175,55,0.25)",
                              backdropFilter: "blur(8px)",
                            }}
                          >
                            <GraduationCap className="h-2.5 w-2.5" />
                            Curso
                          </span>
                        </div>

                        {/* Bottom content */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                          <p className="font-fraunces font-bold text-base sm:text-lg text-cream leading-tight line-clamp-2 mb-1">
                            {course.title}
                          </p>
                          {course.instructor && course.show_instructor && (
                            <p className="text-[11px] text-amber-200/40 mt-1 font-dm">
                              {course.instructor.full_name}
                            </p>
                          )}

                          {/* Description on hover */}
                          {course.description && (
                            <p className="font-dm text-[10px] leading-relaxed text-cream/35 line-clamp-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 hidden sm:block">
                              {course.description}
                            </p>
                          )}

                          {/* Duration info */}
                          {course.total_duration_minutes && course.total_duration_minutes > 0 && (
                            <div className="flex items-center gap-1 mt-2 text-[10px] text-amber-200/30">
                              <Clock className="h-2.5 w-2.5" />
                              {formatDuration(course.total_duration_minutes)}
                            </div>
                          )}
                        </div>

                        {/* Hover gold border glow */}
                        <div
                          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                          style={{
                            border: "1.5px solid rgba(212,175,55,0.35)",
                            boxShadow: "inset 0 0 20px rgba(212,175,55,0.05), 0 0 30px rgba(212,175,55,0.1)",
                          }}
                        />
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Gold-tinted divider */}
            <div className="max-w-[1200px] mx-auto px-6 mt-10">
              <div
                className="h-[1px]"
                style={{
                  background: "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.12) 30%, rgba(212,175,55,0.2) 50%, rgba(212,175,55,0.12) 70%, transparent 100%)",
                }}
              />
            </div>
          </section>
        )}

        {/* Category carousels */}
        <section className="py-10 sm:py-14">
          {loading ? (
            // Skeleton carousels
            <div className="space-y-12">
              {[0, 1].map((i) => (
                <div key={i} className="px-5 sm:px-6 md:px-8">
                  <div className="h-6 w-48 rounded-md bg-white/5 mb-5 animate-pulse" />
                  <div className="flex gap-4 overflow-hidden">
                    {[0, 1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="flex-shrink-0 w-[220px] sm:w-[250px] md:w-[280px] lg:w-[300px] aspect-[3/4] rounded-2xl bg-white/[0.03] animate-pulse"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : coursesByCategory.length > 0 ? (
            <>
              {/* Section header for recordings */}
              {structuredCourses.length > 0 && (
                <div className="px-5 sm:px-6 md:px-8 max-w-[1400px] mx-auto mb-6">
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1px solid rgba(255,255,255,0.08)",
                      }}
                    >
                      <BookOpen className="h-3.5 w-3.5 text-cream/40" />
                    </div>
                    <h2 className="font-fraunces font-bold text-lg text-cream/70 tracking-tight">
                      Gravações de encontros
                    </h2>
                  </div>
                  <p className="text-xs text-cream/25 font-dm ml-[38px]">
                    Encontros gravados organizados por tema
                  </p>
                </div>
              )}
              {coursesByCategory.map((group, i) => (
                <CategoryCarousel
                  key={group.title}
                  title={group.title}
                  courses={group.courses}
                  index={i}
                />
              ))}
            </>
          ) : (
            // Empty state
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-24 px-5"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
                style={{
                  background: "linear-gradient(135deg, rgba(200,75,49,0.12), rgba(163,61,39,0.06))",
                  border: "1px solid rgba(200,75,49,0.15)",
                }}
              >
                <BookOpen className="h-7 w-7 text-accent" />
              </div>
              <h3 className="font-fraunces font-bold text-xl text-cream mb-2">
                Em breve novos cursos
              </h3>
              <p className="text-cream/40 text-sm font-dm mb-6 max-w-sm mx-auto">
                Estamos preparando conteúdos incríveis para você. Deixe seu email e seja o primeiro a saber!
              </p>

              <div className="max-w-md mx-auto space-y-4">
                <form onSubmit={handleNotifySubmit} className="flex gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
                    <input
                      type="email"
                      value={notifyEmail}
                      onChange={(e) => setNotifyEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      className="w-full pl-11 pr-4 py-3 rounded-xl text-sm text-cream placeholder:text-cream/25 focus:outline-none transition-all"
                      style={{
                        background: "rgba(255,255,255,0.04)",
                        border: "1.5px solid rgba(255,255,255,0.08)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "rgba(200,75,49,0.4)";
                        e.currentTarget.style.boxShadow = "0 0 0 3px rgba(200,75,49,0.08)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>
                  <motion.button
                    type="submit"
                    disabled={notifySending}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    className="px-6 py-3 rounded-xl font-dm font-semibold text-sm text-white transition-all disabled:opacity-50"
                    style={{
                      background: "linear-gradient(135deg, #C84B31, #A33D27)",
                      boxShadow: "0 4px 16px rgba(200,75,49,0.25)",
                    }}
                  >
                    {notifySending ? "..." : "Notifique-me"}
                  </motion.button>
                </form>

                <a
                  href="https://instagram.com/associacaoallos"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 font-dm font-medium text-xs text-cream/35 hover:text-accent transition-colors"
                >
                  <Bell className="h-3.5 w-3.5" />
                  Ou acompanhe pelo Instagram
                </a>
              </div>
            </motion.div>
          )}
        </section>

        {/* Download app card */}
        <div className="px-5 sm:px-6 md:px-8 py-10">
          <DownloadAppCard />
        </div>

        {/* Discontinued courses link */}
        <div className="max-w-[1200px] mx-auto px-6 py-8 text-center">
          <Link
            href="/formacao/acervo"
            className="inline-flex items-center gap-2 font-dm text-xs text-cream/20 hover:text-cream/40 transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            Ver cursos e grupos descontinuados
          </Link>
        </div>

        {/* Divider */}
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="divider-gradient" />
        </div>

        {/* Synchronous groups - live schedule */}
        <SyncGroupsSection />
      </div>
    </div>
  );
}
