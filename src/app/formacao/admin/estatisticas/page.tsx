"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart3,
  TrendingUp,
  Trophy,
  AlertTriangle,
  Calendar,
  Users,
  Activity,
} from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  conduzido: "#22c55e",
  nao_conduzido: "#f59e0b",
  cancelado: "#ef4444",
  desmarcado: "#8b5cf6",
  pendente: "#6b7280",
};

const STATUS_LABELS: Record<string, string> = {
  conduzido: "Conduzido",
  nao_conduzido: "Não conduzido",
  cancelado: "Cancelado",
  desmarcado: "Desmarcado",
  pendente: "Pendente",
};

interface SlotLog {
  id: string;
  slot_id: string;
  status_anterior: string | null;
  status_novo: string;
  atividade_nome: string | null;
  condutor_ids: string[];
  changed_at: string;
}

interface MeetPresenca {
  id: string;
  condutor_nome: string;
  atividade_nome: string | null;
  data_reuniao: string;
  dia_semana: number;
  total_participantes: number;
  media_participantes: number;
  pico_participantes: number;
  duracao_minutos: number;
}

interface Condutor {
  id: string;
  nome: string;
}

type Periodo = "mes" | "trimestre" | "semestre" | "ano";
const PERIODO_LABELS: Record<Periodo, string> = {
  mes: "Mês", trimestre: "Trimestre", semestre: "Semestre", ano: "Ano",
};

function getSince(p: Periodo): Date {
  const now = new Date();
  switch (p) {
    case "mes": return new Date(now.getFullYear(), now.getMonth(), 1);
    case "trimestre": return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    case "semestre": return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1);
    case "ano": return new Date(now.getFullYear(), 0, 1);
  }
}

