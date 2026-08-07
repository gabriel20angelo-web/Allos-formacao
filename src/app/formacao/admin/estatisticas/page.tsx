"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  BarChart3,
  TrendingUp,

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
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("mes");

  useEffect(() => {
    async function fetchData() {
      try {
        const sb = createClient();
        const since = getSince(periodo);

        // `formacao_meet_presencas` saiu daqui de propósito: era alimentada por
        // uma extensão de navegador que foi desligada, então a tabela parou no
        // tempo e qualquer número tirado dela mentiria sobre o presente. Quem
        // mede presença na sala hoje é a API do Meet, e esses dados moram em
        // /formacao/admin/meet.
        // O ranking de condutores saiu daqui e virou /formacao/admin/condutores,
        // onde ele fica ao lado do quórum medido na sala em vez de sozinho sobre
        // uma tabela de auditoria. Com ele foi embora a leitura de
        // `certificado_condutores`: esta tela olha o calendário, não as pessoas.
        const logsRes = await sb
          .from("formacao_slot_logs")
          .select("*")
          .gte("changed_at", since.toISOString())
          .order("changed_at", { ascending: false });

        setLogs(logsRes.data || []);
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

  const hasData = logs.length > 0;

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

  // O vazio não pode mais sequestrar a página inteira. Como o período começa no
  // mês corrente e a fonte é rala, o antigo return antecipado tirava do ar o
  // seletor de período junto com os cards: quem caísse num mês sem log ficava
  // preso ali, sem como pedir "Ano" e enxergar o histórico. Agora o seletor é
  // sempre renderizado e o vazio ocupa só a faixa de conteúdo abaixo dele.
  return (
    <div className="space-y-8">
      {/* Period selector */}
      <div className="flex flex-wrap items-center gap-2">
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

      {!hasData ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: "rgba(200,75,49,0.08)", border: "1px solid rgba(200,75,49,0.15)" }}>
            <BarChart3 className="h-7 w-7 text-[#C84B31]/50" />
          </div>
          <h3 className="font-fraunces font-bold text-xl text-[#FDFBF7] mb-2">Nenhum registro neste período</h3>
          <p className="font-dm text-sm text-[#FDFBF7]/40 max-w-sm">
            Nenhum slot do calendário mudou de status na janela escolhida. Amplie o período acima para alcançar o histórico.
          </p>
        </motion.div>
      ) : (
        /* Summary cards */
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
          </motion.div>
        ))}
        </div>
      )}

      {/* Status breakdown bar */}
      {statusStats.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.4 }}
          className="rounded-xl p-4 sm:p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
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

      {/* Onde a presença na sala mora agora.
          Este cartão ocupa o lugar do antigo "Quórum do Meet", que somava uma
          tabela abandonada. Ele fica fora do ramo do estado vazio de propósito:
          é justamente quem chega numa janela sem registro que precisa saber para
          onde ir. Nenhum número aqui, só o caminho. */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.4 }}
        className="rounded-xl p-4 sm:p-6" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-[#C84B31]" />
          <h3 className="font-fraunces font-bold text-base text-[#FDFBF7]">Presença na sala</h3>
        </div>
        <p className="font-dm text-sm text-[#FDFBF7]/40 max-w-xl">
          Quem entrou, quanto tempo ficou e quem falou nos encontros não é mais apurado nesta tela. Essa leitura vem direto da API do Google Meet e fica na tela do Meet.
        </p>
        <Link href="/formacao/admin/meet"
          className="inline-flex items-center gap-1.5 mt-3 font-dm text-xs px-3 py-1.5 rounded-full transition-all hover:opacity-80"
          style={{
            backgroundColor: "rgba(200,75,49,0.12)",
            color: "#C84B31",
            border: "1px solid rgba(200,75,49,0.3)",
          }}>
          Abrir a tela do Meet
        </Link>
      </motion.div>

      {/* Conductor ranking from slot logs */}
    </div>
  );
}
