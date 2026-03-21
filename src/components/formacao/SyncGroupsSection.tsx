"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useInView } from "react-intersection-observer";
import { Radio, Clock, Video, ChevronRight, MessageCircle, X } from "lucide-react";

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
  const [duracao, setDuracao] = useState(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [visivel, setVisivel] = useState(true);
  const [nowMinutes, setNowMinutes] = useState(getNowMinutes);
  const [todayIndex, setTodayIndex] = useState(getTodayIndex);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 });

  // Tick every 60s to keep live status in sync
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
        const res = await fetch("/api/sync-groups");
        if (!res.ok) throw new Error("Failed to fetch");
        const data = await res.json();
        if (data.visivel === false) { setVisivel(false); return; }
        if (data.slots) setSlots(data.slots);
        if (data.atividades) setAtividades(data.atividades);
        if (data.duracao_minutos) setDuracao(data.duracao_minutos);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    fetchSchedule();
  }, []);

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

  if (loading || error || !visivel || schedule.length === 0) return null;

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
        <div className="text-center mb-10">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="font-dm font-semibold text-xs tracking-[.22em] text-[#2E9E8F] uppercase mb-3"
          >
            Grupos Síncronos
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.08, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="font-fraunces font-bold text-[#FDFBF7] mb-3"
            style={{ fontSize: "clamp(24px,3vw,36px)" }}
          >
            Aprendizado <span className="italic text-[#2E9E8F]">ao vivo</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={inView ? { opacity: 1 } : {}}
            transition={{ delay: 0.16, duration: 0.5 }}
            className="font-dm max-w-lg mx-auto"
            style={{ fontSize: "15px", color: "rgba(253,251,247,0.5)" }}
          >
            Participe dos nossos grupos síncronos semanais conduzidos por
            profissionais da Allos. Encontros ao vivo para aprofundar a prática.
          </motion.p>
        </div>

        {/* Live / Upcoming banner */}
        {liveOrNext.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-8 space-y-3"
          >
            {liveOrNext.map((item) => {
              const live = isLive(item);
              return (
                <div
                  key={item.id}
                  className="rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4"
                  style={{
                    background: live
                      ? "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(46,158,143,0.08))"
                      : "rgba(253,251,247,0.02)",
                    border: `1px solid ${live ? "rgba(34,197,94,0.2)" : "rgba(253,251,247,0.06)"}`,
                  }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: live ? "rgba(34,197,94,0.15)" : "rgba(46,158,143,0.1)",
                        border: `1px solid ${live ? "rgba(34,197,94,0.3)" : "rgba(46,158,143,0.2)"}`,
                      }}
                    >
                      {live ? (
                        <Radio size={18} style={{ color: "#22c55e" }} className="animate-pulse" />
                      ) : (
                        <Clock size={18} style={{ color: "#2E9E8F" }} />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="font-dm text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: live ? "rgba(34,197,94,0.15)" : "rgba(46,158,143,0.1)",
                            color: live ? "#22c55e" : "#2E9E8F",
                          }}
                        >
                          {live ? "Ao vivo agora" : "Em breve"}
                        </span>
                        <span className="font-fraunces font-bold text-sm" style={{ color: "#FDFBF7" }}>
                          {item.atividade}
                        </span>
                      </div>
                      <p className="font-dm text-xs mt-0.5" style={{ color: "rgba(253,251,247,0.4)" }}>
                        {item.dia} as {item.hora}
                      </p>
                    </div>
                  </div>

                  {item.meetLink && (
                    <a
                      href={item.meetLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-dm text-sm font-bold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5 flex-shrink-0"
                      style={{
                        backgroundColor: live ? "#22c55e" : "#2E9E8F",
                        color: "#fff",
                        boxShadow: live ? "0 4px 20px rgba(34,197,94,0.3)" : "0 4px 20px rgba(46,158,143,0.25)",
                      }}
                    >
                      <Video size={16} /> Clique aqui para assistir
                    </a>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Weekly schedule grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="rounded-2xl overflow-hidden mb-8"
          style={{
            border: "1px solid rgba(253,251,247,0.06)",
            background: "rgba(253,251,247,0.015)",
          }}
        >
          <div className="p-5 flex items-center gap-2" style={{ borderBottom: "1px solid rgba(253,251,247,0.06)" }}>
            <Clock size={16} style={{ color: "#2E9E8F" }} />
            <h3 className="font-fraunces font-bold text-sm" style={{ color: "rgba(253,251,247,0.8)" }}>
              Cronograma Semanal
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {DIAS.map((dia, diaIdx) => {
              const items = scheduleByDay.get(dia) || [];
              const isCurrentDay = todayIndex === diaIdx;

              return (
                <div
                  key={dia}
                  className="p-4"
                  style={{
                    borderRight: diaIdx < 4 ? "1px solid rgba(253,251,247,0.04)" : "none",
                    borderBottom: "1px solid rgba(253,251,247,0.04)",
                    background: isCurrentDay ? "rgba(46,158,143,0.04)" : "transparent",
                  }}
                >
                  <p
                    className="font-dm text-xs font-bold uppercase tracking-wider mb-3"
                    style={{ color: isCurrentDay ? "#2E9E8F" : "rgba(253,251,247,0.35)" }}
                  >
                    {dia}
                    {isCurrentDay && (
                      <span
                        className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full normal-case tracking-normal font-medium"
                        style={{ backgroundColor: "rgba(46,158,143,0.15)", color: "#2E9E8F" }}
                      >
                        hoje
                      </span>
                    )}
                  </p>

                  {items.length > 0 ? (
                    <div className="space-y-2">
                      {items.map((item) => {
                        const live = isLive(item);
                        const isExpanded = expandedId === item.id;

                        return (
                          <div key={item.id}>
                            <button
                              onClick={() => item.descricao && setExpandedId(isExpanded ? null : item.id)}
                              className="w-full text-left rounded-lg p-2.5 transition-all"
                              style={{
                                background: live
                                  ? "rgba(34,197,94,0.08)"
                                  : isExpanded
                                  ? "rgba(253,251,247,0.04)"
                                  : "rgba(253,251,247,0.02)",
                                border: `1px solid ${live ? "rgba(34,197,94,0.15)" : isExpanded ? "rgba(253,251,247,0.1)" : "rgba(253,251,247,0.05)"}`,
                                cursor: item.descricao ? "pointer" : "default",
                              }}
                            >
                              <div className="flex items-center gap-1.5 mb-1">
                                <span className="font-dm text-[11px] font-bold" style={{ color: "#C84B31" }}>
                                  {item.hora}
                                </span>
                                {live && (
                                  <Radio size={10} style={{ color: "#22c55e" }} className="animate-pulse" />
                                )}
                                {item.descricao && (
                                  <span
                                    className="ml-auto transition-colors"
                                    style={{ color: isExpanded ? "#2E9E8F" : "rgba(253,251,247,0.15)" }}
                                  >
                                    <InfoIcon size={12} />
                                  </span>
                                )}
                              </div>
                              <p className="font-dm text-xs font-medium" style={{ color: "rgba(253,251,247,0.7)" }}>
                                {item.atividade}
                              </p>
                              {item.meetLink && live && (
                                <a
                                  href={item.meetLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="font-dm text-[10px] font-bold mt-1.5 flex items-center gap-1 transition-all hover:gap-2"
                                  style={{ color: "#22c55e" }}
                                >
                                  <Video size={10} /> Assistir agora
                                  <ChevronRight size={10} />
                                </a>
                              )}
                            </button>

                            {/* Description expandable */}
                            <AnimatePresence>
                              {isExpanded && item.descricao && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                                  className="overflow-hidden"
                                >
                                  <div
                                    className="px-2.5 pb-2.5 pt-1.5 rounded-b-lg -mt-0.5"
                                    style={{
                                      background: "rgba(253,251,247,0.03)",
                                      borderLeft: "1px solid rgba(253,251,247,0.08)",
                                      borderRight: "1px solid rgba(253,251,247,0.08)",
                                      borderBottom: "1px solid rgba(253,251,247,0.08)",
                                    }}
                                  >
                                    <div className="flex items-start gap-1.5">
                                      <p
                                        className="font-dm text-[11px] leading-relaxed flex-1"
                                        style={{ color: "rgba(253,251,247,0.45)" }}
                                      >
                                        {item.descricao}
                                      </p>
                                      <button
                                        onClick={() => setExpandedId(null)}
                                        className="p-0.5 rounded flex-shrink-0 transition-colors hover:bg-white/[0.05]"
                                        style={{ color: "rgba(253,251,247,0.2)" }}
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="font-dm text-[11px]" style={{ color: "rgba(253,251,247,0.15)" }}>
                      Sem grupo
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* WhatsApp group CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left"
          style={{
            background: "linear-gradient(135deg, rgba(37,211,102,0.06), rgba(46,158,143,0.06))",
            border: "1px solid rgba(37,211,102,0.15)",
          }}
        >
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: "rgba(37,211,102,0.12)",
              border: "1px solid rgba(37,211,102,0.25)",
            }}
          >
            <MessageCircle size={22} style={{ color: "#25D366" }} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-fraunces font-bold text-sm mb-1" style={{ color: "rgba(253,251,247,0.85)" }}>
              Entre no grupo da Formação Base
            </h4>
            <p className="font-dm text-xs leading-relaxed" style={{ color: "rgba(253,251,247,0.4)" }}>
              Receba avisos sobre os grupos síncronos, materiais e novidades diretamente no WhatsApp.
            </p>
          </div>
          <a
            href="https://chat.whatsapp.com/JpZtYWJovU03VlrZJ5oUxQ"
            target="_blank"
            rel="noopener noreferrer"
            className="font-dm text-sm font-bold px-6 py-3 rounded-xl flex items-center gap-2 transition-all hover:-translate-y-0.5 flex-shrink-0"
            style={{ backgroundColor: "#25D366", color: "#fff", boxShadow: "0 4px 20px rgba(37,211,102,0.3)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Entrar no grupo
          </a>
        </motion.div>
      </div>
    </section>
  );
}
