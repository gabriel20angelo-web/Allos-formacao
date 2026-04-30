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
        <section className="relative px-5 sm:px-6 md:px-10 pt-8 pb-10">
          <div className="max-w-[1200px] mx-auto">
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        background: "linear-gradient(135deg, rgba(139,92,246,0.10), rgba(139,92,246,0.02) 60%, rgba(0,0,0,0.4))",
        border: `1.5px solid ${PURPLE_BORDER}`,
        boxShadow: `0 0 0 1px rgba(139,92,246,0.2), 0 20px 60px -20px rgba(139,92,246,0.4)`,
      }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          boxShadow: `inset 0 0 100px rgba(139,92,246,0.08)`,
        }}
      />
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-0 relative">
        <div className="sm:col-span-5 relative aspect-[16/9] sm:aspect-auto sm:min-h-[260px] overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 640px) 100vw, 480px"
              className="object-cover"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #2a1a3a, #1a1424, #0f0a18)",
              }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(90deg, rgba(0,0,0,0) 40%, rgba(15,10,24,0.92) 100%)",
            }}
          />
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-dm text-[10px] font-bold uppercase tracking-[0.16em]"
              style={{ background: "rgba(139,92,246,0.85)", color: "#FFFFFF", backdropFilter: "blur(8px)" }}
            >
              <Radio size={10} className="animate-pulse" />
              Agora
            </span>
          </div>
        </div>

        <div className="sm:col-span-7 p-6 sm:p-8 flex flex-col justify-center">
          {course.current_meeting?.title && (
            <p
              className="font-dm text-[11px] uppercase tracking-[0.18em] mb-1.5"
              style={{ color: "rgba(167,139,250,0.85)" }}
            >
              {course.current_meeting.title}
            </p>
          )}
          <h3
            className="font-fraunces font-bold text-[#FDFBF7] mb-2"
            style={{ fontSize: "clamp(22px,2.4vw,30px)", lineHeight: 1.1 }}
          >
            {course.title}
          </h3>
          {course.instructor && (
            <p className="font-dm text-sm mb-1" style={{ color: "rgba(253,251,247,0.6)" }}>
              {course.instructor.full_name}
            </p>
          )}
          {course.live_ends_at && (
            <p className="font-dm text-xs mb-5" style={{ color: "rgba(167,139,250,0.7)" }}>
              <CountdownToEnd endsAt={course.live_ends_at} />
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2.5">
            {meetHref && (
              <a
                href={meetHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-dm text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{
                  background: PURPLE,
                  color: "#FFFFFF",
                  boxShadow: "0 8px 24px rgba(139,92,246,0.4)",
                }}
              >
                <Video size={16} /> Entrar no Meet <ChevronRight size={14} />
              </a>
            )}
            {course.whatsapp_group_url && (
              <a
                href={course.whatsapp_group_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-dm text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: "rgba(37,211,102,0.1)",
                  color: "#25D366",
                  border: "1px solid rgba(37,211,102,0.2)",
                }}
              >
                <MessageCircle size={14} /> Grupo
              </a>
            )}
            <Link
              href={`/formacao/curso/${course.slug}`}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-dm text-sm font-medium transition-all hover:bg-white/5"
              style={{ color: "rgba(253,251,247,0.65)" }}
            >
              Detalhes <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function ScheduledCard({ course }: { course: SyncCourse }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="group relative rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(139,92,246,0.025)",
        border: "1px solid rgba(139,92,246,0.18)",
        borderLeftWidth: 3,
        borderLeftColor: PURPLE,
      }}
    >
      <Link href={`/formacao/curso/${course.slug}`} className="block">
        <div className="relative aspect-[16/9] overflow-hidden">
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              sizes="(max-width: 768px) 100vw, 400px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div
              className="absolute inset-0"
              style={{ background: "linear-gradient(135deg, #2a1a3a, #1a1424)" }}
            />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.6) 100%)",
            }}
          />
          <div className="absolute top-3 left-3">
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-dm text-[10px] font-bold uppercase tracking-[0.14em]"
              style={{
                background: "rgba(139,92,246,0.85)",
                color: "#FFFFFF",
                backdropFilter: "blur(8px)",
              }}
            >
              <Play size={9} fill="#FFFFFF" />
              Ao vivo + Gravação
            </span>
          </div>
        </div>
      </Link>

      <div className="p-4 flex-1 flex flex-col">
        <Link href={`/formacao/curso/${course.slug}`} className="block group/title">
          <h3 className="font-fraunces font-bold text-base text-[#FDFBF7] mb-1 line-clamp-2 leading-tight group-hover/title:text-white">
            {course.title}
          </h3>
        </Link>
        {course.instructor && (
          <p className="font-dm text-xs mb-3" style={{ color: "rgba(253,251,247,0.45)" }}>
            {course.instructor.full_name}
          </p>
        )}

        <div className="space-y-1.5 mb-4">
          {course.next_meeting && (
            <div className="flex items-center gap-1.5 font-dm text-[11px]" style={{ color: "rgba(167,139,250,0.85)" }}>
              <Calendar size={11} />
              <span>Próximo: {formatNextMeeting(course.next_meeting.starts_at)}</span>
            </div>
          )}
          {course.total_recordings > 0 && (
            <div className="flex items-center gap-1.5 font-dm text-[11px]" style={{ color: "rgba(253,251,247,0.4)" }}>
              <Play size={10} />
              <span>{course.total_recordings} {course.total_recordings === 1 ? "gravação" : "gravações"} no acervo</span>
            </div>
          )}
        </div>

        <div className="mt-auto flex items-center gap-2">
          {course.whatsapp_group_url && (
            <a
              href={course.whatsapp_group_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:-translate-y-0.5"
              style={{
                background: "rgba(37,211,102,0.1)",
                color: "#25D366",
                border: "1px solid rgba(37,211,102,0.2)",
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
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all hover:-translate-y-0.5"
              style={{
                background: PURPLE_SOFT,
                color: PURPLE,
                border: `1px solid ${PURPLE_BORDER}`,
              }}
              title="Link do Meet"
              aria-label="Abrir link do Meet"
            >
              <Video size={14} />
            </a>
          )}
          <Link
            href={`/formacao/curso/${course.slug}`}
            className="ml-auto inline-flex items-center gap-1 font-dm text-xs font-semibold transition-all hover:gap-2"
            style={{ color: PURPLE }}
          >
            Ver curso <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
