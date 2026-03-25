"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toast } from "sonner";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface LoginFormProps {
  redirectTo?: string;
}

export default function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const supabase = createClient();

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

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Email ou senha incorretos."
          : error.message
      );
      setLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso!");
    window.location.href = redirectTo || "/formacao";
  }

  return (
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
      <Input
        label="Senha"
        type="password"
        placeholder="Sua senha"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={8}
        autoComplete="current-password"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={async () => {
            if (!email) {
              toast.error("Digite seu email primeiro.");
              return;
            }
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
              redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/formacao/auth`,
            });
            if (error) {
              toast.error("Erro ao enviar email de recuperação.");
            } else {
              toast.success("Email de recuperação enviado!");
            }
          }}
          className="text-sm text-accent hover:text-accent-light transition-colors duration-200"
        >
          Esqueci minha senha
        </button>
      </div>

      <Button type="submit" loading={loading} fullWidth size="lg">
        Entrar
      </Button>
    </form>
  );
}
