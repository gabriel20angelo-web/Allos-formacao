"use client";

// A navegação da área, quando há mais de uma subseção.
//
// Some sozinha quando a pessoa tem um cargo só: uma barra com uma aba única não
// oferece escolha nenhuma, e ainda sugere que existe algo escondido ali.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Sparkles, Video } from "lucide-react";
import type { Secao } from "@/lib/areas";

const ICONE: Record<string, typeof Video> = {
  sincrono: Video,
  aprimoramento: Sparkles,
  eventos: CalendarDays,
};

export default function NavDasSecoes({ secoes }: { secoes: Secao[] }) {
  const pathname = usePathname();

  if (secoes.length < 2) return null;

  return (
    <nav className="flex items-center gap-1.5 flex-wrap mb-6">
      {secoes.map((s) => {
        const ativa = pathname === s.href || pathname.startsWith(`${s.href}/`);
        const Icone = ICONE[s.id] ?? Sparkles;

        return (
          <Link
            key={s.id}
            href={s.href}
            title={s.resumo}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: ativa ? "rgba(200,75,49,0.14)" : "rgba(255,255,255,0.03)",
              color: ativa ? "#E8836A" : "rgba(253,251,247,0.45)",
              border: `1px solid ${ativa ? "rgba(200,75,49,0.32)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <Icone className="h-3.5 w-3.5" />
            {s.rotulo}
          </Link>
        );
      })}
    </nav>
  );
}
