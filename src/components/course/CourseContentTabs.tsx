"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, Download, MessageSquare, StickyNote, Cloud } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatFileSize } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import CommentSection from "@/components/community/CommentSection";
import type { Lesson } from "@/types";

interface CourseContentTabsProps {
  lesson: Lesson;
  courseId: string;
}

type Tab = "description" | "files" | "comments" | "notes";

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "PDF",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "application/zip": "ZIP",
};

export default function CourseContentTabs({
  lesson,
  courseId,
}: CourseContentTabsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("description");
  const [commentCount, setCommentCount] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteStatus, setNoteStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [noteLoading, setNoteLoading] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteIdRef = useRef<string | null>(null);

  // Fetch comment count
  useEffect(() => {
    async function fetchCount() {
      const client = createClient();
      const { count } = await client
        .from("lesson_comments")
        .select("id", { count: "exact", head: true })
        .eq("lesson_id", lesson.id);
      setCommentCount(count ?? 0);
    }
    fetchCount();
  }, [lesson.id]);

  // Load note from Supabase when lesson changes
  useEffect(() => {
    if (!user) { setNoteText(""); return; }
    let cancelled = false;
    setNoteLoading(true);
    setNoteStatus("idle");
    noteIdRef.current = null;

    (async () => {
      const client = createClient();
      const { data } = await client
        .from("lesson_notes")
        .select("id, content")
        .eq("user_id", user.id)
        .eq("lesson_id", lesson.id)
        .single();
      if (cancelled) return;
      setNoteText(data?.content || "");
      noteIdRef.current = data?.id || null;
      setNoteLoading(false);
    })();

    return () => { cancelled = true; };
  }, [lesson.id, user]);

  // Auto-save note with debounce
  const handleNoteChange = useCallback(
    (value: string) => {
      setNoteText(value);
      setNoteStatus("saving");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(async () => {
        if (!user) return;
        const client = createClient();

        if (value.trim()) {
          if (noteIdRef.current) {
            // Update existing
            await client
              .from("lesson_notes")
              .update({ content: value, updated_at: new Date().toISOString() })
              .eq("id", noteIdRef.current);
          } else {
            // Insert new
            const { data } = await client
              .from("lesson_notes")
              .upsert(
                { user_id: user.id, lesson_id: lesson.id, content: value },
                { onConflict: "user_id,lesson_id" }
              )
              .select("id")
              .single();
            if (data) noteIdRef.current = data.id;
          }
        } else if (noteIdRef.current) {
          // Delete empty note
          await client.from("lesson_notes").delete().eq("id", noteIdRef.current);
          noteIdRef.current = null;
        }
        setNoteStatus("saved");
      }, 800);
    },
    [lesson.id, user]
  );

  const hasNote = noteText.trim().length > 0;

  const hasDescription = !!lesson.description;
  const fileCount = lesson.attachments?.length || 0;

  const tabs: { id: Tab; label: string; icon: React.ReactNode; hidden?: boolean }[] = [
    {
      id: "description",
      label: "Descrição",
      icon: <FileText className="h-4 w-4" />,
      hidden: !hasDescription,
    },
    {
      id: "files",
      label: `Arquivos${fileCount ? ` (${fileCount})` : ""}`,
      icon: <Download className="h-4 w-4" />,
    },
    {
      id: "comments",
      label: `Comentários${commentCount !== null ? ` (${commentCount})` : ""}`,
      icon: <MessageSquare className="h-4 w-4" />,
    },
    {
      id: "notes",
      label: `Anotações${hasNote ? " ●" : ""}`,
      icon: <StickyNote className="h-4 w-4" />,
    },
  ];

  const visibleTabs = tabs.filter((t) => !t.hidden);

  // Reset to first visible tab if current is hidden
  useEffect(() => {
    if (!visibleTabs.find((t) => t.id === activeTab)) {
      setActiveTab(visibleTabs[0]?.id || "comments");
    }
  }, [lesson.id]);

  return (
    <div>
      {/* Tab buttons */}
      <div className="flex mb-6 relative" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs sm:text-sm font-medium
              transition-colors duration-200 -mb-px
              ${
                activeTab === tab.id
                  ? "text-accent"
                  : "text-cream/40 hover:text-cream/70"
              }
            `}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab content with animation */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "description" && (
            <div className="prose-allos">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {lesson.description!}
              </ReactMarkdown>
            </div>
          )}

          {activeTab === "files" && (
            <div>
              {fileCount > 0 ? (
                <div className="space-y-2">
                  {lesson.attachments!.map((file) => (
                    <a
                      key={file.id}
                      href={file.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="
                        flex items-center gap-4 p-4
                        rounded-[12px]
                        transition-all duration-200
                        border border-white/[.06] hover:border-[rgba(200,75,49,0.2)]
                        hover:bg-white/[.02]
                      "
                      style={{
                        background: "rgba(255,255,255,0.03)",
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-[8px] flex items-center justify-center flex-shrink-0"
                        style={{ background: "rgba(200,75,49,0.08)" }}
                      >
                        <span className="text-xs font-bold text-accent/70">
                          {FILE_ICONS[file.file_type || ""] || "FILE"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-cream truncate">
                          {file.file_name}
                        </p>
                        {file.file_size_bytes && (
                          <p className="text-xs text-cream/35">
                            {formatFileSize(file.file_size_bytes)}
                          </p>
                        )}
                      </div>
                      <Download className="h-4 w-4 text-accent flex-shrink-0" />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-cream/40 text-sm italic py-4">
                  Nenhum arquivo complementar disponível.
                </p>
              )}
            </div>
          )}

          {activeTab === "comments" && (
            <CommentSection
              lessonId={lesson.id}
              onCountChange={(count) => setCommentCount(count)}
            />
          )}

          {activeTab === "notes" && (
            <div>
              {!user ? (
                <p className="text-cream/40 text-sm italic py-4">
                  Faça login para usar as anotações.
                </p>
              ) : noteLoading ? (
                <div className="h-[180px] rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
              ) : (
                <>
                  <textarea
                    value={noteText}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    placeholder="Escreva suas anotações sobre esta aula..."
                    className="w-full min-h-[180px] p-4 rounded-xl text-sm text-cream placeholder-cream/20 font-dm leading-relaxed resize-y outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1.5px solid rgba(255,255,255,0.08)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(200,75,49,0.3)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(200,75,49,0.06)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <div className="flex items-center justify-end gap-1.5 mt-2">
                    {noteStatus === "saved" && <Cloud className="h-3 w-3 text-teal/50" />}
                    <span className="font-dm text-[11px] text-cream/25">
                      {noteStatus === "saving" ? "Salvando..." : noteStatus === "saved" ? "Salvo na nuvem" : ""}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
