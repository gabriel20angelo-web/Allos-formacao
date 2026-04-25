"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Trophy, Crown, Medal, Award } from "lucide-react";

type Tab = "participantes" | "curseiros";
type Periodo = "week" | "month" | "quarter" | "semester" | "year";

const TAB_LABELS: Record<Tab, string> = {
  participantes: "Participantes",
  curseiros: "Curseiros",
};

const TAB_DESCRIPTIONS: Record<Tab, string> = {
  participantes: "Presença nos encontros síncronos",
  curseiros: "Aulas concluídas em cursos gravados",
};

const PERIODO_LABELS: Record<Periodo, string> = {
  week: "Semana",
  month: "Mês",
  quarter: "Tri",
  semester: "Sem",
  year: "Ano",
};

interface RankEntry {
  nome: string;
  horas: number;
  count: number;
}

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"]; // ouro, prata, bronze
const MEDAL_BGS = [
  "linear-gradient(90deg, rgba(255,215,0,0.10) 0%, rgba(212,175,55,0.02) 100%)",
  "linear-gradient(90deg, rgba(192,192,192,0.08) 0%, rgba(160,160,160,0.02) 100%)",
  "linear-gradient(90deg, rgba(205,127,50,0.08) 0%, rgba(165,100,40,0.02) 100%)",
];

function getInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase();
}

function nameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360}, 45%, 48%)`;
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

  const maxHoras = useMemo(
    () => Math.max(...data.map((e) => e.horas), 1),
    [data]
  );

  return (
    <section ref={ref} className="py-10 px-5 sm:px-6 md:px-8">
      <div className="max-w-[700px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-2xl overflow-hidden relative"
          style={{
            border: "1px solid rgba(253,251,247,0.06)",
            background:
              "linear-gradient(180deg, rgba(253,251,247,0.025) 0%, rgba(253,251,247,0.005) 100%)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
          }}
        >
          {/* Top gold shimmer */}
          <div
            className="absolute top-0 left-0 right-0 h-[1px] pointer-events-none"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.35) 30%, rgba(255,215,0,0.55) 50%, rgba(212,175,55,0.35) 70%, transparent 100%)",
            }}
          />

          {/* Header */}
          <div
            className="px-5 sm:px-6 pt-5 pb-4"
            style={{ borderBottom: "1px solid rgba(253,251,247,0.04)" }}
          >
            <div className="flex items-center gap-2 mb-3.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(212,175,55,0.06))",
                  border: "1px solid rgba(212,175,55,0.22)",
                }}
              >
                <Trophy className="h-3.5 w-3.5" style={{ color: "#FBBC05" }} />
              </div>
              <h3 className="font-fraunces font-bold text-sm sm:text-base text-cream/85 tracking-tight">
                Top do período
              </h3>
            </div>

            {/* Tabs + period filters — one row on desktop */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex gap-1.5">
                {(Object.keys(TAB_LABELS) as Tab[]).map((t) => {
                  const active = tab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setTab(t)}
                      className="font-dm text-[11px] font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5 transition-all"
                      style={{
                        background: active
                          ? "rgba(200,75,49,0.12)"
                          : "rgba(255,255,255,0.02)",
                        color: active ? "#C84B31" : "rgba(253,251,247,0.42)",
                        border: `1px solid ${
                          active
                            ? "rgba(200,75,49,0.28)"
                            : "rgba(255,255,255,0.05)"
                        }`,
                      }}
                    >
                      {t === "participantes" ? (
                        <Trophy size={11} />
                      ) : (
                        <Award size={11} />
                      )}
                      {TAB_LABELS[t]}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-1 ml-auto">
                {(Object.keys(PERIODO_LABELS) as Periodo[]).map((p) => {
                  const active = periodo === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setPeriodo(p)}
                      className="font-dm text-[10px] font-medium px-2.5 py-1 rounded-full transition-all"
                      style={{
                        backgroundColor: active
                          ? "rgba(46,158,143,0.14)"
                          : "transparent",
                        color: active ? "#2E9E8F" : "rgba(253,251,247,0.28)",
                        border: `1px solid ${
                          active ? "rgba(46,158,143,0.25)" : "transparent"
                        }`,
                      }}
                    >
                      {PERIODO_LABELS[p]}
                    </button>
                  );
                })}
              </div>
            </div>
            <p className="font-dm text-[10px] text-cream/35 mt-2.5">
              {TAB_DESCRIPTIONS[tab]}
            </p>
          </div>

          {/* Content */}
          <div className="px-5 sm:px-6 py-4">
            {loading ? (
              <div className="space-y-2.5 py-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div
                      className="h-7 w-7 rounded-full animate-pulse"
                      style={{ background: "rgba(253,251,247,0.04)" }}
                    />
                    <div
                      className="h-7 w-7 rounded-full animate-pulse"
                      style={{ background: "rgba(253,251,247,0.04)" }}
                    />
                    <div
                      className="flex-1 h-3 rounded-md animate-pulse"
                      style={{ background: "rgba(253,251,247,0.04)" }}
                    />
                  </div>
                ))}
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center py-8 gap-2">
                <Medal className="h-6 w-6 text-cream/15" />
                <p className="font-dm text-xs text-cream/30">
                  Nenhum dado no período.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {data.map((entry, i) => {
                  const isMedal = i < 3;
                  const medalColor: string | undefined = isMedal
                    ? MEDAL_COLORS[i]
                    : undefined;
                  const medalBg: string | undefined = isMedal
                    ? MEDAL_BGS[i]
                    : undefined;
                  const barWidth = Math.max(
                    6,
                    (entry.horas / maxHoras) * 100
                  );
                  const initial = getInitial(entry.nome);
                  const initialBg = nameToColor(entry.nome);
                  const subtitle =
                    tab === "curseiros"
                      ? `${entry.count} aula${entry.count > 1 ? "s" : ""}`
                      : `${entry.count}× presença${
                          entry.count > 1 ? "s" : ""
                        }`;

                  return (
                    <motion.div
                      key={entry.nome}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.3 }}
                      className="flex items-center gap-3 px-2 py-1.5 rounded-lg"
                      style={medalBg ? { background: medalBg } : undefined}
                    >
                      {/* Rank badge */}
                      <div
                        className="relative w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isMedal
                            ? "rgba(0,0,0,0.28)"
                            : "rgba(255,255,255,0.025)",
                          border: `1px solid ${
                            medalColor
                              ? `${medalColor}55`
                              : "rgba(255,255,255,0.05)"
                          }`,
                        }}
                      >
                        {i === 0 && medalColor ? (
                          <Crown
                            className="h-3.5 w-3.5"
                            style={{ color: medalColor }}
                          />
                        ) : (
                          <span
                            className="font-fraunces font-bold text-xs"
                            style={{
                              color: medalColor ?? "rgba(253,251,247,0.32)",
                            }}
                          >
                            {i + 1}
                          </span>
                        )}
                      </div>

                      {/* Initial avatar */}
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 font-dm font-bold text-[11px] text-white/95"
                        style={{ background: initialBg }}
                      >
                        {initial}
                      </div>

                      {/* Name + bar + value */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-3 mb-1">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span
                              className="font-dm text-xs sm:text-[13px] font-medium truncate"
                              style={{ color: "rgba(253,251,247,0.8)" }}
                            >
                              {entry.nome.split(" ").slice(0, 2).join(" ")}
                            </span>
                            <span className="font-dm text-[10px] text-cream/30 hidden sm:inline truncate">
                              {subtitle}
                            </span>
                          </div>
                          <span
                            className="font-fraunces font-bold text-xs sm:text-sm tabular-nums flex-shrink-0"
                            style={{
                              color: medalColor ?? "rgba(253,251,247,0.45)",
                            }}
                          >
                            {entry.horas}h
                          </span>
                        </div>
                        <div
                          className="h-1 rounded-full overflow-hidden"
                          style={{ background: "rgba(253,251,247,0.05)" }}
                        >
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${barWidth}%` }}
                            transition={{
                              delay: 0.2 + i * 0.06,
                              duration: 0.5,
                              ease: [0.22, 1, 0.36, 1],
                            }}
                            className="h-full rounded-full"
                            style={{
                              background: medalColor
                                ? `linear-gradient(90deg, ${medalColor}66, ${medalColor})`
                                : "rgba(253,251,247,0.2)",
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
