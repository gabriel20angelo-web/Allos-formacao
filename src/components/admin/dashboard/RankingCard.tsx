"use client";

import { useState, useEffect } from "react";
import { Trophy } from "lucide-react";
import Card from "@/components/ui/Card";

type RType = "all" | "sync" | "async";

const labels: Record<RType, string> = {
  all: "Geral",
  sync: "Síncronos",
  async: "Assíncronos",
};

export default function RankingCard({
  period,
  initialData,
}: {
  period: string;
  initialData: { nome: string; horas: number; count: number }[];
}) {
  const [type, setType] = useState<RType>("all");
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData]);

  useEffect(() => {
    if (type === "all") {
      setData(initialData);
      return;
    }
    fetch(`/formacao/api/ranking?period=${period}&type=${type}`)
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setData(d);
      })
      .catch(() => setData([]));
  }, [type, period, initialData]);

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="h-4 w-4" style={{ color: "#FBBC05" }} />
        <h3 className="font-dm text-sm font-semibold text-cream/70">
          Top Participantes
        </h3>
        <div className="flex gap-1 ml-auto">
          {(Object.keys(labels) as RType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className="font-dm text-[9px] px-2 py-0.5 rounded-full transition-all"
              style={{
                backgroundColor:
                  type === t ? "rgba(46,158,143,0.12)" : "transparent",
                color:
                  type === t ? "#2E9E8F" : "rgba(253,251,247,0.25)",
              }}
            >
              {labels[t]}
            </button>
          ))}
        </div>
      </div>
      {data.length > 0 ? (
        <div className="space-y-2">
          {data.map((p, i) => {
            const medals = ["#FFD700", "#C0C0C0", "#CD7F32"];
            const isMedal = i < 3;
            const maxHoras = data[0]?.horas || 1;
            const barWidth = (p.horas / maxHoras) * 100;
            return (
              <div key={p.nome} className="space-y-1">
                <div className="flex items-center gap-3">
                  <span
                    className="font-dm text-sm font-bold w-5 text-center"
                    style={{
                      color: isMedal
                        ? medals[i]
                        : "rgba(253,251,247,0.3)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-dm text-sm flex-1 text-cream/70 truncate">
                    {p.nome}
                  </span>
                  <span
                    className="font-fraunces font-bold text-sm"
                    style={{
                      color: isMedal
                        ? medals[i]
                        : "rgba(253,251,247,0.4)",
                    }}
                  >
                    {p.horas}h
                  </span>
                  <span className="font-dm text-[10px] text-cream/25">
                    {p.count}x
                  </span>
                </div>
                <div
                  className="ml-8 h-1.5 rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.04)" }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: isMedal
                        ? medals[i]
                        : "rgba(253,251,247,0.15)",
                      opacity: isMedal ? 0.6 : 0.3,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-cream/30 text-center py-4">
          Nenhum participante no período.
        </p>
      )}
    </Card>
  );
}
