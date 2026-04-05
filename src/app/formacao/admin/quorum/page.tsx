"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Users, TrendingUp, Clock, Calendar, ChevronLeft, ChevronRight,
  UserCheck, BarChart3, ArrowUp, ArrowDown, Minus, Trash2, Plus, X,
} from "lucide-react";

interface MeetPresenca {
  id: string;
  slot_id: string | null;
  meet_link: string;
  condutor_nome: string;
  atividade_nome: string | null;
  data_reuniao: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
  participantes: { nome: string; primeira_entrada: string; ultima_saida: string; snapshots_presente: number }[];
  total_participantes: number;
  media_participantes: number;
  pico_participantes: number;
  created_at: string;
}

interface Atividade { id: string; nome: string; carga_horaria: number; }

type Periodo = "semana" | "mes" | "trimestre" | "semestre" | "ano";
const PERIODO_LABELS: Record<Periodo, string> = {
  semana: "Semana", mes: "Mes", trimestre: "Trimestre", semestre: "Semestre", ano: "Ano",
};
const DIAS_SEMANA = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];

function getRange(periodo: Periodo, offset: number): { inicio: string; fim: string; label: string } {
  const now = new Date();
  let start: Date, end: Date, label: string;

  if (periodo === "semana") {
    const d = new Date(now);
    d.setDate(d.getDate() + offset * 7);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start = new Date(d); start.setDate(d.getDate() - diff);
    end = new Date(start); end.setDate(start.getDate() + 6);
    label = `${fmt(start)} - ${fmt(end)}`;
  } else if (periodo === "mes") {
    start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
    label = start.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  } else if (periodo === "trimestre") {
    const q = Math.floor(now.getMonth() / 3) + offset;
    const year = now.getFullYear() + Math.floor(q / 4);
    const qMod = ((q % 4) + 4) % 4;
    start = new Date(year, qMod * 3, 1);
    end = new Date(year, qMod * 3 + 3, 0);
    label = `${qMod + 1}o tri ${year}`;
  } else if (periodo === "semestre") {
    const s = Math.floor(now.getMonth() / 6) + offset;
    const year = now.getFullYear() + Math.floor(s / 2);
    const sMod = ((s % 2) + 2) % 2;
    start = new Date(year, sMod * 6, 1);
    end = new Date(year, sMod * 6 + 6, 0);
    label = `${sMod + 1}o sem ${year}`;
  } else {
    const year = now.getFullYear() + offset;
    start = new Date(year, 0, 1);
    end = new Date(year, 11, 31);
    label = String(year);
  }

  return { inicio: start.toISOString().split("T")[0], fim: end.toISOString().split("T")[0], label };
}

