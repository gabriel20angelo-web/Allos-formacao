import type { Block } from "@/lib/aprimoramento-dinamicas";

const HEADING_CLASSES: Record<2 | 3 | 4, string> = {
  2: "font-fraunces text-2xl md:text-3xl text-cream mt-10 mb-4",
  3: "font-fraunces text-lg md:text-xl text-cream mt-8 mb-3",
  4: "font-dm text-sm font-bold tracking-widest uppercase text-accent mt-6 mb-2",
};

export default function ExerciseBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-1">
      {blocks.map((block, i) => {
        if (block.type === "heading") {
          const level = block.level ?? 2;
          const Tag = level === 2 ? "h2" : level === 3 ? "h3" : "h4";
          return (
            <Tag key={i} className={HEADING_CLASSES[level]}>
              {block.text}
            </Tag>
          );
        }
        if (block.type === "paragraph") {
          return (
            <p key={i} className="font-dm text-[15px] leading-[1.75] text-cream/80 mb-3">
              {block.text}
            </p>
          );
        }
        if (block.type === "list") {
          return (
            <ul key={i} className="space-y-2 mb-4 pl-4">
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
            <ol key={i} className="space-y-2 mb-4 pl-4 list-decimal list-inside marker:text-accent marker:font-bold">
              {block.items.map((item, j) => (
                <li key={j} className="font-dm text-[15px] leading-[1.75] text-cream/80 pl-1">
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
              className="border-l-2 border-accent/60 pl-5 my-6 italic"
            >
              <p className="font-fraunces text-[16px] leading-[1.75] text-cream/85">
                &ldquo;{block.text}&rdquo;
              </p>
              {block.attribution && (
                <footer className="mt-2 font-dm text-xs text-cream/50">
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
              className="my-5 rounded-xl p-4 border border-cream/10"
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
            <p key={i} className="font-dm text-xs text-cream/50 mb-3 italic">
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
            <p key={i} className="mb-3">
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
            <div key={i} className="my-5 overflow-x-auto rounded-xl border border-cream/10">
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
