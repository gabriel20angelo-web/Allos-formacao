// Atividade recente — o relatório de movimento da plataforma.
//
// Serve as duas abas do dashboard com o mesmo componente: recebe eventos já
// normalizados (TimelineEvent) e cuida de janela, resumo, gráfico, filtros,
// busca e agrupamento por dia.
//
// O caso de uso que dita o desenho: "divulguei terça — apareceu alguém?".
// Por isso o gráfico marca o pico da janela e o resumo compara sempre com o
// período anterior de mesmo tamanho.

"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import HintButton from "./HintButton";
import {
  ACTIVITY_RANGES,
  RANGE_LABELS,
  RANGE_PREVIOUS_LABELS,
  bucketCoversDay,
  bucketEvents,
  dayKey,
  dayLabel,
  getPreviousRangeStart,
  getRangeStart,
  groupByDay,
  hourLabel,
  variation,
  type ActivityRange,
  type TimelineEvent,
  type TimelineEventType,
} from "@/lib/utils/activity";
import { personKey } from "@/lib/utils/suspeita";
import DayNotesPanel from "./DayNotesPanel";
import type { DayNotesApi } from "@/hooks/useDayNotes";
import {
  Activity,
  Award,
  BookOpen,
  CheckCircle,
  Download,
  FileText,
  MessageCircle,
  MessageSquare,
  PlayCircle,
  Search,
  Star,
  UserPlus,
  Users,
  TrendingUp,
  CalendarClock,
  Megaphone,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const TYPE_META: Record<
  TimelineEventType,
  { label: string; plural: string; verb: string; icon: LucideIcon; color: string }
> = {
  feedback: {
    label: "Feedback",
    plural: "Feedbacks",
    verb: "enviou feedback de",
    icon: MessageSquare,
    color: "#C84B31",
  },
  // A presença medida na sala, ao lado do feedback que é autodeclarado. Cor
  // própria porque a diferença entre declarar e ter estado é justamente o que
  // se quer enxergar de relance.
  encontro: {
    label: "Encontro",
    plural: "Encontros",
    verb: "esteve em",
    icon: Video,
    color: "#2E9E8F",
  },
  signup: {
    label: "Cadastro",
    plural: "Cadastros",
    verb: "criou conta",
    icon: UserPlus,
    color: "#22C55E",
  },
  enrollment: {
    label: "Matrícula",
    plural: "Matrículas",
    verb: "matriculou-se em",
    icon: BookOpen,
    color: "#2E9E8F",
  },
  lesson: {
    label: "Aula concluída",
    plural: "Aulas concluídas",
    verb: "concluiu a aula",
    icon: PlayCircle,
    color: "#6C5CE7",
  },
  completion: {
    label: "Curso concluído",
    plural: "Cursos concluídos",
    verb: "concluiu o curso",
    icon: CheckCircle,
    color: "#D4A857",
  },
  review: {
    label: "Avaliação",
    plural: "Avaliações",
    verb: "avaliou",
    icon: Star,
    color: "#F59E0B",
  },
  certificate: {
    label: "Certificado",
    plural: "Certificados",
    verb: "recebeu certificado de",
    icon: Award,
    color: "#D4854A",
  },
  comment: {
    label: "Comentário",
    plural: "Comentários",
    verb: "comentou em",
    icon: MessageCircle,
    color: "#38BDF8",
  },
  exam: {
    label: "Prova",
    plural: "Provas",
    verb: "fez a prova de",
    icon: FileText,
    color: "#EF4444",
  },
};

const PAGE_SIZE = 60;

/**
 * Quem maratona um curso gera vinte "concluiu a aula" no mesmo minuto, e isso
 * soterra o resto do dia. Rajadas do mesmo tipo/pessoa/curso viram uma linha só,
 * que se abre quando o detalhe interessa. Só `lesson` entra nisso — é o único
 * evento que acontece em série.
 */
type EventCluster = { key: string; lead: TimelineEvent; items: TimelineEvent[] };

function clusterEvents(events: TimelineEvent[]): EventCluster[] {
  const out: EventCluster[] = [];
  events.forEach((e) => {
    const last = out[out.length - 1];
    const groupable =
      last &&
      e.type === "lesson" &&
      last.lead.type === "lesson" &&
      last.lead.person === e.person &&
      (last.lead.detail || "") === (e.detail || "");
    if (groupable) last.items.push(e);
    else out.push({ key: e.id, lead: e, items: [e] });
  });
  return out;
}

interface Props {
  events: TimelineEvent[];
  range: ActivityRange;
  onRangeChange: (r: ActivityRange) => void;
  loading?: boolean;
  accent?: string;
  subtitle?: string;
  /** Nome-base do arquivo CSV. */
  csvName?: string;
  /** Fontes que bateram no teto de linhas — a timeline avisa em vez de mentir. */
  truncated?: string[];
  /** Quando a aba já tem um seletor de janela governando tudo, não repetimos aqui. */
  hideRangeSelector?: boolean;
  /** Anotações de dia; ausente ou indisponível, a UI de anotação não aparece. */
  notes?: DayNotesApi;
  /** Sem isso o nome não vira link — evita abrir dossiê dentro do dossiê. */
  onPersonClick?: (pessoa: { nome: string; email?: string }) => void;
}

export default function ActivityTimeline({
  events,
  range,
  onRangeChange,
  loading = false,
  accent = "#C84B31",
  subtitle,
  csvName = "atividade",
  truncated = [],
  hideRangeSelector = false,
  notes,
  onPersonClick,
}: Props) {
  const [activeTypes, setActiveTypes] = useState<Set<TimelineEventType>>(new Set());
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rangeStart = getRangeStart(range);
  const prevStart = getPreviousRangeStart(range);

  // ── Recorte da janela ───────────────────────────────────────────
  const { current, previous } = useMemo(() => {
    const cur: TimelineEvent[] = [];
    const prev: TimelineEvent[] = [];
    events.forEach((e) => {
      const t = new Date(e.timestamp).getTime();
      if (!rangeStart || t >= rangeStart.getTime()) cur.push(e);
      else if (prevStart && t >= prevStart.getTime()) prev.push(e);
    });
    return { current: cur, previous: prev };
  }, [events, rangeStart, prevStart]);

  // ── Tipos presentes (só viram chip os que têm evento) ───────────
  const typeCounts = useMemo(() => {
    const m = new Map<TimelineEventType, number>();
    current.forEach((e) => m.set(e.type, (m.get(e.type) || 0) + 1));
    return m;
  }, [current]);

  const presentTypes = useMemo(
    () =>
      (Object.keys(TYPE_META) as TimelineEventType[]).filter((t) =>
        typeCounts.has(t)
      ),
    [typeCounts]
  );

  // ── Filtros ─────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return current.filter((e) => {
      if (activeTypes.size > 0 && !activeTypes.has(e.type)) return false;
      if (!q) return true;
      return (
        e.person.toLowerCase().includes(q) ||
        e.title.toLowerCase().includes(q) ||
        (e.detail || "").toLowerCase().includes(q) ||
        (e.body || "").toLowerCase().includes(q)
      );
    });
  }, [current, activeTypes, query]);

  const grouped = useMemo(() => groupByDay(filtered.slice(0, visible)), [filtered, visible]);
  const chart = useMemo(() => bucketEvents(filtered, range), [filtered, range]);

  // ── Resumo ──────────────────────────────────────────────────────
  // Pelo e-mail, não pelo nome. O formulário de /certificado aceita o nome
  // digitado na hora, e a mesma conta aparece como "Mariana Alves" numa semana
  // e "Mariana Alves Ribeiro do Nascimento" na outra: contadas pelo nome, elas
  // viram duas pessoas, e o número que responde "quem apareceu depois da
  // divulgação" fica inflado justamente onde se olha para decidir.
  const peopleNow = useMemo(() => new Set(filtered.map(personKey)).size, [filtered]);
  const peoplePrev = useMemo(() => new Set(previous.map(personKey)).size, [previous]);
  const eventsVar = variation(filtered.length, previous.length);
  const peopleVar = variation(peopleNow, peoplePrev);

  const peak = useMemo(() => {
    if (chart.length === 0) return null;
    return chart.reduce((best, b) => (b.count > best.count ? b : best), chart[0]);
  }, [chart]);

  const perDay = useMemo(() => {
    const days = chart.filter((b) => b.count > 0).length;
    return days > 0 ? filtered.length / days : 0;
  }, [chart, filtered.length]);

  const maxBar = Math.max(...chart.map((b) => b.count), 1);

  // eventos por dia: o painel de anotações usa para dizer o que o dia rendeu
  const eventCountByDay = useMemo(() => {
    const m = new Map<string, number>();
    current.forEach((e) => {
      const k = dayKey(e.timestamp);
      m.set(k, (m.get(k) || 0) + 1);
    });
    return m;
  }, [current]);

  const notedDays = useMemo(
    () => (notes?.available ? Array.from(notes.byDay.keys()) : []),
    [notes]
  );

  function toggleType(t: TimelineEventType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
    setVisible(PAGE_SIZE);
  }

  function exportCSV() {
    const lines = ["Data,Hora,Tipo,Pessoa,Referência,Contexto,Texto,Nota"];
    filtered.forEach((e) => {
      const d = new Date(e.timestamp);
      const esc = (s: string) => `"${(s || "").replace(/"/g, '""').replace(/\n/g, " ")}"`;
      lines.push(
        [
          d.toLocaleDateString("pt-BR"),
          hourLabel(e.timestamp),
          esc(TYPE_META[e.type].label),
          esc(e.person),
          esc(e.title),
          esc(e.detail || ""),
          esc(e.body || ""),
          e.score !== undefined ? String(e.score) : "",
        ].join(",")
      );
    });
    const blob = new Blob(["﻿" + lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${csvName}_${range}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const summary: {
    label: string;
    value: string;
    hint: string;
    delta: number | null;
    icon: LucideIcon;
  }[] = [
    {
      label: "Eventos",
      value: String(filtered.length),
      hint: "Tudo que aconteceu na janela escolhida, somando os tipos ligados nos filtros.",
      delta: eventsVar,
      icon: Activity,
    },
    {
      label: "Pessoas diferentes",
      value: String(peopleNow),
      hint: "Quantas pessoas distintas geraram pelo menos um evento na janela.",
      delta: peopleVar,
      icon: Users,
    },
    {
      label: "Média por dia ativo",
      value: perDay.toFixed(1),
      hint: "Eventos divididos pelos dias em que houve movimento — ignora os dias zerados.",
      delta: null,
      icon: TrendingUp,
    },
    {
      label: peak && peak.count > 0 ? "Pico" : "Sem pico",
      value: peak && peak.count > 0 ? peak.label : "—",
      hint: "O intervalo mais movimentado da janela. É aqui que se enxerga o efeito de uma divulgação.",
      delta: null,
      icon: CalendarClock,
    },
  ];

  return (
    <Card>
      {/* ── Cabeçalho + janela ── */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-fraunces font-bold text-lg text-cream">
              Atividade recente
            </h2>
            <HintButton text="Cada linha é um acontecimento real da plataforma, do mais novo para o mais antigo. Use a janela para virar relatório do dia, da semana, do mês ou de todo o histórico." />
          </div>
          {subtitle && (
            <p className="font-dm text-[11px] text-cream/30 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {!hideRangeSelector && ACTIVITY_RANGES.map((r) => {
            const active = range === r;
            return (
              <button
                key={r}
                onClick={() => {
                  onRangeChange(r);
                  setVisible(PAGE_SIZE);
                }}
                className="font-dm text-[11px] px-2.5 py-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: active ? `${accent}1f` : "rgba(255,255,255,0.03)",
                  color: active ? accent : "rgba(253,251,247,0.4)",
                  border: `1px solid ${active ? `${accent}4d` : "rgba(255,255,255,0.06)"}`,
                }}
              >
                {RANGE_LABELS[r]}
              </button>
            );
          })}
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="font-dm text-[11px] px-2.5 py-1.5 rounded-full transition-all flex items-center gap-1 hover:bg-white/[.05] disabled:opacity-30"
            style={{
              color: "rgba(253,251,247,0.5)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
            title="Baixar o que está filtrado em CSV"
          >
            <Download className="h-3 w-3" />
            CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <p className="font-dm text-sm text-cream/30">Carregando atividade...</p>
        </div>
      ) : (
        <>
          {/* ── Resumo da janela ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
            {summary.map((s) => (
              <div
                key={s.label}
                className="px-3 py-2.5 rounded-[12px]"
                style={{
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <s.icon className="h-3 w-3" style={{ color: `${accent}aa` }} />
                  <p className="font-dm text-[10px] text-cream/35 truncate">{s.label}</p>
                  <HintButton text={s.hint} />
                </div>
                <div className="flex items-baseline gap-1.5">
                  <p className="font-fraunces font-bold text-lg text-cream tabular-nums truncate">
                    {s.value}
                  </p>
                  {s.delta !== null && s.delta !== 0 && (
                    <span
                      className="font-dm text-[10px] font-semibold whitespace-nowrap"
                      style={{ color: s.delta > 0 ? "#22C55E" : "#EF4444" }}
                      title={RANGE_PREVIOUS_LABELS[range]}
                    >
                      {s.delta > 0 ? "+" : ""}
                      {s.delta.toFixed(0)}%
                    </span>
                  )}
                </div>
                {s.label === "Pico" && peak && peak.count > 0 && (
                  <p className="font-dm text-[10px] text-cream/25">
                    {peak.count} evento{peak.count > 1 ? "s" : ""}
                  </p>
                )}
              </div>
            ))}
          </div>

          {range !== "all" && previous.length > 0 && (
            <p className="font-dm text-[10px] text-cream/25 -mt-3 mb-4">
              Comparação {RANGE_PREVIOUS_LABELS[range]} ({previous.length} eventos).
            </p>
          )}

          {/* ── Gráfico da janela ── */}
          {chart.length > 0 && (
            <div className="mb-5">
              {/* items-stretch (padrão) é o que dá altura às colunas — com
                  items-end a barra em % colapsa para o mínimo. */}
              <div className="flex gap-[3px] h-24">
                {chart.map((b) => {
                  const isPeak = peak !== null && b.count === peak.count && b.count > 0;
                  const diasAnotados = notedDays.filter((d) => bucketCoversDay(b, d));
                  const anotacao = diasAnotados
                    .flatMap((d) => notes?.byDay.get(d) ?? [])
                    .map((n) => n.texto)[0];
                  return (
                    <div
                      key={b.key}
                      className="flex-1 flex flex-col justify-end items-center group relative min-w-0"
                    >
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        <div
                          className="px-2 py-0.5 rounded text-[9px] font-dm font-medium text-cream whitespace-nowrap max-w-[220px] truncate"
                          style={{
                            background: "rgba(30,30,30,0.95)",
                            border: `1px solid ${anotacao ? "#D4A85755" : `${accent}33`}`,
                          }}
                        >
                          {b.count} &middot; {b.label}
                          {anotacao && (
                            <span style={{ color: "#D4A857" }}> &middot; {anotacao}</span>
                          )}
                        </div>
                      </div>
                      {anotacao && (
                        <span
                          className="absolute -bottom-[7px] w-[5px] h-[5px] rounded-full"
                          style={{ background: "#D4A857" }}
                          title={anotacao}
                        />
                      )}
                      <div
                        className="w-full rounded-t-[3px] transition-all duration-200"
                        style={{
                          height: `${Math.max((b.count / maxBar) * 100, b.count > 0 ? 6 : 2)}%`,
                          background: isPeak
                            ? `linear-gradient(180deg, ${accent} 0%, ${accent}88 100%)`
                            : b.count > 0
                              ? `linear-gradient(180deg, ${accent}99 0%, ${accent}44 100%)`
                              : "rgba(255,255,255,0.05)",
                          boxShadow: isPeak ? `0 0 10px ${accent}55` : "none",
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-2.5">
                <span className="font-dm text-[9px] text-cream/20">
                  {chart[0]?.label}
                </span>
                <span className="font-dm text-[9px] text-cream/20">
                  {chart[chart.length - 1]?.label}
                </span>
              </div>
            </div>
          )}

          {/* ── Anotações do período ── */}
          {notes && (
            <DayNotesPanel
              api={notes}
              eventCountByDay={eventCountByDay}
              rangeStart={rangeStart}
              accent={accent}
            />
          )}

          {/* ── Filtros ── */}
          {presentTypes.length > 0 && (
            <div className="flex flex-col sm:flex-row gap-2.5 mb-4">
              <div className="flex flex-wrap gap-1.5 flex-1">
                <button
                  onClick={() => {
                    setActiveTypes(new Set());
                    setVisible(PAGE_SIZE);
                  }}
                  className="font-dm text-[10px] px-2.5 py-1 rounded-full transition-all"
                  style={{
                    backgroundColor:
                      activeTypes.size === 0 ? `${accent}1f` : "rgba(255,255,255,0.03)",
                    color: activeTypes.size === 0 ? accent : "rgba(253,251,247,0.4)",
                    border: `1px solid ${activeTypes.size === 0 ? `${accent}4d` : "rgba(255,255,255,0.06)"}`,
                  }}
                >
                  Tudo {current.length}
                </button>
                {presentTypes.map((t) => {
                  const meta = TYPE_META[t];
                  const on = activeTypes.has(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggleType(t)}
                      className="font-dm text-[10px] px-2.5 py-1 rounded-full transition-all flex items-center gap-1"
                      style={{
                        backgroundColor: on ? `${meta.color}1f` : "rgba(255,255,255,0.03)",
                        color: on ? meta.color : "rgba(253,251,247,0.4)",
                        border: `1px solid ${on ? `${meta.color}4d` : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <meta.icon className="h-2.5 w-2.5" />
                      {meta.plural} {typeCounts.get(t)}
                    </button>
                  );
                })}
              </div>
              <div className="relative sm:w-56 flex-shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-cream/25" />
                <input
                  type="text"
                  placeholder="Buscar pessoa..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setVisible(PAGE_SIZE);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 dark-input rounded-full text-[11px] font-dm"
                />
              </div>
            </div>
          )}

          {truncated.length > 0 && (
            <p className="font-dm text-[10px] text-[#F59E0B]/70 mb-3">
              Volume alto: {truncated.join(", ")} aparecem só nos registros mais
              recentes da janela. Os totais acima continuam exatos.
            </p>
          )}

          {/* ── Timeline ── */}
          {grouped.length === 0 ? (
            <div className="py-12 text-center">
              <Activity className="h-8 w-8 text-cream/10 mx-auto mb-2" />
              <p className="font-dm text-sm text-cream/30">
                {current.length === 0
                  ? "Nada aconteceu nessa janela."
                  : "Nenhum evento com esses filtros."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {grouped.map((day, di) => (
                <div key={day.key}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-dm text-[11px] font-semibold text-cream/50">
                      {day.label}
                    </span>
                    <span className="font-dm text-[10px] text-cream/25">
                      {day.events.length} evento{day.events.length > 1 ? "s" : ""}
                    </span>
                    <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.05)" }} />
                  </div>

                  {/* o que foi feito nesse dia — a causa possível do movimento */}
                  {notes?.byDay.get(day.key)?.map((n) => (
                    <div
                      key={n.id}
                      className="flex items-start gap-1.5 mb-1.5 px-2 py-1 rounded-[6px]"
                      style={{
                        background: "rgba(212,168,87,0.06)",
                        border: "1px solid rgba(212,168,87,0.14)",
                      }}
                    >
                      <Megaphone
                        className="h-3 w-3 flex-shrink-0 mt-0.5"
                        style={{ color: "#D4A857" }}
                      />
                      <p className="font-dm text-[11px] leading-snug" style={{ color: "#D4A857" }}>
                        {n.texto}
                      </p>
                    </div>
                  ))}

                  <div className="relative pl-[13px]">
                    <div
                      className="absolute left-[5px] top-1 bottom-1 w-px"
                      style={{ background: "rgba(255,255,255,0.06)" }}
                    />
                    {clusterEvents(day.events).map((cluster, i) => {
                      const e = cluster.lead;
                      const meta = TYPE_META[e.type];
                      const many = cluster.items.length > 1;
                      const open = expanded.has(cluster.key);
                      const last = cluster.items[cluster.items.length - 1];
                      // uma linha só é clicável quando há texto escrito para ler
                      const readable = !many && !!e.body;

                      const toggle = () =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(cluster.key)) next.delete(cluster.key);
                          else next.add(cluster.key);
                          return next;
                        });

                      return (
                        <motion.div
                          key={cluster.key}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(di * 0.02 + i * 0.012, 0.4) }}
                          onClick={readable ? toggle : undefined}
                          role={readable ? "button" : undefined}
                          tabIndex={readable ? 0 : undefined}
                          onKeyDown={
                            readable
                              ? (ev) => {
                                  if (ev.key === "Enter" || ev.key === " ") {
                                    ev.preventDefault();
                                    toggle();
                                  }
                                }
                              : undefined
                          }
                          className={`relative flex items-start gap-2.5 py-1.5 pl-3 pr-2 rounded-[8px] transition-colors group ${
                            readable
                              ? "cursor-pointer hover:bg-white/[.04]"
                              : "hover:bg-white/[.02]"
                          }`}
                        >
                          <span
                            className="absolute -left-[12px] top-[11px] w-[9px] h-[9px] rounded-full border-2"
                            style={{
                              background: "#1a1a1a",
                              borderColor: meta.color,
                            }}
                          />
                          <meta.icon
                            className="h-3.5 w-3.5 flex-shrink-0 mt-0.5"
                            style={{ color: meta.color }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="font-dm text-xs text-cream/75 leading-snug">
                              {onPersonClick ? (
                                <button
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    onPersonClick({
                                      nome: e.person,
                                      email: e.personEmail,
                                    });
                                  }}
                                  className="font-semibold text-cream hover:underline decoration-dotted underline-offset-2"
                                  title="Ver tudo o que essa pessoa fez"
                                >
                                  {e.person}
                                </button>
                              ) : (
                                <span className="font-semibold text-cream">{e.person}</span>
                              )}
                              {many ? (
                                <>
                                  <span className="text-cream/40"> concluiu </span>
                                  <span className="text-cream/80">
                                    {cluster.items.length} aulas
                                  </span>
                                  {e.detail && (
                                    <>
                                      <span className="text-cream/40"> de </span>
                                      <span className="text-cream/80">{e.detail}</span>
                                    </>
                                  )}
                                  <button
                                    onClick={toggle}
                                    className="ml-1.5 text-[10px] font-dm hover:underline"
                                    style={{ color: meta.color }}
                                  >
                                    {open ? "ocultar" : "ver quais"}
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="text-cream/40"> {meta.verb} </span>
                                  {e.title && <span className="text-cream/80">{e.title}</span>}
                                  {e.score !== undefined && (
                                    <span
                                      className="ml-1.5 text-[10px] font-semibold"
                                      style={{ color: meta.color }}
                                    >
                                      {e.score}
                                      {e.scoreSuffix || ""}
                                    </span>
                                  )}
                                </>
                              )}
                            </p>
                            {!many && e.detail && (
                              <p className="font-dm text-[11px] text-cream/30 leading-snug line-clamp-2 mt-0.5">
                                {e.detail}
                              </p>
                            )}
                            {readable &&
                              (open ? (
                                <div
                                  className="mt-1.5 pl-2.5 py-1 border-l-2"
                                  style={{ borderColor: `${meta.color}55` }}
                                >
                                  <p className="font-dm text-[11px] text-cream/60 leading-relaxed whitespace-pre-wrap">
                                    {e.body}
                                  </p>
                                  <span
                                    className="font-dm text-[10px] mt-1 inline-block"
                                    style={{ color: meta.color }}
                                  >
                                    ocultar
                                  </span>
                                </div>
                              ) : (
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                  <p className="font-dm text-[11px] text-cream/30 leading-snug truncate min-w-0">
                                    “{e.body}”
                                  </p>
                                  <span
                                    className="font-dm text-[10px] flex-shrink-0 group-hover:underline"
                                    style={{ color: meta.color }}
                                  >
                                    ler
                                  </span>
                                </div>
                              ))}
                            {many && open && (
                              <div className="mt-1 space-y-0.5">
                                {cluster.items.map((item) => (
                                  <p
                                    key={item.id}
                                    className="font-dm text-[11px] text-cream/35 leading-snug flex gap-2"
                                  >
                                    <span className="text-cream/20 tabular-nums">
                                      {hourLabel(item.timestamp)}
                                    </span>
                                    <span className="truncate">{item.title}</span>
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="font-dm text-[10px] text-cream/25 tabular-nums flex-shrink-0 mt-0.5">
                            {many && hourLabel(last.timestamp) !== hourLabel(e.timestamp)
                              ? `${hourLabel(last.timestamp)}–${hourLabel(e.timestamp)}`
                              : hourLabel(e.timestamp)}
                          </span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {filtered.length > visible && (
                <button
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                  className="w-full py-2 rounded-[10px] font-dm text-[11px] transition-all hover:bg-white/[.04]"
                  style={{
                    color: "rgba(253,251,247,0.45)",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  Carregar mais ({filtered.length - visible} restantes)
                </button>
              )}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

export { TYPE_META, dayLabel };
