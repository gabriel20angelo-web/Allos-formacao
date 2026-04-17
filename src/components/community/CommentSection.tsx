"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import { Trash2, User } from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/format";
import { toast } from "sonner";
import type { LessonComment } from "@/types";

interface CommentSectionProps {
  lessonId: string;
  onCountChange?: (count: number) => void;
}

const COMMENTS_PER_PAGE = 8;

export default function CommentSection({ lessonId, onCountChange }: CommentSectionProps) {
  const { user, profile, isAdmin, isInstructor } = useAuth();
  const [comments, setComments] = useState<LessonComment[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [visibleCount, setVisibleCount] = useState(COMMENTS_PER_PAGE);

  const onCountChangeRef = useRef(onCountChange);
  onCountChangeRef.current = onCountChange;

  const fetchComments = useCallback(async () => {
    const client = createClient();
    const { data } = await client
      .from("lesson_comments")
      .select(`
        *,
        user:profiles!lesson_comments_user_id_fkey(id, full_name, avatar_url)
      `)
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: false });

    if (data) {
      setComments(data);
      onCountChangeRef.current?.(data.length);
    }
    setLoading(false);
  }, [lessonId]);

  useEffect(() => {
    setVisibleCount(COMMENTS_PER_PAGE);
    fetchComments();
  }, [fetchComments]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !content.trim()) return;

    setSubmitting(true);
    const client = createClient();
    const { error } = await client.from("lesson_comments").insert({
      lesson_id: lessonId,
      user_id: user.id,
      content: content.trim(),
    });

    if (error) {
      toast.error("Erro ao enviar comentário.");
    } else {
      setContent("");
      fetchComments();
      toast.success("Comentário publicado!");
    }
    setSubmitting(false);
  }

  async function handleDelete(commentId: string) {
    const client = createClient();
    const { error } = await client
      .from("lesson_comments")
      .delete()
      .eq("id", commentId);

    if (error) {
      toast.error("Erro ao deletar comentário.");
    } else {
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        onCountChange?.(next.length);
        return next;
      });
      toast.success("Comentário removido.");
    }
  }

  return (
    <div>
      {/* Post comment */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Escreva um comentário..."
            className="w-full px-4 py-3 rounded-[12px] text-sm text-cream dark-input resize-none min-h-[80px]"
            aria-label="Comentário"
          />
          <div className="flex justify-end mt-2">
            <Button
              type="submit"
              size="sm"
              loading={submitting}
              disabled={!content.trim()}
            >
              Comentar
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-cream/40 mb-6">
          <a href="/formacao/auth" className="text-accent hover:underline">
            Faça login
          </a>{" "}
          para comentar.
        </p>
      )}

      {/* Comments list */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse flex gap-3 p-4 rounded-[12px]"
              style={{ background: "rgba(255,255,255,0.02)" }}
            >
              <div className="w-8 h-8 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
                <div className="h-3 w-full rounded" style={{ background: "rgba(255,255,255,0.05)" }} />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length > 0 ? (
        <div className="space-y-4">
          {comments.slice(0, visibleCount).map((comment) => (
            <div
              key={comment.id}
              className="flex gap-3 p-4 rounded-[12px] border border-white/[.04] hover:border-white/[.08] transition-colors"
              style={{
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(200,75,49,0.1)" }}
              >
                {comment.user?.avatar_url ? (
                  <Image
                    src={comment.user.avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <User className="h-4 w-4 text-accent" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-cream">
                    {comment.user?.full_name || "Anônimo"}
                  </span>
                  <span className="text-xs text-cream/30">
                    {formatRelativeDate(comment.created_at)}
                  </span>
                </div>
                <p className="text-sm text-cream/55 whitespace-pre-wrap leading-relaxed">
                  {comment.content}
                </p>
              </div>
              {(comment.user_id === user?.id || isAdmin || isInstructor) && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="p-1.5 rounded-lg text-cream/20 hover:text-red-400 hover:bg-red-400/10 transition-all flex-shrink-0 self-start"
                  aria-label="Deletar comentário"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {comments.length > 0 && (
            <p className="text-xs text-cream/30 text-center pt-2">
              Mostrando {Math.min(visibleCount, comments.length)} de {comments.length} comentários
            </p>
          )}

          {visibleCount < comments.length && (
            <div className="flex justify-center pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setVisibleCount((prev) => prev + COMMENTS_PER_PAGE)}
              >
                Ver mais comentários
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-cream/40 text-sm mb-1">Nenhum comentário ainda.</p>
          <p className="text-cream/25 text-xs">Seja o primeiro a participar da discussão!</p>
        </div>
      )}
    </div>
  );
}
