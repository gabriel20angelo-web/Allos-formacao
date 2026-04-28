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

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      toast.error(
        error?.message === "Invalid login credentials"
          ? "Email ou senha incorretos."
          : error?.message || "Não foi possível entrar."
      );
      setLoading(false);
      return;
    }

    // Bridge the session to HttpOnly server cookies so middleware/SSR
    // recognize the user immediately. Without this, Brave/Safari shields
    // block document.cookie and the next navigation loops back to /auth.
    try {
      const res = await fetch("/formacao/auth/set-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        }),
      });
      if (!res.ok) throw new Error(`set-session ${res.status}`);
    } catch (err) {
      console.warn("[LoginForm] set-session failed, continuing anyway:", err);
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
        <a
          href="/formacao/auth/forgot-password"
          className="text-sm text-accent hover:text-accent-light transition-colors duration-200"
        >
          Esqueci minha senha
        </a>
      </div>

      <Button type="submit" loading={loading} fullWidth size="lg">
        Entrar
      </Button>
    </form>
  );
}
