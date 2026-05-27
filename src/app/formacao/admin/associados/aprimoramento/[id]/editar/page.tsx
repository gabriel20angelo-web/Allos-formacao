"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";
import ExerciseEditor from "@/components/admin/aprimoramento/ExerciseEditor";
import {
  getByIdForAdmin,
  updateExercicio,
  type AdminExercicioRow,
} from "@/lib/queries/aprimoramento-exercicios-admin";

export default function EditarExercicioPage({
  params,
}: {
  params: { id: string };
}) {
  const { isAdmin } = useAuth();
  const [row, setRow] = useState<AdminExercicioRow | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getByIdForAdmin(params.id).then((r) => {
      if (cancelled) return;
      setRow(r);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">Acesso restrito.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <p className="font-dm text-sm text-cream/40 text-center py-12 inline-flex items-center gap-2">
        <Loader2 className="animate-spin" width={14} height={14} /> Carregando…
      </p>
    );
  }

  if (!row) {
    return (
      <p className="font-dm text-sm text-cream/40 text-center py-12">
        Exercício não encontrado.
      </p>
    );
  }

  return (
    <ExerciseEditor
      mode="editar"
      initial={{
        id: row.id,
        slug: row.slug,
        number: row.number,
        title: row.title,
        summary: row.summary,
        category: row.category,
        formato: row.formato,
        tags: row.tags,
        recursos: row.recursos,
        blocks: row.blocks,
        curado: row.curado,
        status: row.status,
      }}
      onSubmit={async (data) => {
        const { error } = await updateExercicio(row.id, {
          slug: data.slug,
          title: data.title,
          summary: data.summary,
          category: data.category,
          formato: data.formato,
          tags: data.tags,
          recursos: data.recursos,
          blocks: data.blocks,
          curado: data.curado,
          status: data.status,
        });
        if (error) {
          toast.error(`Falha ao salvar: ${error.message}`);
          return false;
        }
        return true;
      }}
    />
  );
}
