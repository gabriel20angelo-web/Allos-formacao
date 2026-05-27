"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Shield } from "lucide-react";
import { toast } from "sonner";
import ExerciseEditor from "@/components/admin/aprimoramento/ExerciseEditor";
import {
  createExercicio,
  nextExerciseNumber,
} from "@/lib/queries/aprimoramento-exercicios-admin";

export default function NovoExercicioPage() {
  const { user, isAdmin } = useAuth();
  const [nextNumber, setNextNumber] = useState<number | null>(null);

  useEffect(() => {
    nextExerciseNumber().then(setNextNumber);
  }, []);

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
        <Shield className="w-12 h-12 text-[#C84B31] opacity-60" />
        <p className="font-dm text-sm text-[#FDFBF7]/50">Acesso restrito.</p>
      </div>
    );
  }

  if (nextNumber === null) {
    return (
      <p className="font-dm text-sm text-cream/40 text-center py-12">
        Preparando editor…
      </p>
    );
  }

  return (
    <ExerciseEditor
      mode="novo"
      initial={{ number: nextNumber, status: "publicado", curado: false }}
      onSubmit={async (data) => {
        if (!user) return false;
        const { error } = await createExercicio(
          { ...data, number: nextNumber },
          user.id,
        );
        if (error) {
          toast.error(`Falha ao criar: ${error.message}`);
          return false;
        }
        return true;
      }}
    />
  );
}
