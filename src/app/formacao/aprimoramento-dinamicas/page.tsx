import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EXERCISES } from "@/lib/aprimoramento-dinamicas";
import ExerciseCatalog from "@/components/aprimoramento/ExerciseCatalog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aprimoramento de Dinâmicas — Allos Formação",
  description:
    "Lista curada de exercícios e dinâmicas para grupos de aprimoramento clínico. Acesso restrito a associados.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AprimoramentoDinamicasPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/formacao/auth?next=/formacao/aprimoramento-dinamicas");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowed = profile?.role === "associado" || profile?.role === "admin";
  if (!allowed) {
    redirect("/formacao");
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-8 md:py-12">
      <header className="mb-10 md:mb-12">
        <p className="font-dm text-[11px] font-semibold tracking-[0.28em] uppercase text-accent mb-3">
          Restrito a associados
        </p>
        <h1 className="font-fraunces text-3xl md:text-5xl text-cream leading-tight mb-4">
          Aprimoramento de Dinâmicas
        </h1>
        <p className="font-dm text-base md:text-lg text-cream/65 leading-relaxed max-w-3xl">
          Lista curada de {EXERCISES.length} exercícios para grupos de aprimoramento
          clínico. Cada dinâmica traz contextualização, objetivo e descrição
          passo-a-passo — pensada para coordenadores, supervisores e participantes
          conduzirem juntos.
        </p>
      </header>

      <ExerciseCatalog exercises={EXERCISES} />
    </div>
  );
}
