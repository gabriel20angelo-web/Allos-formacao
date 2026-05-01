"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWhatsAppTemplates } from "@/hooks/useWhatsAppTemplates";
import {
  createWhatsAppTemplate,
  updateWhatsAppTemplate,
  deleteWhatsAppTemplate,
} from "@/lib/queries";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import LoadingState from "@/components/ui/LoadingState";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Copy,
  Check,
  Trash2,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { WhatsAppTemplate } from "@/types";

type SaveState = "idle" | "saving" | "saved";

export default function WhatsAppTemplates() {
  const { user } = useAuth();
  const { data: templates, loading, setData: setTemplates } =
    useWhatsAppTemplates(user?.id);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<Record<string, SaveState>>({});

  // debounce timers per template id; clears on unmount
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Cleanup pending debounce timers no unmount pra não dispararem em
  // componente desmontado.
  useEffect(() => {
    const timers = saveTimers.current;
    return () => {
      Object.values(timers).forEach(clearTimeout);
    };
  }, []);

  // ─── Create ───────────────────────────────────────────────────────────────
  async function handleCreate() {
    if (!user || creating) return;
    setCreating(true);
    const { data, error } = await createWhatsAppTemplate(user.id);
    setCreating(false);
    if (error || !data) {
      toast.error("Erro ao criar mensagem");
      return;
    }
    setTemplates((prev) => [...prev, data]);
  }

  // ─── Auto-save (debounce 600ms) ───────────────────────────────────────────
  const scheduleSave = useCallback(
    (id: string, fields: Partial<Pick<WhatsAppTemplate, "titulo" | "mensagem">>) => {
      if (saveTimers.current[id]) clearTimeout(saveTimers.current[id]);
      setSaveState((s) => ({ ...s, [id]: "saving" }));
      saveTimers.current[id] = setTimeout(async () => {
        const { error } = await updateWhatsAppTemplate(id, fields);
        if (error) {
          setSaveState((s) => ({ ...s, [id]: "idle" }));
          toast.error("Erro ao salvar");
          return;
        }
        setSaveState((s) => ({ ...s, [id]: "saved" }));
        // Volta o badge pra idle após 1.5s pra não ficar permanente.
        setTimeout(() => {
          setSaveState((s) => (s[id] === "saved" ? { ...s, [id]: "idle" } : s));
        }, 1500);
      }, 600);
    },
    []
  );

  function updateField(
    id: string,
    field: "titulo" | "mensagem",
    value: string
  ) {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
    scheduleSave(id, { [field]: value });
  }

  // ─── Copy ─────────────────────────────────────────────────────────────────
  async function handleCopy(t: WhatsAppTemplate) {
    if (!t.mensagem.trim()) {
      toast.error("Mensagem vazia");
      return;
    }
    try {
      await navigator.clipboard.writeText(t.mensagem);
      setCopiedId(t.id);
      toast.success("Copiado!");
      setTimeout(() => setCopiedId((c) => (c === t.id ? null : c)), 1500);
    } catch {
      toast.error("Erro ao copiar");
    }
  }

  // ─── Delete ───────────────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    const { error } = await deleteWhatsAppTemplate(id);
    if (error) {
      toast.error("Erro ao excluir");
      return;
    }
    if (saveTimers.current[id]) {
      clearTimeout(saveTimers.current[id]);
      delete saveTimers.current[id];
    }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    setConfirmDeleteId(null);
    toast.success("Mensagem excluída");
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="rounded-xl p-5 bg-surface-2 border border-border-soft">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4 text-[#25D366]" />
          <h3 className="font-fraunces font-semibold text-base text-cream">
            Mensagens salvas
          </h3>
          <span className="text-[10px] font-dm px-1.5 py-0.5 rounded bg-border-soft text-cream-30">
            {templates.length}
          </span>
        </div>
        <Button size="sm" onClick={handleCreate} loading={creating}>
          <Plus className="h-3.5 w-3.5" /> Nova
        </Button>
      </div>

      <p className="text-[10px] font-dm mb-4 text-cream-30">
        Bloco de notas pessoal. Crie quantas mensagens quiser e copie pra mandar
        no WhatsApp. Salva automaticamente.
      </p>

      {/* Loading */}
      {loading && <LoadingState />}

      {/* Empty state */}
      {!loading && templates.length === 0 && (
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma mensagem salva ainda"
          description={"Clique em \u201cNova\u201d pra criar a primeira."}
        />
      )}

      {/* List */}
      {!loading && templates.length > 0 && (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {templates.map((t) => {
              const state = saveState[t.id] || "idle";
              const isConfirm = confirmDeleteId === t.id;
              return (
                <motion.div
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-lg p-3 bg-black/25 border border-white/5"
                >
                  {/* Title row */}
                  <div className="flex items-center gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Título (ex.: Lembrete sessão)"
                      value={t.titulo}
                      onChange={(e) =>
                        updateField(t.id, "titulo", e.target.value)
                      }
                      className="flex-1 bg-transparent outline-none text-sm font-dm font-semibold text-cream"
                    />

                    {/* Save indicator */}
                    {state === "saving" && (
                      <Loader2 className="h-3 w-3 animate-spin flex-shrink-0 text-cream-30" />
                    )}
                    {state === "saved" && (
                      <Check className="h-3 w-3 flex-shrink-0 text-[#25D366]" />
                    )}

                    {/* Copy */}
                    <button
                      onClick={() => handleCopy(t)}
                      className={`p-1.5 rounded hover:bg-white/5 transition-colors flex-shrink-0 ${
                        copiedId === t.id ? "text-[#25D366]" : "text-cream/45"
                      }`}
                      title="Copiar mensagem"
                    >
                      {copiedId === t.id ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>

                    {/* Delete */}
                    {isConfirm ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-[10px] font-dm font-bold px-2 py-1 rounded bg-red-500/20 text-red-500"
                        >
                          Excluir
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-[10px] font-dm px-2 py-1 rounded bg-white/5 text-cream-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(t.id)}
                        className="p-1.5 rounded hover:bg-red-500/10 transition-colors flex-shrink-0 text-cream-30"
                        title="Excluir mensagem"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Message textarea */}
                  <textarea
                    placeholder="Escreva a mensagem..."
                    value={t.mensagem}
                    onChange={(e) =>
                      updateField(t.id, "mensagem", e.target.value)
                    }
                    className="w-full text-xs font-dm p-3 rounded resize-y outline-none bg-black/30 text-cream/75 border border-white/5 min-h-[90px]"
                  />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
