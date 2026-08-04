import Link from "next/link";
import { ChevronRight } from "lucide-react";

export interface Crumb {
  label: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Caminho de navegação"
      className="font-dm text-[12px] text-cream/45 min-w-0"
    >
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => {
          const last = i === items.length - 1;
          return (
            <li key={i} className="inline-flex items-center gap-1.5">
              {it.href && !last ? (
                <Link
                  href={it.href}
                  className="hover:text-accent transition-colors truncate max-w-[200px] md:max-w-none"
                >
                  {it.label}
                </Link>
              ) : (
                <span
                  className={
                    last
                      ? "text-cream/75 truncate max-w-[280px] md:max-w-none"
                      : "truncate max-w-[200px] md:max-w-none"
                  }
                  aria-current={last ? "page" : undefined}
                >
                  {it.label}
                </span>
              )}
              {!last && (
                <ChevronRight
                  width={11}
                  height={11}
                  aria-hidden="true"
                  className="text-cream/25 flex-shrink-0"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
