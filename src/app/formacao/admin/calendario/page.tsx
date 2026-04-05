"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  Clock,
  CalendarDays,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Link as LinkIcon,
  X,
  UserPlus,
  ChevronDown,
  Check,
  Image as ImageIcon,
  Download,
  Send,
  MessageCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FormacaoHorario,
  FormacaoSlot,
  FormacaoAlocacao,
  CertificadoCondutor,
  CertificadoAtividade,
  CertificadoEvento,
  FormacaoCronograma,
} from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────
type SubTab = "calendario" | "horarios" | "cronograma" | "whatsapp" | "eventos";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;
const DIAS_SHORT = ["Seg", "Ter", "Qua", "Qui", "Sex"] as const;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pendente:       { label: "Pendente",       color: "#9ca3af", bg: "rgba(156,163,175,0.12)" },
  conduzido:      { label: "Conduzido",      color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
  nao_conduzido:  { label: "Não conduzido",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  cancelado:      { label: "Cancelado",      color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  desmarcado:     { label: "Desmarcado",     color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
};

const SUB_TABS: { key: SubTab; label: string; icon: typeof Calendar }[] = [
  { key: "calendario", label: "Calendário", icon: Calendar },
  { key: "horarios",   label: "Horários",   icon: Clock },
  { key: "cronograma", label: "Cronograma", icon: ImageIcon },
  { key: "whatsapp",   label: "WhatsApp",   icon: Send },
  { key: "eventos",    label: "Eventos",     icon: CalendarDays },
];

// ─── StatusDropdown ─────────────────────────────────────────────────────────
function StatusDropdown({
  current,
  onChange,
}: {
  current: string;
  onChange: (status: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const cfg = STATUS_CONFIG[current] || STATUS_CONFIG.pendente;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-dm transition-colors"
        style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
      >
        <span className="w-2 h-2 rounded-full" style={{ background: cfg.color }} />
        {cfg.label}
        <ChevronDown className="h-3 w-3" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded-lg py-1 min-w-[150px]"
          style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
        >
          {Object.entries(STATUS_CONFIG).map(([key, val]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-dm hover:bg-white/5 transition-colors"
              style={{ color: val.color }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: val.color }} />
              {val.label}
              {key === current && <Check className="h-3 w-3 ml-auto" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AtividadeDropdown ──────────────────────────────────────────────────────
function AtividadeDropdown({
  current,
  atividades,
  onChange,
}: {
  current: string | null;
  atividades: CertificadoAtividade[];
  onChange: (nome: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-dm transition-colors truncate max-w-[140px]"
        style={{ background: "rgba(255,255,255,0.05)", color: current ? "#FDFBF7" : "rgba(253,251,247,0.35)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {current || "Atividade"}
        <ChevronDown className="h-3 w-3 flex-shrink-0" />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-1 z-30 rounded-lg py-1 min-w-[180px] max-h-[200px] overflow-y-auto"
          style={{ background: "#1A1A1A", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}
        >
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full text-left px-3 py-1.5 text-xs font-dm hover:bg-white/5 transition-colors text-cream/40"
          >
            Nenhuma
          </button>
          {atividades.map((a) => (
            <button
              key={a.id}
              onClick={() => { onChange(a.nome); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs font-dm hover:bg-white/5 transition-colors"
              style={{ color: "#FDFBF7" }}
            >
              {a.nome}
              {a.nome === current && <Check className="h-3 w-3 inline ml-2 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function CalendarioPage() {
  const { isAdmin } = useAuth();
  const [subTab, setSubTab] = useState<SubTab>("calendario");
  const [loading, setLoading] = useState(true);

  // Data
  const [horarios, setHorarios] = useState<FormacaoHorario[]>([]);
  const [slots, setSlots] = useState<FormacaoSlot[]>([]);
  const [alocacoes, setAlocacoes] = useState<FormacaoAlocacao[]>([]);
  const [condutores, setCondutores] = useState<CertificadoCondutor[]>([]);
  const [atividades, setAtividades] = useState<CertificadoAtividade[]>([]);
  const [eventos, setEventos] = useState<CertificadoEvento[]>([]);
  const [config, setConfig] = useState<FormacaoCronograma | null>(null);

  // UI state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [meetEditSlotId, setMeetEditSlotId] = useState<string | null>(null);
  const [meetLinkDraft, setMeetLinkDraft] = useState("");
  const [addCondutorSlotId, setAddCondutorSlotId] = useState<string | null>(null);

  // Horarios tab
  const [newHora, setNewHora] = useState("08:00");
  const [addingHorario, setAddingHorario] = useState(false);

  // Eventos tab
  const [eventoForm, setEventoForm] = useState({ titulo: "", descricao: "", link: "", data_inicio: "", data_fim: "" });
  const [addingEvento, setAddingEvento] = useState(false);
  const [deleteEventoTarget, setDeleteEventoTarget] = useState<CertificadoEvento | null>(null);

  // Cronograma canvas
  const cronogramaCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);

  // WhatsApp
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [whatsappInitialized, setWhatsappInitialized] = useState(false);

  // ─── Fetch all data ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    const [hRes, sRes, aRes, cRes, atRes, eRes, cfgRes] = await Promise.all([
      supabase.from("formacao_horarios").select("*").eq("ativo", true).order("ordem"),
      supabase.from("formacao_slots").select("*, formacao_horarios(hora, ordem)"),
      supabase.from("formacao_alocacoes").select("*, certificado_condutores(id, nome, telefone)"),
      supabase.from("certificado_condutores").select("*").eq("ativo", true).order("nome"),
      supabase.from("certificado_atividades").select("*").eq("ativo", true).order("nome"),
      supabase.from("certificado_eventos").select("*").order("data_inicio", { ascending: false }),
      supabase.from("formacao_cronograma").select("*").limit(1).single(),
    ]);
    if (hRes.data) setHorarios(hRes.data);
    if (sRes.data) setSlots(sRes.data);
    if (aRes.data) setAlocacoes(aRes.data);
    if (cRes.data) setCondutores(cRes.data);
    if (atRes.data) setAtividades(atRes.data);
    if (eRes.data) setEventos(eRes.data);
    if (cfgRes.data) setConfig(cfgRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll().catch(() => setLoading(false));
  }, [fetchAll]);

  // Load assets for canvas (logo, background, fonts)
  useEffect(() => {
    const img = new window.Image();
    img.crossOrigin = "anonymous";
    img.src = "/Logo_Allos_Light.png";
    img.onload = () => { logoRef.current = img; };

    const bg = new window.Image();
    bg.crossOrigin = "anonymous";
    bg.src = "/bg_allos_teal.png";
    bg.onload = () => { bgRef.current = bg; };

    // Load Cocogoose font for canvas
    const cocoBold = new FontFace("CocogoosePro", "url(/fonts/CocogoosePro.ttf)");
    const cocoLight = new FontFace("CocogooseProSemilight", "url(/fonts/CocogooseProSemilight.ttf)");
    Promise.all([cocoBold.load(), cocoLight.load()]).then(([b, l]) => {
      document.fonts.add(b);
      document.fonts.add(l);
    }).catch(() => {});
  }, []);

  // ─── Config upsert ────────────────────────────────────────────────────────
  async function upsertConfig(fields: Partial<FormacaoCronograma>) {
    const supabase = createClient();
    const { data: existing } = await supabase.from("formacao_cronograma").select("id").limit(1).single();
    if (existing) {
      const { data } = await supabase
        .from("formacao_cronograma")
        .update({ ...fields, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (data) setConfig(data);
    } else {
      const { data } = await supabase
        .from("formacao_cronograma")
        .insert({ grupos_visiveis: true, duracao_minutos: 90, ...fields })
        .select("*")
        .single();
      if (data) setConfig(data);
    }
  }

  // ─── Cronograma canvas draw ──────────────────────────────────────────────
  const drawCronograma = useCallback(() => {
    const canvas = cronogramaCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const activeH = [...horarios].sort((a, b) => a.ordem - b.ordem);
    const activeSlots = slots.filter((s) => s.ativo && s.atividade_nome);

    const dayData: { dia: string; items: string[] }[] = [];
    DIAS.forEach((dia, diaIdx) => {
      const items: string[] = [];
      activeH.forEach((h) => {
        const slot = activeSlots.find((s) => s.dia_semana === diaIdx && s.horario_id === h.id);
        if (slot && slot.atividade_nome) {
          items.push(`${h.hora.replace(":00", "h")}:  ${slot.atividade_nome}`);
        }
      });
      if (items.length > 0) dayData.push({ dia, items });
    });

    // ── Layout constants (1080 square, Instagram-ready) ──
    const W = 1080;
    const sidePad = 80;
    const tableW = W - sidePad * 2;
    const logoZoneH = 230;
    const titleBarH = 52;
    const dayColW = 180;
    const lineH = 40;
    const rowPadY = 18;
    const footerZoneH = 110;

    let tableBodyH = 0;
    if (dayData.length === 0) {
      tableBodyH = 120;
    } else {
      dayData.forEach((d) => { tableBodyH += rowPadY * 2 + d.items.length * lineH; });
    }
    const H = logoZoneH + titleBarH + tableBodyH + footerZoneH;

    canvas.width = W;
    canvas.height = H;

    // ── 1. Background: texture image, cover-crop ──
    if (bgRef.current) {
      const bi = bgRef.current;
      const ir = bi.width / bi.height, cr = W / H;
      let sx = 0, sy = 0, sw = bi.width, sh = bi.height;
      if (ir > cr) { sw = bi.height * cr; sx = (bi.width - sw) / 2; }
      else { sh = bi.width / cr; sy = 0; }
      ctx.drawImage(bi, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      // Fallback: paint the teal manually with noise
      const g = ctx.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.5, H * 0.5, W * 0.8);
      g.addColorStop(0, "#35AFA0");
      g.addColorStop(0.5, "#2A9486");
      g.addColorStop(1, "#1C6B62");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Noise
      for (let i = 0; i < 8000; i++) {
        ctx.fillStyle = `rgba(${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() > 0.5 ? 255 : 0},${Math.random() * 0.015})`;
        ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
      }
    }

    // Very soft corner darkening
    const vig = ctx.createRadialGradient(W * 0.4, H * 0.35, W * 0.2, W * 0.5, H * 0.5, W * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── 2. Logo (centered, breathing room) ──
    if (logoRef.current) {
      const img = logoRef.current;
      const targetW = 320;
      const r = img.width / img.height;
      const lw = targetW;
      const lh = lw / r;
      ctx.drawImage(img, (W - lw) / 2, (logoZoneH - lh) / 2, lw, lh);
    }

    // ── 3. "QUADRO DE HORÁRIOS" title bar ──
    const ty = logoZoneH;
    ctx.fillStyle = "rgba(12,18,16,0.85)";
    ctx.fillRect(sidePad, ty, tableW, titleBarH);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 20px CocogoosePro, "Helvetica Neue", sans-serif';
    ctx.fillStyle = "#FDFBF7";
    ctx.fillText("QUADRO DE HORÁRIOS", W / 2, ty + titleBarH / 2 + 1);

    // ── 4. Table rows ──
    let cy = logoZoneH + titleBarH;

    if (dayData.length === 0) {
      ctx.fillStyle = "rgba(0,0,0,0.18)";
      ctx.fillRect(sidePad, cy, tableW, 120);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '18px CocogooseProSemilight, "Helvetica Neue", sans-serif';
      ctx.fillStyle = "rgba(253,251,247,0.3)";
      ctx.fillText("Nenhum grupo cadastrado no calendário", W / 2, cy + 60);
      cy += 120;
    } else {
      dayData.forEach((day) => {
        const rh = rowPadY * 2 + day.items.length * lineH;

        // Row background — uniform semi-transparent dark
        ctx.fillStyle = "rgba(0,0,0,0.18)";
        ctx.fillRect(sidePad, cy, tableW, rh);

        // Top separator — thin white line
        ctx.strokeStyle = "rgba(253,251,247,0.15)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sidePad, cy + 0.5);
        ctx.lineTo(sidePad + tableW, cy + 0.5);
        ctx.stroke();

        // Vertical separator
        ctx.strokeStyle = "rgba(253,251,247,0.12)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(sidePad + dayColW, cy);
        ctx.lineTo(sidePad + dayColW, cy + rh);
        ctx.stroke();

        // Day label
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = 'bold 18px CocogoosePro, "Helvetica Neue", sans-serif';
        ctx.fillStyle = "#FDFBF7";
        ctx.fillText(day.dia.toUpperCase(), sidePad + dayColW / 2, cy + rh / 2 + 1);

        // Activity items
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        day.items.forEach((item, i) => {
          const iy = cy + rowPadY + i * lineH + lineH / 2;

          // Bullet — small filled square
          ctx.fillStyle = "#FDFBF7";
          ctx.fillRect(sidePad + dayColW + 26, iy - 3, 6, 6);

          // Text
          ctx.font = '17px Inter, "Helvetica Neue", sans-serif';
          ctx.fillStyle = "rgba(253,251,247,0.92)";
          ctx.fillText(item, sidePad + dayColW + 46, iy + 1);
        });

        cy += rh;
      });

      // Bottom border of last row
      ctx.strokeStyle = "rgba(253,251,247,0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sidePad, cy + 0.5);
      ctx.lineTo(sidePad + tableW, cy + 0.5);
      ctx.stroke();
    }

    // ── 5. Footer ──
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '20px CocogooseProSemilight, "Helvetica Neue", sans-serif';
    ctx.fillStyle = "rgba(46,158,143,0.75)";
    ctx.fillText("Cronograma Geral", W / 2, H - footerZoneH / 2 + 8);
  }, [horarios, slots]);

  // Auto-draw cronograma when tab is active or data changes
  useEffect(() => {
    if (subTab === "cronograma" && !loading) {
      const t = setTimeout(() => drawCronograma(), 50);
      return () => clearTimeout(t);
    }
  }, [subTab, loading, horarios, slots, drawCronograma]);

  function downloadCronograma() {
    const canvas = cronogramaCanvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = "Cronograma_Allos.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    toast.success("Cronograma baixado!");
  }

  // ─── WhatsApp template ──────────────────────────────────────────────────
  function buildWhatsAppMessage(): string {
    const activeH = horarios.filter((h) => h.ativo).sort((a, b) => a.ordem - b.ordem);
    const lines: string[] = [];

    lines.push("📋 *QUADRO DE HORÁRIOS — FORMAÇÃO BASE*");
    lines.push("_Associação Allos_");
    lines.push("");

    DIAS.forEach((dia, diaIdx) => {
      const daySlots = slots
        .filter((s) => s.ativo && s.dia_semana === diaIdx && s.atividade_nome)
        .sort((a, b) => {
          const hA = activeH.find((h) => h.id === a.horario_id);
          const hB = activeH.find((h) => h.id === b.horario_id);
          return (hA?.ordem || 0) - (hB?.ordem || 0);
        });

      if (daySlots.length === 0) return;

      lines.push(`*${dia}*`);
      daySlots.forEach((slot) => {
        const hora = activeH.find((h) => h.id === slot.horario_id)?.hora || "";
        const allocs = alocacoes.filter((a) => a.slot_id === slot.id);
        const condNames = allocs.map((a) => a.certificado_condutores?.nome || "").filter(Boolean).join(", ");
        lines.push(`  🕐 ${hora} — ${slot.atividade_nome}${condNames ? ` (${condNames})` : ""}`);
      });
      lines.push("");
    });

    lines.push("🔗 Grupo WhatsApp: https://chat.whatsapp.com/JpZtYWJovU03VlrZJ5oUxQ");
    lines.push("");
    lines.push("📚 Encontros e cursos gravados completos e gratuitos:");
    lines.push("👉 allos.org.br/formacao");
    lines.push("");
    lines.push("🧠 Confira também nosso projeto de psicoterapia acessível a valor social:");
    lines.push("👉 https://bit.ly/terapiasite");
    lines.push("");
    lines.push("_Sua participação fortalece nossos projetos!_ 💚");

    return lines.join("\n");
  }

  // Initialize whatsapp message when tab is opened or data changes
  useEffect(() => {
    if (subTab === "whatsapp" && !loading) {
      if (!whatsappInitialized) {
        setWhatsappMsg(buildWhatsAppMessage());
        setWhatsappInitialized(true);
      }
    }
  }, [subTab, loading, whatsappInitialized]);

  function regenerateWhatsApp() {
    setWhatsappMsg(buildWhatsAppMessage());
    toast.success("Mensagem regenerada a partir do cronograma!");
  }

  function copyWhatsApp() {
    navigator.clipboard.writeText(whatsappMsg || buildWhatsAppMessage());
    setWhatsappCopied(true);
    toast.success("Mensagem copiada!");
    setTimeout(() => setWhatsappCopied(false), 2000);
  }

  // ─── Slot helpers ─────────────────────────────────────────────────────────
  function getSlot(dia: number, horarioId: string) {
    return slots.find((s) => s.dia_semana === dia && s.horario_id === horarioId);
  }

  function getSlotAlocacoes(slotId: string) {
    return alocacoes.filter((a) => a.slot_id === slotId);
  }

  // ─── Slot CRUD ────────────────────────────────────────────────────────────
  async function createSlot(dia: number, horarioId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_slots")
      .insert({ dia_semana: dia, horario_id: horarioId })
      .select("*, formacao_horarios(hora, ordem)")
      .single();
    if (error || !data) { toast.error("Erro ao criar slot."); return; }
    setSlots((prev) => [...prev, data]);
    toast.success("Slot criado!");
  }

  async function updateSlot(id: string, fields: Partial<FormacaoSlot>) {
    const currentSlot = slots.find((s) => s.id === id);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_slots")
      .update(fields)
      .eq("id", id)
      .select("*, formacao_horarios(hora, ordem)")
      .single();
    if (error || !data) { toast.error("Erro ao atualizar slot."); return; }
    setSlots((prev) => prev.map((s) => (s.id === id ? data : s)));

    // Log status change (fire-and-forget)
    if (fields.status && currentSlot && fields.status !== currentSlot.status) {
      const condutorIds = alocacoes
        .filter((a) => a.slot_id === id)
        .map((a) => a.condutor_id);
      fetch("/api/certificados/formacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "log_status_change",
          slot_id: id,
          status_anterior: currentSlot.status,
          status_novo: fields.status,
          atividade_nome: data.atividade_nome,
          condutor_ids: condutorIds,
        }),
      }).catch(() => {});
    }
  }

  async function deleteSlot(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_slots").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover slot."); return; }
    setSlots((prev) => prev.filter((s) => s.id !== id));
    setAlocacoes((prev) => prev.filter((a) => a.slot_id !== id));
    toast.success("Slot removido!");
  }

  // ─── Alocacao CRUD ────────────────────────────────────────────────────────
  async function addAlocacao(slotId: string, condutorId: string) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_alocacoes")
      .insert({ slot_id: slotId, condutor_id: condutorId })
      .select("*, certificado_condutores(id, nome, telefone)")
      .single();
    if (error || !data) { toast.error("Erro ao alocar condutor."); return; }
    setAlocacoes((prev) => [...prev, data]);
    setAddCondutorSlotId(null);
    toast.success("Condutor alocado!");
  }

  async function removeAlocacao(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_alocacoes").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover alocação."); return; }
    setAlocacoes((prev) => prev.filter((a) => a.id !== id));
  }

  // ─── Nova Semana ──────────────────────────────────────────────────────────
  async function handleNovaSemana() {
    const supabase = createClient();
    const activeSlots = slots.filter((s) => s.ativo);
    if (activeSlots.length === 0) { toast.error("Nenhum slot ativo."); setResetModalOpen(false); return; }

    // 1. Build snapshot data from current state
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon...
    const diffToMon = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMon);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);
    const fmt = (d: Date) => d.toISOString().split("T")[0];

    const snapshotSlots = activeSlots.map((s) => ({
      slot_id: s.id,
      dia_semana: s.dia_semana,
      horario_hora: s.formacao_horarios?.hora || "",
      atividade_nome: s.atividade_nome,
      status: s.status,
      meet_link: s.meet_link,
      condutores: alocacoes
        .filter((a) => a.slot_id === s.id)
        .map((a) => ({
          id: a.condutor_id,
          nome: a.certificado_condutores?.nome || "",
        })),
    }));

    // 2. Save snapshot via API (before reset)
    try {
      const res = await fetch("/api/certificados/formacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_snapshot",
          semana_inicio: fmt(monday),
          semana_fim: fmt(friday),
          slots: snapshotSlots,
        }),
      });
      if (!res.ok) throw new Error("Snapshot failed");
    } catch {
      toast.error("Erro ao salvar snapshot da semana. Reset cancelado.");
      return;
    }

    // 3. Reset statuses
    const { error } = await supabase
      .from("formacao_slots")
      .update({ status: "pendente" })
      .in("id", activeSlots.map((s) => s.id));
    if (error) { toast.error("Erro ao resetar semana."); return; }
    setSlots((prev) => prev.map((s) => (s.ativo ? { ...s, status: "pendente" } : s)));
    setResetModalOpen(false);
    toast.success("Semana salva e nova semana iniciada!");
  }

  // ─── Horario CRUD ─────────────────────────────────────────────────────────
  async function handleAddHorario() {
    if (!newHora) return;
    setAddingHorario(true);
    const supabase = createClient();
    const maxOrdem = horarios.length > 0 ? Math.max(...horarios.map((h) => h.ordem)) : 0;
    const { data, error } = await supabase
      .from("formacao_horarios")
      .insert({ hora: newHora, ordem: maxOrdem + 1, ativo: true })
      .select("*")
      .single();
    if (error || !data) { toast.error("Erro ao criar horário."); setAddingHorario(false); return; }
    setHorarios((prev) => [...prev, data].sort((a, b) => a.ordem - b.ordem));
    setAddingHorario(false);
    toast.success(`Horário ${newHora} adicionado!`);
  }

  async function deleteHorario(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_horarios").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover horário."); return; }
    setHorarios((prev) => prev.filter((h) => h.id !== id));
    toast.success("Horário removido!");
  }

  async function toggleHorario(id: string, ativo: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("formacao_horarios").update({ ativo }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar horário."); return; }
    setHorarios((prev) => prev.map((h) => (h.id === id ? { ...h, ativo } : h)));
  }

  // ─── Evento CRUD ──────────────────────────────────────────────────────────
  async function handleAddEvento() {
    if (!eventoForm.titulo.trim() || !eventoForm.data_inicio || !eventoForm.data_fim) {
      toast.error("Preencha título, data de início e data de fim.");
      return;
    }
    setAddingEvento(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("certificado_eventos")
      .insert({
        titulo: eventoForm.titulo.trim(),
        descricao: eventoForm.descricao.trim() || null,
        link: eventoForm.link.trim() || null,
        data_inicio: eventoForm.data_inicio,
        data_fim: eventoForm.data_fim,
        ativo: true,
      })
      .select("*")
      .single();
    if (error || !data) { toast.error("Erro ao criar evento."); setAddingEvento(false); return; }
    setEventos((prev) => [data, ...prev]);
    setEventoForm({ titulo: "", descricao: "", link: "", data_inicio: "", data_fim: "" });
    setAddingEvento(false);
    toast.success("Evento criado!");
  }

  async function toggleEvento(id: string, ativo: boolean) {
    const supabase = createClient();
    const { error } = await supabase.from("certificado_eventos").update({ ativo }).eq("id", id);
    if (error) { toast.error("Erro ao atualizar evento."); return; }
    setEventos((prev) => prev.map((e) => (e.id === id ? { ...e, ativo } : e)));
  }

  async function deleteEvento(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("certificado_eventos").delete().eq("id", id);
    if (error) { toast.error("Erro ao remover evento."); return; }
    setEventos((prev) => prev.filter((e) => e.id !== id));
    setDeleteEventoTarget(null);
    toast.success("Evento removido!");
  }

  // ─── Stats ────────────────────────────────────────────────────────────────
  const activeSlots = slots.filter((s) => s.ativo);
  const stats = {
    total: activeSlots.length,
    conduzidos: activeSlots.filter((s) => s.status === "conduzido").length,
    nao_conduzidos: activeSlots.filter((s) => s.status === "nao_conduzido").length,
    cancelados: activeSlots.filter((s) => s.status === "cancelado").length,
    desmarcados: activeSlots.filter((s) => s.status === "desmarcado").length,
    pendentes: activeSlots.filter((s) => s.status === "pendente").length,
  };

  // ─── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-32" />
          ))}
        </div>
        <div className="grid grid-cols-6 gap-3">
          {[...Array(30)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  // ─── activeHorarios for the grid ──────────────────────────────────────────
  const activeHorarios = horarios.filter((h) => h.ativo).sort((a, b) => a.ordem - b.ordem);

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="font-fraunces font-bold text-2xl" style={{ color: "#FDFBF7" }}>
          Calendário Semanal
        </h1>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Duration input */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" style={{ color: "rgba(253,251,247,0.5)" }} />
            <input
              type="number"
              min={30}
              max={300}
              step={10}
              value={config?.duracao_minutos ?? 90}
              onChange={(e) => upsertConfig({ duracao_minutos: Number(e.target.value) } as Partial<FormacaoCronograma>)}
              className="w-20 px-2 py-1.5 rounded-lg text-xs font-dm"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#FDFBF7",
              }}
            />
            <span className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>min</span>
          </div>

          {/* Visibility toggle */}
          <button
            onClick={() => upsertConfig({ grupos_visiveis: !(config?.grupos_visiveis ?? true) } as Partial<FormacaoCronograma>)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-dm transition-colors"
            style={{
              background: (config?.grupos_visiveis ?? true) ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
              color: (config?.grupos_visiveis ?? true) ? "#22c55e" : "rgba(253,251,247,0.4)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {(config?.grupos_visiveis ?? true) ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {(config?.grupos_visiveis ?? true) ? "Visível" : "Oculto"}
          </button>

          {/* Nova Semana */}
          <Button variant="secondary" size="sm" onClick={() => setResetModalOpen(true)}>
            <RefreshCw className="h-3.5 w-3.5" />
            Nova Semana
          </Button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl w-fit"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        {SUB_TABS.map((tab) => {
          const active = subTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSubTab(tab.key)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-dm transition-all duration-200"
              style={{
                background: active ? "rgba(200,75,49,0.15)" : "transparent",
                color: active ? "#C84B31" : "rgba(253,251,247,0.5)",
                fontWeight: active ? 600 : 400,
              }}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {subTab === "calendario" && (
          <motion.div
            key="calendario"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Stats bar */}
            <div
              className="flex flex-wrap gap-3 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              {[
                { label: "Total",          value: stats.total,          color: "#FDFBF7" },
                { label: "Conduzidos",      value: stats.conduzidos,    color: "#22c55e" },
                { label: "Não conduzidos",  value: stats.nao_conduzidos, color: "#f59e0b" },
                { label: "Cancelados",      value: stats.cancelados,    color: "#ef4444" },
                { label: "Desmarcados",     value: stats.desmarcados,   color: "#8b5cf6" },
                { label: "Pendentes",       value: stats.pendentes,     color: "#9ca3af" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.5)" }}>
                    {s.label}:
                  </span>
                  <span className="text-sm font-dm font-semibold" style={{ color: s.color }}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[800px]">
                {/* Header row */}
                <div className="grid grid-cols-[80px_repeat(5,1fr)] gap-2 mb-2">
                  <div />
                  {DIAS.map((dia) => (
                    <div
                      key={dia}
                      className="text-center text-xs font-dm font-semibold py-2 rounded-lg"
                      style={{ color: "rgba(253,251,247,0.6)", background: "rgba(255,255,255,0.03)" }}
                    >
                      {dia}
                    </div>
                  ))}
                </div>

                {/* Data rows */}
                {activeHorarios.map((horario) => (
                  <div key={horario.id} className="grid grid-cols-[80px_repeat(5,1fr)] gap-2 mb-2">
                    {/* Time label */}
                    <div
                      className="flex items-center justify-center text-xs font-dm font-semibold rounded-lg"
                      style={{ color: "#C84B31", background: "rgba(200,75,49,0.08)" }}
                    >
                      {horario.hora}
                    </div>

                    {/* Cells */}
                    {DIAS.map((_, diaIdx) => {
                      const slot = getSlot(diaIdx, horario.id);
                      const slotAlocacoes = slot ? getSlotAlocacoes(slot.id) : [];

                      if (!slot) {
                        return (
                          <div
                            key={`${diaIdx}-${horario.id}`}
                            className="flex items-center justify-center rounded-xl min-h-[100px] transition-colors hover:bg-white/[0.04] cursor-pointer"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}
                            onClick={() => createSlot(diaIdx, horario.id)}
                          >
                            <Plus className="h-5 w-5" style={{ color: "rgba(253,251,247,0.15)" }} />
                          </div>
                        );
                      }

                      if (!slot.ativo) {
                        return (
                          <div
                            key={`${diaIdx}-${horario.id}`}
                            className="flex flex-col items-center justify-center rounded-xl min-h-[100px] gap-1"
                            style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.04)", opacity: 0.5 }}
                          >
                            <span className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>Inativo</span>
                            <button
                              onClick={() => updateSlot(slot.id, { ativo: true } as Partial<FormacaoSlot>)}
                              className="text-[10px] font-dm underline"
                              style={{ color: "#C84B31" }}
                            >
                              Ativar
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`${diaIdx}-${horario.id}`}
                          className="rounded-xl p-2.5 flex flex-col gap-1.5 min-h-[100px]"
                          style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                        >
                          {/* Top row: status + delete */}
                          <div className="flex items-center justify-between gap-1">
                            <StatusDropdown
                              current={slot.status}
                              onChange={(status) => updateSlot(slot.id, { status } as Partial<FormacaoSlot>)}
                            />
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={() => updateSlot(slot.id, { ativo: false } as Partial<FormacaoSlot>)}
                                className="p-1 rounded hover:bg-white/5 transition-colors"
                                title="Desativar"
                              >
                                <EyeOff className="h-3 w-3" style={{ color: "rgba(253,251,247,0.25)" }} />
                              </button>
                              <button
                                onClick={() => deleteSlot(slot.id)}
                                className="p-1 rounded hover:bg-red-500/10 transition-colors"
                                title="Remover"
                              >
                                <Trash2 className="h-3 w-3" style={{ color: "rgba(239,68,68,0.5)" }} />
                              </button>
                            </div>
                          </div>

                          {/* Atividade */}
                          <AtividadeDropdown
                            current={slot.atividade_nome}
                            atividades={atividades}
                            onChange={(nome) => updateSlot(slot.id, { atividade_nome: nome } as Partial<FormacaoSlot>)}
                          />

                          {/* Meet link */}
                          {meetEditSlotId === slot.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="url"
                                value={meetLinkDraft}
                                onChange={(e) => setMeetLinkDraft(e.target.value)}
                                placeholder="https://meet.google.com/..."
                                className="flex-1 px-2 py-1 rounded text-[10px] font-dm"
                                style={{
                                  background: "rgba(255,255,255,0.05)",
                                  border: "1px solid rgba(255,255,255,0.1)",
                                  color: "#FDFBF7",
                                }}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    updateSlot(slot.id, { meet_link: meetLinkDraft || null } as Partial<FormacaoSlot>);
                                    setMeetEditSlotId(null);
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  updateSlot(slot.id, { meet_link: meetLinkDraft || null } as Partial<FormacaoSlot>);
                                  setMeetEditSlotId(null);
                                }}
                                className="p-1 rounded hover:bg-white/5"
                              >
                                <Check className="h-3 w-3" style={{ color: "#22c55e" }} />
                              </button>
                              <button onClick={() => setMeetEditSlotId(null)} className="p-1 rounded hover:bg-white/5">
                                <X className="h-3 w-3" style={{ color: "rgba(253,251,247,0.3)" }} />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setMeetEditSlotId(slot.id); setMeetLinkDraft(slot.meet_link || ""); }}
                              className="flex items-center gap-1 text-[10px] font-dm transition-colors hover:opacity-80"
                              style={{ color: slot.meet_link ? "#60a5fa" : "rgba(253,251,247,0.2)" }}
                            >
                              <LinkIcon className="h-3 w-3" />
                              {slot.meet_link ? "Meet" : "Add link"}
                            </button>
                          )}

                          {/* Condutores */}
                          <div className="space-y-1 mt-auto">
                            {slotAlocacoes.map((aloc) => (
                              <div key={aloc.id} className="flex items-center justify-between gap-1">
                                <span className="text-[10px] font-dm truncate" style={{ color: "rgba(253,251,247,0.7)" }}>
                                  {aloc.certificado_condutores?.nome || "—"}
                                </span>
                                <button
                                  onClick={() => removeAlocacao(aloc.id)}
                                  className="p-0.5 rounded hover:bg-red-500/10 flex-shrink-0"
                                >
                                  <X className="h-2.5 w-2.5" style={{ color: "rgba(239,68,68,0.5)" }} />
                                </button>
                              </div>
                            ))}

                            {/* Add condutor */}
                            {addCondutorSlotId === slot.id ? (
                              <div className="space-y-1">
                                <div
                                  className="max-h-[120px] overflow-y-auto rounded-lg py-1"
                                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.06)" }}
                                >
                                  {condutores
                                    .filter((c) => !slotAlocacoes.some((a) => a.condutor_id === c.id))
                                    .map((c) => (
                                      <button
                                        key={c.id}
                                        onClick={() => addAlocacao(slot.id, c.id)}
                                        className="w-full text-left px-2 py-1 text-[10px] font-dm hover:bg-white/5 transition-colors"
                                        style={{ color: "#FDFBF7" }}
                                      >
                                        {c.nome}
                                      </button>
                                    ))}
                                  {condutores.filter((c) => !slotAlocacoes.some((a) => a.condutor_id === c.id)).length === 0 && (
                                    <span className="px-2 py-1 text-[10px] font-dm block" style={{ color: "rgba(253,251,247,0.3)" }}>
                                      Sem condutores disponíveis
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setAddCondutorSlotId(null)}
                                  className="text-[10px] font-dm"
                                  style={{ color: "rgba(253,251,247,0.3)" }}
                                >
                                  Cancelar
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAddCondutorSlotId(slot.id)}
                                className="flex items-center gap-1 text-[10px] font-dm transition-colors hover:opacity-80"
                                style={{ color: "rgba(200,75,49,0.7)" }}
                              >
                                <UserPlus className="h-3 w-3" />
                                Condutor
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}

                {activeHorarios.length === 0 && (
                  <div className="text-center py-16">
                    <Clock className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.15)" }} />
                    <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>
                      Nenhum horário ativo. Crie horários na aba &quot;Horários&quot;.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {subTab === "horarios" && (
          <motion.div
            key="horarios"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Add new */}
            <div
              className="flex items-center gap-3 p-4 rounded-xl"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <input
                type="time"
                value={newHora}
                onChange={(e) => setNewHora(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm font-dm"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#FDFBF7",
                  colorScheme: "dark",
                }}
              />
              <Button size="sm" onClick={handleAddHorario} loading={addingHorario}>
                <Plus className="h-4 w-4" />
                Adicionar
              </Button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {horarios
                .sort((a, b) => a.ordem - b.ordem)
                .map((h) => (
                  <motion.div
                    key={h.id}
                    layout
                    className="flex items-center justify-between px-4 py-3 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4" style={{ color: "#C84B31" }} />
                      <span className="text-sm font-dm font-semibold" style={{ color: "#FDFBF7" }}>
                        {h.hora}
                      </span>
                      <span className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>
                        Ordem: {h.ordem}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Toggle ativo */}
                      <button
                        onClick={() => toggleHorario(h.id, !h.ativo)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors"
                        style={{
                          background: h.ativo ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                          color: h.ativo ? "#22c55e" : "rgba(253,251,247,0.4)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {h.ativo ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                        {h.ativo ? "Ativo" : "Inativo"}
                      </button>
                      {/* Delete */}
                      <button
                        onClick={() => deleteHorario(h.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" style={{ color: "rgba(239,68,68,0.6)" }} />
                      </button>
                    </div>
                  </motion.div>
                ))}

              {horarios.length === 0 && (
                <div className="text-center py-16">
                  <Clock className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.15)" }} />
                  <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>
                    Nenhum horário cadastrado.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── Cronograma ──────────────────────────────────────────── */}
        {subTab === "cronograma" && (
          <motion.div key="cronograma" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" style={{ color: "#C84B31" }} />
                  <h3 className="font-fraunces font-semibold text-base" style={{ color: "#FDFBF7" }}>Quadro de Horários</h3>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={() => drawCronograma()}>
                    <RefreshCw className="h-3.5 w-3.5" /> Atualizar
                  </Button>
                  <Button size="sm" onClick={downloadCronograma}>
                    <Download className="h-3.5 w-3.5" /> Baixar PNG
                  </Button>
                </div>
              </div>
              <p className="text-xs font-dm mb-4" style={{ color: "rgba(253,251,247,0.35)" }}>
                A arte é gerada automaticamente a partir dos dados do calendário.
              </p>
              <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
                <canvas ref={cronogramaCanvasRef} className="w-full h-auto" style={{ maxWidth: "100%", display: "block" }} onLoad={() => drawCronograma()} />
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── WhatsApp ──────────────────────────────────────────── */}
        {subTab === "whatsapp" && (
          <motion.div key="whatsapp" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.2 }} className="space-y-5">
            <div className="rounded-xl p-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
                  <h3 className="font-fraunces font-semibold text-base" style={{ color: "#FDFBF7" }}>Mensagem para WhatsApp</h3>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={regenerateWhatsApp}>
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerar
                  </Button>
                  <Button size="sm" onClick={copyWhatsApp}>
                    {whatsappCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {whatsappCopied ? "Copiado!" : "Copiar"}
                  </Button>
                </div>
              </div>
              <p className="text-[10px] font-dm mb-2" style={{ color: "rgba(253,251,247,0.25)" }}>Edite livremente. Use &quot;Regenerar&quot; para recriar a partir do cronograma.</p>
              <textarea
                value={whatsappMsg || buildWhatsAppMessage()}
                onChange={(e) => setWhatsappMsg(e.target.value)}
                className="w-full text-xs font-dm p-4 rounded-lg resize-y outline-none"
                style={{ background: "rgba(0,0,0,0.3)", color: "rgba(253,251,247,0.7)", border: "1px solid rgba(255,255,255,0.06)", minHeight: "200px", maxHeight: "500px" }}
              />
            </div>

            {/* Conductor WhatsApp links — split by vinculados / não vinculados */}
            {(() => {
              const withPhone = condutores.filter((c) => c.telefone);
              const activeSlotIds = new Set(slots.filter((s) => s.ativo && s.atividade_nome).map((s) => s.id));
              const vinculadoIds = new Set(
                alocacoes.filter((a) => activeSlotIds.has(a.slot_id)).map((a) => a.condutor_id)
              );
              const vinculados = withPhone.filter((c) => vinculadoIds.has(c.id));
              const naoVinculados = withPhone.filter((c) => !vinculadoIds.has(c.id));

              return (
                <div className="rounded-xl p-5 space-y-5" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {/* Vinculados */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Send className="h-4 w-4" style={{ color: "#25D366" }} />
                      <h3 className="font-dm text-sm font-semibold" style={{ color: "rgba(253,251,247,0.7)" }}>Condutores vinculados</h3>
                      <span className="text-[10px] font-dm px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(253,251,247,0.35)" }}>{vinculados.length}</span>
                    </div>
                    <div className="space-y-2">
                      {vinculados.map((c) => {
                        const firstName = c.nome.split(" ")[0];
                        const condSlotIds = alocacoes.filter((a) => a.condutor_id === c.id).map((a) => a.slot_id);
                        const condSlots = slots.filter((s) => condSlotIds.includes(s.id) && s.ativo && s.atividade_nome);
                        const isAprimoramento = condSlots.some((s) =>
                          s.atividade_nome?.toLowerCase().includes("aprimoramento") &&
                          s.atividade_nome?.toLowerCase().includes("habilidades")
                        );
                        const msg = isAprimoramento
                          ? `Oi, ${firstName}! Tudo bem? Tudo certo para o grupo da semana que vem? Quando puder, me avisa qual será o tema abordado, por gentileza.`
                          : `Oi, ${firstName}! Tudo bem? Tudo certo pro grupo da semana que vem?`;
                        const phone = c.telefone!.replace(/\D/g, "");
                        const waLink = `https://wa.me/55${phone}?text=${encodeURIComponent(msg)}`;

                        return (
                          <a key={c.id} href={waLink} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.03]"
                            style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(37,211,102,0.12)" }}>
                              <MessageCircle className="h-4 w-4" style={{ color: "#25D366" }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-dm font-medium truncate" style={{ color: "rgba(253,251,247,0.8)" }}>{c.nome}</p>
                              <p className="text-[10px] font-dm truncate" style={{ color: "rgba(253,251,247,0.25)" }}>{msg}</p>
                            </div>
                            <span className="text-[10px] font-dm font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(37,211,102,0.1)", color: "#25D366" }}>Enviar</span>
                          </a>
                        );
                      })}
                      {vinculados.length === 0 && (
                        <p className="text-xs font-dm text-center py-4" style={{ color: "rgba(253,251,247,0.3)" }}>Nenhum condutor vinculado a atividades.</p>
                      )}
                    </div>
                  </div>

                  {/* Separator */}
                  {naoVinculados.length > 0 && (
                    <div className="h-[1px]" style={{ background: "rgba(255,255,255,0.06)" }} />
                  )}

                  {/* Não vinculados */}
                  {naoVinculados.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageCircle className="h-4 w-4" style={{ color: "rgba(253,251,247,0.3)" }} />
                        <h3 className="font-dm text-sm font-semibold" style={{ color: "rgba(253,251,247,0.4)" }}>Sem vínculo no calendário</h3>
                        <span className="text-[10px] font-dm px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(253,251,247,0.25)" }}>{naoVinculados.length}</span>
                      </div>
                      <div className="space-y-2">
                        {naoVinculados.map((c) => {
                          const phone = c.telefone!.replace(/\D/g, "");
                          const waLink = `https://wa.me/55${phone}`;
                          return (
                            <a key={c.id} href={waLink} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all hover:bg-white/[0.03]"
                              style={{ border: "1px solid rgba(255,255,255,0.04)" }}>
                              <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)" }}>
                                <MessageCircle className="h-4 w-4" style={{ color: "rgba(253,251,247,0.3)" }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-dm font-medium truncate" style={{ color: "rgba(253,251,247,0.5)" }}>{c.nome}</p>
                                <p className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.2)" }}>{c.telefone}</p>
                              </div>
                              <span className="text-[10px] font-dm font-bold px-2 py-0.5 rounded flex-shrink-0" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(253,251,247,0.3)" }}>WhatsApp</span>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </motion.div>
        )}

        {subTab === "eventos" && (
          <motion.div
            key="eventos"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {/* Create form */}
            <div
              className="p-5 rounded-xl space-y-4"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <h3 className="font-fraunces font-semibold text-base" style={{ color: "#FDFBF7" }}>
                Novo Evento
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Título"
                  value={eventoForm.titulo}
                  onChange={(e) => setEventoForm((f) => ({ ...f, titulo: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm font-dm col-span-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#FDFBF7",
                  }}
                />
                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={eventoForm.descricao}
                  onChange={(e) => setEventoForm((f) => ({ ...f, descricao: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm font-dm col-span-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#FDFBF7",
                  }}
                />
                <input
                  type="url"
                  placeholder="Link do evento (YouTube, Meet, etc.)"
                  value={eventoForm.link}
                  onChange={(e) => setEventoForm((f) => ({ ...f, link: e.target.value }))}
                  className="px-3 py-2 rounded-lg text-sm font-dm col-span-full"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    color: "#FDFBF7",
                  }}
                />
                <div className="space-y-1">
                  <label className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>Início</label>
                  <input
                    type="datetime-local"
                    value={eventoForm.data_inicio}
                    onChange={(e) => setEventoForm((f) => ({ ...f, data_inicio: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm font-dm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#FDFBF7",
                      colorScheme: "dark",
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>Fim</label>
                  <input
                    type="datetime-local"
                    value={eventoForm.data_fim}
                    onChange={(e) => setEventoForm((f) => ({ ...f, data_fim: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg text-sm font-dm"
                    style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      color: "#FDFBF7",
                      colorScheme: "dark",
                    }}
                  />
                </div>
              </div>
              <Button size="sm" onClick={handleAddEvento} loading={addingEvento}>
                <Plus className="h-4 w-4" />
                Criar Evento
              </Button>
            </div>

            {/* Events list */}
            <div className="space-y-2">
              {eventos.map((evento) => (
                <motion.div
                  key={evento.id}
                  layout
                  className="flex items-center justify-between px-4 py-3 rounded-xl"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    opacity: evento.ativo ? 1 : 0.5,
                  }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 flex-shrink-0" style={{ color: "#C84B31" }} />
                      <span className="text-sm font-dm font-semibold truncate" style={{ color: "#FDFBF7" }}>
                        {evento.titulo}
                      </span>
                    </div>
                    {evento.descricao && (
                      <p className="text-xs font-dm mt-0.5 ml-6 truncate" style={{ color: "rgba(253,251,247,0.4)" }}>
                        {evento.descricao}
                      </p>
                    )}
                    <div className="flex gap-3 ml-6 mt-1">
                      <span className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>
                        Início: {new Date(evento.data_inicio).toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[10px] font-dm" style={{ color: "rgba(253,251,247,0.3)" }}>
                        Fim: {new Date(evento.data_fim).toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Toggle ativo */}
                    <button
                      onClick={() => toggleEvento(evento.id, !evento.ativo)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors"
                      style={{
                        background: evento.ativo ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.05)",
                        color: evento.ativo ? "#22c55e" : "rgba(253,251,247,0.4)",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {evento.ativo ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      {evento.ativo ? "Ativo" : "Inativo"}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => setDeleteEventoTarget(evento)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" style={{ color: "rgba(239,68,68,0.6)" }} />
                    </button>
                  </div>
                </motion.div>
              ))}

              {eventos.length === 0 && (
                <div className="text-center py-16">
                  <CalendarDays className="h-8 w-8 mx-auto mb-3" style={{ color: "rgba(253,251,247,0.15)" }} />
                  <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.4)" }}>
                    Nenhum evento cadastrado.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset modal */}
      <Modal open={resetModalOpen} onClose={() => setResetModalOpen(false)} title="Nova Semana">
        <div className="space-y-4">
          <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.7)" }}>
            Tem certeza que deseja iniciar uma nova semana? Todos os status dos slots ativos serão
            resetados para <strong style={{ color: "#9ca3af" }}>&quot;Pendente&quot;</strong>.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setResetModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={handleNovaSemana}>
              <RefreshCw className="h-4 w-4" />
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete evento modal */}
      <Modal
        open={!!deleteEventoTarget}
        onClose={() => setDeleteEventoTarget(null)}
        title="Remover Evento"
      >
        <div className="space-y-4">
          <p className="text-sm font-dm" style={{ color: "rgba(253,251,247,0.7)" }}>
            Deseja remover o evento{" "}
            <strong style={{ color: "#FDFBF7" }}>&quot;{deleteEventoTarget?.titulo}&quot;</strong>?
            Esta ação não pode ser desfeita.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDeleteEventoTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => deleteEventoTarget && deleteEvento(deleteEventoTarget.id)}
            >
              <Trash2 className="h-4 w-4" />
              Remover
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}