import Link from "next/link";
import { Drama, BrainCog, MessagesSquare, ClipboardList, Package } from "lucide-react";
import type { Exercise, FormatoSlug } from "@/lib/aprimoramento-dinamicas";
import { tagToSlug } from "@/lib/aprimoramento-dinamicas";
import { CATEGORIES, FORMATOS } from "@/lib/aprimoramento-categories";

const FORMATO_ICON = {
  Drama,
  BrainCog,
  MessagesSquare,
  ClipboardList,
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Link
              key={tag}
              href={`/formacao/aprimoramento-dinamicas/tag/${tagToSlug(tag)}`}
              className="font-dm text-[10.5px] px-2 py-0.5 rounded-md text-cream/55 hover:text-accent transition-colors"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              #{tag}
            </Link>
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
