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
    // Mobile: cada aba divide a largura igualmente (flex-1) e nunca quebra
    // linha, cabendo sempre até 3 itens. Desktop volta ao comportamento
    // original: pílulas do tamanho do próprio texto, podendo quebrar linha.
    <nav className="flex items-stretch gap-1.5 mb-4 md:mb-6 md:items-center md:flex-wrap">
      {secoes.map((s) => {
        const ativa = pathname === s.href || pathname.startsWith(`${s.href}/`);
        const Icone = ICONE[s.id] ?? Sparkles;

        return (
          <Link
            key={s.id}
            href={s.href}
            title={s.resumo}
            className="flex flex-1 min-w-0 items-center justify-center gap-1.5 px-2 py-2 min-h-[44px] rounded-xl text-[13px] font-medium text-center transition-all md:flex-initial md:min-w-[auto] md:justify-start md:min-h-0 md:px-3.5"
            style={{
              background: ativa ? "rgba(200,75,49,0.14)" : "rgba(255,255,255,0.03)",
              color: ativa ? "#E8836A" : "rgba(253,251,247,0.45)",
              border: `1px solid ${ativa ? "rgba(200,75,49,0.32)" : "rgba(255,255,255,0.07)"}`,
            }}
          >
            <Icone className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 md:min-w-[auto]">{s.rotulo}</span>
          </Link>
        );
      })}
    </nav>
  );
}
