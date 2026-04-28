"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toast } from "sonner";
import { BookOpen, ArrowLeft, Mail } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  function validateEmail(value: string): boolean {
    if (!value) {
      setEmailError("");
      return false;
    }
    if (!EMAIL_REGEX.test(value)) {
      setEmailError("Formato de email inválido.");
      return false;
    }
    setEmailError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateEmail(email)) return;
    setLoading(true);

    const origin = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/formacao/auth/reset-password`,
    });

    setLoading(false);
    if (error) {
      console.error("[forgot-password]", error);
      // Mesmo em erro mostramos sucesso pra não vazar quais emails existem.
    }
    setSent(true);
    toast.success("Se o email estiver cadastrado, enviaremos as instruções.");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: "#111111" }}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2.5 mb-4">
            <div
              className="w-11 h-11 rounded-[12px] flex items-center justify-center"
              style={{
                background: "linear-gradient(135deg, #C84B31, #A33D27)",
                boxShadow: "0 4px 20px rgba(200,75,49,0.3)",
              }}
            >
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="font-fraunces font-bold text-2xl text-cream tracking-tight">
              Allos <span className="italic text-accent">Formação</span>
            </span>
          </div>
          <h1 className="font-fraunces font-bold text-xl text-cream mb-2">
            Recuperar senha
          </h1>
          <p className="text-cream/40 text-sm font-dm">
            Informe o email da sua conta para enviarmos um link de redefinição.
          </p>
        </div>

        <div
          className="rounded-[16px] p-8"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
          }}
        >
          {sent ? (
            <div className="text-center space-y-4">
              <div
                className="inline-flex w-12 h-12 rounded-full items-center justify-center"
                style={{ background: "rgba(46,158,143,0.15)" }}
              >
                <Mail className="h-5 w-5 text-teal" />
              </div>
              <p className="text-cream/70 text-sm">
                Verifique sua caixa de entrada. Se houver uma conta associada
                a <strong className="text-cream">{email}</strong>, você receberá
                o link em alguns minutos.
              </p>
              <Link
                href="/formacao/auth"
                className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) validateEmail(e.target.value);
                }}
                onBlur={() => email && validateEmail(email)}
                error={emailError}
                required
                autoComplete="email"
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Enviar instruções
              </Button>
              <Link
                href="/formacao/auth"
                className="block text-center text-sm text-cream/50 hover:text-accent"
              >
                Voltar ao login
              </Link>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
