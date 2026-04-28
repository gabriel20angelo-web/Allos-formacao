"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { toast } from "sonner";
import { BookOpen, Check } from "lucide-react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmError, setConfirmError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasRecoveryToken, setHasRecoveryToken] = useState<boolean | null>(null);

  useEffect(() => {
    // O Supabase entrega um token de recovery via fragmento (#access_token=...&type=recovery)
    // ou já estabelece sessão se o link foi processado pelo callback. Detectamos qualquer um.
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setHasRecoveryToken(!!data.session);
    });
  }, []);

  const passwordChecks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
  };
  const passwordValid =
    passwordChecks.length && passwordChecks.uppercase && passwordChecks.number;

  function validateConfirm(value: string): boolean {
    if (!value) {
      setConfirmError("");
      return false;
    }
    if (value !== password) {
      setConfirmError("As senhas não coincidem.");
      return false;
    }
    setConfirmError("");
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordValid) {
      toast.error("A senha não atende os requisitos mínimos.");
      return;
    }
    if (!validateConfirm(confirmPassword)) return;

    setLoading(true);
    const { error } = await createClient().auth.updateUser({ password });
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Senha atualizada! Faça login com a nova senha.");
    router.push("/formacao/auth");
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
            Definir nova senha
          </h1>
          <p className="text-cream/40 text-sm font-dm">
            Escolha uma senha forte para sua conta.
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
          {hasRecoveryToken === false ? (
            <p className="text-center text-cream/50 text-sm">
              Link inválido ou expirado. Solicite um novo em{" "}
              <a
                href="/formacao/auth/forgot-password"
                className="text-accent hover:underline"
              >
                Recuperar senha
              </a>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Input
                  label="Nova senha"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (confirmPassword) validateConfirm(confirmPassword);
                  }}
                  required
                  autoComplete="new-password"
                />
                {password && (
                  <div className="mt-2 space-y-1">
                    {(
                      [
                        { key: "length" as const, label: "Mínimo 8 caracteres" },
                        { key: "uppercase" as const, label: "Uma letra maiúscula" },
                        { key: "number" as const, label: "Um número" },
                      ]
                    ).map(({ key, label }) => (
                      <div key={key} className="flex items-center gap-1.5">
                        <Check
                          className={`h-3 w-3 ${
                            passwordChecks[key] ? "text-[#2E9E8F]" : "text-cream/25"
                          }`}
                        />
                        <span
                          className={`text-xs ${
                            passwordChecks[key] ? "text-green-400" : "text-cream/40"
                          }`}
                        >
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Input
                label="Confirmar senha"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (confirmError) validateConfirm(e.target.value);
                }}
                onBlur={() => confirmPassword && validateConfirm(confirmPassword)}
                error={confirmError}
                required
                autoComplete="new-password"
              />
              <Button type="submit" loading={loading} fullWidth size="lg">
                Atualizar senha
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
