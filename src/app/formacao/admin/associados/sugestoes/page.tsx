"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Shield, ChevronLeft, Lightbulb } from "lucide-react";

export default function SugestoesAdminPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">
          Acesso restrito. Apenas administradores podem aceder.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      <Link
        href="/formacao/admin/associados"
        className="font-dm text-[12px] inline-flex items-center gap-1 text-cream/55 hover:text-accent transition-colors mb-6"
      >
        <ChevronLeft width={14} height={14} aria-hidden="true" />
        Associados
      </Link>

      <header className="mb-8">
        <div className="flex items-center gap-2.5 mb-2">
          <Lightbulb
            width={14}
            height={14}
            style={{ color: "#D4A857" }}
            aria-hidden="true"
          />
          <p
            className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase"
            style={{ color: "#D4A857" }}
          >
            Fila
          </p>
        </div>
        <h1 className="font-fraunces text-3xl md:text-4xl text-cream leading-tight mb-3">
          Sugestões
        </h1>
        <p className="font-dm text-base text-cream/55 leading-relaxed max-w-2xl">
          Ideias enviadas por associados aguardando avaliação.
        </p>
      </header>

      <div
        className="rounded-2xl p-8 text-center"
        style={{
          border: "1.5px dashed rgba(255,255,255,0.08)",
        }}
      >
        <p className="font-dm text-sm text-cream/45 mb-2">
          Em construção — Sprint 3F
        </p>
        <p className="font-dm text-xs text-cream/30">
          Lista de sugestões pendentes com ações &quot;Transformar em rascunho&quot; ou &quot;Descartar&quot;.
        </p>
      </div>
    </div>
  );
}
