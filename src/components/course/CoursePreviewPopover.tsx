"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Users, Star, CheckCircle2, BookOpen } from "lucide-react";
import { formatDuration } from "@/lib/utils/format";
import type { Course } from "@/types";

interface CoursePreviewPopoverProps {
  course: Course;
  children: React.ReactNode;
}

export default function CoursePreviewPopover({ course, children }: CoursePreviewPopoverProps) {
  const [show, setShow] = useState(false);
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null);

  function handleEnter() {
    const id = setTimeout(() => setShow(true), 400);
    setTimeoutId(id);
  }

  function handleLeave() {
    if (timeoutId) clearTimeout(timeoutId);
    setShow(false);
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="absolute z-50 left-1/2 -translate-x-1/2 top-full mt-2 w-[320px] pointer-events-none hidden lg:block"
          >
            <div
              className="rounded-2xl p-5 backdrop-blur-xl"
              style={{
                background: "rgba(26,26,26,0.96)",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)",
              }}
            >
              {/* Arrow */}
              <div
                className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45"
                style={{ background: "rgba(26,26,26,0.96)", border: "1px solid rgba(255,255,255,0.1)", borderBottom: "none", borderRight: "none" }}
              />

              {/* Meta row */}
              <div className="flex items-center gap-3 text-xs text-cream/50 mb-3">
                {course.average_rating !== undefined && course.average_rating > 0 && (
                  <span className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    <span className="text-cream/70 font-medium">{course.average_rating.toFixed(1)}</span>
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

              {/* Description */}
              {course.description && (
                <p className="text-sm text-cream/55 leading-relaxed mb-4 line-clamp-3">
                  {course.description}
                </p>
              )}

              {/* Learning points */}
              {course.learning_points && course.learning_points.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-cream/30 font-semibold mb-2">
                    O que você vai aprender
                  </p>
                  <ul className="space-y-1.5">
                    {course.learning_points.slice(0, 4).map((point, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-cream/50">
                        <CheckCircle2 className="h-3.5 w-3.5 text-teal flex-shrink-0 mt-0.5" />
                        <span className="line-clamp-1">{point}</span>
                      </li>
                    ))}
                    {course.learning_points.length > 4 && (
                      <li className="text-xs text-cream/30 pl-5">
                        +{course.learning_points.length - 4} mais...
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* No learning points fallback */}
              {(!course.learning_points || course.learning_points.length === 0) && !course.description && (
                <div className="flex items-center gap-2 text-cream/30 text-sm">
                  <BookOpen className="h-4 w-4" />
                  <span>Passe o mouse para ver detalhes</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