function fmt(d: Date) {
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShort(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export default function QuorumPage() {
  const [presencas, setPresencas] = useState<MeetPresenca[]>([]);
  const [atividades, setAtividades] = useState<Atividade[]>([]);
  const [condutores, setCondutores] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [offset, setOffset] = useState(0);
  const [selectedPresenca, setSelectedPresenca] = useState<MeetPresenca | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Manual form
  const [manualAtividade, setManualAtividade] = useState("");
  const [manualCondutor, setManualCondutor] = useState("");
  const [manualTotal, setManualTotal] = useState("");
  const [manualData, setManualData] = useState(new Date().toISOString().split("T")[0]);
  const [manualHora, setManualHora] = useState("14:00");
  const [manualDuracao, setManualDuracao] = useState("90");
  const [submitting, setSubmitting] = useState(false);

  const range = useMemo(() => getRange(periodo, offset), [periodo, offset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sb = createClient();
      const { data } = await sb
        .from("formacao_meet_presencas")
        .select("*")
        .gte("data_reuniao", range.inicio)
        .lte("data_reuniao", range.fim)
        .order("data_reuniao", { ascending: true })
        .order("hora_inicio", { ascending: true });
      setPresencas(data || []);
    } catch (err) {
      console.error("Erro:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from("certificado_atividades").select("id, nome, carga_horaria").eq("ativo", true).order("nome"),
      sb.from("certificado_condutores").select("id, nome").eq("ativo", true).order("nome"),
    ]).then(([atRes, coRes]) => {
      setAtividades(atRes.data || []);
      setCondutores(coRes.data || []);
    });
  }, []);

  // Reset offset when changing period
  useEffect(() => { setOffset(0); }, [periodo]);

  async function deletePresenca(id: string) {
    setDeleting(id);
    try {
      const sb = createClient();
      const { error } = await sb.from("formacao_meet_presencas").delete().eq("id", id);
      if (error) throw error;
      setPresencas((prev) => prev.filter((p) => p.id !== id));
      setSelectedPresenca(null);
      toast.success("Registro apagado.");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Erro ao apagar registro.");
    } finally {
      setDeleting(null);
    }
  }

  async function submitManual() {
    if (!manualAtividade || !manualCondutor || !manualTotal) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setSubmitting(true);
    try {
      const horaInicio = new Date(`${manualData}T${manualHora}:00`);
      const horaFim = new Date(horaInicio.getTime() + parseInt(manualDuracao) * 60000);
      const total = parseInt(manualTotal);
      const res = await fetch("/api/meet-presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meet_link: "manual", condutor_nome: manualCondutor, atividade_nome: manualAtividade,
          slot_id: null, hora_inicio: horaInicio.toISOString(), hora_fim: horaFim.toISOString(),
          duracao_minutos: parseInt(manualDuracao), participantes: [],
          total_participantes: total, media_participantes: total, pico_participantes: total,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Registro manual salvo!");
      setShowManualForm(false);
      setManualAtividade(""); setManualCondutor(""); setManualTotal("");
      loadData();
    } catch {
      toast.error("Erro ao salvar.");
    } finally {
      setSubmitting(false);
    }
  }

  const stats = useMemo(() => {
    if (presencas.length === 0) return { totalGrupos: 0, mediaGeral: 0, picoGeral: 0, totalUnicos: 0 };
    const totalGrupos = presencas.length;
    const mediaGeral = presencas.reduce((s, p) => s + p.media_participantes, 0) / totalGrupos;
    const picoGeral = Math.max(...presencas.map((p) => p.pico_participantes));
    const nomes = new Set<string>();
    presencas.forEach((p) => p.participantes?.forEach((x) => nomes.add(x.nome)));
    return { totalGrupos, mediaGeral, picoGeral, totalUnicos: nomes.size };
  }, [presencas]);

  // Group by date for non-weekly views, by day for weekly
  const grouped = useMemo(() => {
    if (periodo === "semana") {
      const map: Record<number, MeetPresenca[]> = {};
      presencas.forEach((p) => {
        if (!map[p.dia_semana]) map[p.dia_semana] = [];
        map[p.dia_semana].push(p);
      });
      return Object.entries(map)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([dia, regs]) => ({ label: DIAS_SEMANA[Number(dia)], regs }));
    }
    // Group by date
    const map: Record<string, MeetPresenca[]> = {};
    presencas.forEach((p) => {
      if (!map[p.data_reuniao]) map[p.data_reuniao] = [];
      map[p.data_reuniao].push(p);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, regs]) => {
        const d = new Date(date + "T12:00:00");
        const dia = DIAS_SEMANA[d.getDay() === 0 ? 6 : d.getDay() - 1];
        return { label: `${dia} ${formatDateShort(date)}`, regs };
      });
  }, [presencas, periodo]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-fraunces font-bold text-cream">Quorum dos Grupos</h1>
          <p className="text-sm text-cream/40 mt-1">Presenca capturada automaticamente ou registrada manualmente.</p>
        </div>
        <button
          onClick={() => setShowManualForm(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
          style={{ background: "rgba(108,92,231,0.12)", color: "#6c5ce7", border: "1px solid rgba(108,92,231,0.3)" }}
        >
          <Plus className="h-3.5 w-3.5" /> Registro manual
        </button>
      </div>

      {/* Period selector + nav */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-1">
          {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="font-dm text-xs px-3 py-1.5 rounded-full transition-all"
              style={{
                backgroundColor: periodo === p ? "rgba(108,92,231,0.12)" : "rgba(255,255,255,0.03)",
                color: periodo === p ? "#6c5ce7" : "rgba(253,251,247,0.35)",
                border: `1px solid ${periodo === p ? "rgba(108,92,231,0.3)" : "rgba(255,255,255,0.06)"}`,
              }}
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setOffset((o) => o - 1)} className="p-2 rounded-lg hover:bg-white/5 text-cream/50 hover:text-cream transition-colors">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-cream/70 min-w-[160px] text-center">{range.label}</span>
          <button onClick={() => setOffset((o) => o + 1)} disabled={offset >= 0} className="p-2 rounded-lg hover:bg-white/5 text-cream/50 hover:text-cream transition-colors disabled:opacity-30">
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Manual form modal */}
      <AnimatePresence>
        {showManualForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            onClick={() => setShowManualForm(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="rounded-2xl p-6 w-[420px] max-w-[90vw]" style={{ background: "#1a1a1a", border: "1px solid #333" }}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-fraunces font-bold text-base text-cream">Registro Manual</h3>
                <button onClick={() => setShowManualForm(false)} className="text-cream/30 hover:text-cream"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Atividade/Grupo</label>
                  <select value={manualAtividade} onChange={(e) => setManualAtividade(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-cream outline-none" style={{ background: "#111", border: "1px solid #333" }}>
                    <option value="">Selecione...</option>
                    {atividades.map((a) => <option key={a.id} value={a.nome}>{a.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-cream/50 mb-1">Condutor</label>
                  <select value={manualCondutor} onChange={(e) => setManualCondutor(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm text-cream outline-none" style={{ background: "#111", border: "1px solid #333" }}>
                    <option value="">Selecione...</option>
                    {condutores.map((c) => <option key={c.id} value={c.nome}>{c.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-cream/50 mb-1">Data</label>
                    <input type="date" value={manualData} onChange={(e) => setManualData(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-cream outline-none" style={{ background: "#111", border: "1px solid #333", colorScheme: "dark" }} />
                  </div>
                  <div>
                    <label className="block text-xs text-cream/50 mb-1">Horario</label>
                    <input type="time" value={manualHora} onChange={(e) => setManualHora(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm text-cream outline-none" style={{ background: "#111", border: "1px solid #333", colorScheme: "dark" }} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-cream/50 mb-1">Total de participantes</label>
                    <input type="number" value={manualTotal} onChange={(e) => setManualTotal(e.target.value)} placeholder="0" min="0"
                      className="w-full px-3 py-2 rounded-lg text-sm text-cream outline-none" style={{ background: "#111", border: "1px solid #333" }} />
                  </div>
                  <div>
                    <label className="block text-xs text-cream/50 mb-1">Duracao (min)</label>
                    <input type="number" value={manualDuracao} onChange={(e) => setManualDuracao(e.target.value)} min="1"
                      className="w-full px-3 py-2 rounded-lg text-sm text-cream outline-none" style={{ background: "#111", border: "1px solid #333" }} />
                  </div>
                </div>
                <button onClick={submitManual} disabled={submitting}
                  className="w-full py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-50" style={{ background: "#6c5ce7", color: "#fff" }}>
                  {submitting ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Calendar className="h-5 w-5" />} label="Grupos realizados" value={stats.totalGrupos.toString()} color="#6c5ce7" />
        <StatCard icon={<Users className="h-5 w-5" />} label="Media por grupo" value={stats.mediaGeral.toFixed(1)} color="#00b894" />
        <StatCard icon={<TrendingUp className="h-5 w-5" />} label="Pico do periodo" value={stats.picoGeral.toString()} color="#fdcb6e" />
        <StatCard icon={<UserCheck className="h-5 w-5" />} label="Participantes unicos" value={stats.totalUnicos.toString()} color="#e17055" />
      </div>

      {/* Records */}
      {presencas.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-cream/20 mx-auto mb-3" />
            <p className="text-cream/40 text-sm">Nenhum registro neste periodo.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {grouped.map(({ label, regs }, gi) => (
            <motion.div key={label + gi} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: gi * 0.03 }}>
              <Card padding="sm">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <Calendar className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-cream">{label}</h3>
                  <span className="text-xs text-cream/30">{regs.length} grupo{regs.length > 1 ? "s" : ""}</span>
                </div>
                <div className="space-y-2">
                  {regs.map((reg) => (
                    <div key={reg.id}>
                      <button
                        onClick={() => setSelectedPresenca(selectedPresenca?.id === reg.id ? null : reg)}
                        className="w-full text-left rounded-xl px-4 py-3 transition-all duration-200 hover:bg-white/5"
                        style={{
                          background: selectedPresenca?.id === reg.id ? "rgba(108,92,231,0.1)" : "rgba(255,255,255,0.02)",
                          border: selectedPresenca?.id === reg.id ? "1px solid rgba(108,92,231,0.3)" : "1px solid transparent",
                        }}>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5 text-cream/50">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="text-xs">{formatTime(reg.hora_inicio)} - {formatTime(reg.hora_fim)}</span>
                            </div>
                            <span className="text-sm text-cream/70">{reg.condutor_nome}</span>
                            {reg.atividade_nome && (
                              <span className="text-xs px-2 py-0.5 rounded-md" style={{ background: "rgba(108,92,231,0.1)", color: "rgba(108,92,231,0.7)" }}>
                                {reg.atividade_nome}
                              </span>
                            )}
                            {reg.meet_link === "manual" && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: "rgba(253,203,110,0.1)", color: "#fdcb6e" }}>manual</span>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-lg font-bold text-cream">{reg.media_participantes.toFixed(1)}</span>
                              <span className="text-xs text-cream/30 ml-1">media</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-cream/70">{reg.pico_participantes}</span>
                              <span className="text-xs text-cream/30 ml-1">pico</span>
                            </div>
                            <span className="text-sm text-cream/50">{reg.duracao_minutos} min</span>
                          </div>
                        </div>
                        {selectedPresenca?.id === reg.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 pt-3" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs text-cream/40">{reg.total_participantes} participantes unicos</p>
                              <button onClick={(e) => { e.stopPropagation(); if (confirm("Apagar este registro?")) deletePresenca(reg.id); }}
                                disabled={deleting === reg.id}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-red-500/10" style={{ color: "#e74c3c" }}>
                                <Trash2 className="h-3 w-3" />
                                {deleting === reg.id ? "Apagando..." : "Apagar"}
                              </button>
                            </div>
                            {reg.participantes && reg.participantes.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {reg.participantes.map((p, i) => (
                                  <span key={i} className="text-xs px-2 py-1 rounded-md" style={{ background: "rgba(108,92,231,0.12)", color: "rgba(108,92,231,0.8)" }}>
                                    {p.nome}
                                  </span>
                                ))}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Card padding="sm">
      <div className="p-2 rounded-lg w-fit" style={{ background: `${color}15` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-cream">{value}</p>
        <p className="text-xs text-cream/40 mt-0.5">{label}</p>
      </div>
    </Card>
  );
}
