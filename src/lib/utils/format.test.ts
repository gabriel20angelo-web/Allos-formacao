import { describe, it, expect } from "vitest";
import {
  formatPrice,
  formatDuration,
  formatFileSize,
  slugify,
} from "./format";

describe("formatPrice", () => {
  it("formata centavos como BRL", () => {
    // \u00a0 = non-breaking space que Intl insere entre R$ e número.
    expect(formatPrice(10000)).toBe("R$\u00a0100,00");
    expect(formatPrice(0)).toBe("R$\u00a00,00");
    expect(formatPrice(150)).toBe("R$\u00a01,50");
  });
});

describe("formatDuration", () => {
  it("renderiza minutos puros quando < 60", () => {
    expect(formatDuration(45)).toBe("45min");
    expect(formatDuration(1)).toBe("1min");
  });

  it("renderiza horas exatas sem minutos quando múltiplo de 60", () => {
    expect(formatDuration(60)).toBe("1h");
    expect(formatDuration(120)).toBe("2h");
  });

  it("combina horas + minutos quando há resto", () => {
    expect(formatDuration(75)).toBe("1h 15min");
    expect(formatDuration(135)).toBe("2h 15min");
  });
});

describe("formatFileSize", () => {
  it("usa B até 1024", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("usa KB entre 1024 e 1 MB", () => {
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("usa MB acima de 1 MB", () => {
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("slugify", () => {
  it("remove acentos e normaliza espaços/símbolos", () => {
    expect(slugify("Introdução à Psicologia")).toBe(
      "introducao-a-psicologia"
    );
  });

  it("remove dashes nas pontas", () => {
    expect(slugify("  --abc--  ")).toBe("abc");
  });

  it("colapsa múltiplos separadores", () => {
    expect(slugify("foo!!!bar???baz")).toBe("foo-bar-baz");
  });

  it("preserva ç corretamente (vira c)", () => {
    expect(slugify("Coração")).toBe("coracao");
  });
});
