import Link from "next/link";
import { ChevronRight, Clock, Users } from "lucide-react";
import type { Exercise } from "@/lib/aprimoramento-dinamicas";
import {
  CATEGORIES,
  PESSOAS_LABEL,
  formatDuracao,
} from "@/lib/aprimoramento-categories";

export default function RelatedExercises({
  items,
}: {
  items: Exercise[];
}) {
  if (items.length === 0) return null;

  return (
    <section
      className="mt-14 pt-8 print-hide"
      style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
      aria-labelledby="veja-tambem-heading"
    >
      <h3
        id="veja-tambem-heading"
        className="font-dm text-[11px] font-bold tracking-[0.24em] uppercase text-accent/80 mb-4"
      >
        Veja também
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((ex) => {
          const cat = CATEGORIES[ex.category];
          return (
            <Link
              key={ex.slug}
              href={`/formacao/aprimoramento-dinamicas/${ex.slug}`}
              className="group block rounded-2xl p-4 transition-all duration-200 hover:translate-y-[-1px]"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.07)",
              }}
            >
              <div className="flex items-start gap-3 mb-2.5">
                <div
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-fraunces text-[11px] font-bold"
                  style={{
                    background: cat.tint,
                    color: cat.color,
                    border: `1px solid ${cat.border}`,
                  }}
                  aria-hidden="true"
                >
                  {ex.number}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className="font-dm text-[9px] font-semibold tracking-[0.24em] uppercase"
                    style={{ color: cat.color }}
                  >
                    {cat.label}
                  </span>
                  <h4 className="font-fraunces text-[15px] text-cream leading-snug mt-0.5 group-hover:text-accent transition-colors">
                    {ex.title}
                  </h4>
                </div>
                <ChevronRight
                  className="flex-shrink-0 text-cream/25 group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-1"
                  width={14}
                  height={14}
                  aria-hidden="true"
                />
              </div>
              <div className="flex items-center gap-3 font-dm text-[11px] text-cream/45 pl-10">
                <span className="inline-flex items-center gap-1">
                  <Clock width={10} height={10} aria-hidden="true" />
                  {formatDuracao(ex.duracaoMin)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users width={10} height={10} aria-hidden="true" />
                  {PESSOAS_LABEL[ex.pessoas]}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
