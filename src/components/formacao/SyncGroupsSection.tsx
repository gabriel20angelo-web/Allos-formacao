"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Radio, Clock, Video, ChevronRight, MessageCircle, X, Trophy, ExternalLink, CalendarDays } from "lucide-react";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"] as const;

interface Slot {
  id: string;
  dia_semana: number;
  horario_id: string;
  ativo: boolean;
  status: string;
  atividade_nome: string | null;
  meet_link: string | null;
  formacao_horarios: { hora: string; ordem: number } | null;
}

interface AtividadeInfo {
  id: string;
  nome: string;
  descricao: string | null;
}

interface Evento {
  id: string;
  titulo: string;
  descricao: string | null;
  link: string | null;
  data_inicio: string;
  data_fim: string;
  ativo: boolean;
}

interface ScheduleItem {
  id: string;
  dia: string;
  diaIndex: number;
  hora: string;
  horaMinutos: number;
  atividade: string;
  descricao: string | null;
  meetLink: string | null;
  status: string;
}

function InfoIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 7v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="5" r="0.75" fill="currentColor" />
    </svg>
  );
}

function getNowMinutes() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getTodayIndex() {
  const day = new Date().getDay();
  return day === 0 || day === 6 ? -1 : day - 1;
}

export default function SyncGroupsSection() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [atividades, setAtividades] = useState<AtividadeInfo[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [duracao, setDuracao] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);
  const [todayIndex, setTodayIndex] = useState(getTodayIndex);
  const [descModal, setDescModal] = useState<{ atividade: string; descricao: string } | null>(null);

  // Ranking
  type RankingPeriod = "week" | "month" | "quarter" | "semester" | "year";
  type RankingType = "all" | "sync" | "async";
  const RANKING_LABELS: Record<RankingPeriod, string> = { week: "Semana", month: "Mês", quarter: "Trimestre", semester: "Semestre", year: "Ano" };
  const RANKING_TYPE_LABELS: Record<RankingType, string> = { all: "Geral", sync: "Síncronos", async: "Assíncronos" };
  const [rankingPeriod, setRankingPeriod] = useState<RankingPeriod>("week");
  const [rankingType, setRankingType] = useState<RankingType>("all");
  const [rankingData, setRankingData] = useState<{ nome: string; horas: number; count: number }[]>([]);

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMinutes(getNowMinutes());
      setTodayIndex(getTodayIndex());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchSchedule() {
      try {
        const client = (await import("@/lib/supabase/client")).createClient();

        const [slotsRes, atividadesRes, eventosRes, cfgRes] = await Promise.all([
          client
            .from("formacao_slots")
            .select("*, formacao_horarios(hora, ordem)")
            .eq("ativo", true),
          client
            .from("certificado_atividades")
            .select("id, nome, descricao")
            .eq("ativo", true),
          client
            .from("certificado_eventos")
            .select("*")
            .eq("ativo", true)
            .gte("data_fim", new Date().toISOString())
            .order("data_inicio"),
          client
            .from("formacao_cronograma")
            .select("grupos_visiveis, duracao_minutos")
            .limit(1)
            .single(),
        ]);

        if (slotsRes.data) setSlots(slotsRes.data as unknown as Slot[]);
        if (atividadesRes.data) setAtividades(atividadesRes.data);
        if (eventosRes.data) setEventos(eventosRes.data);
        if (cfgRes.data) {
          setVisivel(cfgRes.data.grupos_visiveis !== false);
          if (cfgRes.data.duracao_minutos) setDuracao(cfgRes.data.duracao_minutos);
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

  useEffect(() => {
    fetch(`/formacao/api/ranking?period=${rankingPeriod}&type=${rankingType}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setRankingData(d); })
      .catch(() => setRankingData([]));
  }, [rankingPeriod, rankingType]);

  const schedule = useMemo(() => {
    const items: ScheduleItem[] = [];

    slots
      .filter((s) => s.ativo && s.atividade_nome && s.status !== "desmarcado" && s.status !== "cancelado")
      .forEach((slot) => {
        const hora = slot.formacao_horarios?.hora || "";
        const [h, m] = hora.split(":").map(Number);
        const atividadeInfo = atividades.find((a) => a.nome === slot.atividade_nome);

        items.push({
          id: slot.id,
          dia: DIAS[slot.dia_semana],
          diaIndex: slot.dia_semana,
          hora,
          horaMinutos: h * 60 + (m || 0),
          atividade: slot.atividade_nome!,
          descricao: atividadeInfo?.descricao || null,
          meetLink: slot.meet_link,
          status: slot.status,
        });
      });

    items.sort((a, b) => {
      if (a.diaIndex !== b.diaIndex) return a.diaIndex - b.diaIndex;
      return a.horaMinutos - b.horaMinutos;
    });

    return items;
  }, [slots, atividades]);

  const isLive = useCallback((item: ScheduleItem) => {
    return item.diaIndex === todayIndex && nowMinutes >= item.horaMinutos && nowMinutes < item.horaMinutos + duracao;
  }, [todayIndex, nowMinutes, duracao]);

  const isNext = useCallback((item: ScheduleItem) => {
    if (item.diaIndex !== todayIndex) return false;
    const diff = item.horaMinutos - nowMinutes;
    return diff > 0 && diff <= 120;
  }, [todayIndex, nowMinutes]);

  const liveOrNext = useMemo(
    () => schedule.filter((s) => isLive(s) || isNext(s)),
    [schedule, isLive, isNext]
  );

  const scheduleByDay = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    schedule.forEach((item) => {
      const list = map.get(item.dia) || [];
      list.push(item);
      map.set(item.dia, list);
    });
    return map;
  }, [schedule]);

  // Active/upcoming events
  const activeEventos = useMemo(() => {
    const now = new Date();
    return eventos.filter(e => e.ativo && new Date(e.data_fim) >= now);
  }, [eventos]);

  if (loading || error || !visivel) return null;

  const hasSchedule = schedule.length > 0;
  const hasRanking = rankingData.length > 0;
  const hasEvents = activeEventos.length > 0;

  if (!hasSchedule && !hasRanking && !hasEvents) return null;

  return (
    <section
      ref={ref}
      className="relative py-16 sm:py-20 md:py-24 px-5 sm:px-6 md:px-10"
      style={{
        background: "radial-gradient(ellipse at 50% 20%,rgba(46,158,143,.06) 0%,transparent 60%)",
      }}
    >
      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        {hasSchedule && (
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="font-dm font-semibold text-xs tracking-[.22em] text-[#2E9E8F] uppercase mb-3"
          >
            Grupos Sincronos
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-fraunces font-bold text-[#FDFBF7] mb-3"
            style={{ fontSize: "clamp(24px,3vw,36px)" }}
          >
            Aprendizado ao vivo
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.6 }}
            className="font-dm text-sm max-w-xl mx-auto"
            style={{ color: "rgba(253,251,247,0.45)" }}
          >
            Participe dos nossos grupos de formacao ao vivo. Cada sessao e conduzida por facilitadores experientes.
          </motion.p>
        </div>
        )}

        {/* Events banner */}
        {hasEvents && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-6 space-y-3"
          >
            {activeEventos.map((evento) => {
              const inicio = new Date(evento.data_inicio);
              const fim = new Date(evento.data_fim);
              const isHappening = new Date() >= inicio && new Date() <= fim;
              const diaStr = inicio.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
              const horaStr = inicio.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

              return (
                <div
                  key={evento.id}
                  className="rounded-2xl px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3"
                  style={{
                    background: isHappening
                      ? "linear-gradient(135deg, rgba(200,75,49,0.08), rgba(200,75,49,0.02))"
                      : "rgba(253,251,247,0.02)",
                    border: `1px solid ${isHappening ? "rgba(200,75,49,0.15)" : "rgba(253,251,247,0.06)"}`,
                  }}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 rounded-lg" style={{ background: isHappening ? "rgba(200,75,49,0.1)" : "rgba(253,251,247,0.04)" }}>
                      <CalendarDays size={16} style={{ color: isHappening ? "#C84B31" : "rgba(253,251,247,0.3)" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-dm text-sm font-semibold text-[#FDFBF7] truncate">{evento.titulo}</p>
                        {isHappening && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(200,75,49,0.12)", color: "#C84B31" }}>
                            <Radio size={8} className="animate-pulse" /> Agora
                          </span>
                        )}
                      </div>
                      <p className="font-dm text-[11px]" style={{ color: "rgba(253,251,247,0.4)" }}>
                        {diaStr} as {horaStr}
                        {evento.descricao && ` — ${evento.descricao}`}
                      </p>
                    </div>
                  </div>
                  {evento.link && (
                    <a
                      href={evento.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-dm text-xs font-semibold px-4 py-2 rounded-xl flex items-center gap-1.5 transition-all hover:-translate-y-0.5 flex-shrink-0"
                      style={{
                        background: isHappening ? "rgba(200,75,49,0.12)" : "rgba(253,251,247,0.04)",
                        color: isHappening ? "#C84B31" : "rgba(253,251,247,0.5)",
                        border: `1px solid ${isHappening ? "rgba(200,75,49,0.2)" : "rgba(253,251,247,0.08)"}`,
                      }}
                    >
                      <ExternalLink size={12} />
                      {isHappening ? "Assistir agora" : "Acessar"}
                    </a>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Live/Upcoming banner */}
        {liveOrNext.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="mb-4 space-y-2"
          >
            {liveOrNext.map((item) => {
              const live = isLive(item);
              return (
                <div
                  key={item.id + "-banner"}
                  className="rounded-2xl px-5 py-4 flex items-center gap-3"
                  style={{
                    background: live
                      ? "linear-gradient(135deg,rgba(34,197,94,0.06),rgba(34,197,94,0.01))"
                      : "rgba(253,251,247,0.015)",
                    border: `1px solid ${live ? "rgba(34,197,94,0.12)" : "rgba(253,251,247,0.06)"}`,
                  }}
                >
                  {live && <Radio size={14} className="animate-pulse flex-shrink-0" style={{ color: "#22c55e" }} />}
                  {!live && <Clock size={14} style={{ color: "rgba(253,251,247,0.25)" }} className="flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="font-dm text-sm font-semibold" style={{ color: live ? "#22c55e" : "rgba(253,251,247,0.6)" }}>
                      {live ? "Ao vivo agora" : `Em breve — ${item.hora}`}
                    </p>
                    <p className="font-dm text-xs truncate" style={{ color: "rgba(253,251,247,0.35)" }}>
                      {item.atividade}
                    </p>
                  </div>
                  {live && item.meetLink && (
                    <a
                      href={item.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-dm text-xs font-bold flex items-center gap-1 transition-all hover:gap-2 flex-shrink-0"
                      style={{ color: "#22c55e" }}
                    >
                      <Video size={14} /> Entrar <ChevronRight size={12} />
                    </a>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Weekly schedule grid */}
        {hasSchedule && <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(253,251,247,0.06)", background: "rgba(253,251,247,0.015)" }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {DIAS.map((dia, diaIdx) => {
              const items = scheduleByDay.get(dia) || [];
              const isCurrentDay = todayIndex === diaIdx;
              return (
                <div key={dia} className="p-4"
                  style={{
                    borderRight: diaIdx < 4 ? "1px solid rgba(253,251,247,0.04)" : "none",
                    borderBottom: "1px solid rgba(253,251,247,0.04)",
                    background: isCurrentDay ? "rgba(200,75,49,0.03)" : "transparent",
                  }}>
                  <p className="font-dm text-[10px] font-bold uppercase tracking-wider mb-3"
                    style={{ color: isCurrentDay ? "#C84B31" : "rgba(253,251,247,0.3)" }}>
                    {dia}
                    {isCurrentDay && (
                      <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full normal-case tracking-normal font-medium"
                        style={{ backgroundColor: "rgba(200,75,49,0.1)", color: "#C84B31" }}>hoje</span>
                    )}
                  </p>
                  {items.length > 0 ? (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const live = isLive(item);
                        return (
                          <div key={item.id}>
                            <button
                              onClick={() => item.descricao && setDescModal({ atividade: item.atividade, descricao: item.descricao })}
                              className="w-full text-left rounded-lg p-2.5 transition-all"
                              style={{
                                background: live ? "rgba(34,197,94,0.06)" : "rgba(253,251,247,0.02)",
                                border: `1px solid ${live ? "rgba(34,197,94,0.12)" : "rgba(253,251,247,0.05)"}`,
                                cursor: item.descricao ? "pointer" : "default",
                              }}>
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-dm text-[11px] font-bold" style={{ color: "#C84B31" }}>{item.hora}</span>
                                {live && <Radio size={10} style={{ color: "#22c55e" }} className="animate-pulse" />}
                                {item.descricao && (
                                  <span className="ml-auto" style={{ color: "rgba(253,251,247,0.2)" }}><InfoIcon size={11} /></span>
                                )}
                              </div>
                              <p className="font-dm text-xs font-medium" style={{ color: "rgba(253,251,247,0.65)" }}>{item.atividade}</p>
                              {item.meetLink && live && (
                                <a href={item.meetLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  className="font-dm text-[10px] font-bold mt-1.5 flex items-center gap-1 transition-all hover:gap-2" style={{ color: "#22c55e" }}>
                                  <Video size={10} /> Assistir agora <ChevronRight size={10} />
                                </a>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-dm text-[11px]" style={{ color: "rgba(253,251,247,0.12)" }}>Sem grupo</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Bottom bar: WhatsApp + Google inline */}
          <div className="flex flex-col sm:flex-row items-center gap-3 px-5 py-4" style={{ borderTop: "1px solid rgba(253,251,247,0.06)" }}>
            <a href="https://chat.whatsapp.com/JpZtYWJovU03VlrZJ5oUxQ" target="_blank" rel="noopener noreferrer"
              className="font-dm text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "rgba(37,211,102,0.1)", color: "#25D366", border: "1px solid rgba(37,211,102,0.15)" }}>
              <MessageCircle size={14} />
              Grupo WhatsApp
            </a>
            <a href="https://search.google.com/local/writereview?placeid=ChIJRU1omzaXpgARA4UFQLEIq4g" target="_blank" rel="noopener noreferrer"
              className="font-dm text-xs font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5"
              style={{ backgroundColor: "rgba(253,251,247,0.03)", color: "rgba(253,251,247,0.5)", border: "1px solid rgba(253,251,247,0.06)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Avaliar no Google
            </a>
          </div>
        </motion.div>}

        {/* Description modal */}
        <AnimatePresence>
          {descModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center px-4"
              style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
              onClick={() => setDescModal(null)}
            >
              <motion.div
                initial={{ scale: 0.92, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 10 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                className="rounded-2xl p-6 max-w-md w-full"
                style={{ background: "#161616", border: "1px solid rgba(253,251,247,0.08)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="font-dm text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "#C84B31" }}>
                      Sobre o grupo
                    </p>
                    <h3 className="font-fraunces font-bold text-lg text-[#FDFBF7]">
                      {descModal.atividade}
                    </h3>
                  </div>
                  <button
                    onClick={() => setDescModal(null)}
                    className="p-1 rounded-lg transition-colors hover:bg-white/5 flex-shrink-0"
                    style={{ color: "rgba(253,251,247,0.3)" }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: "60vh" }}>
                  <p className="font-dm text-sm leading-relaxed" style={{ color: "rgba(253,251,247,0.55)" }}>
                    {descModal.descricao}
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Ranking */}
        {rankingData.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-4 rounded-2xl overflow-hidden"
            style={{ border: "1px solid rgba(253,251,247,0.06)", background: "rgba(253,251,247,0.015)" }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-5 py-3" style={{ borderBottom: "1px solid rgba(253,251,247,0.04)" }}>
              <div className="flex items-center gap-1.5">
                <Trophy size={13} style={{ color: "#C84B31" }} />
                <span className="font-dm text-[11px] font-semibold" style={{ color: "rgba(253,251,247,0.5)" }}>Top participantes</span>
              </div>
              <div className="flex gap-1 sm:ml-auto flex-wrap">
                {(Object.keys(RANKING_TYPE_LABELS) as RankingType[]).map(t => (
                  <button key={t} onClick={() => setRankingType(t)}
                    className="font-dm text-[9px] px-2 py-0.5 rounded-full transition-all"
                    style={{
                      backgroundColor: rankingType === t ? "rgba(46,158,143,0.12)" : "transparent",
                      color: rankingType === t ? "#2E9E8F" : "rgba(253,251,247,0.2)",
                    }}>
                    {RANKING_TYPE_LABELS[t]}
                  </button>
                ))}
                <span className="w-px h-3 self-center mx-0.5" style={{ background: "rgba(253,251,247,0.08)" }} />
                {(Object.keys(RANKING_LABELS) as RankingPeriod[]).map(p => (
                  <button key={p} onClick={() => setRankingPeriod(p)}
                    className="font-dm text-[9px] px-2 py-0.5 rounded-full transition-all"
                    style={{
                      backgroundColor: rankingPeriod === p ? "rgba(200,75,49,0.1)" : "transparent",
                      color: rankingPeriod === p ? "#C84B31" : "rgba(253,251,247,0.25)",
                    }}>
                    {RANKING_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5">
              {rankingData.map((entry, i) => {
                const medals = ["#C84B31", "rgba(253,251,247,0.5)", "rgba(200,75,49,0.6)"];
                const isMedal = i < 3;
                return (
                  <div key={entry.nome} className="flex items-center gap-2 px-5 py-2.5 sm:flex-col sm:text-center sm:py-4 sm:gap-1"
                    style={{ borderRight: i < rankingData.length - 1 ? "1px solid rgba(253,251,247,0.04)" : "none" }}>
                    <span className="font-fraunces font-bold text-lg sm:text-xl" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.15)" }}>{i + 1}</span>
                    <span className="font-dm text-[11px] flex-1 truncate sm:flex-none" style={{ color: "rgba(253,251,247,0.6)" }}>{entry.nome.split(" ").slice(0, 2).join(" ")}</span>
                    <span className="font-dm text-[11px] font-bold" style={{ color: isMedal ? medals[i] : "rgba(253,251,247,0.2)" }}>{entry.horas}h</span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
