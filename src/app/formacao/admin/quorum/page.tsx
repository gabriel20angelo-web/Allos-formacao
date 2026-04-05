"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import Card from "@/components/ui/Card";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  Calendar,
  ChevronLeft,
  ChevronRight,
  UserCheck,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus,
} from "lucide-react";

interface MeetPresenca {
  id: string;
  slot_id: string | null;
  meet_link: string;
  condutor_nome: string;
  data_reuniao: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
  participantes: {
    nome: string;
    primeira_entrada: string;
    ultima_saida: string;
    snapshots_presente: number;
  }[];
  total_participantes: number;
  media_participantes: number;
  pico_participantes: number;
  created_at: string;
}

const DIAS_SEMANA = ["Segunda", "Terca", "Quarta", "Quinta", "Sexta", "Sabado", "Domingo"];

function getWeekRange(date: Date): { inicio: string; fim: string } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1; // monday = 0
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 6);
  return {
    inicio: monday.toISOString().split("T")[0],
    fim: friday.toISOString().split("T")[0],
  };
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function QuorumPage() {
  const [presencas, setPresencas] = useState<MeetPresenca[]>([]);
  const [presencasSemanaAnterior, setPresencasSemanaAnterior] = useState<MeetPresenca[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedPresenca, setSelectedPresenca] = useState<MeetPresenca | null>(null);

  const currentWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + weekOffset * 7);
    return getWeekRange(d);
  }, [weekOffset]);

  const previousWeek = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + (weekOffset - 1) * 7);
    return getWeekRange(d);
  }, [weekOffset]);

  useEffect(() => {
    loadData();
  }, [currentWeek]);

  async function loadData() {
    setLoading(true);
    try {
      const sb = createClient();

      const [{ data: current }, { data: prev }] = await Promise.all([
        sb
          .from("formacao_meet_presencas")
          .select("*")
          .gte("data_reuniao", currentWeek.inicio)
          .lte("data_reuniao", currentWeek.fim)
          .order("data_reuniao", { ascending: true })
          .order("hora_inicio", { ascending: true }),
        sb
          .from("formacao_meet_presencas")
          .select("*")
          .gte("data_reuniao", previousWeek.inicio)
          .lte("data_reuniao", previousWeek.fim),
      ]);

      setPresencas(current || []);
      setPresencasSemanaAnterior(prev || []);
    } catch (err) {
      console.error("Erro ao carregar presencas:", err);
    } finally {
      setLoading(false);
    }
  }

  // Metricas da semana
  const stats = useMemo(() => {
    if (presencas.length === 0) {
      return { totalGrupos: 0, mediaGeral: 0, picoGeral: 0, totalUnicos: 0, tendencia: 0 };
    }

    const totalGrupos = presencas.length;
    const mediaGeral =
      presencas.reduce((sum, p) => sum + p.media_participantes, 0) / totalGrupos;
    const picoGeral = Math.max(...presencas.map((p) => p.pico_participantes));

    // Total de participantes unicos na semana
    const nomesUnicos = new Set<string>();
    presencas.forEach((p) => {
      p.participantes?.forEach((part) => nomesUnicos.add(part.nome));
    });
    const totalUnicos = nomesUnicos.size;

    // Tendencia vs semana anterior
    const mediaPrev =
      presencasSemanaAnterior.length > 0
        ? presencasSemanaAnterior.reduce((sum, p) => sum + p.media_participantes, 0) /
          presencasSemanaAnterior.length
        : 0;
    const tendencia = mediaPrev > 0 ? ((mediaGeral - mediaPrev) / mediaPrev) * 100 : 0;

    return { totalGrupos, mediaGeral, picoGeral, totalUnicos, tendencia };
  }, [presencas, presencasSemanaAnterior]);

  // Agrupar por dia
  const porDia = useMemo(() => {
    const map: Record<number, MeetPresenca[]> = {};
    presencas.forEach((p) => {
      if (!map[p.dia_semana]) map[p.dia_semana] = [];
      map[p.dia_semana].push(p);
    });
    return map;
  }, [presencas]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com navegacao de semana */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-fraunces font-bold text-cream">Quorum dos Grupos</h1>
          <p className="text-sm text-cream/40 mt-1">
            Presenca capturada automaticamente pelo Google Meet
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="p-2 rounded-lg hover:bg-white/5 text-cream/50 hover:text-cream transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <span className="text-sm text-cream/70 min-w-[160px] text-center">
            {formatDate(currentWeek.inicio)} - {formatDate(currentWeek.fim)}
          </span>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            disabled={weekOffset >= 0}
            className="p-2 rounded-lg hover:bg-white/5 text-cream/50 hover:text-cream transition-colors disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Cards de estatisticas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Calendar className="h-5 w-5" />}
          label="Grupos realizados"
          value={stats.totalGrupos.toString()}
          color="#6c5ce7"
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Media por grupo"
          value={stats.mediaGeral.toFixed(1)}
          trend={stats.tendencia}
          color="#00b894"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Pico da semana"
          value={stats.picoGeral.toString()}
          color="#fdcb6e"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="Participantes unicos"
          value={stats.totalUnicos.toString()}
          color="#e17055"
        />
      </div>

      {/* Tabela por dia */}
      {presencas.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <BarChart3 className="h-12 w-12 text-cream/20 mx-auto mb-3" />
            <p className="text-cream/40 text-sm">
              Nenhum registro de presenca nesta semana.
            </p>
            <p className="text-cream/25 text-xs mt-1">
              Os dados aparecem automaticamente quando condutores usam a extensao do Meet.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {[0, 1, 2, 3, 4, 5, 6].map((dia) => {
            const registros = porDia[dia];
            if (!registros || registros.length === 0) return null;
            return (
              <motion.div
                key={dia}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: dia * 0.05 }}
              >
                <Card padding="sm">
                  <div className="flex items-center gap-2 mb-3 px-2">
                    <Calendar className="h-4 w-4 text-accent" />
                    <h3 className="text-sm font-semibold text-cream">
                      {DIAS_SEMANA[dia]}
                    </h3>
                    <span className="text-xs text-cream/30">
                      {registros.length} grupo{registros.length > 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {registros.map((reg) => (
                      <button
                        key={reg.id}
                        onClick={() =>
                          setSelectedPresenca(
                            selectedPresenca?.id === reg.id ? null : reg
                          )
                        }
                        className="w-full text-left rounded-xl px-4 py-3 transition-all duration-200 hover:bg-white/5"
                        style={{
                          background:
                            selectedPresenca?.id === reg.id
                              ? "rgba(108,92,231,0.1)"
                              : "rgba(255,255,255,0.02)",
                          border:
                            selectedPresenca?.id === reg.id
                              ? "1px solid rgba(108,92,231,0.3)"
                              : "1px solid transparent",
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1.5 text-cream/50">
                              <Clock className="h-3.5 w-3.5" />
                              <span className="text-xs">
                                {formatTime(reg.hora_inicio)} - {formatTime(reg.hora_fim)}
                              </span>
                            </div>
                            <span className="text-sm text-cream/70">
                              {reg.condutor_nome}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <span className="text-lg font-bold text-cream">
                                {reg.media_participantes.toFixed(1)}
                              </span>
                              <span className="text-xs text-cream/30 ml-1">media</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-cream/70">
                                {reg.pico_participantes}
                              </span>
                              <span className="text-xs text-cream/30 ml-1">pico</span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm text-cream/50">
                                {reg.duracao_minutos} min
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Detalhes expandidos */}
                        {selectedPresenca?.id === reg.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="mt-3 pt-3"
                            style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
                          >
                            <p className="text-xs text-cream/40 mb-2">
                              {reg.total_participantes} participantes unicos
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {reg.participantes?.map((p, i) => (
                                <span
                                  key={i}
                                  className="text-xs px-2 py-1 rounded-md"
                                  style={{
                                    background: "rgba(108,92,231,0.12)",
                                    color: "rgba(108,92,231,0.8)",
                                  }}
                                >
                                  {p.nome}
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </button>
                    ))}
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  trend,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  trend?: number;
  color: string;
}) {
  return (
    <Card padding="sm">
      <div className="flex items-start justify-between">
        <div
          className="p-2 rounded-lg"
          style={{ background: `${color}15` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        {trend !== undefined && trend !== 0 && (
          <span
            className="flex items-center gap-0.5 text-xs font-semibold"
            style={{ color: trend > 0 ? "#00b894" : "#e74c3c" }}
          >
            {trend > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
        {trend !== undefined && trend === 0 && (
          <span className="flex items-center gap-0.5 text-xs text-cream/30">
            <Minus className="h-3 w-3" />
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-cream">{value}</p>
        <p className="text-xs text-cream/40 mt-0.5">{label}</p>
      </div>
    </Card>
  );
}
