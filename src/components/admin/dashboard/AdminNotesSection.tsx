"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { toast } from "sonner";
import { StickyNote, Plus, Trash2, Save, X } from "lucide-react";

interface AdminNote {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

interface Props {
  userId: string;
}

export default function AdminNotesSection({ userId }: Props) {
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [newNoteText, setNewNoteText] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteText, setEditingNoteText] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("admin_notes")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      setNotes(data || []);
    } catch {
      // table may not exist yet
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  async function addNote() {
    if (!newNoteText.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.from("admin_notes").insert({
        user_id: userId,
        content: newNoteText.trim(),
      });
      if (error) throw error;
      setNewNoteText("");
      toast.success("Nota adicionada");
      fetchNotes();
    } catch {
      toast.error("Erro ao adicionar nota");
    }
  }

  async function updateNote(id: string) {
    if (!editingNoteText.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admin_notes")
        .update({
          content: editingNoteText.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      setEditingNoteId(null);
      setEditingNoteText("");
      toast.success("Nota atualizada");
      fetchNotes();
    } catch {
      toast.error("Erro ao atualizar nota");
    }
  }

  async function deleteNote(id: string) {
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("admin_notes")
        .delete()
        .eq("id", id);
      if (error) throw error;
      toast.success("Nota removida");
      fetchNotes();
    } catch {
      toast.error("Erro ao remover nota");
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.4, duration: 0.4 }}
      className="mt-8"
    >
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <StickyNote className="h-4 w-4" style={{ color: "#D4854A" }} />
          <h3 className="font-fraunces font-bold text-base text-cream">
            Notas do Admin
          </h3>
        </div>

        {/* Add new note */}
        <div className="flex gap-2 mb-4">
          <textarea
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            placeholder="Adicionar uma nota..."
            className="flex-1 font-dm text-sm text-cream bg-transparent rounded-[10px] px-3 py-2 resize-none placeholder:text-cream/20 focus:outline-none border border-border-soft-2 min-h-[60px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                addNote();
              }
            }}
          />
          <button
            onClick={addNote}
            disabled={!newNoteText.trim()}
            className="self-end flex items-center gap-1.5 font-dm text-xs px-3 py-2 rounded-[8px] transition-all disabled:opacity-30 bg-accent-soft text-accent"
          >
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ) : notes.length > 0 ? (
          <div className="space-y-2">
            {notes.map((note) => (
              <div
                key={note.id}
                className="px-3 py-2.5 rounded-[10px] group bg-surface-1 border border-white/5"
              >
                {editingNoteId === note.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      className="w-full font-dm text-sm text-cream bg-transparent rounded-[8px] px-2 py-1.5 resize-none focus:outline-none border border-accent/20 min-h-[60px]"
                      autoFocus
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter" &&
                          (e.metaKey || e.ctrlKey)
                        ) {
                          updateNote(note.id);
                        }
                        if (e.key === "Escape") {
                          setEditingNoteId(null);
                          setEditingNoteText("");
                        }
                      }}
                    />
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => updateNote(note.id)}
                        className="flex items-center gap-1 font-dm text-[11px] px-2 py-1 rounded-md transition-all bg-teal/15 text-teal"
                      >
                        <Save className="h-3 w-3" />
                        Salvar
                      </button>
                      <button
                        onClick={() => {
                          setEditingNoteId(null);
                          setEditingNoteText("");
                        }}
                        className="flex items-center gap-1 font-dm text-[11px] px-2 py-1 rounded-md text-cream/40 hover:text-cream/60 transition-all"
                      >
                        <X className="h-3 w-3" />
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="font-dm text-sm text-cream/70 leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <p className="font-dm text-[10px] text-cream/20">
                        {new Date(
                          note.updated_at || note.created_at
                        ).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingNoteId(note.id);
                            setEditingNoteText(note.content);
                          }}
                          className="font-dm text-[10px] px-1.5 py-0.5 rounded text-cream/30 hover:text-cream/60 hover:bg-white/[.03] transition-all"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => deleteNote(note.id)}
                          className="font-dm text-[10px] px-1.5 py-0.5 rounded text-red-400/40 hover:text-red-400 hover:bg-red-400/[.05] transition-all"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-cream/25 text-center py-4 font-dm">
            Nenhuma nota ainda. Use o campo acima para adicionar lembretes.
          </p>
        )}
      </Card>
    </motion.div>
  );
}
