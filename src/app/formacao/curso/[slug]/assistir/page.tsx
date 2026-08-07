"use client";

import { Suspense, useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import VideoPlayer, { VideoPlaceholder } from "@/components/course/VideoPlayer";
import CourseSidebar from "@/components/course/CourseSidebar";
import CourseContentTabs from "@/components/course/CourseContentTabs";
import CourseBackground from "@/components/course/CourseBackground";
import ReviewSection from "@/components/community/ReviewSection";
import Button from "@/components/ui/Button";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  Award,
  ArrowLeft,
  ChevronRight,
  SkipForward,
  PartyPopper,
  Star,
  CheckCircle2,
} from "lucide-react";
import type { Course, Section, Lesson, LessonProgress, Enrollment } from "@/types";

function CoursePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const requestedLessonId = searchParams?.get("lesson") || null;
  const { user } = useAuth();

  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [progressMap, setProgressMap] = useState<Record<string, LessonProgress>>({});
  const [favoritesSet, setFavoritesSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const allLessons = useMemo(
    () => sections.flatMap((s) => s.lessons || []),
    [sections]
  );

  // Required lessons (non-extra sections) for completion
  const requiredLessons = useMemo(
    () => sections.filter((s) => !s.is_extra).flatMap((s) => s.lessons || []),
    [sections]
  );

  const totalLessons = allLessons.length;
  const completedLessons = Object.values(progressMap).filter(
    (p) => p.completed
  ).length;

  const requiredTotal = requiredLessons.length;
  const requiredCompleted = requiredLessons.filter(
    (l) => progressMap[l.id]?.completed
  ).length;
  const allComplete = requiredTotal > 0 && requiredCompleted >= requiredTotal;

  const currentIndex = currentLesson
    ? allLessons.findIndex((l) => l.id === currentLesson.id)
    : -1;
  const nextLesson = currentIndex >= 0 && currentIndex < allLessons.length - 1
    ? allLessons[currentIndex + 1]
    : null;

  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  // Espelha o id da aula atual num ref pra que o effect de deep-link leia
  // sempre o valor mais recente SEM precisar de currentLesson nas suas deps.
  // Sem isso, o effect re-rodava a cada troca local de aula e brigava com o
  // sync de URL (router.replace é assíncrono), criando um loop aula↔aula
  // (a tela "piscava" e não dava pra marcar como concluída).
  const currentLessonIdRef = useRef<string | null>(null);
  currentLessonIdRef.current = currentLesson?.id ?? null;

  // True enquanto toggleComplete está aguardando o servidor — usado pra
  // evitar que checkCompletion (effect) rode em paralelo e marque o
  // enrollment como completed antes do toggle confirmar.
  const toggleInFlightRef = useRef(false);

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

          const allLoadedLessons = sectionsData.flatMap((s) => s.lessons || []);
          let initialLesson: Lesson | undefined;

          // 1) Lesson passada via query param (deep link / click do overview)
          if (requestedLessonId) {
            initialLesson = allLoadedLessons.find((l: Lesson) => l.id === requestedLessonId);
          }

          // 2) Última aula vista (localStorage)
          if (!initialLesson) {
            try {
              const savedLessonId = localStorage.getItem(`allos_last_lesson_${courseData.id}`);
              if (savedLessonId) {
                initialLesson = allLoadedLessons.find((l: Lesson) => l.id === savedLessonId);
              }
            } catch {
              // localStorage unavailable, ignore
            }
          }

          // 3) Fallback pra primeira aula
          if (!initialLesson) {
            initialLesson = allLoadedLessons[0];
          }

          if (initialLesson) setCurrentLesson(initialLesson);
        }

        const userId = userIdRef.current;
        if (userId) {
          const { data: enrollData } = await client
            .from("enrollments")
            .select("*")
            .eq("course_id", courseData.id)
            .eq("user_id", userId)
            .single();

          if (cancelled) return;

          // Matrícula cancelada é ausência de matrícula, e precisa ser tratada
          // aqui e não só na listagem. Sem isto, desmatricular alguém não fecha
          // nada: a pessoa continua com o vídeo tocando, e a linha `cancelled`
          // ainda impede o insert de baixo de recriá-la, então o admin vê a
          // matrícula sumir da tela e a pessoa não vê diferença nenhuma.
          if (enrollData && enrollData.status === "cancelled") {
            toast.error("Sua matrícula neste curso foi encerrada.");
            router.push("/formacao/meus-cursos");
            return;
          }

          if (enrollData) {
            setEnrollment(enrollData);
          } else if (courseData.is_free) {
            const { data: newEnroll, error: enrollError } = await client
              .from("enrollments")
              .insert({
                user_id: userId,
                course_id: courseData.id,
                status: "active",
                payment_status: "free",
              })
              .select()
              .single();
            if (!cancelled && newEnroll) {
              setEnrollment(newEnroll);
              toast.success("Você foi matriculado neste curso gratuito!");
            } else if (!cancelled && enrollError) {
              toast.error("Erro ao matricular. Tente recarregar a página.");
            }
          } else {
            if (!cancelled) router.push(`/formacao/curso/${slug}/comprar`);
            return;
          }

          const allLessonIds = sectionsData
            ?.flatMap((s) => s.lessons?.map((l: Lesson) => l.id) || [])
            || [];

          if (allLessonIds.length > 0) {
            const [progressRes, favoritesRes] = await Promise.all([
              client
                .from("lesson_progress")
                .select("*")
                .eq("user_id", userId)
                .in("lesson_id", allLessonIds),
              client
                .from("lesson_favorites")
                .select("lesson_id")
                .eq("user_id", userId)
                .in("lesson_id", allLessonIds),
            ]);
            const progressData = progressRes.data;

            if (!cancelled && favoritesRes.data) {
              setFavoritesSet(new Set(favoritesRes.data.map((f: { lesson_id: string }) => f.lesson_id)));
            }

            if (!cancelled && progressData) {
              const map: Record<string, LessonProgress> = {};
              progressData.forEach((p) => {
                map[p.lesson_id] = p;
              });
              setProgressMap(map);

              // Se nenhuma aula específica foi pedida (query param) nem está
              // salva no localStorage, pula pra primeira aula incompleta
              let hasSavedLesson = false;
              try {
                hasSavedLesson = !!localStorage.getItem(`allos_last_lesson_${courseData.id}`);
              } catch {
                // ignore
              }
              if (!requestedLessonId && !hasSavedLesson && sectionsData) {
                const allLoadedLessons = sectionsData.flatMap((s) => s.lessons || []);
                const firstIncomplete = allLoadedLessons.find(
                  (l: Lesson) => !map[l.id]?.completed
                );
                if (firstIncomplete) {
                  setCurrentLesson(firstIncomplete);
                }
              }
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
    // requestedLessonId é lido na 1ª carga (acima); navegações subsequentes
    // pra outra aula via query param são tratadas pelo effect dedicado abaixo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user?.id, router]);

  // Deep-link: ao mudar ?lesson=X na URL por uma fonte EXTERNA (back/forward,
  // link colado), troca pra essa aula sem refazer o fetch. Lê a aula atual via
  // ref e depende só de [requestedLessonId, sections] — NÃO de currentLesson —
  // pra não reagir a trocas locais de aula (que o effect abaixo já reflete na
  // URL). Reagir a currentLesson aqui criava um loop infinito com o sync de URL.
  useEffect(() => {
    if (!requestedLessonId || sections.length === 0) return;
    if (currentLessonIdRef.current === requestedLessonId) return;
    const allLoaded = sections.flatMap((s) => s.lessons || []);
    const target = allLoaded.find((l) => l.id === requestedLessonId);
    if (target) setCurrentLesson(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedLessonId, sections]);

  // Persist last viewed lesson to localStorage
  useEffect(() => {
    if (!currentLesson || !course) return;
    try {
      localStorage.setItem(`allos_last_lesson_${course.id}`, currentLesson.id);
    } catch {
      // localStorage unavailable, ignore
    }
  }, [currentLesson, course]);

  // Sincroniza ?lesson=X com a aula atual — assim recarregar/compartilhar
  // o link mantém a aula. Usa replace pra não acumular histórico.
  useEffect(() => {
    if (!currentLesson) return;
    if (requestedLessonId === currentLesson.id) return;
    const url = `/formacao/curso/${slug}/assistir?lesson=${currentLesson.id}`;
    router.replace(url, { scroll: false });
  }, [currentLesson, requestedLessonId, slug, router]);

  // ─── Offline-first: sync pending progress on load ─────────────
  useEffect(() => {
    if (!user || !course) return;
    const key = `allos_pending_progress_${course.id}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      // Pendentes têm user_id pra evitar aplicar progresso de user antigo
      // num login subsequente com user diferente.
      const pending: { userId: string; lessonId: string; completed: boolean; completedAt: string | null }[] =
        JSON.parse(raw);
      const filtered = pending.filter((p) => p.userId === user.id);
      if (filtered.length !== pending.length) {
        // Tem entrada de outro user — ignora as órfãs
        if (filtered.length === 0) {
          localStorage.removeItem(key);
          return;
        }
        localStorage.setItem(key, JSON.stringify(filtered));
      }
      if (filtered.length === 0) return;

      const client = createClient();
      const remaining: typeof filtered = [];

      (async () => {
        try {
          for (const item of filtered) {
            try {
              const { error } = await client.from("lesson_progress").upsert({
                user_id: user.id,
                lesson_id: item.lessonId,
                completed: item.completed,
                completed_at: item.completedAt,
              }, { onConflict: "user_id,lesson_id" });
              if (error) remaining.push(item);
            } catch (itemErr) {
              console.warn("[assistir] pending sync item failed:", itemErr);
              remaining.push(item);
            }
          }
          if (remaining.length === 0) {
            localStorage.removeItem(key);
          } else {
            localStorage.setItem(key, JSON.stringify(remaining));
          }
        } catch (err) {
          console.error("[assistir] pending sync IIFE error:", err);
        }
      })();
    } catch {
      // localStorage unavailable
    }
  }, [user, course]);

  const toggleComplete = useCallback(
    async (lessonId: string) => {
      if (!user) return;

      toggleInFlightRef.current = true;
      try {

      const existing = progressMap[lessonId];
      const newCompleted = !existing?.completed;
      const completedAt = newCompleted ? new Date().toISOString() : null;

      // Update local state immediately (optimistic)
      setProgressMap((prev) => ({
        ...prev,
        [lessonId]: {
          ...prev[lessonId],
          id: existing?.id || "",
          user_id: user.id,
          lesson_id: lessonId,
          completed: newCompleted,
          completed_at: completedAt,
        },
      }));

      if (newCompleted) {
        toast.success("Aula marcada como concluída!");
      }

      // Try to persist to database
      const client = createClient();
      let error;
      if (existing) {
        ({ error } = await client
          .from("lesson_progress")
          .update({ completed: newCompleted, completed_at: completedAt })
          .eq("id", existing.id));
      } else {
        ({ error } = await client.from("lesson_progress").insert({
          user_id: user.id,
          lesson_id: lessonId,
          completed: true,
          completed_at: completedAt,
        }));
      }

      if (error) {
        // Reverte o estado otimista — assim o ícone reflete o que está
        // realmente persistido. Se o user offline, o pending sync (na
        // outra useEffect) reaplica quando a conexão volta.
        setProgressMap((prev) => {
          const restored: LessonProgress = {
            ...prev[lessonId],
            id: existing?.id || "",
            user_id: user.id,
            lesson_id: lessonId,
            completed: existing?.completed ?? false,
            completed_at: existing?.completed_at ?? null,
          };
          return { ...prev, [lessonId]: restored };
        });

        try {
          const key = `allos_pending_progress_${course?.id}`;
          const raw = localStorage.getItem(key);
          const pending: { userId: string; lessonId: string; completed: boolean; completedAt: string | null }[] =
            raw ? JSON.parse(raw) : [];
          const idx = pending.findIndex(
            (p) => p.userId === user.id && p.lessonId === lessonId,
          );
          const entry = { userId: user.id, lessonId, completed: newCompleted, completedAt };
          if (idx >= 0) pending[idx] = entry; else pending.push(entry);
          localStorage.setItem(key, JSON.stringify(pending));
        } catch {
          // localStorage unavailable
        }
        toast("Progresso salvo localmente. Será sincronizado quando a conexão voltar.", { duration: 4000 });
      }
      } finally {
        toggleInFlightRef.current = false;
      }
    },
    [user, progressMap, course]
  );

  const toggleFavorite = useCallback(
    async (lessonId: string) => {
      if (!user) return;
      const wasFav = favoritesSet.has(lessonId);

      setFavoritesSet((prev) => {
        const next = new Set(prev);
        if (wasFav) next.delete(lessonId);
        else next.add(lessonId);
        return next;
      });

      const client = createClient();
      const { error } = wasFav
        ? await client
            .from("lesson_favorites")
            .delete()
            .eq("user_id", user.id)
            .eq("lesson_id", lessonId)
        : await client
            .from("lesson_favorites")
            .upsert(
              { user_id: user.id, lesson_id: lessonId },
              { onConflict: "user_id,lesson_id" },
            );

      if (error) {
        setFavoritesSet((prev) => {
          const next = new Set(prev);
          if (wasFav) next.add(lessonId);
          else next.delete(lessonId);
          return next;
        });
        toast.error("Não foi possível salvar a aula nos favoritos.");
        return;
      }
      if (!wasFav) toast.success("Aula adicionada aos favoritos!");
    },
    [user, favoritesSet],
  );

  const isSync = course?.course_type === "sync";
  const isCollection = course?.course_type === "collection";

  useEffect(() => {
    async function checkCompletion() {
      if (!allComplete || !enrollment || !course || !user) return;
      if (enrollment.status === "completed") return;
      // Sync and collection courses don't auto-complete
      if (course.course_type === "sync" || course.course_type === "collection") return;
      // Bloqueia race com toggleComplete: se a última toggle ainda não
      // confirmou (servidor pode rejeitar e reverter o progressMap),
      // não dispara o "completed" do enrollment ainda.
      if (toggleInFlightRef.current) return;

      const client = createClient();
      await client
        .from("enrollments")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", enrollment.id);

      setEnrollment((prev) =>
        prev ? { ...prev, status: "completed", completed_at: new Date().toISOString() } : null
      );

      toast.success("Parabéns! Você concluiu todas as aulas!");
    }
    checkCompletion();
  }, [allComplete, enrollment, course, user]);

  // Loading skeleton with shimmer
  if (loading) {
    return (
      <div className="relative flex" style={{ minHeight: "100vh" }}>
        <CourseBackground />
        <div className="relative z-10 flex-1 p-6 space-y-4 max-w-4xl mx-auto">
          <div className="aspect-video w-full rounded-[16px] animate-shimmer" style={{
            background: "linear-gradient(90deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.02) 100%)",
            backgroundSize: "200% 100%",
          }} />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div
          className="hidden lg:block w-80 p-4 space-y-3 relative z-10"
          style={{ borderLeft: "1px solid rgba(200,75,49,0.06)" }}
        >
          <Skeleton className="h-24 w-full" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (!course) return null;

  if (!currentLesson) {
    return (
      <div className="relative flex items-center justify-center pt-16" style={{ minHeight: "100vh" }}>
        <CourseBackground />
        <div className="relative z-10 text-center px-6 max-w-md">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
            style={{
              background: "rgba(200,75,49,0.08)",
              border: "1px solid rgba(200,75,49,0.15)",
            }}
          >
            <Award className="h-7 w-7 text-accent/50" />
          </div>
          <h2 className="font-fraunces font-bold text-xl text-cream mb-2">
            Nenhuma aula disponível
          </h2>
          <p className="text-cream/40 text-sm mb-6">
            Este curso ainda não possui aulas publicadas. Volte em breve!
          </p>
          <Link
            href="/formacao"
            className="inline-flex items-center gap-2 text-accent text-sm font-semibold hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos cursos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex" style={{ minHeight: "100vh" }}>
      {/* Animated starfield + grain + orbs */}
      <CourseBackground />

      {/* Main content */}
      <div className="relative z-10 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Breadcrumb with entrance animation */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center justify-between mb-5"
          >
            <nav className="flex items-center gap-1.5 text-sm">
              <Link
                href="/formacao"
                className="text-cream/35 hover:text-accent transition-colors font-dm"
              >
                Cursos
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-cream/20" />
              <Link
                href={`/formacao/curso/${slug}`}
                className="text-cream/35 hover:text-accent transition-colors font-dm truncate max-w-[140px] sm:max-w-[250px]"
              >
                {course.title}
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-cream/20" />
              <span className="text-cream/50 font-dm truncate max-w-[140px] sm:max-w-[200px]">
                {currentLesson.title}
              </span>
            </nav>
          </motion.div>

          {/* Video with glow backdrop */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            {/* Glow behind video */}
            <div
              className="absolute -inset-4 rounded-3xl pointer-events-none blur-3xl opacity-30"
              style={{
                background: "radial-gradient(ellipse at 50% 50%, rgba(200,75,49,0.15), rgba(46,158,143,0.05), transparent 70%)",
              }}
            />
            <div className="relative">
              {currentLesson.video_url && currentLesson.video_source ? (
                <VideoPlayer
                  url={currentLesson.video_url}
                  source={currentLesson.video_source}
                  title={currentLesson.title}
                />
              ) : (
                <VideoPlaceholder
                  title={currentLesson.title}
                  thumbnailUrl={currentLesson.thumbnail_url || course.default_lesson_thumbnail_url || undefined}
                />
              )}
            </div>
          </motion.div>

          {/* Lesson title with entrance animation */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentLesson.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col sm:flex-row items-start justify-between mt-5 sm:mt-6 mb-4 sm:mb-5 gap-3 sm:gap-4"
            >
              <div>
                <h1 className="font-fraunces font-bold text-xl sm:text-2xl text-cream tracking-tight">
                  {currentLesson.title}
                </h1>
                {course.instructor && course.show_instructor && (
                  <p className="text-sm text-cream/35 mt-1 font-dm">
                    {course.instructor.full_name}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {(() => {
                  const isDone = !!progressMap[currentLesson.id]?.completed;
                  return (
                    <motion.button
                      onClick={() => toggleComplete(currentLesson.id)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all backdrop-blur-sm"
                      style={{
                        border: `1px solid ${isDone ? "rgba(46,158,143,0.4)" : "rgba(200,75,49,0.3)"}`,
                        background: isDone ? "rgba(46,158,143,0.12)" : "rgba(200,75,49,0.08)",
                        color: isDone ? "#2E9E8F" : "#E8A28A",
                      }}
                      title={isDone ? "Marcar como não concluída" : "Marcar aula como concluída"}
                      aria-pressed={isDone}
                    >
                      <CheckCircle2
                        className="h-4 w-4"
                        style={{ fill: isDone ? "rgba(46,158,143,0.18)" : "transparent" }}
                      />
                      <span>{isDone ? "Concluída" : "Concluir"}</span>
                    </motion.button>
                  );
                })()}

                {(() => {
                  const isFav = favoritesSet.has(currentLesson.id);
                  return (
                    <motion.button
                      onClick={() => toggleFavorite(currentLesson.id)}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.95 }}
                      className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium transition-all backdrop-blur-sm"
                      style={{
                        border: `1px solid ${isFav ? "rgba(232,178,58,0.35)" : "rgba(255,255,255,0.08)"}`,
                        background: isFav ? "rgba(232,178,58,0.08)" : "rgba(255,255,255,0.03)",
                        color: isFav ? "#E8B23A" : "rgba(253,251,247,0.5)",
                      }}
                      title={isFav ? "Remover dos favoritos" : "Favoritar aula"}
                      aria-pressed={isFav}
                    >
                      <Star
                        className="h-4 w-4"
                        style={{ fill: isFav ? "#E8B23A" : "transparent" }}
                      />
                      <span className="hidden sm:inline">{isFav ? "Favoritada" : "Favoritar"}</span>
                    </motion.button>
                  );
                })()}

                {nextLesson && (
                  <motion.button
                    onClick={() => setCurrentLesson(nextLesson)}
                    whileHover={{ scale: 1.03, boxShadow: "0 4px 20px rgba(200,75,49,0.15)" }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-sm font-medium text-cream/50 hover:text-accent transition-all backdrop-blur-sm"
                    style={{
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    Próxima
                    <SkipForward className="h-4 w-4" />
                  </motion.button>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Content tabs in glass container */}
          <div
            className="rounded-[12px] sm:rounded-[16px] p-3 sm:p-5 mb-6 backdrop-blur-sm"
            style={{
              background: "rgba(255,255,255,0.015)",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <CourseContentTabs
              lesson={currentLesson}
              courseId={course.id}
            />
          </div>

          {/* Collection certificate progress */}
          {isCollection && course.cert_lessons_required && !course.is_discontinued && (
            (() => {
              const req = course.cert_lessons_required!;
              const lessonsInNextCert = completedLessons % req;
              const certsEarned = Math.floor(completedLessons / req);
              const canCertify = certsEarned > 0;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-5 rounded-[16px] relative overflow-hidden"
                  style={{
                    background: canCertify
                      ? "linear-gradient(135deg, rgba(46,158,143,0.1), rgba(200,75,49,0.05))"
                      : "rgba(255,255,255,0.02)",
                    border: canCertify
                      ? "1px solid rgba(46,158,143,0.2)"
                      : "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="font-dm text-sm font-medium text-cream mb-1">
                        {completedLessons} aula{completedLessons !== 1 ? "s" : ""} concluída{completedLessons !== 1 ? "s" : ""}
                      </p>
                      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${(lessonsInNextCert / req) * 100}%`,
                            background: "linear-gradient(90deg, #2E9E8F, #C84B31)",
                          }}
                        />
                      </div>
                      <p className="font-dm text-xs text-cream/40 mt-1.5">
                        {canCertify
                          ? `${certsEarned} certificado${certsEarned > 1 ? "s" : ""} disponível${certsEarned > 1 ? "is" : ""} · ${req - lessonsInNextCert} aula${req - lessonsInNextCert !== 1 ? "s" : ""} para o próximo`
                          : `${req - lessonsInNextCert} aula${req - lessonsInNextCert !== 1 ? "s" : ""} para o primeiro certificado`
                        }
                      </p>
                    </div>
                    {canCertify && (
                      <Button
                        onClick={() => router.push(`/formacao/curso/${course.slug}/certificado`)}
                      >
                        <Award className="h-4 w-4" />
                        Emitir certificado
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })()
          )}

          {/* Completion celebration (hidden for sync, collection, and discontinued courses) */}
          {allComplete && !isSync && !isCollection && !course?.is_discontinued && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-4 p-5 sm:p-8 rounded-[16px] sm:rounded-[20px] text-center relative overflow-hidden"
              style={{
                background: "linear-gradient(135deg, rgba(200,75,49,0.1), rgba(46,158,143,0.05))",
                border: "1px solid rgba(200,75,49,0.2)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[250px] pointer-events-none"
                style={{ background: "radial-gradient(ellipse, rgba(200,75,49,0.18) 0%, transparent 70%)" }}
              />

              <div className="relative z-10">
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.3, type: "spring", stiffness: 300 }}
                  className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{
                    background: "linear-gradient(135deg, #C84B31, #D4854A)",
                    boxShadow: "0 8px 40px rgba(200,75,49,0.4), 0 0 80px rgba(200,75,49,0.15)",
                  }}
                >
                  <PartyPopper className="h-9 w-9 text-white" />
                </motion.div>

                <h3 className="font-fraunces font-bold text-2xl text-cream mb-2">
                  Parabéns! Curso concluído!
                </h3>
                <p className="text-sm text-cream/50 mb-6 max-w-sm mx-auto">
                  Você completou todas as {requiredTotal} aulas obrigatórias deste curso. Seu esforço valeu a pena!
                  {totalLessons > requiredTotal && (
                    <span className="block mt-1" style={{ color: "rgba(167,139,250,0.6)" }}>
                      Ainda há {totalLessons - requiredTotal} aula{totalLessons - requiredTotal !== 1 ? "s" : ""} extra{totalLessons - requiredTotal !== 1 ? "s" : ""} para somar horas ao certificado!
                    </span>
                  )}
                </p>
                <div className="flex flex-wrap gap-3 justify-center">
                  {course.exam_enabled && (
                    <Button
                      onClick={() =>
                        router.push(`/formacao/curso/${course.slug}/prova`)
                      }
                    >
                      Fazer prova final
                    </Button>
                  )}
                  {!course.exam_enabled && course.certificate_enabled && (
                    <Button
                      onClick={() =>
                        router.push(
                          `/formacao/curso/${course.slug}/certificado`
                        )
                      }
                    >
                      <Award className="h-4 w-4" />
                      Emitir certificado
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Reviews with subtle background (hidden for sync courses) */}
          {enrollment && !isSync && (
            <div
              className="mt-2 -mx-6 px-6 py-4 rounded-none"
              style={{
                background: "linear-gradient(180deg, transparent, rgba(200,75,49,0.015) 30%, rgba(200,75,49,0.015) 70%, transparent)",
              }}
            >
              <ReviewSection
                courseId={course.id}
                progressPercent={
                  requiredTotal > 0
                    ? (requiredCompleted / requiredTotal) * 100
                    : 0
                }
              />
            </div>
          )}
        </div>
      </div>

      {/* Decorative line between content and sidebar */}
      <div
        className="hidden lg:block w-px flex-shrink-0 relative z-10"
        style={{
          background: "linear-gradient(180deg, transparent, rgba(200,75,49,0.12) 20%, rgba(46,158,143,0.06) 80%, transparent)",
        }}
      />

      {/* Sidebar */}
      <CourseSidebar
        sections={sections}
        currentLessonId={currentLesson.id}
        progressMap={progressMap}
        totalLessons={isCollection ? totalLessons : requiredTotal}
        completedLessons={isCollection ? completedLessons : requiredCompleted}
        onSelectLesson={setCurrentLesson}
        onToggleComplete={toggleComplete}
        favoritesSet={favoritesSet}
        onToggleFavorite={toggleFavorite}
        isSync={isSync}
        isCollection={isCollection}
        certLessonsRequired={course?.cert_lessons_required ?? undefined}
      />
    </div>
  );
}

export default function CoursePage() {
  return (
    <Suspense fallback={null}>
      <CoursePageContent />
    </Suspense>
  );
}
