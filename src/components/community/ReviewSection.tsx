"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ReviewStars from "@/components/community/ReviewStars";
import Button from "@/components/ui/Button";
import { User, Star, Lock } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/format";
import { toast } from "sonner";
import type { Review } from "@/types";

interface ReviewSectionProps {
  courseId: string;
  progressPercent: number;
}

const REVIEWS_PER_PAGE = 5;

export default function ReviewSection({
  courseId,
  progressPercent,
}: ReviewSectionProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(REVIEWS_PER_PAGE);

  const canReview = progressPercent >= 50;
  const percentToUnlock = Math.max(0, 50 - Math.round(progressPercent));

  const userIdRef = useRef(user?.id);
  userIdRef.current = user?.id;

  const fetchReviews = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from("reviews")
      .select(`
        *,
        user:profiles!reviews_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq("course_id", courseId)
      .order("created_at", { ascending: false });

    if (data) {
      setReviews(data);
      const uid = userIdRef.current;
      if (uid) {
        const mine = data.find((r) => r.user_id === uid);
        if (mine) {
          setMyReview(mine);
          setRating(mine.rating);
          setComment(mine.comment || "");
        }
      }
    }
  }, [courseId]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || rating === 0) return;

    setSubmitting(true);
    const client = createClient();

    if (myReview) {
      await client
        .from("reviews")
        .update({ rating, comment: comment || null, updated_at: new Date().toISOString() })
        .eq("id", myReview.id);
      toast.success("Avaliação atualizada!");
    } else {
      await client.from("reviews").insert({
        user_id: user.id,
        course_id: courseId,
        rating,
        comment: comment || null,
      });
      toast.success("Avaliação publicada!");
    }

    fetchReviews();
    setSubmitting(false);
  }

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length;
    return {
      star,
      count,
      percent: reviews.length > 0 ? (count / reviews.length) * 100 : 0,
    };
  });

  const visibleReviews = reviews.slice(0, visibleCount);
  const hasMore = reviews.length > visibleCount;

  return (
    <section className="mt-12 pt-8" style={{ borderTop: "1px solid rgba(200,75,49,0.08)" }}>
      <h2 className="font-fraunces font-bold text-xl text-cream mb-6">
        Avaliações do curso
      </h2>

      {/* Summary */}
      {reviews.length > 0 && (
        <div
          className="flex flex-col sm:flex-row gap-8 mb-8 p-6 rounded-[16px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="text-center sm:min-w-[100px]">
            <p className="font-fraunces font-bold text-4xl text-cream">
              {avgRating.toFixed(1)}
            </p>
            <p className="text-xs text-cream/30 mb-1">de 5</p>
            <ReviewStars value={Math.round(avgRating)} size="sm" />
            <p className="text-xs text-cream/35 mt-1">
              {reviews.length} avaliação{reviews.length !== 1 ? "ões" : ""}
            </p>
          </div>

          <div className="flex-1 space-y-1.5">
            {distribution.map(({ star, percent }) => (
              <div key={star} className="flex items-center gap-2">
                <span className="text-xs text-cream/40 w-4">{star}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <div
                  className="flex-1 h-2 rounded-pill overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="h-full bg-amber-400 rounded-pill transition-all duration-500"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <span className="text-xs text-cream/35 w-8 text-right">
                  {Math.round(percent)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Write review */}
      {user && canReview && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 p-6 rounded-[16px]"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <h3 className="text-sm font-semibold text-cream mb-3">
            {myReview ? "Editar sua avaliação" : "Deixe sua avaliação"}
          </h3>
          <div className="mb-3">
            <ReviewStars
              value={rating}
              onChange={setRating}
              size="lg"
              interactive
            />
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Conte sua experiência (opcional)"
            className="w-full px-4 py-3 rounded-[10px] text-sm text-cream dark-input resize-none min-h-[80px]"
          />
          <div className="flex justify-end mt-3">
            <Button type="submit" size="sm" loading={submitting} disabled={rating === 0}>
              {myReview ? "Atualizar" : "Publicar"}
            </Button>
          </div>
        </form>
      )}

      {/* Locked review message */}
      {user && !canReview && (
        <div
          className="mb-8 p-5 rounded-[16px] flex items-center gap-4"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.15)" }}
          >
            <Lock className="h-4 w-4 text-accent/60" />
          </div>
          <div>
            <p className="text-sm font-medium text-cream/60">
              Avaliação bloqueada
            </p>
            <p className="text-xs text-cream/35">
              Complete mais {percentToUnlock}% do curso para liberar sua avaliação.
            </p>
          </div>
          {/* Mini progress */}
          <div className="hidden sm:flex items-center gap-2 ml-auto">
            <div className="w-24 h-1.5 rounded-pill overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div
                className="h-full rounded-pill"
                style={{
                  width: `${Math.min(progressPercent * 2, 100)}%`,
                  background: "linear-gradient(90deg, #A33D27, #C84B31)",
                }}
              />
            </div>
            <span className="text-xs text-cream/30 tabular-nums">{Math.round(progressPercent)}%/50%</span>
          </div>
        </div>
      )}

      {/* Reviews list */}
      <div className="space-y-4">
        {visibleReviews.map((review) => (
          <div
            key={review.id}
            className="flex gap-3 p-4 rounded-[12px] border border-white/[.04] hover:border-white/[.08] transition-colors"
            style={{
              background: "rgba(255,255,255,0.02)",
            }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(200,75,49,0.1)" }}
            >
              {review.user?.avatar_url ? (
                <img
                  src={review.user.avatar_url}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="h-4 w-4 text-accent" />
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-cream">
                  {review.user?.full_name || "Anônimo"}
                </span>
                <ReviewStars value={review.rating} size="sm" />
                <span className="text-xs text-cream/30">
                  {formatRelativeDate(review.created_at)}
                </span>
              </div>
              {review.comment && (
                <p className="text-sm text-cream/55 leading-relaxed">{review.comment}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((prev) => prev + REVIEWS_PER_PAGE)}
          className="w-full mt-4 py-3 rounded-[12px] text-sm font-medium text-cream/40 hover:text-cream/60 hover:bg-white/[.02] transition-colors border border-white/[.06]"
        >
          Mostrar mais avaliações ({reviews.length - visibleCount} restantes)
        </button>
      )}
    </section>
  );
}
