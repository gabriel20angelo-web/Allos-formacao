"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Radio, Video, MessageCircle, Calendar, ChevronRight, Play } from "lucide-react";

interface SyncCourse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  whatsapp_group_url: string | null;
  meet_url: string | null;
  instructor_bio: string | null;
  live_session_duration_minutes: number | null;
  show_instructor: boolean | null;
  instructor: { id: string; full_name: string; avatar_url: string | null } | null;
  is_live_now: boolean;
  current_meeting: { id: string; starts_at: string; title: string | null; meet_url_override: string | null } | null;
  next_meeting: { id: string; starts_at: string; title: string | null; meet_url_override: string | null } | null;
  total_recordings: number;
  live_ends_at: string | null;
}

const PURPLE = "#8B5CF6";
const PURPLE_SOFT = "rgba(139,92,246,0.12)";
const PURPLE_BORDER = "rgba(139,92,246,0.4)";

function formatNextMeeting(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > 7) {
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Sao_Paulo",
    });
  }

  const dayName = date.toLocaleDateString("pt-BR", { weekday: "short", timeZone: "America/Sao_Paulo" });
  const time = date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
  if (diffDays === 0) {
    const isToday = now.toDateString() === date.toDateString();
    if (isToday) return `Hoje às ${time}`;
  }
  if (diffDays === 1) return `Amanhã às ${time}`;
  return `${dayName.replace(".", "")} ${time}`;
}

