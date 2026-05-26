import { Clock, Users, Drama, BrainCog, MessagesSquare, ClipboardList, Eye, Package } from "lucide-react";
import type { Exercise, FormatoSlug } from "@/lib/aprimoramento-dinamicas";
import {
  CATEGORIES,
  FORMATOS,
  PESSOAS_LABEL,
  formatDuracao,
} from "@/lib/aprimoramento-categories";

// Escala máxima da régua de duração (em minutos).
const DURATION_SCALE_MAX = 120;

const FORMATO_ICON = {
  Drama,
  BrainCog,
  MessagesSquare,
  ClipboardList,
  Eye,
};

export default function ExerciseQuickFacts({ exercise }: { exercise: Exercise }) {
  const cat = CATEGORIES[exercise.category];
  return (
    <div
      className="rounded-2xl p-4 md:p-5 mb-10"
      style={{
        background: cat.tint,
        border: `1px solid ${cat.border}`,
      }}
    >
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <DurationFact duracaoMin={exercise.duracaoMin} color={cat.color} />
        <Fact
          label="Configuração"
          value={PESSOAS_LABEL[exercise.pessoas]}
          icon={<Users width={14} height={14} />}
          color={cat.color}
        />
        <Fact
          label="Formato"
          value={exercise.formato
            .map((f: FormatoSlug) => FORMATOS[f].label)
            .join(" · ")}
          icon={renderFormatoIcon(exercise.formato[0])}
          color={cat.color}
        />
        <Fact
          label={exercise.recursos?.length ? "Recursos" : "Categoria"}
          value={
            exercise.recursos?.length
              ? exercise.recursos.join(" · ")
              : cat.label
          }
          icon={
            exercise.recursos?.length ? (
              <Package width={14} height={14} />
            ) : (
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ background: cat.color }}
                aria-hidden="true"
              />
            )
          }
          color={cat.color}
        />
      </div>

      {exercise.tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mt-4 pt-4" style={{ borderTop: `1px solid ${cat.border}` }}>
          <span className="font-dm text-[10px] font-semibold tracking-widest uppercase text-cream/35 mr-1">
            Tags
          </span>
          {exercise.tags.map((tag) => (
            <span
              key={tag}
              className="font-dm text-[10.5px] px-2 py-0.5 rounded-md text-cream/55"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function renderFormatoIcon(slug: FormatoSlug) {
  const meta = FORMATOS[slug];
  const Icon = FORMATO_ICON[meta.icon];
  return <Icon width={14} height={14} />;
}

interface FactProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function Fact({ label, value, icon, color }: FactProps) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 mb-1 font-dm text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: "rgba(253,251,247,0.4)" }}
      >
        <span style={{ color }} aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <p className="font-dm text-[13px] text-cream/90 leading-snug">{value}</p>
    </div>
  );
}

function DurationFact({
  duracaoMin,
  color,
}: {
  duracaoMin: [number, number];
  color: string;
}) {
  const [min, max] = duracaoMin;
  const startPct = Math.min(100, (min / DURATION_SCALE_MAX) * 100);
  const widthPct = Math.min(
    100 - startPct,
    ((max - min) / DURATION_SCALE_MAX) * 100,
  );
  return (
    <div>
      <div
        className="flex items-center gap-1.5 mb-1 font-dm text-[10px] font-semibold tracking-widest uppercase"
        style={{ color: "rgba(253,251,247,0.4)" }}
      >
        <span style={{ color }} aria-hidden="true">
          <Clock width={14} height={14} />
        </span>
        Duração
      </div>
      <p className="font-dm text-[13px] text-cream/90 leading-snug mb-1.5">
        {formatDuracao(duracaoMin)}
      </p>
      {/* Régua visual: posição/comprimento sobre 0-120 min */}
      <div
        className="relative h-1.5 rounded-full overflow-hidden"
        style={{ background: "rgba(255,255,255,0.05)" }}
        aria-hidden="true"
      >
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${startPct}%`,
            width: `${Math.max(widthPct, 2)}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
          }}
        />
      </div>
      <div
        className="flex justify-between mt-0.5 font-dm text-[9px]"
        style={{ color: "rgba(253,251,247,0.28)" }}
        aria-hidden="true"
      >
        <span>0</span>
        <span>{DURATION_SCALE_MAX} min</span>
      </div>
    </div>
  );
}
