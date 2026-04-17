"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import ReviewStars from "@/components/community/ReviewStars";
import Skeleton from "@/components/ui/Skeleton";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import {
  User,
  Clock,
  Users,
  Award,
  ChevronDown,
  CheckCircle2,
  MessageCircle,
} from "lucide-react";
import { formatPrice, formatDuration } from "@/lib/utils/format";
import type { Course, Section } from "@/types";

export default function ComprarPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { user } = useAuth();
  const [course, setCourse] = useState<Course | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [reviewsCount, setReviewsCount] = useState(0);
  const [avgRating, setAvgRating] = useState(0);
  const [enrollCount, setEnrollCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    async function fetch() {
      const { data: courseData } = await createClient()
        .from("courses")
        .select(`
          *,
          instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url, email)
        `)
        .eq("slug", slug)
        .single();

      if (!courseData) {
        router.push("/formacao");
        return;
      }

      // If free, redirect to course page
      if (courseData.is_free) {
        router.push(`/formacao/curso/${slug}`);
        return;
      }

      // If already enrolled
      if (user) {
        const { data: enrollment } = await createClient()
          .from("enrollments")
          .select("id")
          .eq("course_id", courseData.id)
          .eq("user_id", user.id)
          .eq("payment_status", "paid")
          .single();

        if (enrollment) {
          router.push(`/formacao/curso/${slug}`);
          return;
        }
      }

      setCourse(courseData);

      const { data: sectionsData } = await createClient()
        .from("sections")
        .select("*, lessons(id, title, duration_minutes, is_preview, position)")
        .eq("course_id", courseData.id)
        .order("position")
        .order("position", { referencedTable: "lessons" });

      if (sectionsData) setSections(sectionsData);

      // Stats
      const client2 = createClient();
      const [{ count: eCount }, { data: reviews }] = await Promise.all([
        client2
          .from("enrollments")
          .select("*", { count: "exact", head: true })
          .eq("course_id", courseData.id),
        client2
          .from("reviews")
          .select("rating")
          .eq("course_id", courseData.id),
      ]);

      setEnrollCount(eCount || 0);
      if (reviews && reviews.length > 0) {
        setReviewsCount(reviews.length);
        setAvgRating(
          reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
        );
      }

      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [slug, user?.id, router]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
        <Skeleton className="aspect-video w-full" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (!course) return null;

  const whatsappNumber =
    course.whatsapp_number ||
    process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ||
    "5531999999999";

  const whatsappMsg = encodeURIComponent(
    `Olá! Tenho interesse no curso "${course.title}" da Allos Formação.`
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="flex flex-col md:flex-row gap-8 mb-12">
        {/* Thumbnail */}
        <div className="md:w-1/2">
          {course.thumbnail_url ? (
            <div className="relative w-full aspect-video rounded-[16px] overflow-hidden">
              <Image
                src={course.thumbnail_url}
                alt={course.title}
                fill
                sizes="(max-width: 768px) 100vw, 500px"
                className="object-cover"
              />
            </div>
          ) : (
            <div
              className="w-full aspect-video rounded-[16px] flex items-center justify-center"
              style={{ background: "rgba(200,75,49,0.06)" }}
            >
              <span className="font-fraunces text-5xl" style={{ color: "rgba(200,75,49,0.15)" }}>A</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="md:w-1/2 flex flex-col justify-center">
          {course.category && (
            <span className="section-label mb-3">
              {course.category}
            </span>
          )}
          <h1 className="font-fraunces font-bold text-3xl text-cream mb-3 tracking-tight">
            {course.title}
          </h1>

          <div className="flex items-center gap-4 mb-4 text-sm text-cream/40">
            {avgRating > 0 && (
              <span className="flex items-center gap-1">
                <ReviewStars value={Math.round(avgRating)} size="sm" />
                <span className="font-medium text-cream">
                  {avgRating.toFixed(1)}
                </span>
                <span>({reviewsCount})</span>
              </span>
            )}
            <span className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              {enrollCount} alunos
            </span>
            {course.total_duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {formatDuration(course.total_duration_minutes)}
              </span>
            )}
          </div>

          {/* Instructor */}
          {course.instructor && (
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "rgba(200,75,49,0.1)" }}
              >
                {course.instructor.avatar_url ? (
                  <Image
                    src={course.instructor.avatar_url}
                    alt=""
                    width={40}
                    height={40}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-accent" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-cream">
                  {course.instructor.full_name}
                </p>
                <p className="text-xs text-cream/35">Professor</p>
              </div>
            </div>
          )}

          {/* Price */}
          <div
            className="rounded-[16px] p-6"
            style={{
              background: "linear-gradient(135deg, rgba(200,75,49,0.08), rgba(163,61,39,0.04))",
              border: "1px solid rgba(200,75,49,0.12)",
            }}
          >
            <p className="font-fraunces font-bold text-3xl text-cream mb-1">
              {course.price_cents
                ? formatPrice(course.price_cents)
                : "Consulte"}
            </p>
            {course.certificate_enabled && course.course_type !== "sync" && (
              <p className="flex items-center gap-1 text-xs text-cream/40 mb-4">
                <Award className="h-3.5 w-3.5" />
                Certificado incluso
              </p>
            )}

            {/* Payment placeholder */}
            <div id="payment-embed-container">
              <p className="text-sm text-cream/40 mb-4">
                Sistema de pagamento em breve. Entre em contato pelo WhatsApp
                para garantir sua vaga.
              </p>
              <a
                href={`https://wa.me/${whatsappNumber}?text=${whatsappMsg}`}
                target="_blank"
                rel="noopener noreferrer"
                className="
                  inline-flex items-center justify-center gap-2 w-full
                  px-6 py-3 bg-[#25D366] text-white rounded-[10px]
                  font-semibold text-sm
                  hover:bg-[#20BD5A] transition-colors
                "
              >
                <MessageCircle className="h-5 w-5" />
                Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Learning points */}
      {course.learning_points && course.learning_points.length > 0 && (
        <section
          className="mb-12 p-6 rounded-[16px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h2 className="font-fraunces font-bold text-xl text-cream mb-4">
            O que você vai aprender
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {course.learning_points.map((point, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                <span className="text-sm text-cream/55">{point}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Long description */}
      {course.long_description && (
        <section className="mb-12">
          <h2 className="font-fraunces font-bold text-xl text-cream mb-4">
            Sobre o curso
          </h2>
          <div className="prose-allos">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw]}
            >
              {course.long_description}
            </ReactMarkdown>
          </div>
        </section>
      )}

      {/* Content accordion */}
      <section className="mb-12">
        <h2 className="font-fraunces font-bold text-xl text-cream mb-4">
          Conteúdo do curso
        </h2>
        <div
          className="rounded-[16px] overflow-hidden"
          style={{
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {sections.map((section) => {
            const isExpanded = expandedSections.has(section.id);
            const lessons = section.lessons || [];
            const totalMinutes = lessons.reduce(
              (sum, l: { duration_minutes?: number | null }) =>
                sum + (l.duration_minutes || 0),
              0
            );

            return (
              <div
                key={section.id}
                style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              >
                <button
                  onClick={() => {
                    setExpandedSections((prev) => {
                      const next = new Set(prev);
                      if (next.has(section.id)) next.delete(section.id);
                      else next.add(section.id);
                      return next;
                    });
                  }}
                  className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-cream">
                      {section.title}
                    </h4>
                    <span className="text-xs text-cream/30">
                      {lessons.length} aula{lessons.length !== 1 ? "s" : ""}
                      {totalMinutes > 0 && ` · ${formatDuration(totalMinutes)}`}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-cream/30 transition-transform ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {isExpanded && (
                  <div>
                    {lessons.map(
                      (lesson: {
                        id: string;
                        title: string;
                        duration_minutes?: number | null;
                        is_preview?: boolean;
                      }) => (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between px-6 py-3"
                          style={{ borderTop: "1px solid rgba(255,255,255,0.03)" }}
                        >
                          <span className="text-sm text-cream/50">
                            {lesson.title}
                          </span>
                          <div className="flex items-center gap-2">
                            {lesson.is_preview && (
                              <Badge variant="free">Preview</Badge>
                            )}
                            {lesson.duration_minutes && (
                              <span className="text-xs text-cream/30">
                                {formatDuration(lesson.duration_minutes)}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
