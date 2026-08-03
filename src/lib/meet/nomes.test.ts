// O casamento de nome é a peça que decide de quem é cada presença. Errar aqui
// contamina duas histórias ao mesmo tempo e ninguém percebe, então os casos que
// aparecem de verdade ficam registrados aqui.

import { describe, expect, it } from "vitest";
import { ehContaDaCasa, normalizarNome, similaridade, sugerirAluno } from "./nomes";

const s = (a: string, b: string) => similaridade(normalizarNome(a), normalizarNome(b));

describe("similaridade de nomes", () => {
  it("reconhece nome escrito pela metade, que é o caso mais comum", () => {
    // A pessoa se cadastra completo e entra no Meet com dois nomes.
    expect(s("Ana Paula", "Ana Paula Ferreira Lima")).toBeGreaterThan(0.8);
  });

  it("tolera letra trocada", () => {
    expect(s("Gabirel Angelo", "Gabriel Angelo")).toBeGreaterThan(0.8);
  });

  it("ignora maiúscula e acento", () => {
    expect(s("ANA PAULA FERREIRA", "Ana Paula Ferreira")).toBe(1);
    expect(s("Joao Conceicao", "João Conceição")).toBe(1);
  });

  it("ignora nome de aparelho no começo", () => {
    // "iPhone de Ana" precisa continuar batendo com Ana.
    expect(s("iPhone de Ana Paula", "Ana Paula Ferreira")).toBeGreaterThan(0.7);
  });

  it("separa irmãos: mesmo sobrenome, primeiro nome diferente", () => {
    expect(s("Maria Souza", "Joao Souza")).toBeLessThan(0.6);
  });

  it("separa pessoas diferentes com nome parecido", () => {
    expect(s("Ana Paula Silva", "Ana Paula Souza")).toBeLessThan(0.9);
  });
});

describe("decisão de casar sozinho", () => {
  const candidatos = [
    { id: "1", full_name: "Ana Paula Ferreira Lima", nomeNorm: normalizarNome("Ana Paula Ferreira Lima") },
    { id: "2", full_name: "Carlos Eduardo Mendes", nomeNorm: normalizarNome("Carlos Eduardo Mendes") },
  ];

  it("casa quando há um só candidato parecido", () => {
    expect(sugerirAluno("Ana Paula", candidatos).automatico).toBe("1");
  });

  it("casa com nome idêntico", () => {
    expect(sugerirAluno("Carlos Eduardo Mendes", candidatos).automatico).toBe("2");
  });

  it("NÃO casa quando dois candidatos empatam", () => {
    // O risco real: duas pessoas com o mesmo começo de nome. Casar com
    // qualquer uma seria chute, e o chute aqui é silencioso.
    const gemeas = [
      { id: "3", full_name: "Ana Paula Silva", nomeNorm: normalizarNome("Ana Paula Silva") },
      { id: "4", full_name: "Ana Paula Souza", nomeNorm: normalizarNome("Ana Paula Souza") },
    ];
    expect(sugerirAluno("Ana Paula", gemeas).automatico).toBeNull();
    // Mas continua sugerindo as duas para alguém decidir.
    expect(sugerirAluno("Ana Paula", gemeas).sugestoes.length).toBe(2);
  });

  it("NÃO casa quando ninguém se parece", () => {
    expect(sugerirAluno("Roberto Nascimento", candidatos).automatico).toBeNull();
  });
});

describe("conta da instituição", () => {
  it("reconhece a conta da associação, que nunca é aluno", () => {
    expect(ehContaDaCasa("Associação Allos")).toBe(true);
    expect(ehContaDaCasa("ALLOS")).toBe(true);
    expect(ehContaDaCasa("Diretoria Allos")).toBe(true);
  });

  it("não confunde com pessoa de nome parecido", () => {
    expect(ehContaDaCasa("Carlos Allosio")).toBe(false);
  });
});