export default function EstatisticasPage() {
  const [logs, setLogs] = useState<SlotLog[]>([]);
  const [presencas, setPresencas] = useState<MeetPresenca[]>([]);
  const [condutores, setCondutores] = useState<Condutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  useEffect(() => {
    async function fetchData() {
      try {
        const sb = createClient();
        const since = getSince(periodo);

        const [logsRes, presRes, condRes] = await Promise.all([
          sb.from("formacao_slot_logs")
            .select("*")
            .gte("changed_at", since.toISOString())
            .order("changed_at", { ascending: false }),
          sb.from("formacao_meet_presencas")
            .select("id, condutor_nome, atividade_nome, data_reuniao, dia_semana, total_participantes, media_participantes, pico_participantes, duracao_minutos")
            .gte("data_reuniao", since.toISOString().split("T")[0])
            .order("data_reuniao", { ascending: false }),
          sb.from("certificado_condutores")
            .select("id, nome")
            .eq("ativo", true),
        ]);

        setLogs(logsRes.data || []);
        setPresencas(presRes.data || []);
        setCondutores(condRes.data || []);
      } catch {
        console.error("Erro ao carregar estatísticas");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [periodo]);

  // Status stats from slot logs
  const statusStats = useMemo(() => {
    const finalStatuses = new Map<string, string>();
    // Get latest status per slot
    logs.forEach((l) => {
      if (!finalStatuses.has(l.slot_id)) {
        finalStatuses.set(l.slot_id, l.status_novo);
      }
    });
    const counts: Record<string, number> = {};
    finalStatuses.forEach((status) => {
      counts[status] = (counts[status] || 0) + 1;
    });
    const total = finalStatuses.size;
    const conduzidos = counts["conduzido"] || 0;
    const cancelados = counts["cancelado"] || 0;
    const desmarcados = counts["desmarcado"] || 0;
    const taxa = total > 0 ? Math.round((conduzidos / total) * 100) : 0;
    return { total, conduzidos, cancelados, desmarcados, taxa, counts };
  }, [logs]);

  // Meet quorum stats
  const quorumStats = useMemo(() => {
    if (presencas.length === 0) return null;
    const totalGrupos = presencas.length;
    const mediaGeral = presencas.reduce((s, p) => s + p.media_participantes, 0) / totalGrupos;
    const picoGeral = Math.max(...presencas.map((p) => p.pico_participantes));
    const totalMinutos = presencas.reduce((s, p) => s + p.duracao_minutos, 0);

    // By atividade
    const porAtividade: Record<string, { count: number; media: number; total: number }> = {};
    presencas.forEach((p) => {
      const nome = p.atividade_nome || "Sem atividade";
      if (!porAtividade[nome]) porAtividade[nome] = { count: 0, media: 0, total: 0 };
      porAtividade[nome].count++;
      porAtividade[nome].total += p.total_participantes;
    });
    Object.values(porAtividade).forEach((v) => { v.media = v.total / v.count; });

    // By condutor
    const porCondutor: Record<string, { count: number; total: number }> = {};
    presencas.forEach((p) => {
      const nome = p.condutor_nome;
      if (!porCondutor[nome]) porCondutor[nome] = { count: 0, total: 0 };
      porCondutor[nome].count++;
      porCondutor[nome].total += p.total_participantes;
    });

    // By day of week
    const porDia: Record<number, number> = {};
    presencas.forEach((p) => {
      porDia[p.dia_semana] = (porDia[p.dia_semana] || 0) + 1;
    });

    return { totalGrupos, mediaGeral, picoGeral, totalMinutos, porAtividade, porCondutor, porDia };
  }, [presencas]);

  // Conductor ranking from slot logs
  const conductorStats = useMemo(() => {
    const map: Record<string, { total: number; conduzidos: number; cancelados: number; desmarcados: number }> = {};

    logs.forEach((l) => {
      if (l.status_novo === "pendente") return;
      (l.condutor_ids || []).forEach((cid) => {
        const nome = condutores.find((c) => c.id === cid)?.nome || cid;
        if (!map[nome]) map[nome] = { total: 0, conduzidos: 0, cancelados: 0, desmarcados: 0 };
        map[nome].total++;
        if (l.status_novo === "conduzido") map[nome].conduzidos++;
        if (l.status_novo === "cancelado") map[nome].cancelados++;
        if (l.status_novo === "desmarcado") map[nome].desmarcados++;
      });
    });

    return Object.entries(map)
      .map(([nome, d]) => ({
        nome,
        ...d,
        taxa: d.total > 0 ? Math.round((d.conduzidos / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.taxa - a.taxa || b.total - a.total);
  }, [logs, condutores]);

  const bestConductor = conductorStats.length > 0 ? conductorStats[0] : null;
  const hasData = logs.length > 0 || presencas.length > 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
          ))}
        </div>
        <div className="h-64 rounded-xl animate-pulse" style={{ background: "rgba(255,255,255,0.03)" }} />
      </div>
    );
  }

  if (!hasData) {
    return (
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.15)" }}>
          <BarChart3 className="h-7 w-7 text-[#C84B31]/50" />
        </div>
        <h3 className="font-fraunces font-bold text-xl text-[#FDFBF7] mb-2">Nenhuma estatistica ainda</h3>
        <p className="font-dm text-sm text-[#FDFBF7]/40 max-w-sm">
          As estatísticas aparecem quando os slots do calendário mudam de status (conduzido, cancelado, etc.) ou quando há registros de presença do Meet.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
          <button key={p} onClick={() => setPeriodo(p)}
            className="font-dm text-xs px-3 py-1.5 rounded-full transition-all"
            style={{
              backgroundColor: periodo === p ? "rgba(200,75,49,0.12)" : "rgba(255,255,255,0.03)",
              color: periodo === p ? "#C84B31" : "rgba(253,251,247,0.35)",
              border: `1px solid ${periodo === p ? "rgba(200,75,49,0.3)" : "rgba(255,255,255,0.06)"}`,
            }}>
            {PERIODO_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { icon: Calendar, label: "Slots registrados", value: statusStats.total.toString(), color: "#2E9E8F" },
          {
            icon: TrendingUp, label: "Taxa de condução",
            value: `${statusStats.taxa}%`,
            color: statusStats.taxa >= 70 ? "#22c55e" : statusStats.taxa >= 50 ? "#f59e0b" : "#ef4444",
          },
          {
            icon: AlertTriangle, label: "Cancelamentos + Desmarques",
            value: (statusStats.cancelados + statusStats.desmarcados).toString(), color: "#ef4444",
          },
          {
            icon: Trophy, label: "Condutor mais confiável",
            value: bestConductor ? bestConductor.nome : "—",
            sub: bestConductor ? `${bestConductor.taxa}% de condução` : undefined,
            color: "#d4af37",
          },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="rounded-xl p-5 flex flex-col gap-2"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center gap-2">
              <card.icon className="h-4 w-4" style={{ color: card.color }} />
              <span className="font-dm text-[11px] text-[#FDFBF7]/40 uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="font-fraunces font-bold text-2xl text-[#FDFBF7] truncate">{card.value}</p>
            {card.sub && <p className="font-dm text-[11px] text-[#FDFBF7]/30">{card.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Status breakdown bar */}
      {statusStats.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Activity className="h-4 w-4 text-[#C84B31]" />
            <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">Status dos slots</h3>
          </div>
          <div className="flex flex-wrap gap-4 mb-4">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STATUS_COLORS[key] }} />
                <span className="font-dm text-[10px] text-[#FDFBF7]/40">{label}: {statusStats.counts[key] || 0}</span>
              </div>
            ))}
          </div>
          <div className="flex h-6 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
            {["conduzido", "nao_conduzido", "cancelado", "desmarcado", "pendente"].map((status) => {
              const count = statusStats.counts[status] || 0;
              if (count === 0 || statusStats.total === 0) return null;
              const pct = (count / statusStats.total) * 100;
              return (
                <div key={status} title={`${STATUS_LABELS[status]}: ${count}`}
                  className="h-full flex items-center justify-center"
                  style={{ width: `${pct}%`, background: STATUS_COLORS[status], minWidth: "14px" }}>
                  {pct > 12 && <span className="font-dm text-[9px] font-bold text-white/80">{count}</span>}
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Quorum stats from Meet */}
      {quorumStats && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Users className="h-4 w-4 text-[#C84B31]" />
            <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">Quórum do Meet</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { label: "Grupos registrados", value: quorumStats.totalGrupos.toString() },
              { label: "Média de participantes", value: quorumStats.mediaGeral.toFixed(1) },
              { label: "Pico máximo", value: quorumStats.picoGeral.toString() },
              { label: "Horas totais", value: Math.round(quorumStats.totalMinutos / 60).toString() + "h" },
            ].map((s) => (
              <div key={s.label} className="text-center">
                <p className="font-fraunces font-bold text-xl text-[#FDFBF7]">{s.value}</p>
                <p className="font-dm text-[10px] text-[#FDFBF7]/35">{s.label}</p>
              </div>
            ))}
          </div>

          {/* By atividade */}
          {Object.keys(quorumStats.porAtividade).length > 0 && (
            <div className="mb-4">
              <p className="font-dm text-[11px] text-[#FDFBF7]/40 uppercase tracking-wider mb-3">Por atividade</p>
              <div className="space-y-2">
                {Object.entries(quorumStats.porAtividade)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([nome, d]) => (
                    <div key={nome} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="font-dm text-xs text-[#FDFBF7]/60">{nome}</span>
                      <div className="flex gap-4">
                        <span className="font-dm text-xs text-[#FDFBF7]/40">{d.count}x</span>
                        <span className="font-dm text-xs font-semibold" style={{ color: "#2E9E8F" }}>média {d.media.toFixed(1)}</span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* By condutor */}
          {Object.keys(quorumStats.porCondutor).length > 0 && (
            <div>
              <p className="font-dm text-[11px] text-[#FDFBF7]/40 uppercase tracking-wider mb-3">Por condutor</p>
              <div className="space-y-2">
                {Object.entries(quorumStats.porCondutor)
                  .sort(([, a], [, b]) => b.count - a.count)
                  .map(([nome, d]) => (
                    <div key={nome} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.02)" }}>
                      <span className="font-dm text-xs text-[#FDFBF7]/60">{nome}</span>
                      <span className="font-dm text-xs text-[#FDFBF7]/40">{d.count} grupos, média {(d.total / d.count).toFixed(1)}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Conductor ranking from slot logs */}
      {conductorStats.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35, duration: 0.4 }}
          className="rounded-xl p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2 mb-5">
            <Trophy className="h-4 w-4 text-[#C84B31]" />
            <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">Ranking de condutores (calendário)</h3>
          </div>
          <div className="grid gap-2 px-4 py-2 mb-1 font-dm text-[10px] uppercase tracking-wider text-[#FDFBF7]/25"
            style={{ gridTemplateColumns: "1fr 60px 72px 80px 1fr" }}>
            <span>Nome</span>
            <span className="text-center">Alocados</span>
            <span className="text-center">Conduzidos</span>
            <span className="text-center">Desmarcados</span>
            <span>Taxa</span>
          </div>
          <div className="space-y-1">
            {conductorStats.map((c, i) => {
              const taxaColor = c.taxa >= 80 ? "#22c55e" : c.taxa >= 50 ? "#f59e0b" : "#ef4444";
              return (
                <div key={c.nome}
                  className="grid gap-2 px-4 py-3 rounded-lg items-center hover:bg-white/[0.02]"
                  style={{
                    gridTemplateColumns: "1fr 60px 72px 80px 1fr",
                    background: i === 0 ? "rgba(212,175,55,0.04)" : "transparent",
                    border: i === 0 ? "1px solid rgba(212,175,55,0.1)" : "1px solid transparent",
                  }}>
                  <div className="flex items-center gap-2">
                    {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-400" />}
                    <span className="font-dm text-sm text-[#FDFBF7] truncate">{c.nome}</span>
                  </div>
                  <span className="font-dm text-sm text-[#FDFBF7]/50 text-center">{c.total}</span>
                  <span className="font-dm text-sm text-center" style={{ color: "#22c55e" }}>{c.conduzidos}</span>
                  <span className="font-dm text-sm text-center" style={{ color: c.desmarcados > 0 ? "#8b5cf6" : "#FDFBF7", opacity: c.desmarcados > 0 ? 1 : 0.3 }}>{c.desmarcados}</span>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.taxa}%`, background: taxaColor }} />
                    </div>
                    <span className="font-dm text-xs font-semibold w-10 text-right" style={{ color: taxaColor }}>{c.taxa}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
