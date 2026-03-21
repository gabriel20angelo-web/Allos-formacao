"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const WHATSAPP_GROUP_LINK = "https://chat.whatsapp.com/JpZtYWJovU03VlrZJ5oUxQ";

function WhatsAppIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function FloatingQuestionButton() {
  const { user, profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isOpen]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim()) return;

    setSending(true);

    try {
      const client = createClient();
      await client.from("video_questions").insert({
        user_id: user?.id || null,
        user_name: profile?.full_name || "Anônimo",
        user_email: profile?.email || null,
        question: question.trim(),
      });

      setSent(true);
      setQuestion("");
      toast.success("Dúvida enviada! Obrigado!");
      setTimeout(() => {
        setSent(false);
        setIsOpen(false);
      }, 3000);
    } catch {
      toast.error("Erro ao enviar. Tente novamente.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-[999]" ref={panelRef}>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-20 right-0 w-[340px] rounded-2xl overflow-hidden"
            style={{
              background: "rgba(22,22,22,0.97)",
              border: "1px solid rgba(255,255,255,0.1)",
              boxShadow: "0 25px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,75,49,0.1)",
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Header */}
            <div
              className="px-5 pt-5 pb-4"
              style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="flex items-start justify-between mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(200,75,49,0.12)", border: "1px solid rgba(200,75,49,0.25)" }}
                >
                  {/* Video camera SVG */}
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C84B31" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
                    <rect x="3" y="6" width="12" height="12" rx="2" />
                    <circle cx="9" cy="12" r="1" fill="#C84B31" />
                  </svg>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-cream/30 hover:text-cream/60 hover:bg-white/5 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h3 className="font-fraunces font-bold text-lg text-cream leading-tight">
                Sua pergunta em vídeo
              </h3>
              <p className="text-xs text-cream/40 mt-1 leading-relaxed">
                Mande sua dúvida e a gente responde em vídeo no nosso canal! As melhores perguntas são selecionadas toda semana.
              </p>
            </div>

            {/* Body */}
            <div className="p-5">
              {sent ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-4"
                >
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                    style={{ background: "rgba(46,158,143,0.12)", border: "1px solid rgba(46,158,143,0.25)" }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2E9E8F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </div>
                  <p className="font-dm font-semibold text-cream text-sm">Dúvida recebida!</p>
                  <p className="text-xs text-cream/40 mt-1">Fique de olho no nosso canal.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ex: Como lidar com resistência do paciente nas primeiras sessões?"
                    rows={4}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl text-sm text-cream placeholder:text-cream/20 resize-none focus:outline-none transition-all"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1.5px solid rgba(255,255,255,0.08)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "rgba(200,75,49,0.4)";
                      e.currentTarget.style.boxShadow = "0 0 0 3px rgba(200,75,49,0.08)";
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-cream/20">{question.length}/500</span>
                    <motion.button
                      type="submit"
                      disabled={!question.trim() || sending}
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-5 py-2.5 rounded-xl font-dm font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "linear-gradient(135deg, #C84B31, #A33D27)",
                        boxShadow: "0 4px 16px rgba(200,75,49,0.3)",
                      }}
                    >
                      {sending ? "Enviando..." : "Enviar dúvida"}
                    </motion.button>
                  </div>
                </form>
              )}
            </div>

            {/* WhatsApp shortcut */}
            <div
              className="px-5 pb-4 pt-1"
              style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
            >
              <a
                href={WHATSAPP_GROUP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl transition-all hover:bg-white/[0.03] group"
              >
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "rgba(37,211,102,0.12)", color: "#25D366" }}
                >
                  <WhatsAppIcon size={14} />
                </div>
                <div className="min-w-0">
                  <p className="font-dm text-[11px] font-semibold text-cream/60 group-hover:text-cream/80 transition-colors">
                    Quer ser respondido mais rápido?
                  </p>
                  <p className="font-dm text-[10px] text-cream/30">
                    Pergunte no nosso grupo de WhatsApp
                  </p>
                </div>
                <svg className="h-3.5 w-3.5 text-cream/20 group-hover:text-[#25D366] transition-colors flex-shrink-0 ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB Button */}
      <div className="relative">
          {/* Tooltip on hover */}
          <AnimatePresence>
            {isHovered && !isOpen && (
              <motion.div
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.2 }}
                className="absolute right-full mr-4 top-1/2 -translate-y-1/2 whitespace-nowrap"
              >
                <div
                  className="px-4 py-2.5 rounded-xl text-sm font-dm font-medium text-cream"
                  style={{
                    background: "rgba(22,22,22,0.95)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                  }}
                >
                  <span className="text-accent font-semibold">Pergunta em vídeo?</span>
                  <br />
                  <span className="text-cream/50 text-xs">Mande sua dúvida!</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            onClick={() => setIsOpen(!isOpen)}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-14 h-14 rounded-full flex items-center justify-center transition-all"
            style={{
              background: isOpen
                ? "linear-gradient(135deg, #1a1a1a, #222)"
                : "linear-gradient(135deg, #C84B31, #A33D27)",
              boxShadow: isOpen
                ? "0 4px 20px rgba(0,0,0,0.3)"
                : "0 8px 32px rgba(200,75,49,0.4), 0 0 0 2px rgba(200,75,49,0.15)",
            }}
            aria-label="Enviar pergunta para resposta em vídeo"
          >
            <AnimatePresence mode="wait">
              {isOpen ? (
                <motion.div
                  key="close"
                  initial={{ rotate: -90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <X className="h-5 w-5 text-cream/60" />
                </motion.div>
              ) : (
                <motion.div
                  key="icon"
                  initial={{ rotate: 90, opacity: 0 }}
                  animate={{ rotate: 0, opacity: 1 }}
                  exit={{ rotate: -90, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Video question icon */}
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14" />
                    <rect x="3" y="6" width="12" height="12" rx="2" />
                    <path d="M9 10v0" strokeWidth="3" strokeLinecap="round" />
                    <path d="M9 14h.01" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Pulse ring */}
            {!isOpen && (
              <span className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: "#C84B31" }} />
            )}
          </motion.button>
        </div>
    </div>
  );
}
