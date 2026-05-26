import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EXERCISES } from "@/lib/aprimoramento-dinamicas";
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
      <header className="mb-10 md:mb-14">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
        {EXERCISES.map((ex) => (
          <Link
            key={ex.slug}
            href={`/formacao/aprimoramento-dinamicas/${ex.slug}`}
            className="group block rounded-2xl p-5 md:p-6 transition-all duration-200 hover:bg-white/[0.05]"
            style={{
              background: "rgba(255,255,255,0.025)",
              border: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-start gap-4">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-fraunces text-base font-bold"
                style={{
                  background: "rgba(200,75,49,0.12)",
                  color: "#C84B31",
                  border: "1px solid rgba(200,75,49,0.25)",
                }}
              >
                {ex.number}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-fraunces text-lg md:text-xl text-cream leading-snug mb-2 group-hover:text-accent transition-colors">
                  {ex.title}
                </h2>
                <p className="font-dm text-sm text-cream/55 leading-relaxed">
                  {ex.summary}
                </p>
              </div>
              <svg
                className="flex-shrink-0 text-cream/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
