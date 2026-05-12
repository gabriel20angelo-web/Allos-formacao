"use client";

import { useState } from "react";
import { createClient, seedLocalStorageCookies } from "@/lib/supabase/client";
import {
  authErrorMessage,
  isRetriableAuthError,
} from "@/lib/auth/error-message";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toast } from "sonner";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ServerSignInResult =
  | { ok: true; authCookies: { name: string; value: string }[] }
  | { ok: false; kind: "invalid_credentials" | "network" | "unknown"; message?: string };

// Login server-side fallback: o servidor chama Supabase via Railway (rota
// backbone, não passa pelo CF datacenter do usuário). Resolve quando o
// browser não consegue chegar em *.supabase.co — CF 522, iCloud Private
// Relay, adblock, DNS de operadora etc.
async function signInViaServer(
  email: string,
  password: string
): Promise<ServerSignInResult> {
  try {
    const res = await fetch("/formacao/api/sign-in", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Allos-Auth": "1",
      },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      const body = (await res.json()) as {
        authCookies?: { name: string; value: string }[];
      };
      return { ok: true, authCookies: body.authCookies || [] };
    }
    if (res.status === 401) return { ok: false, kind: "invalid_credentials" };
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      return { ok: false, kind: "network" };
    }
    return { ok: false, kind: "unknown" };
  } catch {
    return { ok: false, kind: "network" };
  }
}

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

    // Saneia o redirect — só aceita caminhos relativos same-origin.
    const target =
      redirectTo &&
      redirectTo.startsWith("/") &&
      !redirectTo.startsWith("//") &&
      !redirectTo.includes("\\")
        ? redirectTo
        : "/formacao";

    // 1ª tentativa: SDK direto (path rápido — funciona pra maioria).
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    // Se erro transitório (CF 522, fetch failed, timeout) → fallback
    // server-side. Retry direto via SDK não ajuda quando a rota do browser
    // pro Supabase está bloqueada (rede do user, adblock, Private Relay).
    if (error && isRetriableAuthError(error)) {
      const serverResult = await signInViaServer(email, password);
      if (serverResult.ok) {
        // Servidor já setou cookies HttpOnly via response. Popula localStorage
        // do SDK pra useAuth ler a sessão sem precisar bater no Supabase.
        if (serverResult.authCookies.length > 0) {
          seedLocalStorageCookies(serverResult.authCookies);
        }
        toast.success("Login realizado com sucesso!");
        window.location.href = target;
        return;
      }
      if (serverResult.kind === "invalid_credentials") {
        toast.error("Email ou senha incorretos.");
        setLoading(false);
        return;
      }
      // network/unknown: cai pro fluxo de erro abaixo com o erro original
    }

    if (error || !data.session) {
      toast.error(authErrorMessage(error, "Não foi possível entrar."));
      setLoading(false);
      return;
    }

    // SDK direto funcionou. Bridge a sessão pra cookies HttpOnly servidor
    // (sem isso Brave/Safari shields bloqueiam document.cookie e o middleware
    // não vê a sessão, gerando loop de redirect pra /auth).
    try {
      const res = await fetch("/formacao/auth/set-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Allos-Auth": "1",
        },
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
    window.location.href = target;
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
