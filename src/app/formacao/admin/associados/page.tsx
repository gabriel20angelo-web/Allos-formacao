"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import {
  Shield,
  Sparkles,
  Lightbulb,
  ChevronRight,
} from "lucide-react";

interface Card {
  href: string;
  pretitle: string;
  title: string;
  description: string;
  Icon: typeof Sparkles;
  color: string;
  tint: string;
  border: string;
  countLoader?: () => Promise<number>;
  countLabel?: (n: number) => string;
}

const SUB_AREAS: Card[] = [
  {
    href: "/formacao/admin/associados/aprimoramento",
    pretitle: "Conteúdo",
    title: "Aprimoramento de Dinâmicas",
    description:
      "Lista, edita, cria, cura e arquiva os exercícios que aparecem em /aprimoramento-dinamicas. Inclui os criados por associados (não-curados).",
    Icon: Sparkles,
    color: "#C84B31",
    tint: "rgba(200,75,49,0.10)",
    border: "rgba(200,75,49,0.28)",
    countLoader: async () => {
      const sb = createClient();
      const { count } = await sb
        .from("aprimoramento_exercicios")
        .select("*", { count: "exact", head: true });
      return count ?? 0;
    },
    countLabel: (n) => `${n} exercícios`,
  },
  {
    href: "/formacao/admin/associados/sugestoes",
    pretitle: "Fila",
    title: "Sugestões",
    description:
      "Ideias de dinâmicas enviadas por associados aguardando decisão. Cada uma pode virar rascunho de exercício ou ser descartada com nota.",
    Icon: Lightbulb,
    color: "#D4A857",
    tint: "rgba(212,168,87,0.10)",
    border: "rgba(212,168,87,0.28)",
    countLoader: async () => {
      const sb = createClient();
      const { count } = await sb
        .from("aprimoramento_sugestoes")
        .select("*", { count: "exact", head: true })
        .eq("status", "pendente");
      return count ?? 0;
    },
    countLabel: (n) => `${n} pendentes`,
  },
];

export default function AssociadosIndexPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">
          Acesso restrito. Apenas administradores podem gerenciar associados.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <header className="mb-8">
        <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-2">
          Painel admin
        </p>
        <h1 className="font-fraunces text-3xl md:text-4xl text-cream leading-tight mb-3">
          Associados
        </h1>
        <p className="font-dm text-base text-cream/55 leading-relaxed max-w-2xl">
          Gerencia o conteúdo restrito a associados — começando pelos exercícios
          de aprimoramento clínico e a fila de sugestões enviadas por eles.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {SUB_AREAS.map((card) => (
          <SubAreaCard key={card.href} card={card} />
        ))}
      </div>
    </div>
  );
}

function SubAreaCard({ card }: { card: Card }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!card.countLoader) return;
    card
      .countLoader()
      .then(setCount)
      .catch(() => setCount(null));
  }, [card]);

  return (
    <Link
      href={card.href}
      className="group block rounded-2xl p-5 md:p-6 transition-all duration-200 hover:translate-y-[-1px] relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${card.tint} 0%, rgba(255,255,255,0.02) 100%)`,
        border: `1px solid ${card.border}`,
      }}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: card.tint,
              border: `1px solid ${card.border}`,
            }}
            aria-hidden="true"
          >
            <card.Icon
              width={18}
              height={18}
              style={{ color: card.color }}
            />
          </div>
          <div>
            <p
              className="font-dm text-[10px] font-bold tracking-[0.24em] uppercase"
              style={{ color: card.color }}
            >
              {card.pretitle}
            </p>
            <h2 className="font-fraunces text-lg md:text-xl text-cream group-hover:text-accent transition-colors">
              {card.title}
            </h2>
          </div>
        </div>
        <ChevronRight
          className="text-cream/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all mt-2"
          width={18}
          height={18}
          aria-hidden="true"
        />
      </div>

      <p className="font-dm text-[13px] text-cream/55 leading-relaxed mb-4">
        {card.description}
      </p>

      {card.countLabel && (
        <div
          className="font-dm text-[11px] font-medium inline-block px-2.5 py-1 rounded-full"
          style={{
            color: card.color,
            background: card.tint,
            border: `1px solid ${card.border}`,
          }}
        >
          {count === null ? "—" : card.countLabel(count)}
        </div>
      )}
    </Link>
  );
}
