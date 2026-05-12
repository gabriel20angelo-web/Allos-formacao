import { describe, it, expect } from "vitest";
import {
  classifyAuthError,
  authErrorMessage,
  isRetriableAuthError,
} from "./error-message";

describe("classifyAuthError", () => {
  it("identifica credenciais inválidas", () => {
    expect(classifyAuthError({ message: "Invalid login credentials" })).toBe(
      "invalid_credentials"
    );
    expect(classifyAuthError({ message: "invalid_grant" })).toBe(
      "invalid_credentials"
    );
  });

  it("identifica falhas de rede pelo texto", () => {
    expect(classifyAuthError({ message: "Failed to fetch" })).toBe("network");
    expect(classifyAuthError({ message: "Load failed" })).toBe("network");
    expect(classifyAuthError({ message: "NetworkError when attempting to fetch" })).toBe(
      "network"
    );
    expect(classifyAuthError({ message: "request timed out" })).toBe("network");
  });

  it("identifica falhas de upstream pelo status HTTP 5xx", () => {
    expect(classifyAuthError({ message: "x", status: 522 })).toBe("network");
    expect(classifyAuthError({ message: "x", status: 503 })).toBe("network");
    expect(classifyAuthError({ message: "x", status: 504 })).toBe("network");
    expect(classifyAuthError({ message: "x", status: 500 })).toBe("network");
  });

  it("identifica rate limit", () => {
    expect(classifyAuthError({ message: "x", status: 429 })).toBe("rate_limit");
    expect(classifyAuthError({ message: "rate limit exceeded" })).toBe("rate_limit");
  });

  it("identifica email não confirmado e usuário existente", () => {
    expect(classifyAuthError({ message: "Email not confirmed" })).toBe(
      "email_not_confirmed"
    );
    expect(classifyAuthError({ message: "User already registered" })).toBe(
      "user_exists"
    );
  });

  it("não confunde credenciais inválidas com network", () => {
    // Credenciais erradas devolvem status 400 mas mensagem clara — não retry.
    expect(
      classifyAuthError({ message: "Invalid login credentials", status: 400 })
    ).toBe("invalid_credentials");
  });

  it("retorna unknown para mensagens não mapeadas", () => {
    expect(classifyAuthError({ message: "algo estranho aconteceu" })).toBe(
      "unknown"
    );
    expect(classifyAuthError(null)).toBe("unknown");
    expect(classifyAuthError(undefined)).toBe("unknown");
  });
});

describe("authErrorMessage", () => {
  it("traduz erros conhecidos pra pt-BR", () => {
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe(
      "Email ou senha incorretos."
    );
    expect(authErrorMessage({ message: "Failed to fetch" })).toBe(
      "Servidor de autenticação temporariamente indisponível. Tente novamente em alguns instantes."
    );
    expect(authErrorMessage({ message: "x", status: 522 })).toBe(
      "Servidor de autenticação temporariamente indisponível. Tente novamente em alguns instantes."
    );
  });

  it("usa fallback quando erro é null", () => {
    expect(authErrorMessage(null, "fallback custom")).toBe("fallback custom");
  });

  it("ecoa mensagem original em erros não mapeados", () => {
    expect(authErrorMessage({ message: "outro erro" })).toBe("outro erro");
  });
});

describe("isRetriableAuthError", () => {
  it("retorna true só pra erros de rede", () => {
    expect(isRetriableAuthError({ message: "Failed to fetch" })).toBe(true);
    expect(isRetriableAuthError({ message: "x", status: 522 })).toBe(true);
    expect(isRetriableAuthError({ message: "Invalid login credentials" })).toBe(false);
    expect(isRetriableAuthError({ message: "x", status: 429 })).toBe(false);
    expect(isRetriableAuthError(null)).toBe(false);
  });
});
