"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  Play,
  CheckCircle2,
  Clock,
  ListVideo,
  X,
  Pause,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Section, Lesson, LessonProgress } from "@/types";
import { formatDuration } from "@/lib/utils/format";

interface CourseSidebarProps {
  sections: Section[];
  currentLessonId: string;
  progressMap: Record<string, LessonProgress>;
  totalLessons: number;
  completedLessons: number;
  onSelectLesson: (lesson: Lesson) => void;
  onToggleComplete: (lessonId: string) => void;
  isSync?: boolean;
}

/* Circular progress ring */
function ProgressRing({ percent, size = 56 }: { percent: number; size?: number }) {
  const stroke = 3;
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (percent / 100) * circ;
  const done = percent >= 100;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={stroke}
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={done ? "#2E9E8F" : "#C84B31"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.span
          key={Math.round(percent)}
          initial={{ scale: 1.2 }}
          animate={{ scale: 1 }}
          className="font-fraunces font-bold text-sm tabular-nums"
          style={{ color: done ? "#2E9E8F" : "#C84B31" }}
        >
          {Math.round(percent)}%
        </motion.span>
      </div>
    </div>
  );
}

export default function CourseSidebar({
  sections,
  currentLessonId,
  progressMap,
  totalLessons,
  completedLessons,
  onSelectLesson,
  onToggleComplete,
  isSync,
}: CourseSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => {
      const set = new Set<string>();
      sections.forEach((section, i) => {
        if (i < 2 || section.lessons?.some((l) => l.id === currentLessonId)) {
          set.add(section.id);
        }
      });
      return set;
    }
  );

  useEffect(() => {
    for (const section of sections) {
      if (section.lessons?.some((l) => l.id === currentLessonId)) {
        setExpandedSections((prev) => {
          if (prev.has(section.id)) return prev;
          const next = new Set(prev);
          next.add(section.id);
          return next;
        });
        break;
      }
    }
  }, [currentLessonId, sections]);

  const progressPercent =
    totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;
  const done = progressPercent >= 100;

  function toggleSection(sectionId: string) {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }

  const motivational = done
    ? "Concluído!"
    : progressPercent >= 90
      ? "Quase lá!"
      : progressPercent >= 60
        ? "Falta pouco!"
        : progressPercent >= 30
          ? "Bom ritmo!"
          : progressPercent > 0
            ? "Bom começo!"
            : "Comece agora!";

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* ─── Progress header with ring (or sync header) ─── */}
      <div className="p-5 relative overflow-hidden">
        {isSync ? (
          <>
            <div
              className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none blur-2xl"
              style={{ background: "rgba(46,158,143,0.12)" }}
            />
            <div className="relative z-10 flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(46,158,143,0.1)", border: "1px solid rgba(46,158,143,0.2)" }}
              >
                <Play className="h-6 w-6 text-[#2E9E8F]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-dm font-semibold text-[15px] text-cream">
                  Grupo síncrono
                </p>
                <p className="text-[13px] text-cream/35 mt-0.5">
                  {totalLessons} {totalLessons === 1 ? "gravação disponível" : "gravações disponíveis"}
                </p>
                <p className="text-xs font-medium mt-1.5" style={{ color: "#2E9E8F" }}>
                  Curso ao vivo
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Ambient glow */}
            <div
              className="absolute -top-6 -right-6 w-28 h-28 rounded-full pointer-events-none blur-2xl"
              style={{ background: done ? "rgba(46,158,143,0.12)" : `rgba(200,75,49,${0.04 + progressPercent * 0.002})` }}
            />

            <div className="relative z-10 flex items-center gap-4">
              <ProgressRing percent={progressPercent} size={64} />
              <div className="flex-1 min-w-0">
                <p className="font-dm font-semibold text-[15px] text-cream">
                  Seu progresso
                </p>
                <p className="text-[13px] text-cream/35 mt-0.5">
                  {completedLessons} de {totalLessons} aulas
                </p>
                <p className="text-xs font-medium mt-1.5" style={{ color: done ? "#2E9E8F" : "#C84B31" }}>
                  {motivational}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Bottom divider */}
        <div className="mt-4 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(200,75,49,0.12), transparent)" }} />
      </div>

      {/* ─── Sections ─── */}
      <div className="flex-1 overflow-y-auto py-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(200,75,49,0.15) transparent" }}>
        {sections.map((section, sIdx) => {
          const isExpanded = expandedSections.has(section.id);
          const lessons = section.lessons || [];
          const sectionCompleted = lessons.filter((l) => progressMap[l.id]?.completed).length;
          const sectionDone = sectionCompleted === lessons.length && lessons.length > 0;
          const sectionPercent = lessons.length > 0 ? (sectionCompleted / lessons.length) * 100 : 0;

          return (
            <div key={section.id}>
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-all duration-200 group hover:bg-white/[0.02]"
                aria-expanded={isExpanded}
              >
                {/* Section progress mini-ring (hidden for sync) */}
                <div className="relative flex-shrink-0" style={{ width: 32, height: 32 }}>
                  {isSync ? (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: "rgba(46,158,143,0.08)", border: "1px solid rgba(46,158,143,0.15)" }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: "#2E9E8F" }}>{sIdx + 1}</span>
                    </div>
                  ) : section.is_extra ? (
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{
                        background: sectionDone ? "rgba(139,92,246,0.15)" : "rgba(139,92,246,0.06)",
                        border: `1px solid rgba(139,92,246,${sectionDone ? 0.3 : 0.15})`,
                      }}
                    >
                      {sectionDone ? (
                        <span className="text-[10px] font-bold" style={{ color: "rgb(167,139,250)" }}>✓</span>
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" style={{ color: "rgba(167,139,250,0.5)" }} />
                      )}
                    </div>
                  ) : (
                    <>
                      <svg width={32} height={32} className="-rotate-90">
                        <circle cx={16} cy={16} r={13} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={2} />
                        <circle
                          cx={16} cy={16} r={13} fill="none"
                          stroke={sectionDone ? "#2E9E8F" : "rgba(200,75,49,0.5)"}
                          strokeWidth={2} strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 13}
                          strokeDashoffset={2 * Math.PI * 13 * (1 - sectionPercent / 100)}
                          className="transition-all duration-700"
                        />
                      </svg>
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[9px] font-bold"
                        style={{ color: sectionDone ? "#2E9E8F" : "rgba(253,251,247,0.35)" }}
                      >
                        {sectionDone ? "✓" : sIdx + 1}
                      </span>
                    </>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-cream leading-snug group-hover:text-cream/90 transition-colors line-clamp-2">
                      {section.title}
                    </h4>
                    {section.is_extra && (
                      <span
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider flex-shrink-0"
                        style={{ background: "rgba(139,92,246,0.15)", color: "rgb(167,139,250)", border: "1px solid rgba(139,92,246,0.2)" }}
                      >
                        <Sparkles className="h-2.5 w-2.5" />
                        Extra
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-cream/30 mt-0.5 block">
                    {isSync
                      ? `${lessons.length} ${lessons.length === 1 ? "gravação" : "gravações"}`
                      : section.is_extra
                        ? `${sectionCompleted}/${lessons.length} · bônus`
                        : `${sectionCompleted}/${lessons.length} concluídas`
                    }
                  </span>
                </div>

                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChevronDown className="h-4 w-4 text-cream/20 flex-shrink-0" />
                </motion.div>
              </button>

              {/* Lessons */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="pb-2 pl-3 pr-2">
                      {lessons.map((lesson, lIdx) => {
                        const isCurrent = lesson.id === currentLessonId;
                        const isCompleted = progressMap[lesson.id]?.completed;

                        return (
                          <div
                            key={lesson.id}
                            className={`
                              relative flex items-start gap-2.5 pl-5 pr-3 py-2.5 rounded-[10px] cursor-pointer
                              transition-all duration-200
                              ${isCurrent ? "" : "hover:bg-white/[0.025]"}
                            `}
                            style={
                              isCurrent
                                ? {
                                    background: "rgba(200,75,49,0.06)",
                                    boxShadow: "inset 0 0 0 1px rgba(200,75,49,0.12), 0 0 16px rgba(200,75,49,0.04)",
                                  }
                                : {}
                            }
                          >
                            {/* Vertical connector line */}
                            {lIdx < lessons.length - 1 && (
                              <div
                                className="absolute left-[29px] top-[28px] w-px bottom-0 pointer-events-none"
                                style={{ background: "rgba(255,255,255,0.04)" }}
                              />
                            )}

                            {/* Active indicator */}
                            {isCurrent && (
                              <motion.div
                                layoutId="sidebar-active"
                                className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-full"
                                style={{ background: "#C84B31", boxShadow: "0 0 8px rgba(200,75,49,0.4)" }}
                                transition={{ type: "spring", stiffness: 350, damping: 30 }}
                              />
                            )}

                            {/* Checkbox */}
                            <button
                              onClick={(e) => { e.stopPropagation(); onToggleComplete(lesson.id); }}
                              className="flex-shrink-0 mt-0.5 group/chk"
                              title={isCompleted ? "Desmarcar" : "Marcar como concluída"}
                            >
                              {isCompleted ? (
                                <motion.div
                                  initial={{ scale: 0.5 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: "spring", stiffness: 400, damping: 12 }}
                                >
                                  <CheckCircle2 className="h-[18px] w-[18px] text-[#2E9E8F]" />
                                </motion.div>
                              ) : (
                                <div
                                  className="h-[18px] w-[18px] rounded-full transition-all duration-200 group-hover/chk:border-accent/60 group-hover/chk:bg-accent/5"
                                  style={{ border: "1.5px solid rgba(255,255,255,0.1)" }}
                                />
                              )}
                            </button>

                            {/* Lesson info */}
                            <button
                              onClick={() => { onSelectLesson(lesson); setMobileOpen(false); }}
                              className="flex-1 text-left min-w-0"
                            >
                              <span
                                className={`text-sm leading-snug block transition-colors duration-200 ${
                                  isCurrent
                                    ? "font-medium text-[#C84B31]"
                                    : isCompleted
                                      ? "text-cream/35"
                                      : "text-cream/65 hover:text-cream/85"
                                }`}
                                style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                              >
                                {lesson.title}
                              </span>
                              {lesson.duration_minutes && (
                                <span className="flex items-center gap-1 text-xs text-cream/25 mt-1">
                                  <Clock className="h-[10px] w-[10px]" />
                                  {formatDuration(lesson.duration_minutes)}
                                </span>
                              )}
                            </button>

                            {/* Play/pause indicator */}
                            {isCurrent && (
                              <motion.div
                                className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full flex items-center justify-center"
                                style={{ background: "rgba(200,75,49,0.15)" }}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                              >
                                <Play className="h-3 w-3 text-[#C84B31] fill-[#C84B31] ml-px" />
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile FAB */}
      <motion.button
        onClick={() => setMobileOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="lg:hidden fixed bottom-[max(1.5rem,env(safe-area-inset-bottom,0px)_+_0.75rem)] right-4 sm:right-6 z-40 text-white flex items-center gap-2.5 py-3 px-5 rounded-full font-dm font-semibold text-sm"
        style={{
          background: "linear-gradient(135deg, #C84B31, #A33D27)",
          boxShadow: "0 4px 24px rgba(200,75,49,0.4), 0 0 60px rgba(200,75,49,0.08)",
        }}
      >
        <ListVideo className="h-5 w-5" />
        <span className="tabular-nums">{isSync ? `${totalLessons} aulas` : `${completedLessons}/${totalLessons}`}</span>
      </motion.button>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden fixed inset-0 z-50">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="absolute top-0 right-0 w-[340px] xl:w-[400px] max-w-[88vw] h-full backdrop-blur-xl"
              style={{ background: "rgba(14,14,14,0.94)", borderLeft: "1px solid rgba(200,75,49,0.08)" }}
            >
              <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid rgba(200,75,49,0.08)" }}>
                <span className="font-dm font-semibold text-cream text-sm">Conteúdo do curso</span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-cream/40 hover:text-cream hover:bg-white/5 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {sidebarContent}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:block w-[340px] xl:w-[400px] flex-shrink-0 h-[calc(100vh-64px)] sticky top-16 overflow-hidden relative z-10"
        style={{
          background: "linear-gradient(180deg, rgba(16,16,16,0.82) 0%, rgba(12,12,12,0.95) 100%)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
