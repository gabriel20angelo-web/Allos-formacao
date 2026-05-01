// Página /admin/calendario — controle de formação síncrona da Allos.
// Sub-abas (subTab):
//   - "calendario":  grid semanal Seg→Sex × Horários, com status por slot
//   - "horarios":    gerenciar lista de horários ativos + reordenar
//   - "cronograma":  Canvas 1080x1080 da arte do quadro semanal (download PNG)
//   - "whatsapp":    mensagens salvas (WhatsAppTemplates) + cronograma+condutores
//   - "eventos":     CRUD de eventos avulsos (componente EventosTab)
//
// fetchAll() carrega os 7 datasets em paralelo (horários, slots, alocações,
// condutores, atividades, cronograma config, presenças meet). Eventos virou
// fetch próprio do EventosTab. Os assets pesados do canvas (3 fontes
// Cocogoose ~600KB + 3 PNGs ~120KB) são lazy-load só quando subTab vira
// "cronograma" pela primeira vez.

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import Skeleton from "@/components/ui/Skeleton";
import WhatsAppTemplates from "@/components/admin/WhatsAppTemplates";
import EventosTab from "@/components/admin/calendario/EventosTab";
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
  ArrowUp,
  ArrowDown,
  UserCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import type {
  FormacaoHorario,
  FormacaoSlot,
  FormacaoAlocacao,
  CertificadoCondutor,
  CertificadoAtividade,
  FormacaoCronograma,
} from "@/types";

