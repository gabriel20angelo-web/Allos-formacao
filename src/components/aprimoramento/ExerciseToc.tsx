"use client";

import { useEffect, useState } from "react";

interface TocItem {
  id: string;
  text: string;
}

interface Props {
  items: TocItem[];
  /** Cor do active state — geralmente a cor da categoria do exercício. */
  color?: string;
  /** Tint (rgba sutil) usado no fundo do item ativo. */
  tint?: string;
}

export default function ExerciseToc({
  items,
  color = "#C84B31",
  tint = "rgba(200,75,49,0.08)",
}: Props) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((it) => document.getElementById(it.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Pega a primeira heading visível mais próxima do topo
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActive(visible[0].target.id);
        }
      },
      {
        rootMargin: "-80px 0px -60% 0px",
        threshold: 0,
      },
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) return null;

  return (
    <nav aria-label="Sumário do exercício" className="hidden lg:block sticky top-24">
      <p className="font-dm text-[10px] font-semibold tracking-[0.28em] uppercase text-cream/40 mb-3">
        Nesta página
      </p>
      <ul className="space-y-1">
        {items.map((item) => {
          const isActive = active === item.id;
          return (
            <li key={item.id}>
              <a
                href={`#${item.id}`}
                className="block font-dm text-[13px] leading-relaxed py-1.5 px-3 rounded-lg transition-colors"
                style={{
                  color: isActive ? color : "rgba(253,251,247,0.5)",
                  background: isActive ? tint : "transparent",
                  borderLeft: `2px solid ${isActive ? color : "transparent"}`,
                  marginLeft: "-2px",
                }}
              >
                {item.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
