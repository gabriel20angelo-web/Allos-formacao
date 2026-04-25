"use client";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Award, ArrowRight, Trophy, Crown, Medal } from "lucide-react";

const MEDAL_COLORS = ["#FFD700", "#C0C0C0", "#CD7F32"]; // ouro, prata, bronze
const MEDAL_BGS = [
  "linear-gradient(90deg, rgba(255,215,0,0.10) 0%, rgba(212,175,55,0.02) 100%)",
  "linear-gradient(90deg, rgba(192,192,192,0.08) 0%, rgba(160,160,160,0.02) 100%)",
  "linear-gradient(90deg, rgba(205,127,50,0.08) 0%, rgba(165,100,40,0.02) 100%)",
];

function rankInitial(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts[0]?.[0] || "?").toUpperCase();
}

function rankNameToColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = name.charCodeAt(i) + ((h << 5) - h);
  }
  return `hsl(${Math.abs(h) % 360}, 45%, 48%)`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

function MovingGradient() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobile = useIsMobile();
  const prefersReduced = useReducedMotion();

  useEffect(() => {
    if (prefersReduced) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let t = 0;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const allOrbs = [
      { x: 0.12, y: 0.25, r: 0.6, speed: 0.0004, phase: 0, color: "rgba(200,75,49," },
      { x: 0.8, y: 0.65, r: 0.5, speed: 0.0003, phase: 2.1, color: "rgba(200,75,49," },
      { x: 0.5, y: 0.1, r: 0.4, speed: 0.0005, phase: 1.2, color: "rgba(163,61,39," },
      { x: 0.35, y: 0.8, r: 0.3, speed: 0.00035, phase: 3.5, color: "rgba(46,158,143," },
    ];
    const orbs = isMobile ? allOrbs.slice(0, 2) : allOrbs;

    const frameSkip = isMobile ? 2 : 1;
    let frameCount = 0;

    const draw = () => {
      frameCount++;
      if (frameCount % frameSkip !== 0) {
        raf = requestAnimationFrame(draw);
        return;
      }

      t += 1;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      orbs.forEach((orb) => {
        const px = (orb.x + Math.sin(t * orb.speed + orb.phase) * 0.18) * canvas.width;
        const py = (orb.y + Math.cos(t * orb.speed * 1.3 + orb.phase) * 0.14) * canvas.height;
        const rad = orb.r * Math.min(canvas.width, canvas.height);

        const g = ctx.createRadialGradient(px, py, 0, px, py, rad);
        g.addColorStop(0, orb.color + "0.18)");
        g.addColorStop(0.4, orb.color + "0.08)");
        g.addColorStop(1, orb.color + "0)");

        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, rad, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [isMobile, prefersReduced]);

  if (prefersReduced) {
    return (
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 30% 40%, rgba(200,75,49,0.12) 0%, transparent 60%), radial-gradient(ellipse at 70% 60%, rgba(46,158,143,0.08) 0%, transparent 50%)",
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 1 }}
    />
  );
}

interface RankingEntry { nome: string; horas: number; count: number }
type RankTab = "participantes" | "curseiros";
type RankPeriod = "week" | "month" | "quarter" | "semester" | "year";
const RANK_PERIOD_LABELS: Record<RankPeriod, string> = { week: "Semana", month: "Mês", quarter: "Tri", semester: "Sem", year: "Ano" };

export default function HeroFormacao() {
  const r = useReducedMotion();
  const [ranking, setRanking] = useState<RankingEntry[]>([]);
  const [rankTab, setRankTab] = useState<RankTab>("participantes");
  const [rankPeriod, setRankPeriod] = useState<RankPeriod>("month");
  const [rankLoading, setRankLoading] = useState(false);

  useEffect(() => {
    setRankLoading(true);
    // "Participantes" = quem aparece via /certificado (eventos síncronos).
    // "Curseiros" = quem completa lições de cursos assíncronos (lesson_progress).
    const type = rankTab === "participantes" ? "sync" : "async";
    fetch(`/formacao/api/ranking?period=${rankPeriod}&type=${type}&_t=${Date.now()}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRanking(d.slice(0, 5)); else setRanking([]); })
      .catch(() => setRanking([]))
      .finally(() => setRankLoading(false));
  }, [rankTab, rankPeriod]);
  const up = (d: number) => ({
    initial: { opacity: 0, y: r ? 0 : 24 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: d, duration: 0.75, ease: [0.22, 1, 0.36, 1] },
  });

  return (
    <section
      className="relative overflow-hidden flex items-center"
      style={{ background: "rgba(13,13,13,0.7)", minHeight: "min(45vh, 420px)" }}
    >
      {/* Grain */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[.05] z-0"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      <MovingGradient />

      <div className="relative z-10 w-full max-w-[1200px] mx-auto px-5 sm:px-6 md:px-8 py-12 sm:py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10 lg:gap-16 items-center">
          {/* Left — text (3 cols) */}
          <div className="lg:col-span-3">
            {/* Tag */}
            <motion.div
              {...up(0.1)}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-7"
              style={{
                background: "rgba(200,75,49,0.1)",
                border: "1px solid rgba(200,75,49,0.2)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-[#C84B31] animate-pulse" />
              <span className="font-dm text-xs font-semibold tracking-wider uppercase text-[#C84B31]">
                Cursos
              </span>
            </motion.div>

            {/* Title */}
            <motion.h1
              {...up(0.2)}
              className="font-fraunces font-bold leading-[1.05] mb-6 tracking-tight"
              style={{ fontSize: "clamp(36px, 5.5vw, 72px)" }}
            >
              <span className="text-[#FDFBF7]">Transformando </span>
              <span className="italic text-[#C84B31]">talentos</span>
              <span className="text-[#FDFBF7]"> em </span>
              <span className="italic text-[#C84B31]">legado</span>
            </motion.h1>

            {/* Subtitle */}
            <motion.p
              {...up(0.35)}
              className="font-dm leading-relaxed max-w-[540px] mb-10"
              style={{ fontSize: "clamp(15px,1.6vw,17px)", color: "rgba(253,251,247,0.6)" }}
            >
              Do manejo clínico à presença terapêutica. Cursos gravados, encontros síncronos e formação contínua para quem quer ir além do protocolo.
            </motion.p>

            {/* CTAs */}
            <motion.div {...up(0.5)} className="flex flex-wrap gap-4">
              <motion.a
                href="#cursos"
                whileHover={{ scale: 1.04, boxShadow: "0 10px 36px rgba(200,75,49,.35)" }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2.5 font-dm font-semibold text-white bg-[#C84B31] rounded-full hover:bg-[#A33D27] transition-colors"
                style={{ padding: "14px 32px", fontSize: "15px", boxShadow: "0 4px 20px rgba(200,75,49,.25)" }}
              >
                Ver cursos
                <ArrowRight size={16} />
              </motion.a>
            </motion.div>
          </div>

          {/* Right — certificate highlight (2 cols) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-2"
          >
            <div
              className="rounded-2xl p-6 sm:p-8 relative overflow-hidden"
              style={{
                background: "rgba(46,158,143,0.04)",
                border: "1px solid rgba(46,158,143,0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                style={{
                  background: "rgba(46,158,143,0.12)",
                  border: "1px solid rgba(46,158,143,0.25)",
                }}
              >
                <Award className="h-5 w-5" style={{ color: "#2E9E8F" }} />
              </div>
              <h3 className="font-fraunces font-bold text-lg text-[#FDFBF7] mb-2">
                Certificação digital
              </h3>
              <p className="font-dm text-sm leading-relaxed" style={{ color: "rgba(253,251,247,0.5)" }}>
                Conclua seus cursos e emita certificados digitais da Associação Allos. Cada hora de estudo conta para a sua formação.
              </p>

              {/* Decorative line */}
              <div
                className="absolute top-0 right-0 w-32 h-32 pointer-events-none"
                style={{
                  background: "radial-gradient(circle at 100% 0%, rgba(46,158,143,0.08) 0%, transparent 70%)",
                }}
              />
            </div>

            {/* Ranking card */}
            <div
              className="rounded-2xl p-4 sm:p-5 mt-3 relative overflow-hidden"
              style={{
                background:
                  "linear-gradient(180deg, rgba(253,251,247,0.025) 0%, rgba(253,251,247,0.005) 100%)",
                border: "1px solid rgba(253,251,247,0.06)",
                backdropFilter: "blur(12px)",
                boxShadow: "0 6px 24px rgba(0,0,0,0.18)",
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

              {/* Header row: title + tabs */}
              <div className="flex items-center gap-2 mb-2.5">
                <div
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,215,0,0.16), rgba(212,175,55,0.06))",
                    border: "1px solid rgba(212,175,55,0.22)",
                  }}
                >
                  <Trophy className="h-2.5 w-2.5" style={{ color: "#FBBC05" }} />
                </div>
                <h4 className="font-fraunces font-bold text-[11px] text-cream/80 tracking-tight">
                  Top do período
                </h4>
              </div>

              {/* Tabs + period */}
              <div className="flex flex-wrap items-center gap-1.5 mb-3">
                {(["participantes", "curseiros"] as RankTab[]).map((t) => {
                  const active = rankTab === t;
                  return (
                    <button
                      key={t}
                      onClick={() => setRankTab(t)}
                      className="font-dm text-[10px] font-semibold px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                      style={{
                        background: active
                          ? "rgba(200,75,49,0.12)"
                          : "rgba(255,255,255,0.02)",
                        color: active ? "#C84B31" : "rgba(253,251,247,0.4)",
                        border: `1px solid ${
                          active
                            ? "rgba(200,75,49,0.28)"
                            : "rgba(255,255,255,0.05)"
                        }`,
                      }}
                    >
                      {t === "participantes" ? <Trophy size={9} /> : <Award size={9} />}
                      {t === "participantes" ? "Participantes" : "Curseiros"}
                    </button>
                  );
                })}
                <span className="w-px h-3 mx-0.5" style={{ background: "rgba(253,251,247,0.06)" }} />
                {(Object.keys(RANK_PERIOD_LABELS) as RankPeriod[]).map((p) => {
                  const active = rankPeriod === p;
                  return (
                    <button
                      key={p}
                      onClick={() => setRankPeriod(p)}
                      className="font-dm text-[9px] px-1.5 py-0.5 rounded-full transition-all"
                      style={{
                        background: active
                          ? "rgba(46,158,143,0.14)"
                          : "transparent",
                        color: active ? "#2E9E8F" : "rgba(253,251,247,0.25)",
                        border: `1px solid ${
                          active ? "rgba(46,158,143,0.22)" : "transparent"
                        }`,
                      }}
                    >
                      {RANK_PERIOD_LABELS[p]}
                    </button>
                  );
                })}
              </div>

              {/* Content */}
              {rankLoading ? (
                <div className="space-y-2 py-1">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full animate-pulse" style={{ background: "rgba(253,251,247,0.05)" }} />
                      <div className="h-5 w-5 rounded-full animate-pulse" style={{ background: "rgba(253,251,247,0.05)" }} />
                      <div className="h-2 flex-1 rounded animate-pulse" style={{ background: "rgba(253,251,247,0.05)" }} />
                    </div>
                  ))}
                </div>
              ) : ranking.length === 0 ? (
                <div className="flex flex-col items-center py-4 gap-1.5">
                  <Medal className="h-4 w-4 text-cream/15" />
                  <p className="font-dm text-[10px] text-cream/30">Nenhum dado no período.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {(() => {
                    const maxHoras = Math.max(...ranking.map((e) => e.horas), 1);
                    return ranking.map((entry, i) => {
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
                      const initial = rankInitial(entry.nome);
                      const initialBg = rankNameToColor(entry.nome);

                      return (
                        <div
                          key={entry.nome + i}
                          className="flex items-center gap-2 px-1.5 py-1 rounded-md"
                          style={medalBg ? { background: medalBg } : undefined}
                        >
                          {/* Rank badge */}
                          <div
                            className="relative w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{
                              background: isMedal
                                ? "rgba(0,0,0,0.28)"
                                : "rgba(255,255,255,0.025)",
                              border: `1px solid ${
                                medalColor ? `${medalColor}55` : "rgba(255,255,255,0.05)"
                              }`,
                            }}
                          >
                            {i === 0 && medalColor ? (
                              <Crown className="h-2.5 w-2.5" style={{ color: medalColor }} />
                            ) : (
                              <span
                                className="font-fraunces font-bold text-[10px]"
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
                            className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 font-dm font-bold text-[9px] text-white/95"
                            style={{ background: initialBg }}
                          >
                            {initial}
                          </div>

                          {/* Name + bar + value */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2 mb-0.5">
                              <span
                                className="font-dm text-[11px] font-medium truncate"
                                style={{ color: "rgba(253,251,247,0.78)" }}
                              >
                                {entry.nome.split(" ").slice(0, 2).join(" ")}
                              </span>
                              <span
                                className="font-fraunces font-bold text-[11px] tabular-nums flex-shrink-0"
                                style={{
                                  color: medalColor ?? "rgba(253,251,247,0.42)",
                                }}
                              >
                                {entry.horas}h
                              </span>
                            </div>
                            <div
                              className="h-[3px] rounded-full overflow-hidden"
                              style={{ background: "rgba(253,251,247,0.05)" }}
                            >
                              <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                  width: `${barWidth}%`,
                                  background: medalColor
                                    ? `linear-gradient(90deg, ${medalColor}66, ${medalColor})`
                                    : "rgba(253,251,247,0.18)",
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom fade */}
      <div
        className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none z-10"
        style={{ background: "linear-gradient(to bottom,transparent,#111111)" }}
      />
    </section>
  );
}
