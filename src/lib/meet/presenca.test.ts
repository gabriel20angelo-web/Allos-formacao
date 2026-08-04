// A conta dos minutos de presença.
//
// Existe por um número que apareceu em produção: 167 minutos de presença num
// encontro de 85. A causa era soma crua de sessões que se sobrepõem, e o erro
// passava despercebido porque a permanência é capada em 100% e o total do
// encontro não é conferido contra a duração dele.

import { describe, expect, it } from "vitest";
import { medirSessoes } from "./ingest";

const FIM = new Date("2026-08-04T18:27:00Z");

function sessao(inicio: string, fim?: string) {
  return { startTime: inicio, endTime: fim } as never;
}

describe("medirSessoes", () => {
  it("soma uma sessão simples", () => {
    const r = medirSessoes([sessao("2026-08-04T17:00:00Z", "2026-08-04T18:00:00Z")], FIM);
    expect(r.minutos).toBe(60);
  });

  it("soma sessões separadas, sem inventar o intervalo entre elas", () => {
    const r = medirSessoes(
      [
        sessao("2026-08-04T17:00:00Z", "2026-08-04T17:30:00Z"),
        sessao("2026-08-04T18:00:00Z", "2026-08-04T18:20:00Z"),
      ],
      FIM
    );
    expect(r.minutos).toBe(50);
  });

  it("não conta duas vezes quem entrou por dois aparelhos ao mesmo tempo", () => {
    const r = medirSessoes(
      [
        sessao("2026-08-04T17:01:00Z", "2026-08-04T18:25:00Z"),
        sessao("2026-08-04T17:05:00Z", "2026-08-04T18:20:00Z"),
      ],
      FIM
    );
    // A janela real é de 17:01 às 18:25. A soma crua daria 159.
    expect(r.minutos).toBe(84);
  });

  it("une sobreposição parcial em vez de somar o pedaço repetido", () => {
    const r = medirSessoes(
      [
        sessao("2026-08-04T17:00:00Z", "2026-08-04T17:40:00Z"),
        sessao("2026-08-04T17:30:00Z", "2026-08-04T18:00:00Z"),
      ],
      FIM
    );
    expect(r.minutos).toBe(60);
  });

  it("sessão que ficou aberta conta até o fim do encontro", () => {
    const r = medirSessoes([sessao("2026-08-04T18:00:00Z")], FIM);
    expect(r.minutos).toBe(27);
  });

  it("guarda a primeira entrada e a última saída, mesmo fora de ordem", () => {
    const r = medirSessoes(
      [
        sessao("2026-08-04T18:00:00Z", "2026-08-04T18:20:00Z"),
        sessao("2026-08-04T17:00:00Z", "2026-08-04T17:30:00Z"),
      ],
      FIM
    );
    expect(r.entrada?.toISOString()).toBe("2026-08-04T17:00:00.000Z");
    expect(r.saida?.toISOString()).toBe("2026-08-04T18:20:00.000Z");
    expect(r.n).toBe(2);
  });

  it("ignora sessão sem começo e sessão que termina antes de começar", () => {
    const r = medirSessoes(
      [
        { startTime: undefined, endTime: "2026-08-04T18:00:00Z" } as never,
        sessao("2026-08-04T18:00:00Z", "2026-08-04T17:00:00Z"),
      ],
      FIM
    );
    expect(r.minutos).toBe(0);
  });
});
