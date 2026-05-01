"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Skeleton from "@/components/ui/Skeleton";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { motion } from "framer-motion";
import {
  Search,
  Video,
  CheckCircle2,
  Circle,
  Trash2,
  Mail,
  User,
  Calendar,
  MessageSquareText,
} from "lucide-react";
import { formatRelativeDate } from "@/lib/utils/format";
import { toast } from "sonner";

interface VideoQuestion {
  id: string;
  user_id: string | null;
  user_name: string;
  user_email: string | null;
  question: string;
  answered: boolean;
  created_at: string;
}

type StatusFilter = "all" | "pending" | "answered";

export default function AdminDuvidasPage() {
  const { profile } = useAuth();
  const [questions, setQuestions] = useState<VideoQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<VideoQuestion | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    async function fetch() {
      if (!profile) {
        setLoading(false);
        return;
      }
      const client = createClient();
      const { data } = await client
        .from("video_questions")
        .select("*")
        .order("created_at", { ascending: false });

      if (data) setQuestions(data);
      setLoading(false);
    }
    fetch().catch(() => setLoading(false));
  }, [profile]);

  async function toggleAnswered(q: VideoQuestion) {
    const client = createClient();
    const newVal = !q.answered;
    const { error } = await client
      .from("video_questions")
      .update({ answered: newVal })
      .eq("id", q.id);

    if (error) {
      toast.error("Erro ao atualizar.");
      return;
    }

    setQuestions((prev) =>
      prev.map((item) =>
        item.id === q.id ? { ...item, answered: newVal } : item
      )
    );
    toast.success(newVal ? "Marcada como respondida!" : "Marcada como pendente.");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const client = createClient();
    const { error } = await client
      .from("video_questions")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Erro ao excluir.");
      setDeleting(false);
      return;
    }

    setQuestions((prev) => prev.filter((q) => q.id !== deleteTarget.id));
    toast.success("Dúvida excluída.");
    setDeleteTarget(null);
    setDeleting(false);
  }

  const filtered = useMemo(() => {
    let result = questions;

    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (q) =>
          q.question.toLowerCase().includes(s) ||
          q.user_name.toLowerCase().includes(s) ||
          q.user_email?.toLowerCase().includes(s)
      );
    }

    if (statusFilter === "pending") result = result.filter((q) => !q.answered);
    if (statusFilter === "answered") result = result.filter((q) => q.answered);

    return result;
  }, [questions, search, statusFilter]);

  const pendingCount = questions.filter((q) => !q.answered).length;
  const answeredCount = questions.filter((q) => q.answered).length;

  if (loading) {
    return (
      <div>
        <Skeleton className="h-8 w-48 mb-8" />
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="font-fraunces font-bold text-2xl text-cream tracking-tight">
          Dúvidas em vídeo
        </h1>
        <p className="text-sm text-cream/35 mt-1">
          Perguntas enviadas pelos alunos para serem respondidas em vídeo.
        </p>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap items-center gap-3 mb-6 px-4 py-3 rounded-[12px]"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-accent" />
          <span className="text-sm text-cream/60">
            <span className="text-cream font-semibold">{questions.length}</span> dúvida{questions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-cream/15">·</span>
        <span className="text-sm text-cream/60">
          <span className="text-accent font-semibold">{pendingCount}</span> pendente{pendingCount !== 1 ? "s" : ""}
        </span>
        <span className="text-cream/15">·</span>
        <span className="text-sm text-cream/60">
          <span className="text-teal font-semibold">{answeredCount}</span> respondida{answeredCount !== 1 ? "s" : ""}
        </span>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap items-center gap-3 mb-6"
      >
        <div className="relative flex-1 min-w-[200px] max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-cream/25" />
          <input
            type="text"
            placeholder="Buscar por pergunta, nome ou email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 dark-input rounded-[10px] text-sm"
            aria-label="Buscar dúvidas"
          />
        </div>

        <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { id: "all" as StatusFilter, label: "Todas" },
            { id: "pending" as StatusFilter, label: "Pendentes" },
            { id: "answered" as StatusFilter, label: "Respondidas" },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                statusFilter === f.id
                  ? "text-white bg-accent"
                  : "text-cream/40 hover:text-cream/60"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Questions list */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-16">
            <MessageSquareText className="h-8 w-8 text-cream/15 mx-auto mb-3" />
            <p className="text-cream/30 text-sm">
              {questions.length === 0
                ? "Nenhuma dúvida recebida ainda."
                : "Nenhuma dúvida encontrada com esses filtros."}
            </p>
          </div>
        ) : (
          filtered.map((q, i) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.03, 0.3) }}
              className="rounded-[14px] p-5 transition-all"
              style={{
                background: q.answered ? "rgba(46,158,143,0.03)" : "rgba(255,255,255,0.03)",
                border: q.answered
                  ? "1px solid rgba(46,158,143,0.12)"
                  : "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: "rgba(200,75,49,0.1)" }}
                  >
                    <User className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-cream truncate">{q.user_name}</p>
                    <div className="flex items-center gap-3 text-xs text-cream/30">
                      {q.user_email && (
                        <span className="flex items-center gap-1 truncate">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {q.user_email}
                        </span>
                      )}
                      <span className="flex items-center gap-1 flex-shrink-0">
                        <Calendar className="h-3 w-3" />
                        {formatRelativeDate(q.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Toggle answered */}
                  <button
                    onClick={() => toggleAnswered(q)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      q.answered
                        ? "text-teal bg-teal/10 hover:bg-teal/15"
                        : "text-cream/40 bg-white/5 hover:text-accent hover:bg-accent/10"
                    }`}
                  >
                    {q.answered ? (
                      <><CheckCircle2 className="h-3.5 w-3.5" /> Respondida</>
                    ) : (
                      <><Circle className="h-3.5 w-3.5" /> Pendente</>
                    )}
                  </button>

                  <button
                    onClick={() => setDeleteTarget(q)}
                    className="p-1.5 text-cream/15 hover:text-red-400 rounded transition-colors"
                    aria-label="Excluir dúvida"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {/* Question text */}
              <p className="text-sm text-cream/70 leading-relaxed pl-11">
                {q.question}
              </p>
            </motion.div>
          ))
        )}
      </div>

      {/* Delete confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Excluir dúvida"
      >
        {deleteTarget && (
          <div className="space-y-4">
            <p className="text-sm text-cream/60">
              Tem certeza que deseja excluir esta dúvida de <span className="font-medium text-cream">{deleteTarget.user_name}</span>?
            </p>
            <p className="text-sm text-cream/40 p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
              &ldquo;{deleteTarget.question.substring(0, 200)}{deleteTarget.question.length > 200 ? "..." : ""}&rdquo;
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
              <Button variant="danger" loading={deleting} onClick={handleDelete}>Excluir</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
