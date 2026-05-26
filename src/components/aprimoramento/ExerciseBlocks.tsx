"use client";

import { useEffect, useRef } from "react";
import type { Block } from "@/lib/aprimoramento-dinamicas";
import { parseMomento, slugifyHeading } from "@/lib/aprimoramento-dinamicas";

const HEADING2_CLASSES =
  "reveal font-fraunces text-2xl md:text-[28px] text-cream mt-12 mb-4 scroll-mt-24";
const HEADING4_CLASSES =
  "reveal font-dm text-[11px] font-bold tracking-widest uppercase text-accent mt-6 mb-2";

export default function ExerciseBlocks({ blocks }: { blocks: Block[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Reveal-on-scroll: aplica `reveal-shown` em cada elemento `.reveal` quando
  // entra na viewport. Respeita prefers-reduced-motion mostrando tudo de cara.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      root
        .querySelectorAll<HTMLElement>(".reveal")
        .forEach((el) => el.classList.add("reveal-shown"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-shown");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.04 },
    );

    root.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [blocks]);

  // Gera IDs únicos pros headings level 2 (mesma lógica do extractToc).
  const idsUsed = new Set<string>();
  function makeId(text: string): string {
    let id = slugifyHeading(text);
    let suffix = 2;
    while (id && idsUsed.has(id)) {
      id = `${slugifyHeading(text)}-${suffix++}`;
    }
    if (id) idsUsed.add(id);
    return id;
  }

  return (
    <div ref={containerRef} className="space-y-1">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const level = block.level ?? 2;

          if (level === 2) {
            const id = makeId(block.text);
            return (
              <h2 key={i} id={id} className={HEADING2_CLASSES}>
                {block.text}
              </h2>
            );
          }

          if (level === 3) {
            const momento = parseMomento(block.text);
            if (momento) {
              return (
                <div
                  key={i}
                  className="reveal momento-step flex items-start gap-3 mt-8 mb-3 scroll-mt-24"
                >
                  <div
                    className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-fraunces text-base font-bold mt-0.5"
                    style={{
                      background: "rgba(200,75,49,0.12)",
                      color: "#C84B31",
                      border: "1px solid rgba(200,75,49,0.28)",
                    }}
                    aria-hidden="true"
                  >
                    {momento.number}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-dm text-[10px] font-bold tracking-[0.24em] uppercase text-accent/80">
                      Momento {momento.number}
                    </p>
                    {momento.label && (
                      <h3 className="font-fraunces text-lg md:text-xl text-cream leading-snug mt-0.5">
                        {momento.label}
                      </h3>
                    )}
                  </div>
                </div>
              );
            }
            return (
              <h3
                key={i}
                className="reveal font-fraunces text-lg md:text-xl text-cream mt-8 mb-3"
              >
                {block.text}
              </h3>
            );
          }

          // level 4 — usado pra "Para o paciente / Para o terapeuta" etc.
          return (
            <h4 key={i} className={HEADING4_CLASSES}>
              {block.text}
            </h4>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={i}
              className="reveal font-dm text-[15px] leading-[1.75] text-cream/80 mb-3"
            >
              {block.text}
            </p>
          );
        }

        if (block.type === "list") {
          return (
            <ul key={i} className="reveal space-y-2 mb-4 pl-4">
              {block.items.map((item, j) => (
                <li
                  key={j}
                  className="font-dm text-[15px] leading-[1.75] text-cream/80 relative pl-4 before:content-['•'] before:absolute before:left-0 before:text-accent"
                >
                  {item}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "orderedList") {
          return (
            <ol
              key={i}
              className="reveal space-y-2 mb-4 pl-4 list-decimal list-inside marker:text-accent marker:font-bold"
            >
              {block.items.map((item, j) => (
                <li
                  key={j}
                  className="font-dm text-[15px] leading-[1.75] text-cream/80 pl-1"
                >
                  {item}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={i}
              className="reveal border-l-2 border-accent/60 pl-5 my-6 italic"
            >
              <p className="font-fraunces text-[16px] leading-[1.75] text-cream/85">
                &ldquo;{block.text}&rdquo;
              </p>
              {block.attribution && (
                <footer className="mt-2 font-dm text-xs text-cream/50 not-italic">
                  — {block.attribution}
                </footer>
              )}
            </blockquote>
          );
        }

        if (block.type === "callout") {
          return (
            <div
              key={i}
              className="reveal my-5 rounded-xl p-4 border border-cream/10"
              style={{ background: "rgba(200,75,49,0.06)" }}
            >
              <p className="font-dm text-[13px] leading-[1.7] text-cream/70 italic">
                {block.text}
              </p>
            </div>
          );
        }

        if (block.type === "reference") {
          return (
            <p key={i} className="reveal font-dm text-xs text-cream/50 mb-3 italic">
              {block.url ? (
                <a
                  href={block.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors underline-offset-2 hover:underline"
                >
                  {block.text}
                </a>
              ) : (
                block.text
              )}
            </p>
          );
        }

        if (block.type === "link") {
          return (
            <p key={i} className="reveal mb-3">
              <a
                href={block.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-dm text-sm text-accent hover:text-accent/80 transition-colors inline-flex items-center gap-1 underline underline-offset-4"
              >
                {block.label}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  aria-hidden="true"
                >
                  <path d="M7 17L17 7M9 7h8v8" />
                </svg>
              </a>
            </p>
          );
        }

        if (block.type === "table") {
          return (
            <div
              key={i}
              className="reveal my-5 overflow-x-auto rounded-xl border border-cream/10"
            >
              <table className="w-full text-left">
                <thead style={{ background: "rgba(255,255,255,0.04)" }}>
                  <tr>
                    {block.headers.map((h, j) => (
                      <th
                        key={j}
                        className="font-dm text-[11px] font-semibold tracking-wider uppercase text-cream/60 px-4 py-3 align-top"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, j) => (
                    <tr key={j} className="border-t border-cream/5">
                      {row.map((cell, k) => (
                        <td
                          key={k}
                          className="font-dm text-[13px] leading-[1.65] text-cream/75 px-4 py-3 align-top italic"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
