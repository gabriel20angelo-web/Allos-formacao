import type { AuthError } from "@supabase/supabase-js";

export type AuthFailureKind =
  | "invalid_credentials"
  | "network"
  | "rate_limit"
  | "email_not_confirmed"
  | "user_exists"
  | "weak_password"
  | "unknown";

type AuthErrorLike =
  | (Pick<AuthError, "message"> & { status?: number })
  | { message: string; status?: number }
  | null
  | undefined;

// Detecta falhas de rede/upstream: quando o Supabase está fora (Cloudflare 522,
// timeout, DNS, adblocker), o SDK lança erro genérico "Failed to fetch" ou
// devolve status 5xx. Tratamos esses casos como transitórios — podem ser tentados
// de novo. Já status 4xx geralmente vêm de credenciais inválidas e não retornam.
export function classifyAuthError(error: AuthErrorLike): AuthFailureKind {
  if (!error) return "unknown";
  const msg = (error.message || "").toLowerCase();
  const status = (error as { status?: number }).status;

  if (msg.includes("invalid login credentials") || msg.includes("invalid_grant")) {
    return "invalid_credentials";
  }
  if (msg.includes("email not confirmed") || msg.includes("email_not_confirmed")) {
    return "email_not_confirmed";
  }
  if (msg.includes("already registered") || msg.includes("user already registered")) {
    return "user_exists";
  }
  if (msg.includes("password") && (msg.includes("weak") || msg.includes("short"))) {
    return "weak_password";
  }
  if (status === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return "rate_limit";
  }
  if (
    msg.includes("failed to fetch") ||
    msg.includes("network") ||
    msg.includes("networkerror") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("connection") ||
    msg.includes("load failed") ||
    msg.includes("fetch failed") ||
    status === 0 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    status === 522 ||
    status === 524 ||
    (typeof status === "number" && status >= 500 && status < 600)
  ) {
    return "network";
  }
  return "unknown";
}

export function authErrorMessage(
  error: AuthErrorLike,
  fallback = "Não foi possível concluir a operação."
): string {
  const kind = classifyAuthError(error);
  switch (kind) {
    case "invalid_credentials":
      return "Email ou senha incorretos.";
    case "email_not_confirmed":
      return "Confirme seu email antes de fazer login. Verifique sua caixa de entrada.";
    case "user_exists":
      return "Este email já está cadastrado. Tente fazer login.";
    case "weak_password":
      return "Senha muito fraca. Use ao menos 8 caracteres com letras e números.";
    case "rate_limit":
      return "Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.";
    case "network":
      return "Servidor de autenticação temporariamente indisponível. Tente novamente em alguns instantes.";
    default:
      return error?.message || fallback;
  }
}

export function isRetriableAuthError(error: AuthErrorLike): boolean {
  return classifyAuthError(error) === "network";
}
