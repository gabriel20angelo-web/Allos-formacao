"use client";

import Image from "next/image";
import Link from "next/link";
import { Star, Clock, Users, BookOpen, Radio } from "lucide-react";
import Badge from "@/components/ui/Badge";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Course } from "@/types";

interface CourseCardProps {
  course: Course;
  isInstructor?: boolean;
}

export default function CourseCard({ course, isInstructor }: CourseCardProps) {
  const displayPrice = course.is_free
    ? null
    : course.price_cents
      ? formatPrice(course.price_cents)
      : null;

  return (
    <Link
      href={`/formacao/curso/${course.slug}`}
      className="group block"
    >
      <article
        className="rounded-[16px] overflow-hidden transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:shadow-[0_12px_40px_rgba(200,75,49,0.12)] border border-white/[.06] group-hover:border-[rgba(200,75,49,0.25)]"
        style={{
          background: "rgba(255,255,255,0.03)",
        }}
      >
        {/* Top accent line on hover */}
        <div
          className="h-[2px] origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500"
          style={{ background: "linear-gradient(to right,#C84B31,rgba(200,75,49,0))" }}
        />

        {/* Thumbnail */}
        <div
          className="relative aspect-video overflow-hidden"
          style={{ background: "linear-gradient(135deg,#1C1414,#0F0F0F)" }}
        >
          {course.thumbnail_url ? (
            <Image
              src={course.thumbnail_url}
              alt={course.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center relative">
              <div
                className="absolute inset-0"
                style={{ background: "radial-gradient(ellipse at 50% 50%,rgba(200,75,49,.08) 0%,transparent 70%)" }}
              />
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: "rgba(200,75,49,0.08)",
                  border: "1px solid rgba(200,75,49,0.15)",
                }}
              >
                <BookOpen className="h-6 w-6" style={{ color: "rgba(200,75,49,0.4)" }} />
              </div>
            </div>
          )}

          {/* Gradient overlay on thumbnail */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-400"
            style={{
              background: "linear-gradient(180deg, transparent 50%, rgba(17,17,17,0.5) 100%)",
            }}
          />

          {/* Badge overlay */}
          <div className="absolute top-3 left-3 flex gap-2">
            {course.is_free ? (
              <Badge variant="free">Gratuito</Badge>
            ) : (
              displayPrice && <Badge variant="paid">{displayPrice}</Badge>
            )}
            {course.course_type === "sync" && (
              <Badge variant="sync">
                <Radio className="h-2.5 w-2.5 mr-1" />
                Ao vivo
              </Badge>
            )}
            {isInstructor && (
              <Badge variant="instructor">Meu curso</Badge>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <h3 className="font-fraunces font-bold text-lg text-cream leading-tight mb-1.5 line-clamp-2 group-hover:text-[#F5DDD7] transition-colors duration-300">
            {course.title}
          </h3>

          {course.instructor && (
            <p className="text-sm text-cream/45 mb-3 font-dm">
              {course.instructor.full_name}
            </p>
          )}

          {course.description && (
            <p className="text-sm text-cream/40 line-clamp-2 mb-4 leading-relaxed">
              {course.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-4 text-xs text-cream/45">
            {course.average_rating !== undefined && course.average_rating > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                <span className="font-medium text-cream/70">
                  {course.average_rating.toFixed(1)}
                </span>
                {course.reviews_count !== undefined && (
                  <span>({course.reviews_count})</span>
                )}
              </span>
            )}
            {course.enrollments_count !== undefined && course.enrollments_count > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {course.enrollments_count} alunos
              </span>
            )}
            {course.total_duration_minutes && course.total_duration_minutes > 0 && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(course.total_duration_minutes)}
              </span>
            )}
          </div>

          {/* CTA */}
          <div
            className="mt-5 pt-4"
            style={{ borderTop: "1px solid rgba(200,75,49,0.08)" }}
          >
            <span
              className="inline-flex items-center justify-center w-full py-2.5 rounded-[10px] text-sm font-semibold transition-all duration-300 group-hover:bg-[#C84B31] group-hover:text-white group-hover:shadow-glow-orange"
              style={{
                background: "linear-gradient(135deg, rgba(200,75,49,0.12), rgba(163,61,39,0.08))",
                color: "#C84B31",
              }}
            >
              {course.course_type === "sync"
                ? "Acessar gravações →"
                : course.is_free
                  ? "Começar grátis →"
                  : "Ver curso →"}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
