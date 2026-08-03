// Faixa densa de números — substitui a parede de StatCards.
//
// Um card por métrica gastava uma tela inteira para dizer dez números que se
// leem de relance. Aqui cada métrica é valor + rótulo, lado a lado, com o
// mesmo hint de antes. A cor continua disponível para o que é semáforo
// (retenção), mas o padrão é sóbrio: cor demais em faixa densa vira ruído.

"use client";

import { motion } from "framer-motion";
import Card from "@/components/ui/Card";
import HintButton from "./HintButton";

export interface StripItem {
  label: string;
  value: string;
  suffix?: string;
  sub?: string;
  hint?: string;
  /** Só para semáforo; sem isso o valor herda o accent da faixa. */
  color?: string;
}

export default function StatStrip({
  title,
  items,
  accent = "#C84B31",
  delay = 0,
}: {
  title?: string;
  items: StripItem[];
  accent?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card padding="sm">
        {title && (
          <p className="font-dm text-[10px] uppercase tracking-[.14em] text-cream/25 mb-2.5">
            {title}
          </p>
        )}
        <div className="flex flex-wrap gap-y-3">
          {items.map((item, i) => (
            <div
              key={item.label}
              className="flex-1 min-w-[124px] px-3 first:pl-0"
              style={{
                borderLeft:
                  i === 0 ? "none" : "1px solid rgba(255,255,255,0.05)",
              }}
            >
              <p className="font-fraunces font-bold text-[19px] leading-none tabular-nums">
                <span style={{ color: item.color || accent }}>{item.value}</span>
                {item.suffix && (
                  <span className="text-[11px] text-cream/25">{item.suffix}</span>
                )}
              </p>
              <div className="flex items-center gap-1 mt-1">
                <p className="font-dm text-[10px] text-cream/40 leading-tight">
                  {item.label}
                </p>
                {item.hint && <HintButton text={item.hint} />}
              </div>
              {item.sub && (
                <p className="font-dm text-[9px] text-cream/20 mt-0.5">{item.sub}</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