// ─── Constants ──────────────────────────────────────────────────────────────
type SubTab = "calendario" | "horarios" | "cronograma" | "whatsapp" | "eventos";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

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
  const [subTab, setSubTab] = useState<SubTab>("calendario");
  const [loading, setLoading] = useState(true);

  // Data
  const [horarios, setHorarios] = useState<FormacaoHorario[]>([]);
  const [slots, setSlots] = useState<FormacaoSlot[]>([]);
  const [alocacoes, setAlocacoes] = useState<FormacaoAlocacao[]>([]);
  const [condutores, setCondutores] = useState<CertificadoCondutor[]>([]);
  const [atividades, setAtividades] = useState<CertificadoAtividade[]>([]);
  const [config, setConfig] = useState<FormacaoCronograma | null>(null);

  // UI state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [meetEditSlotId, setMeetEditSlotId] = useState<string | null>(null);
  const [meetLinkDraft, setMeetLinkDraft] = useState("");
  const [addCondutorSlotId, setAddCondutorSlotId] = useState<string | null>(null);

  // Horarios tab
  const [newHora, setNewHora] = useState("08:00");
  const [addingHorario, setAddingHorario] = useState(false);

  // Quórum rápido por slot
  type LatestPresenca = { slot_id: string; total_participantes: number; data_reuniao: string };
  const [latestPresencas, setLatestPresencas] = useState<Record<string, LatestPresenca>>({});
  const [quorumDraftSlot, setQuorumDraftSlot] = useState<string | null>(null);
  const [quorumDraftValue, setQuorumDraftValue] = useState("");
  const [savingQuorum, setSavingQuorum] = useState(false);

  // Eventos tab

  // Cronograma canvas
  const cronogramaCanvasRef = useRef<HTMLCanvasElement>(null);
  const logoRef = useRef<HTMLImageElement | null>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const bgLightRef = useRef<HTMLImageElement | null>(null);
  const drawCronogramaRef = useRef<(() => void) | null>(null);

  // WhatsApp
  const [whatsappCopied, setWhatsappCopied] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState("");
  const [whatsappInitialized, setWhatsappInitialized] = useState(false);

  // ─── Fetch all data ───────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const supabase = createClient();
    // Janela de 60 dias atrás cobre férias/feriados sem trazer histórico
    // antigo demais. A query já volta ordenada DESC pra reduzir lógica
    // client-side.
    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const [hRes, sRes, aRes, cRes, atRes, cfgRes, pRes] = await Promise.all([
      supabase.from("formacao_horarios").select("*").eq("ativo", true).order("ordem"),
      supabase.from("formacao_slots").select("*, formacao_horarios(hora, ordem)"),
      supabase.from("formacao_alocacoes").select("*, certificado_condutores(id, nome, telefone)"),
      supabase.from("certificado_condutores").select("*").eq("ativo", true).order("nome"),
      supabase.from("certificado_atividades").select("*").eq("ativo", true).order("nome"),
      supabase.from("formacao_cronograma").select("*").limit(1).single(),
      supabase
        .from("formacao_meet_presencas")
        .select("slot_id, total_participantes, data_reuniao")
        .gte("data_reuniao", sixtyDaysAgo)
        .not("slot_id", "is", null)
        .order("data_reuniao", { ascending: false }),
    ]);
    if (hRes.data) setHorarios(hRes.data);
    if (sRes.data) setSlots(sRes.data);
    if (aRes.data) setAlocacoes(aRes.data);
    if (cRes.data) setCondutores(cRes.data);
    if (atRes.data) setAtividades(atRes.data);
    if (cfgRes.data) setConfig(cfgRes.data);
    if (pRes.data) {
      // Como vem ordenado DESC, a primeira ocorrência por slot_id é a mais recente.
      const latest: Record<string, LatestPresenca> = {};
      for (const p of pRes.data as LatestPresenca[]) {
        if (p.slot_id && !latest[p.slot_id]) latest[p.slot_id] = p;
      }
      setLatestPresencas(latest);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll().catch(() => setLoading(false));
  }, [fetchAll]);

  // Load assets for canvas (logo, backgrounds, fonts) — só quando a aba
  // cronograma é aberta. Antes carregava no mount, mesmo que o usuário só
  // precisasse das outras abas; agora as fontes Cocogoose (~600 KB) e as
  // 3 imagens (~120 KB) só baixam sob demanda.
  useEffect(() => {
    if (subTab !== "cronograma") return;
    // Cada onload dispara um redraw — drawCronograma faz early return se o
    // canvas ainda não montou (aba diferente), então é seguro chamar sempre.
    const triggerRedraw = () => {
      setTimeout(() => drawCronogramaRef.current?.(), 30);
    };

    if (!logoRef.current) {
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.src = "/Logo_Dark_Alternativo.png";
      img.onload = () => { logoRef.current = img; triggerRedraw(); };
    }

    if (!bgRef.current) {
      const bg = new window.Image();
      bg.crossOrigin = "anonymous";
      bg.src = "/cronograma_bg_color.png";
      bg.onload = () => { bgRef.current = bg; triggerRedraw(); };
    }

    if (!bgLightRef.current) {
      const bgL = new window.Image();
      bgL.crossOrigin = "anonymous";
      bgL.src = "/cronograma_bg_light.png";
      bgL.onload = () => { bgLightRef.current = bgL; triggerRedraw(); };
    }

    // Load Cocogoose family for canvas
    const cocoBold = new FontFace("CocogoosePro", "url(/fonts/CocogoosePro.ttf)");
    const cocoSemi = new FontFace("CocogooseProSemilight", "url(/fonts/CocogooseProSemilight.ttf)");
    const cocoLight = new FontFace("CocogooseProLight", "url(/fonts/CocogooseProLight.ttf)");
    Promise.all([cocoBold.load(), cocoSemi.load(), cocoLight.load()]).then((fonts) => {
      fonts.forEach((f) => document.fonts.add(f));
      triggerRedraw();
    }).catch(() => {});
  }, [subTab]);

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

    // ── Reproduz o design Cronograma.html: stage 1080x1080 quadrado ──
    // Frame branco (956x712) com header preto + 5 rows iguais (SEG-SEX),
    // coluna esquerda teal (#2E9E8F) e cell direita mármore claro. Logo
    // dark alternativo no topo, footer "Cronograma Geral" abaixo.

    const W = 1080;
    const H = 1080;
    canvas.width = W;
    canvas.height = H;

    const activeH = [...horarios].sort((a, b) => a.ordem - b.ordem);
    const activeSlots = slots.filter((s) => s.ativo && s.atividade_nome);

    type DayItem = { hora: string; atividade: string };
    const dayItemsByIdx: DayItem[][] = DIAS.map((_, diaIdx) => {
      const items: DayItem[] = [];
      activeH.forEach((h) => {
        const slot = activeSlots.find((s) => s.dia_semana === diaIdx && s.horario_id === h.id);
        if (slot && slot.atividade_nome) {
          items.push({
            hora: h.hora.replace(":00", "h").replace(":", "h"),
            atividade: slot.atividade_nome,
          });
        }
      });
      return items;
    });

    // ── 1. Background: texture image, cover-crop centralizado ──
    if (bgRef.current) {
      const bi = bgRef.current;
      const ir = bi.width / bi.height;
      const cr = W / H;
      let sx = 0, sy = 0, sw = bi.width, sh = bi.height;
      if (ir > cr) { sw = bi.height * cr; sx = (bi.width - sw) / 2; }
      else { sh = bi.width / cr; sy = (bi.height - sh) / 2; }
      ctx.drawImage(bi, sx, sy, sw, sh, 0, 0, W, H);
    } else {
      // Fallback teal sólido com gradiente
      const g = ctx.createRadialGradient(W * 0.35, H * 0.3, 0, W * 0.5, H * 0.5, W * 0.8);
      g.addColorStop(0, "#35AFA0");
      g.addColorStop(0.5, "#2A9486");
      g.addColorStop(1, "#1C6B62");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // Vinheta sutil pra dar profundidade
    const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.55, W / 2, H / 2, W * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── 2. Logo Allos Dark Alternativo (centralizado, top 54px, w 230px) ──
    if (logoRef.current) {
      const img = logoRef.current;
      const targetW = 230;
      const r = img.width / img.height;
      const lw = targetW;
      const lh = lw / r;
      // Drop shadow sutil
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.18)";
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.drawImage(img, (W - lw) / 2, 54, lw, lh);
      ctx.restore();
    }

    // ── 3. Frame (956x712 branco com borda preta 5px) ──
    const FRAME_X = 62;
    const FRAME_Y = 228;
    const FRAME_W = W - 62 * 2; // 956
    const FRAME_H = H - 228 - 140; // 712
    const BORDER = 5;

    // Sombra do frame
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.25)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 24;
    ctx.fillStyle = "#000";
    ctx.fillRect(FRAME_X, FRAME_Y, FRAME_W, FRAME_H);
    ctx.restore();

    ctx.fillStyle = "#fff";
    ctx.fillRect(FRAME_X + BORDER, FRAME_Y + BORDER, FRAME_W - BORDER * 2, FRAME_H - BORDER * 2);

    // ── 4. Header preto "QUADRO DE HORÁRIOS" (78px) ──
    const HEADER_H = 78;
    const headerX = FRAME_X + BORDER;
    const headerY = FRAME_Y + BORDER;
    const headerW = FRAME_W - BORDER * 2;

    // Fundo preto com gradiente sutil
    const headerGrad = ctx.createLinearGradient(0, headerY, 0, headerY + HEADER_H);
    headerGrad.addColorStop(0, "#1a1a1a");
    headerGrad.addColorStop(0.5, "#050505");
    headerGrad.addColorStop(1, "#111");
    ctx.fillStyle = headerGrad;
    ctx.fillRect(headerX, headerY, headerW, HEADER_H);
    // Highlight sutil top + sombra interior bottom
    const headerSheen = ctx.createLinearGradient(0, headerY, 0, headerY + HEADER_H);
    headerSheen.addColorStop(0, "rgba(255,255,255,0.05)");
    headerSheen.addColorStop(1, "rgba(0,0,0,0.25)");
    ctx.fillStyle = headerSheen;
    ctx.fillRect(headerX, headerY, headerW, HEADER_H);

    // Borda inferior preta
    ctx.fillStyle = "#000";
    ctx.fillRect(headerX, headerY + HEADER_H - BORDER, headerW, BORDER);

    // Título
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = 'bold 26px CocogoosePro, "Helvetica Neue", sans-serif';
    ctx.fillStyle = "#fff";
    // letter-spacing simulado via espaçamento (canvas 2D não suporta direto)
    ctx.fillText("QUADRO DE HORÁRIOS", W / 2, headerY + HEADER_H / 2 + 1);

    // ── 5. 5 rows iguais (SEGUNDA-SEXTA) ──
    const ROWS_TOP = headerY + HEADER_H;
    const ROWS_H = FRAME_H - BORDER * 2 - HEADER_H;
    const ROW_H = ROWS_H / 5;
    const DAY_COL_W = 215;
    const cellInnerW = headerW - DAY_COL_W - BORDER;
    const cellInnerX = headerX + DAY_COL_W + BORDER;

    // ── Pré-calcula layout GLOBAL dos itens pra alinhar todas as cells na
    // mesma coluna X (hora + bullet + atividade). Sem isso cada cell
    // centraliza o próprio bloco e as horas dançam entre dias. ──
    const globalLayout = (() => {
      const allItems = dayItemsByIdx.flat();
      const maxItemsPerDay = Math.max(1, ...dayItemsByIdx.map((arr) => arr.length));
      const maxTextH = ROW_H - 28;
      const maxBlockW = cellInnerW - 56;

      const measure = (fs: number) => {
        ctx.font = `500 ${fs}px CocogooseProSemilight, CocogoosePro, "Helvetica Neue", sans-serif`;
        let mh = 0, ma = 0;
        for (const it of allItems) {
          const hw = ctx.measureText(it.hora).width;
          const aw = ctx.measureText(it.atividade).width;
          if (hw > mh) mh = hw;
          if (aw > ma) ma = aw;
        }
        const bw = ctx.measureText("  •  ").width;
        return { maxHora: mh, maxAtiv: ma, bulletW: bw, totalW: mh + bw + ma };
      };

      let fontSize = 22;
      let lineH = fontSize * 1.3;
      let block = measure(fontSize);
      while (
        (maxItemsPerDay * lineH > maxTextH || block.totalW > maxBlockW) &&
        fontSize > 11
      ) {
        fontSize -= 1;
        lineH = fontSize * 1.3;
        block = measure(fontSize);
      }

      const blockX = cellInnerX + (cellInnerW - block.totalW) / 2;
      return {
        fontSize,
        lineH,
        horaEndX: blockX + block.maxHora,
        bulletCenterX: blockX + block.maxHora + block.bulletW / 2,
        ativStartX: blockX + block.maxHora + block.bulletW,
      };
    })();

    DIAS.forEach((dia, i) => {
      const ry = ROWS_TOP + i * ROW_H;
      const rh = ROW_H;
      const isLast = i === DIAS.length - 1;

      // ─── Day cell (esquerda, teal sólido com mármore overlay) ───
      ctx.fillStyle = "#2E9E8F";
      ctx.fillRect(headerX, ry, DAY_COL_W, rh);

      // Highlight diagonal sutil
      const dayHi = ctx.createRadialGradient(
        headerX + DAY_COL_W * 0.3, ry + rh * 0.2, 0,
        headerX + DAY_COL_W * 0.3, ry + rh * 0.2, DAY_COL_W * 1.2,
      );
      dayHi.addColorStop(0, "rgba(255,255,255,0.10)");
      dayHi.addColorStop(0.6, "rgba(255,255,255,0)");
      ctx.fillStyle = dayHi;
      ctx.fillRect(headerX, ry, DAY_COL_W, rh);
      const dayShadow = ctx.createRadialGradient(
        headerX + DAY_COL_W * 0.8, ry + rh * 0.9, 0,
        headerX + DAY_COL_W * 0.8, ry + rh * 0.9, DAY_COL_W * 1.2,
      );
      dayShadow.addColorStop(0, "rgba(0,0,0,0.18)");
      dayShadow.addColorStop(0.6, "rgba(0,0,0,0)");
      ctx.fillStyle = dayShadow;
      ctx.fillRect(headerX, ry, DAY_COL_W, rh);

      // Sobreposição mármore (bg color com multiply parcial)
      if (bgRef.current) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.globalCompositeOperation = "multiply";
        const bi = bgRef.current;
        const targetAR = DAY_COL_W / rh;
        const srcAR = bi.width / bi.height;
        let sx = 0, sy = 0, sw = bi.width, sh = bi.height;
        if (srcAR > targetAR) { sw = bi.height * targetAR; sx = (bi.width - sw) / 2; }
        else { sh = bi.width / targetAR; sy = (bi.height - sh) / 2; }
        ctx.drawImage(bi, sx, sy, sw, sh, headerX, ry, DAY_COL_W, rh);
        ctx.restore();
      }

      // Borda direita preta (separa day/cell)
      ctx.fillStyle = "#000";
      ctx.fillRect(headerX + DAY_COL_W, ry, BORDER, rh);

      // Texto do dia
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = 'bold 26px CocogoosePro, "Helvetica Neue", sans-serif';
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.3)";
      ctx.shadowBlur = 4;
      ctx.fillText(dia.toUpperCase(), headerX + DAY_COL_W / 2, ry + rh / 2 + 1);
      ctx.shadowBlur = 0;
      ctx.shadowColor = "transparent";

      // ─── Cell direita (mármore claro) ───
      const cellX = headerX + DAY_COL_W + BORDER;
      const cellW = headerW - DAY_COL_W - BORDER;
      ctx.fillStyle = "#fff";
      ctx.fillRect(cellX, ry, cellW, rh);

      if (bgLightRef.current) {
        const bi = bgLightRef.current;
        const targetAR = cellW / rh;
        const srcAR = bi.width / bi.height;
        let sx = 0, sy = 0, sw = bi.width, sh = bi.height;
        if (srcAR > targetAR) { sw = bi.height * targetAR; sx = (bi.width - sw) / 2; }
        else { sh = bi.width / targetAR; sy = (bi.height - sh) / 2; }
        ctx.drawImage(bi, sx, sy, sw, sh, cellX, ry, cellW, rh);
      }

      // Inner highlight gradient (top branco→transparente, bottom subtle dark)
      const cellGloss = ctx.createLinearGradient(0, ry, 0, ry + rh);
      cellGloss.addColorStop(0, "rgba(255,255,255,0.35)");
      cellGloss.addColorStop(0.4, "rgba(255,255,255,0)");
      cellGloss.addColorStop(0.6, "rgba(255,255,255,0)");
      cellGloss.addColorStop(1, "rgba(0,0,0,0.04)");
      ctx.fillStyle = cellGloss;
      ctx.fillRect(cellX, ry, cellW, rh);

      // Conteúdo dinâmico: usa globalLayout pra alinhar TODAS as cells na
      // mesma coluna X (hora + bullet + atividade), independente do dia.
      const items = dayItemsByIdx[i];
      if (items.length > 0) {
        const { fontSize, lineH, horaEndX, bulletCenterX, ativStartX } = globalLayout;
        const totalH = items.length * lineH;
        const startY = ry + (rh - totalH) / 2 + lineH / 2;

        ctx.font = `500 ${fontSize}px CocogooseProSemilight, CocogoosePro, "Helvetica Neue", sans-serif`;
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#1a1a1a";

        items.forEach((it, idx) => {
          const y = startY + idx * lineH;
          ctx.textAlign = "right";
          ctx.fillText(it.hora, horaEndX, y);
          ctx.textAlign = "center";
          ctx.fillText("•", bulletCenterX, y);
          ctx.textAlign = "left";
          ctx.fillText(it.atividade, ativStartX, y);
        });
      }

      // Borda inferior preta entre rows
      if (!isLast) {
        ctx.fillStyle = "#000";
        ctx.fillRect(headerX, ry + rh - BORDER / 2, headerW, BORDER);
      }
    });

    // ── 6. Footer "Cronograma Geral" (bottom 62px, branco) ──
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = '500 30px CocogooseProSemilight, CocogoosePro, "Helvetica Neue", sans-serif';
    ctx.fillStyle = "#fff";
    ctx.shadowColor = "rgba(0,0,0,0.18)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillText("Cronograma Geral", W / 2, H - 62 - 15);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.shadowColor = "transparent";
  }, [horarios, slots]);

  // Mantém ref atualizada pra triggerRedraw chamar a versão mais recente
  // sem dependência circular no useEffect dos assets.
  drawCronogramaRef.current = drawCronograma;

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
    lines.push("👉 allos.org.br/terapiasocial");
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

    // Log status change (fire-and-forget) via Supabase direto.
    if (fields.status && currentSlot && fields.status !== currentSlot.status) {
      const condutorIds = alocacoes
        .filter((a) => a.slot_id === id)
        .map((a) => a.condutor_id);
      createClient()
        .from("formacao_slot_logs")
        .insert({
          slot_id: id,
          status_anterior: currentSlot.status,
          status_novo: fields.status,
          atividade_nome: data.atividade_nome,
          condutor_ids: condutorIds,
        })
        .then(({ error }) => {
          if (error) console.warn("[calendario] log_status_change:", error);
        });
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

    // 2. Save snapshot via Supabase direto (RLS admin já cobre).
    const { data: snapshot, error: snapErr } = await supabase
      .from("formacao_snapshots")
      .insert({ semana_inicio: fmt(monday), semana_fim: fmt(friday) })
      .select()
      .single();
    if (snapErr || !snapshot) {
      console.error("[calendario] snapshot:", snapErr);
      toast.error("Erro ao salvar snapshot da semana. Reset cancelado.");
      return;
    }
    if (snapshotSlots.length > 0) {
      const rows = snapshotSlots.map((s) => ({
        snapshot_id: snapshot.id,
        slot_id: s.slot_id,
        dia_semana: s.dia_semana,
        horario_hora: s.horario_hora,
        atividade_nome: s.atividade_nome,
        status: s.status,
        meet_link: s.meet_link,
        condutores: s.condutores,
      }));
      const { error: slotsErr } = await supabase
        .from("formacao_snapshot_slots")
        .insert(rows);
      if (slotsErr) {
        console.error("[calendario] snapshot_slots:", slotsErr);
        toast.error("Erro ao salvar slots do snapshot. Reset cancelado.");
        return;
      }
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

  // ─── Quórum rápido ─────────────────────────────────────────────────────────
  function whatsappUrl(telefone: string | null): string | null {
    if (!telefone) return null;
    const digits = telefone.replace(/\D/g, "");
    if (digits.length === 0) return null;
    // Se já vem com código do país (12-13 dígitos), usa direto. Senão prefixa 55.
    const withCountry = digits.length >= 12 ? digits : `55${digits}`;
    return `https://wa.me/${withCountry}`;
  }

  async function registrarQuorum(slot: FormacaoSlot, horario: { hora: string }) {
    const total = parseInt(quorumDraftValue);
    if (!total || total < 0) {
      toast.error("Informe um número válido.");
      return;
    }
    setSavingQuorum(true);
    try {
      const supabase = createClient();
      const slotAlocs = getSlotAlocacoes(slot.id);
      const condutorNome = slotAlocs[0]?.certificado_condutores?.nome || "—";
      const today = new Date();
      const [hh, mm] = horario.hora.split(":").map(Number);
      const horaInicio = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hh, mm);
      const duracao = config?.duracao_minutos ?? 90;
      const horaFim = new Date(horaInicio.getTime() + duracao * 60_000);

      const { error } = await supabase.from("formacao_meet_presencas").insert({
        slot_id: slot.id,
        meet_link: slot.meet_link || "manual",
        condutor_nome: condutorNome,
        atividade_nome: slot.atividade_nome,
        data_reuniao: horaInicio.toISOString().split("T")[0],
        dia_semana: slot.dia_semana,
        hora_inicio: horaInicio.toISOString(),
        hora_fim: horaFim.toISOString(),
        duracao_minutos: duracao,
        participantes: [],
        total_participantes: total,
        media_participantes: total,
        pico_participantes: total,
      });
      if (error) throw error;
      setLatestPresencas((prev) => ({
        ...prev,
        [slot.id]: {
          slot_id: slot.id,
          total_participantes: total,
          data_reuniao: horaInicio.toISOString().split("T")[0],
        },
      }));
      toast.success(`Quórum registrado: ${total} participantes`);
      setQuorumDraftSlot(null);
      setQuorumDraftValue("");
    } catch (err) {
      console.error("[registrarQuorum]", err);
      toast.error("Erro ao registrar quórum.");
    } finally {
      setSavingQuorum(false);
    }
  }

  async function moveHorario(id: string, direction: "up" | "down") {
    // Reordena pelo campo `ordem`. Trabalha sobre a lista atual ordenada pra
    // achar o vizinho e troca os valores de ordem entre os dois — duas linhas
    // updates em paralelo.
    const sorted = [...horarios].sort((a, b) => a.ordem - b.ordem);
    const idx = sorted.findIndex((h) => h.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];

    // Otimista: atualiza estado local primeiro
    const optimistic = horarios.map((h) => {
      if (h.id === a.id) return { ...h, ordem: b.ordem };
      if (h.id === b.id) return { ...h, ordem: a.ordem };
      return h;
    });
    setHorarios(optimistic);

    const supabase = createClient();
    // Estratégia em 2 passos pra contornar UNIQUE constraint caso exista:
    // primeiro joga `a` num valor temporário (negativo, fora do range), depois
    // troca os dois.
    const tempOrdem = -(Math.max(...horarios.map((h) => h.ordem)) + 1);
    const r1 = await supabase.from("formacao_horarios").update({ ordem: tempOrdem }).eq("id", a.id);
    if (r1.error) { toast.error("Erro ao reordenar."); setHorarios(horarios); return; }
    const r2 = await supabase.from("formacao_horarios").update({ ordem: a.ordem }).eq("id", b.id);
    if (r2.error) { toast.error("Erro ao reordenar."); setHorarios(horarios); return; }
    const r3 = await supabase.from("formacao_horarios").update({ ordem: b.ordem }).eq("id", a.id);
    if (r3.error) { toast.error("Erro ao reordenar."); setHorarios(horarios); return; }
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

                          {/* Quórum: chip do último registrado + form pra registrar */}
                          {(() => {
                            const lastPres = latestPresencas[slot.id];
                            const isOpen = quorumDraftSlot === slot.id;
                            return (
                              <div className="flex flex-col gap-1">
                                {lastPres && !isOpen && (
                                  <div
                                    className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-dm font-semibold w-fit"
                                    style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.18)" }}
                                    title={`Último registro em ${new Date(lastPres.data_reuniao + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}`}
                                  >
                                    <Users className="h-2.5 w-2.5" />
                                    {lastPres.total_participantes}
                                  </div>
                                )}
                                {isOpen ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      autoFocus
                                      value={quorumDraftValue}
                                      onChange={(e) => setQuorumDraftValue(e.target.value)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") registrarQuorum(slot, horario);
                                        if (e.key === "Escape") { setQuorumDraftSlot(null); setQuorumDraftValue(""); }
                                      }}
                                      placeholder="Total"
                                      className="flex-1 min-w-0 px-1.5 py-1 rounded text-[10px] font-dm"
                                      style={{
                                        background: "rgba(34,197,94,0.06)",
                                        border: "1px solid rgba(34,197,94,0.25)",
                                        color: "#FDFBF7",
                                      }}
                                    />
                                    <button
                                      onClick={() => registrarQuorum(slot, horario)}
                                      disabled={savingQuorum}
                                      className="p-1 rounded hover:bg-white/5 disabled:opacity-40"
                                    >
                                      <Check className="h-3 w-3" style={{ color: "#22c55e" }} />
                                    </button>
                                    <button
                                      onClick={() => { setQuorumDraftSlot(null); setQuorumDraftValue(""); }}
                                      className="p-1 rounded hover:bg-white/5"
                                    >
                                      <X className="h-3 w-3" style={{ color: "rgba(253,251,247,0.3)" }} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setQuorumDraftSlot(slot.id);
                                      setQuorumDraftValue("");
                                    }}
                                    className="flex items-center gap-1 text-[10px] font-dm transition-colors hover:opacity-80 w-fit"
                                    style={{ color: "rgba(34,197,94,0.7)" }}
                                  >
                                    <UserCheck className="h-3 w-3" />
                                    {lastPres ? "Novo registro" : "Registrar quórum"}
                                  </button>
                                )}
                              </div>
                            );
                          })()}

                          {/* Condutores */}
                          <div className="space-y-1 mt-auto">
                            {slotAlocacoes.map((aloc) => {
                              const waUrl = whatsappUrl(aloc.certificado_condutores?.telefone || null);
                              return (
                                <div key={aloc.id} className="flex items-center justify-between gap-1">
                                  <span className="text-[10px] font-dm truncate flex-1" style={{ color: "rgba(253,251,247,0.7)" }}>
                                    {aloc.certificado_condutores?.nome || "—"}
                                  </span>
                                  {waUrl && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-0.5 rounded hover:bg-green-500/10 flex-shrink-0"
                                      title={`WhatsApp ${aloc.certificado_condutores?.telefone}`}
                                    >
                                      <MessageCircle className="h-2.5 w-2.5" style={{ color: "#22c55e" }} />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => removeAlocacao(aloc.id)}
                                    className="p-0.5 rounded hover:bg-red-500/10 flex-shrink-0"
                                  >
                                    <X className="h-2.5 w-2.5" style={{ color: "rgba(239,68,68,0.5)" }} />
                                  </button>
                                </div>
                              );
                            })}

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
              {(() => {
                const sortedHorarios = [...horarios].sort((a, b) => a.ordem - b.ordem);
                return sortedHorarios.map((h, idx) => (
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
                    </div>
                    <div className="flex items-center gap-1.5">
                      {/* Reorder up */}
                      <button
                        onClick={() => moveHorario(h.id, "up")}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-25 disabled:cursor-not-allowed enabled:hover:bg-white/5"
                        title="Mover pra cima"
                      >
                        <ArrowUp className="h-4 w-4" style={{ color: "rgba(253,251,247,0.5)" }} />
                      </button>
                      {/* Reorder down */}
                      <button
                        onClick={() => moveHorario(h.id, "down")}
                        disabled={idx === sortedHorarios.length - 1}
                        className="p-1.5 rounded-lg transition-colors disabled:opacity-25 disabled:cursor-not-allowed enabled:hover:bg-white/5"
                        title="Mover pra baixo"
                      >
                        <ArrowDown className="h-4 w-4" style={{ color: "rgba(253,251,247,0.5)" }} />
                      </button>
                      {/* Toggle ativo */}
                      <button
                        onClick={() => toggleHorario(h.id, !h.ativo)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-dm transition-colors ml-1"
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
                ));
              })()}

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
            <WhatsAppTemplates />

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

        {subTab === "eventos" && <EventosTab />}
      </AnimatePresence>

      <ConfirmDialog
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={handleNovaSemana}
        title="Nova Semana"
        description={
          <p className="font-dm text-cream-70">
            Tem certeza que deseja iniciar uma nova semana? Todos os status dos slots
            ativos serão resetados para{" "}
            <strong className="text-[#9ca3af]">&quot;Pendente&quot;</strong>.
          </p>
        }
      />

    </div>
  );
}