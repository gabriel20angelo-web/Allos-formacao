"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Shield, ChevronLeft, Sparkles } from "lucide-react";

export default function AprimoramentoAdminPage() {
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
          <Sparkles
            width={14}
            height={14}
            className="text-accent"
            aria-hidden="true"
          />
          <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent">
            Conteúdo
          </p>
        </div>
        <h1 className="font-fraunces text-3xl md:text-4xl text-cream leading-tight mb-3">
          Aprimoramento de Dinâmicas
        </h1>
        <p className="font-dm text-base text-cream/55 leading-relaxed max-w-2xl">
          Lista, edita, cria, cura e arquiva os exercícios.
        </p>
      </header>

      <div
        className="rounded-2xl p-8 text-center"
        style={{
          border: "1.5px dashed rgba(255,255,255,0.08)",
        }}
      >
        <p className="font-dm text-sm text-cream/45 mb-2">
          Em construção — Sprint 3D
        </p>
        <p className="font-dm text-xs text-cream/30">
          Lista CRUD com filtros, busca e ações inline (editar/curar/arquivar/excluir).
        </p>
      </div>
    </div>
  );
}
