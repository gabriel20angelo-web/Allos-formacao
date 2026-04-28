"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import Card from "@/components/ui/Card";
import HintButton from "./HintButton";

interface StatCardData {
  label: string;
  value: string;
  suffix?: string;
  subtitle?: string;
  hint?: string;
  icon: LucideIcon;
  iconColor: string;
  iconBg: string;
  trend?: number;
}

export default function StatCard({
  card,
  delay,
}: {
  card: StatCardData;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card>
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-[10px] flex items-center justify-center flex-shrink-0"
            style={{ background: card.iconBg }}
          >
            <card.icon
              className="h-5 w-5"
              style={{ color: card.iconColor }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-fraunces font-bold text-xl text-cream tabular-nums">
                <span style={{ color: card.iconColor }}>{card.value}</span>
                {card.suffix && (
                  <span className="text-sm text-cream/30">{card.suffix}</span>
                )}
              </p>
              {card.trend !== undefined && card.trend !== 0 && (
                <span
                  className="font-dm text-[10px] font-semibold"
                  style={{
                    color: card.trend > 0 ? "#00b894" : "#e74c3c",
                  }}
                >
                  {card.trend > 0 ? "+" : ""}
                  {card.trend.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-dm text-cream/40">{card.label}</p>
              {card.hint && <HintButton text={card.hint} />}
            </div>
            {card.subtitle && (
              <p className="text-[10px] font-dm text-cream/25">
                {card.subtitle}
              </p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