function CountdownToEnd({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  const remainingMs = new Date(endsAt).getTime() - now;
  if (remainingMs <= 0) return <>Encerrando…</>;
  const min = Math.floor(remainingMs / 60_000);
  if (min < 60) return <>Termina em {min}min</>;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return <>Termina em {h}h{m > 0 ? `${m}min` : ""}</>;
}

export default function LiveCoursesShowcase() {
  const [courses, setCourses] = useState<SyncCourse[] | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/formacao/api/sync-courses", { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        if (mounted && Array.isArray(json.courses)) setCourses(json.courses);
      } catch {
        // silent fail
      }
    }
    load();
    const interval = setInterval(load, 60_000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const { live, scheduled } = useMemo(() => {
    if (!courses) return { live: [] as SyncCourse[], scheduled: [] as SyncCourse[] };
    return {
      live: courses.filter((c) => c.is_live_now),
      scheduled: courses.filter((c) => !c.is_live_now),
    };
  }, [courses]);

  if (!courses || (live.length === 0 && scheduled.length === 0)) return null;

  return (
    <div className="relative">
      {live.length > 0 && (
        <section className="relative px-5 sm:px-6 md:px-10 pt-12 pb-6">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(ellipse at 50% 30%, rgba(139,92,246,0.10) 0%, transparent 70%)",
            }}
          />
          <div className="max-w-[1200px] mx-auto relative">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-2 mb-4"
            >
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-dm text-[10px] font-bold uppercase tracking-[0.18em]"
                style={{ background: PURPLE_SOFT, color: PURPLE, border: `1px solid ${PURPLE_BORDER}` }}
              >
                <Radio size={10} className="animate-pulse" />
                Ao vivo agora
              </span>
            </motion.div>

            <div className="space-y-4">
              {live.map((c) => (
                <LiveNowCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        </section>
      )}

      {scheduled.length > 0 && (
        <section className="relative pt-8 pb-10">
          <div className="max-w-[1200px] mx-auto px-5 sm:px-6 md:px-10">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-8"
            >
              <p
                className="font-dm font-semibold text-xs tracking-[.22em] uppercase mb-2"
                style={{ color: PURPLE }}
              >
                Ao vivo + Gravação
              </p>
              <h2
                className="font-fraunces font-bold text-[#FDFBF7] mb-2"
                style={{ fontSize: "clamp(22px,2.6vw,32px)" }}
              >
                Cursos com encontros e acervo
              </h2>
              <p
                className="font-dm text-sm max-w-xl mx-auto"
                style={{ color: "rgba(253,251,247,0.45)" }}
              >
                Acompanhe ao vivo pelo Meet ou assista as gravações no seu tempo.
              </p>
            </motion.div>
          </div>

          {/* Carousel mobile (snap-x) → grid no desktop */}
          <div
            className="md:hidden flex gap-3 overflow-x-auto snap-x snap-mandatory pb-3 px-5"
            style={{ scrollbarWidth: "none" }}
          >
            {scheduled.map((c) => (
              <div key={c.id} className="snap-start flex-shrink-0 w-[88%] xs:w-[82%]">
                <ScheduledCard course={c} />
              </div>
            ))}
          </div>
          <div className="hidden md:block max-w-[1200px] mx-auto px-5 sm:px-6 md:px-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {scheduled.map((c) => (
                <ScheduledCard key={c.id} course={c} />
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function LiveNowCard({ course }: { course: SyncCourse }) {
  const meetHref = course.current_meeting?.meet_url_override || course.meet_url;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        border: `1.5px solid ${PURPLE_BORDER}`,
        boxShadow: `0 0 0 1px rgba(139,92,246,0.2), 0 20px 60px -20px rgba(139,92,246,0.4)`,
      }}
    >
      <Link href={`/formacao/curso/${course.slug}`} className="block group">
        <div className="relative w-full aspect-[16/10] sm:aspect-[21/9] overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.02]"
              priority
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #2a1a3a, #1a1424, #0f0a18)",
              }}
            />
          )}

          {/* Overlay esquerdo (degradê pra texto) + base escura */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(8,5,15,0.92) 0%, rgba(8,5,15,0.7) 35%, rgba(8,5,15,0.25) 65%, rgba(8,5,15,0) 100%)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(8,5,15,0.6) 100%)",
            }}
          />
          {/* Glow roxo difuso */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 80% 100%, rgba(139,92,246,0.18) 0%, transparent 50%)",
            }}
          />

          {/* Badge AGORA — top left */}
          <div className="absolute top-4 left-4 sm:top-6 sm:left-6 flex items-center gap-2 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-dm text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em]"
              style={{ background: "rgba(139,92,246,0.92)", color: "#FFFFFF", backdropFilter: "blur(10px)" }}
            >
              <Radio size={11} className="animate-pulse" />
              Ao vivo agora
            </span>
            {course.live_ends_at && (
              <span
                className="hidden sm:inline-flex font-dm text-[11px]"
                style={{ color: "rgba(253,251,247,0.7)" }}
              >
                · <CountdownToEnd endsAt={course.live_ends_at} />
              </span>
            )}
          </div>

          {/* Conteúdo bottom-left */}
          <div className="absolute left-0 right-0 bottom-0 p-5 sm:p-8 md:p-10 z-10">
            <div className="max-w-[640px]">
              {course.current_meeting?.title && (
                <p
                  className="font-dm text-[11px] sm:text-xs uppercase tracking-[0.18em] mb-1.5 sm:mb-2"
                  style={{ color: "rgba(167,139,250,0.95)" }}
                >
                  {course.current_meeting.title}
                </p>
              )}
              <h3
                className="font-fraunces font-bold text-[#FDFBF7] mb-2 sm:mb-3 drop-shadow-lg"
                style={{ fontSize: "clamp(22px,3.2vw,38px)", lineHeight: 1.05 }}
              >
                {course.title}
              </h3>
              {course.instructor && course.show_instructor && (
                <p
                  className="font-dm text-xs sm:text-sm mb-4 sm:mb-5"
                  style={{ color: "rgba(253,251,247,0.7)" }}
                >
                  {course.instructor.full_name}
                </p>
              )}
              {course.live_ends_at && (
                <p
                  className="sm:hidden font-dm text-[11px] mb-3"
                  style={{ color: "rgba(167,139,250,0.85)" }}
                >
                  <CountdownToEnd endsAt={course.live_ends_at} />
                </p>
              )}

              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                {meetHref && (
                  <a
                    href={meetHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-dm text-xs sm:text-sm font-bold transition-all hover:-translate-y-0.5"
                    style={{
                      background: PURPLE,
                      color: "#FFFFFF",
                      boxShadow: "0 8px 24px rgba(139,92,246,0.45)",
                    }}
                  >
                    <Video size={14} /> Entrar no Meet <ChevronRight size={12} />
                  </a>
                )}
                {course.whatsapp_group_url && (
                  <a
                    href={course.whatsapp_group_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 rounded-xl font-dm text-xs sm:text-sm font-semibold transition-all hover:-translate-y-0.5"
                    style={{
                      background: "rgba(37,211,102,0.18)",
                      color: "#3DDB7C",
                      border: "1px solid rgba(37,211,102,0.3)",
                      backdropFilter: "blur(8px)",
                    }}
                  >
                    <MessageCircle size={14} /> Grupo
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function ScheduledCard({ course }: { course: SyncCourse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="group relative rounded-2xl overflow-hidden"
      style={{
        border: `1px solid rgba(139,92,246,0.25)`,
        boxShadow: "0 12px 40px -16px rgba(139,92,246,0.25)",
      }}
    >
      <Link href={`/formacao/curso/${course.slug}`} className="block">
        <div className="relative w-full aspect-[16/10] overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 90vw, 600px"
              className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #2a1a3a, #1a1424)" }}
            />
          )}

          {/* Overlay degradê pra texto */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(8,5,15,0.05) 0%, rgba(8,5,15,0.35) 40%, rgba(8,5,15,0.92) 100%)",
            }}
          />
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 90% 100%, rgba(139,92,246,0.16) 0%, transparent 55%)",
            }}
          />

          {/* Badge top-left */}
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-dm text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background: "rgba(139,92,246,0.85)",
                color: "#FFFFFF",
                backdropFilter: "blur(10px)",
              }}
            >
              <Play size={9} fill="#FFFFFF" />
              Ao vivo + Gravação
            </span>
          </div>

          {/* Ícones quick-access top-right */}
          <div className="absolute top-3 right-3 sm:top-4 sm:right-4 flex items-center gap-1.5 z-10">
            {course.whatsapp_group_url && (
              <a
                href={course.whatsapp_group_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-110"
                style={{
                  background: "rgba(37,211,102,0.85)",
                  color: "#FFFFFF",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 4px 14px rgba(37,211,102,0.35)",
                }}
                title="Grupo do WhatsApp"
                aria-label="Entrar no grupo do WhatsApp"
              >
                <MessageCircle size={14} />
              </a>
            )}
            {course.meet_url && (
              <a
                href={course.meet_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center justify-center w-9 h-9 rounded-full transition-all hover:scale-110"
                style={{
                  background: "rgba(139,92,246,0.92)",
                  color: "#FFFFFF",
                  backdropFilter: "blur(10px)",
                  boxShadow: "0 4px 14px rgba(139,92,246,0.4)",
                }}
                title="Link do Meet"
                aria-label="Abrir link do Meet"
              >
                <Video size={14} />
              </a>
            )}
          </div>

          {/* Conteúdo bottom — sobreposto à imagem */}
          <div className="absolute left-0 right-0 bottom-0 p-4 sm:p-5 z-10">
            <h3
              className="font-fraunces font-bold text-[#FDFBF7] line-clamp-2 leading-tight mb-1 drop-shadow-lg"
              style={{ fontSize: "clamp(16px,1.6vw,20px)" }}
            >
              {course.title}
            </h3>
            {course.instructor && course.show_instructor && (
              <p
                className="font-dm text-[11px] sm:text-xs mb-2.5"
                style={{ color: "rgba(253,251,247,0.65)" }}
              >
                {course.instructor.full_name}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {course.next_meeting && (
                <div
                  className="flex items-center gap-1.5 font-dm text-[11px] font-medium"
                  style={{ color: "#A78BFA" }}
                >
                  <Calendar size={11} />
                  <span>{formatNextMeeting(course.next_meeting.starts_at)}</span>
                </div>
              )}
              {course.total_recordings > 0 && (
                <div
                  className="flex items-center gap-1.5 font-dm text-[11px]"
                  style={{ color: "rgba(253,251,247,0.55)" }}
                >
                  <Play size={10} />
                  <span>
                    {course.total_recordings} {course.total_recordings === 1 ? "gravação" : "gravações"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
