"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Trophy, Award } from "lucide-react";

type Tab = "participantes" | "curseiros";
type Periodo = "week" | "month" | "quarter" | "semester" | "year";

const TAB_LABELS: Record<Tab, string> = {
  participantes: "Top Participantes",
  curseiros: "Top Curseiros",
};

const PERIODO_LABELS: Record<Periodo, string> = {
  week: "Semana",
  month: "Mes",
  quarter: "Trimestre",
  semester: "Semestre",
  year: "Ano",
};

interface RankEntry {
  nome: string;
  horas: number;
  count: number;
}

export default function TopRanking() {
  const [tab, setTab] = useState<Tab>("participantes");
  const [periodo, setPeriodo] = useState<Periodo>("month");
  const [data, setData] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    setLoading(true);
    // "Participantes" = quem aparece via /certificado (eventos síncronos).
    // "Curseiros" = quem completa lições de cursos assíncronos (lesson_progress).
    const type = tab === "participantes" ? "sync" : "async";
    fetch(`/formacao/api/ranking?period=${periodo}&type=${type}&_t=${Date.now()}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d.slice(0, 5));
        else setData([]);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [tab, periodo]);

  return (
    <section ref={ref} className="py-10 px-5 sm:px-6 md:px-8">
      <div className="max-w-[700px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{
            border: "1px solid rgba(253,251,247,0.06)",
            background: "rgba(253,251,247,0.015)",
          }}
        >
          {/* Tab + period selector */}
          <div className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderBottom: "1px solid rgba(253,251,247,0.04)" }}>
            <div className="flex gap-1">
              {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className="font-dm text-[11px] font-semibold px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
                  style={{
                    background: tab === t ? "rgba(200,75,49,0.1)" : "transparent",
                    color: tab === t ? "#C84B31" : "rgba(253,251,247,0.3)",
                  }}
                >
                  {t === "participantes" ? <Trophy size={11} /> : <Award size={11} />}
                  {TAB_LABELS[t]}
                </button>
              ))}
            </div>
            <div className="flex gap-1 sm:ml-auto">
              {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriodo(p)}
                  className="font-dm text-[9px] px-2 py-0.5 rounded-full transition-all"
                  style={{
                    backgroundColor: periodo === p ? "rgba(46,158,143,0.12)" : "transparent",
                    color: periodo === p ? "#2E9E8F" : "rgba(253,251,247,0.2)",
                  }}
                >
                  {PERIODO_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-5 py-4">
            {loading ? (
              <div className="flex gap-3 justify-center py-4">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-6 w-20 rounded-md animate-pulse" style={{ background: "rgba(253,251,247,0.04)" }} />
                ))}
              </div>
            ) : data.length === 0 ? (
              <p className="text-center font-dm text-xs py-6" style={{ color: "rgba(253,251,247,0.2)" }}>
                Nenhum dado no periodo.
              </p>
            ) : (
              <div className="space-y-2">
                {data.map((entry, i) => {
                  const medals = ["#C84B31", "rgba(253,251,247,0.5)", "rgba(200,75,49,0.6)"];
                  const isMedal = i < 3;
                  const maxVal = data[0]?.horas || data[0]?.count || 1;
                  const barVal = tab === "curseiros" ? entry.count : entry.horas;
                  const barMax = tab === "curseiros" ? (data[0]?.count || 1) : maxVal;
                  const barWidth = Math.max(8, (barVal / barMax) * 100);

                  return (
                    <motion.div
                      key={entry.nome}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="font-fraunces font-bold text-base w-6 text-center flex-shrink-0"
                        style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.15)" }}
                      >
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-dm text-xs truncate" style={{ color: "rgba(253,251,247,0.6)" }}>
                            {entry.nome.split(" ").slice(0, 2).join(" ")}
                          </span>
                          <span className="font-dm text-xs font-bold flex-shrink-0 ml-2" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.2)" }}>
                            {tab === "curseiros" ? `${entry.count} cert${entry.count > 1 ? "s" : ""}` : `${entry.horas}h`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(253,251,247,0.04)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{ delay: 0.2 + i * 0.06, duration: 0.5 }}
                            className="h-full rounded-full"
                            style={{
                              background: isMedal ? medals[i] : "rgba(253,251,247,0.1)",
                              opacity: isMedal ? 0.6 : 0.3,
                            }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
