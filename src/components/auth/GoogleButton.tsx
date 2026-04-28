"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface GoogleButtonProps {
  redirectTo?: string;
}

export default function GoogleButton({ redirectTo }: GoogleButtonProps) {
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  async function handleGoogleLogin() {
    setLoading(true);
    // skipBrowserRedirect: we want to bridge the PKCE code_verifier to
    // HTTP cookies (not just localStorage) BEFORE leaving for Google —
    // otherwise Brave/Safari shields block document.cookie and the
    // server callback can't exchange the code (AuthPKCECodeVerifierMissingError).
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || window.location.origin}/formacao/auth/callback${
          redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ""
        }`,
        skipBrowserRedirect: true,
      },
    });

    if (error || !data?.url) {
      toast.error("Erro ao conectar com o Google.");
      setLoading(false);
      return;
    }

    // Supabase SDK just saved the code_verifier via our localStorage-based
    // cookie handler. Mirror everything it stored to real HttpOnly cookies
    // so the server-side callback can read the verifier.
    try {
      const raw = localStorage.getItem("sb-auth-cookies");
      const parsed: { name: string; value: string }[] = raw ? JSON.parse(raw) : [];
      if (parsed.length > 0) {
        await fetch("/formacao/auth/sync-cookies", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Allos-Auth": "1",
          },
          body: JSON.stringify({ cookies: parsed }),
        });
      }
    } catch (err) {
      console.warn("[GoogleButton] sync-cookies failed, continuing:", err);
    }

    window.location.href = data.url;
  }

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading}
      className="
        w-full flex items-center justify-center gap-3
        px-6 py-3
        rounded-[10px]
        font-dm font-medium text-sm
        transition-all duration-250 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed
      "
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1.5px solid rgba(255,255,255,0.1)",
        color: "#FDFBF7",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(200,75,49,0.3)";
        e.currentTarget.style.background = "rgba(255,255,255,0.08)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
      }}
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24">
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
      {loading ? "Conectando..." : "Entrar com Google"}
    </button>
  );
}
