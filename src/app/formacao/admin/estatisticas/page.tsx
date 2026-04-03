"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  Trophy,
  AlertTriangle,
  Calendar,
  Users,
  Activity,
} from "lucide-react";
import type { FormacaoSnapshot, FormacaoSnapshotSlot } from "@/types";

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

const DAY_NAMES = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

interface ConductorStats {
  id: string;
  nome: string;
  total: number;
  conduzidos: number;
  desmarcados: number;
  cancelados: number;
  taxa: number;
}

interface ActivityStats {
  nome: string;
  total: number;
  conduzidos: number;
  cancelados: number;
  desmarcados: number;
  taxa: number;
}

export default function EstatisticasPage() {
  const [snapshots, setSnapshots] = useState<FormacaoSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch("/api/certificados/formacao?type=snapshots");
        if (res.ok) {
          const data = await res.json();
          setSnapshots(data || []);
        }
      } catch {
        console.error("Erro ao carregar estatísticas");
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // All snapshot slots flattened
  const allSlots = useMemo(
    () => snapshots.flatMap((s) => s.formacao_snapshot_slots || []),
    [snapshots]
  );

  // Non-pending slots (actual outcomes)
  const resolvedSlots = useMemo(
    () => allSlots.filter((s) => s.status !== "pendente"),
    [allSlots]
  );

  // Summary stats
  const summary = useMemo(() => {
    const total = resolvedSlots.length;
    const conduzidos = resolvedSlots.filter((s) => s.status === "conduzido").length;
    const cancelados = resolvedSlots.filter((s) => s.status === "cancelado").length;
    const desmarcados = resolvedSlots.filter((s) => s.status === "desmarcado").length;
    const taxa = total > 0 ? Math.round((conduzidos / total) * 100) : 0;
    return { total, conduzidos, cancelados, desmarcados, taxa, semanas: snapshots.length };
  }, [resolvedSlots, snapshots.length]);

  // Conductor ranking
  const conductorStats = useMemo(() => {
    const map: Record<string, ConductorStats> = {};

    for (const slot of allSlots) {
      if (slot.status === "pendente") continue;
      const condutores = slot.condutores || [];
      for (const c of condutores) {
        if (!map[c.id]) {
          map[c.id] = { id: c.id, nome: c.nome, total: 0, conduzidos: 0, desmarcados: 0, cancelados: 0, taxa: 0 };
        }
        map[c.id].total++;
        if (slot.status === "conduzido") map[c.id].conduzidos++;
        if (slot.status === "desmarcado") map[c.id].desmarcados++;
        if (slot.status === "cancelado") map[c.id].cancelados++;
      }
    }

    const list = Object.values(map);
    for (const c of list) {
      c.taxa = c.total > 0 ? Math.round((c.conduzidos / c.total) * 100) : 0;
    }
    return list.sort((a, b) => b.taxa - a.taxa || b.total - a.total);
  }, [allSlots]);

  // Activity stats
  const activityStats = useMemo(() => {
    const map: Record<string, ActivityStats> = {};

    for (const slot of allSlots) {
      const nome = slot.atividade_nome || "Sem atividade";
      if (slot.status === "pendente") continue;
      if (!map[nome]) {
        map[nome] = { nome, total: 0, conduzidos: 0, cancelados: 0, desmarcados: 0, taxa: 0 };
      }
      map[nome].total++;
      if (slot.status === "conduzido") map[nome].conduzidos++;
      if (slot.status === "cancelado") map[nome].cancelados++;
      if (slot.status === "desmarcado") map[nome].desmarcados++;
    }

    const list = Object.values(map);
    for (const a of list) {
      a.taxa = a.total > 0 ? Math.round((a.conduzidos / a.total) * 100) : 0;
    }
    return list.sort((a, b) => b.total - a.total);
  }, [allSlots]);

  // Day x Time heatmap data
  const heatmapData = useMemo(() => {
    const hours = new Set<string>();
    const countMap: Record<string, { total: number; problems: number }> = {};

    for (const slot of allSlots) {
      if (slot.status === "pendente") continue;
      hours.add(slot.horario_hora);
      const key = `${slot.dia_semana}-${slot.horario_hora}`;
      if (!countMap[key]) countMap[key] = { total: 0, problems: 0 };
      countMap[key].total++;
      if (slot.status === "cancelado" || slot.status === "desmarcado") {
        countMap[key].problems++;
      }
    }

    const sortedHours = Array.from(hours).sort();
    return { hours: sortedHours, countMap };
  }, [allSlots]);

  // Weekly bars data
  const weeklyBars = useMemo(() => {
    return snapshots.map((snap) => {
      const slots = snap.formacao_snapshot_slots || [];
      const total = slots.length;
      const counts: Record<string, number> = {};
      for (const s of slots) {
        counts[s.status] = (counts[s.status] || 0) + 1;
      }
      const label = new Date(snap.semana_inicio + "T12:00:00").toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
      });
      return { label, total, counts, semana_inicio: snap.semana_inicio };
    }).reverse(); // oldest first
  }, [snapshots]);

  // Best conductor
  const bestConductor = conductorStats.length > 0 ? conductorStats[0] : null;

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

  if (snapshots.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center py-24 text-center"
      >
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
          style={{
            background: "rgba(200,75,49,0.08)",
            border: "1px solid rgba(200,75,49,0.15)",
          }}
        >
          <BarChart3 className="h-7 w-7 text-[#C84B31]/50" />
        </div>
        <h3 className="font-fraunces font-bold text-xl text-[#FDFBF7] mb-2">
          Nenhuma estatística ainda
        </h3>
        <p className="font-dm text-sm text-[#FDFBF7]/40 max-w-sm">
          As estatísticas começam a ser coletadas quando você clica em &quot;Nova Semana&quot; no Calendário. Cada semana gera um snapshot automático dos dados.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            icon: Calendar,
            label: "Semanas registradas",
            value: summary.semanas.toString(),
            color: "#2E9E8F",
          },
          {
            icon: TrendingUp,
            label: "Taxa de condução",
            value: `${summary.taxa}%`,
            color: summary.taxa >= 70 ? "#22c55e" : summary.taxa >= 50 ? "#f59e0b" : "#ef4444",
          },
          {
            icon: AlertTriangle,
            label: "Cancelamentos + Desmarques",
            value: (summary.cancelados + summary.desmarcados).toString(),
            color: "#ef4444",
          },
          {
            icon: Trophy,
            label: "Condutor mais confiável",
            value: bestConductor ? bestConductor.nome : "—",
            sub: bestConductor ? `${bestConductor.taxa}% de condução` : undefined,
            color: "#d4af37",
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.4 }}
            className="rounded-xl p-5 flex flex-col gap-2"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            <div className="flex items-center gap-2">
              <card.icon className="h-4 w-4" style={{ color: card.color }} />
              <span className="font-dm text-[11px] text-[#FDFBF7]/40 uppercase tracking-wider">
                {card.label}
              </span>
            </div>
            <p className="font-fraunces font-bold text-2xl text-[#FDFBF7] truncate">
              {card.value}
            </p>
            {card.sub && (
              <p className="font-dm text-[11px] text-[#FDFBF7]/30">{card.sub}</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* ─── Weekly Status Overview ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="rounded-xl p-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Activity className="h-4 w-4 text-[#C84B31]" />
          <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">
            Visão semanal
          </h3>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: STATUS_COLORS[key] }}
              />
              <span className="font-dm text-[10px] text-[#FDFBF7]/40">{label}</span>
            </div>
          ))}
        </div>

        <div className="space-y-2.5">
          {weeklyBars.map((week) => (
            <div key={week.semana_inicio} className="flex items-center gap-3">
              <span className="font-dm text-xs text-[#FDFBF7]/40 w-16 flex-shrink-0 text-right">
                {week.label}
              </span>
              <div className="flex-1 flex h-6 rounded-md overflow-hidden" style={{ background: "rgba(255,255,255,0.04)" }}>
                {["conduzido", "nao_conduzido", "cancelado", "desmarcado", "pendente"].map((status) => {
                  const count = week.counts[status] || 0;
                  if (count === 0 || week.total === 0) return null;
                  const pct = (count / week.total) * 100;
                  return (
                    <div
                      key={status}
                      title={`${STATUS_LABELS[status]}: ${count}`}
                      className="h-full transition-all duration-300 flex items-center justify-center"
                      style={{
                        width: `${pct}%`,
                        background: STATUS_COLORS[status],
                        minWidth: count > 0 ? "14px" : 0,
                      }}
                    >
                      {pct > 12 && (
                        <span className="font-dm text-[9px] font-bold text-white/80">
                          {count}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <span className="font-dm text-[10px] text-[#FDFBF7]/25 w-8 flex-shrink-0">
                {week.total}
              </span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ─── Conductor Ranking ─── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-xl p-6"
        style={{
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-2 mb-5">
          <Users className="h-4 w-4 text-[#C84B31]" />
          <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">
            Ranking de condutores
          </h3>
        </div>

        {/* Table header */}
        <div
          className="grid gap-2 px-4 py-2 mb-1 font-dm text-[10px] uppercase tracking-wider text-[#FDFBF7]/25"
          style={{ gridTemplateColumns: "1fr 60px 72px 80px 1fr" }}
        >
          <span>Nome</span>
          <span className="text-center">Alocados</span>
          <span className="text-center">Conduzidos</span>
          <span className="text-center">Desmarcados</span>
          <span>Taxa de condução</span>
        </div>

        <div className="space-y-1">
          {conductorStats.map((c, i) => {
            const taxaColor = c.taxa >= 80 ? "#22c55e" : c.taxa >= 50 ? "#f59e0b" : "#ef4444";
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.05 * i, duration: 0.3 }}
                className="grid gap-2 px-4 py-3 rounded-lg items-center transition-colors hover:bg-white/[0.02]"
                style={{
                  gridTemplateColumns: "1fr 60px 72px 80px 1fr",
                  background: i === 0 ? "rgba(212,175,55,0.04)" : "transparent",
                  border: i === 0 ? "1px solid rgba(212,175,55,0.1)" : "1px solid transparent",
                }}
              >
                <div className="flex items-center gap-2">
                  {i === 0 && <Trophy className="h-3.5 w-3.5 text-amber-400" />}
                  <span className="font-dm text-sm text-[#FDFBF7] truncate">{c.nome}</span>
                </div>
                <span className="font-dm text-sm text-[#FDFBF7]/50 text-center">{c.total}</span>
                <span className="font-dm text-sm text-center" style={{ color: "#22c55e" }}>
                  {c.conduzidos}
                </span>
                <span className="font-dm text-sm text-center" style={{ color: c.desmarcados > 0 ? "#8b5cf6" : "#FDFBF7", opacity: c.desmarcados > 0 ? 1 : 0.3 }}>
                  {c.desmarcados}
                </span>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${c.taxa}%`, background: taxaColor }}
                    />
                  </div>
                  <span className="font-dm text-xs font-semibold w-10 text-right" style={{ color: taxaColor }}>
                    {c.taxa}%
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Activity Analysis + Heatmap ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activities */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          className="rounded-xl p-6"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <BarChart3 className="h-4 w-4 text-[#C84B31]" />
            <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">
              Por atividade/grupo
            </h3>
          </div>

          <div className="space-y-3">
            {activityStats.map((a, i) => {
              const taxaColor = a.taxa >= 70 ? "#22c55e" : a.taxa >= 50 ? "#f59e0b" : "#ef4444";
              return (
                <motion.div
                  key={a.nome}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * i, duration: 0.3 }}
                  className="rounded-lg p-4"
                  style={{
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-dm text-sm font-medium text-[#FDFBF7] truncate">
                      {a.nome}
                    </span>
                    <span className="font-dm text-xs font-semibold" style={{ color: taxaColor }}>
                      {a.taxa}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${a.taxa}%`, background: taxaColor }}
                    />
                  </div>
                  <div className="flex gap-4 font-dm text-[10px] text-[#FDFBF7]/30">
                    <span>{a.total} slots</span>
                    <span style={{ color: "#22c55e" }}>{a.conduzidos} conduzidos</span>
                    {a.cancelados > 0 && <span style={{ color: "#ef4444" }}>{a.cancelados} cancelados</span>}
                    {a.desmarcados > 0 && <span style={{ color: "#8b5cf6" }}>{a.desmarcados} desmarcados</span>}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.4 }}
          className="rounded-xl p-6"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="h-4 w-4 text-[#C84B31]" />
            <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">
              Mapa de problemas (dia x horário)
            </h3>
          </div>
          <p className="font-dm text-[11px] text-[#FDFBF7]/30 mb-4">
            Intensidade de cancelamentos e desmarques por dia e horário
          </p>

          {heatmapData.hours.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="font-dm text-[10px] text-[#FDFBF7]/25 text-left pr-3 pb-2" />
                    {DAY_NAMES.map((d) => (
                      <th key={d} className="font-dm text-[10px] text-[#FDFBF7]/25 text-center pb-2 px-1">
                        {d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmapData.hours.map((hora) => (
                    <tr key={hora}>
                      <td className="font-dm text-xs text-[#FDFBF7]/40 pr-3 py-1.5">{hora}</td>
                      {[0, 1, 2, 3, 4].map((dia) => {
                        const key = `${dia}-${hora}`;
                        const data = heatmapData.countMap[key];
                        const rate = data && data.total > 0 ? data.problems / data.total : 0;
                        const opacity = Math.min(rate * 1.5, 1);
                        return (
                          <td key={dia} className="px-1 py-1.5">
                            <div
                              className="w-full h-9 rounded-lg flex items-center justify-center transition-all"
                              style={{
                                background: data
                                  ? `rgba(239,68,68,${0.05 + opacity * 0.4})`
                                  : "rgba(255,255,255,0.02)",
                                border: `1px solid rgba(239,68,68,${opacity * 0.3})`,
                              }}
                              title={data ? `${data.problems}/${data.total} problemas (${Math.round(rate * 100)}%)` : "Sem dados"}
                            >
                              {data && data.problems > 0 && (
                                <span
                                  className="font-dm text-[10px] font-bold"
                                  style={{ color: `rgba(239,68,68,${0.5 + opacity * 0.5})` }}
                                >
                                  {Math.round(rate * 100)}%
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="font-dm text-sm text-[#FDFBF7]/25 text-center py-8">
              Dados insuficientes
            </p>
          )}

          {/* Heatmap legend */}
          <div className="flex items-center gap-2 mt-4 justify-end">
            <span className="font-dm text-[9px] text-[#FDFBF7]/20">Menos problemas</span>
            <div className="flex gap-0.5">
              {[0.05, 0.15, 0.25, 0.35, 0.45].map((op) => (
                <div
                  key={op}
                  className="w-4 h-3 rounded-sm"
                  style={{ background: `rgba(239,68,68,${op})` }}
                />
              ))}
            </div>
            <span className="font-dm text-[9px] text-[#FDFBF7]/20">Mais problemas</span>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
