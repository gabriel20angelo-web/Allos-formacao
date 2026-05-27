"use client";

import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Shield, ChevronLeft } from "lucide-react";

export default function EditarExercicioPage({
  params,
}: {
  params: { id: string };
}) {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">Acesso restrito.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link
        href="/formacao/admin/associados/aprimoramento"
        className="font-dm text-[12px] inline-flex items-center gap-1 text-cream/55 hover:text-accent transition-colors mb-6"
      >
        <ChevronLeft width={14} height={14} aria-hidden="true" />
        Aprimoramento de Dinâmicas
      </Link>

      <h1 className="font-fraunces text-3xl text-cream mb-3">
        Editar exercício
      </h1>
      <p className="font-dm text-sm text-cream/55 mb-2">
        ID: <code className="text-xs text-cream/40">{params.id}</code>
      </p>

      <div
        className="rounded-2xl p-8 text-center mt-6"
        style={{ border: "1.5px dashed rgba(255,255,255,0.08)" }}
      >
        <p className="font-dm text-sm text-cream/45 mb-2">
          Em construção — Sprint 3E
        </p>
        <p className="font-dm text-xs text-cream/30">
          Editor com identificação, conteúdo markdown e preview ao vivo.
        </p>
      </div>
    </div>
  );
}
