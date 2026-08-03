// Tela de acesso suspenso.
//
// Mostra o motivo registrado no bloqueio e o canal de contato. Bloquear sem
// dizer por quê transforma qualquer erro administrativo em conflito, então o
// motivo aparece aqui mesmo, com a data.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Skeleton from "@/components/ui/Skeleton";
import { motion } from "framer-motion";
import { Lock, Mail } from "lucide-react";

export default function AcessoSuspensoPage() {
  const { user, loading, signOut } = useAuth();
  const [motivo, setMotivo] = useState<string | null>(null);
  const [desde, setDesde] = useState<string | null>(null);
  const [bloqueado, setBloqueado] = useState<boolean | null>(null);

  useEffect(() => {
    async function carregar() {
      if (!user) return;
      const sb = createClient();
      const { data } = await sb
        .from("profiles")
        .select("bloqueado, bloqueado_motivo, bloqueado_em")
        .eq("id", user.id)
        .maybeSingle();
      setBloqueado(!!data?.bloqueado);
      setMotivo(data?.bloqueado_motivo ?? null);
      setDesde(data?.bloqueado_em ?? null);
    }
    carregar();
  }, [user]);

  if (loading || bloqueado === null) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  // Desbloqueado enquanto a aba estava aberta: manda seguir a vida.
  if (bloqueado === false) {
    return (
      <div className="max-w-lg mx-auto px-6 py-20 text-center">
        <h1 className="font-fraunces font-bold text-2xl text-cream mb-3">
          Seu acesso está liberado
        </h1>
        <Link
          href="/formacao"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-[10px] text-sm font-medium text-cream"
          style={{
            background: "linear-gradient(135deg, #C84B31, #A33D27)",
            boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
          }}
        >
          Voltar para a formação
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-lg mx-auto px-6 py-20 text-center"
    >
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <Lock className="h-8 w-8" style={{ color: "#EF4444" }} />
      </div>

      <h1 className="font-fraunces font-bold text-2xl text-cream mb-3 tracking-tight">
        Acesso suspenso
      </h1>

      <p className="text-sm text-cream/50 font-dm leading-relaxed mb-5">
        Seu acesso à plataforma de formação está suspenso
        {desde && (
          <> desde {new Date(desde).toLocaleDateString("pt-BR")}</>
        )}
        .
      </p>

      {motivo && (
        <div
          className="rounded-[12px] px-4 py-3 mb-6 text-left"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <p className="text-[11px] font-semibold text-cream/40 mb-1 font-dm">
            Motivo registrado
          </p>
          <p className="text-[13px] text-cream/65 font-dm whitespace-pre-wrap">
            {motivo}
          </p>
        </div>
      )}

      <p className="text-[12px] text-cream/35 font-dm leading-relaxed mb-6">
        Se você discorda desta decisão, escreva para o contato abaixo: você tem
        direito de se manifestar, conforme a cláusula 10.2 dos{" "}
        <Link href="/formacao/termos" className="text-accent hover:underline">
          Termos de Uso
        </Link>
        . Certificados já emitidos de forma regular continuam válidos.
      </p>

      <div className="flex flex-col-reverse sm:flex-row gap-2.5 justify-center">
        <button
          onClick={() => signOut()}
          className="px-4 py-2.5 rounded-[10px] text-sm font-dm text-cream/50 hover:text-cream transition-colors"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        >
          Sair da conta
        </button>
        <a
          href="mailto:suporte@allos.org.br?subject=Recurso%20sobre%20suspens%C3%A3o%20de%20acesso"
          className="px-4 py-2.5 rounded-[10px] text-sm font-medium text-cream inline-flex items-center justify-center gap-2"
          style={{
            background: "linear-gradient(135deg, #C84B31, #A33D27)",
            boxShadow: "0 2px 12px rgba(200,75,49,0.3)",
          }}
        >
          <Mail className="h-4 w-4" />
          Falar com a Allos
        </a>
      </div>
    </motion.div>
  );
}
