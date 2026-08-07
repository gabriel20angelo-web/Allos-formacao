import { describe, it, expect } from "vitest";
import { REGUA, atende, porQueNaoDaParaLer, DIAS_ESFRIANDO } from "./regua";
import { tendencia } from "./quorum";

describe("regua", () => {
  it("a recusa carrega o denominador, não um 'ainda não dá'", () => {
    // "Ainda não dá" faz o leitor achar que quebrou. "1 de 3" faz ele saber
    // quando volta, e é a diferença entre uma tela muda e uma tela honesta.
    expect(porQueNaoDaParaLer(1, REGUA.comparacaoEntreGrupos)).toBe(
      "1 de 3 encontros com transcrição",
    );
  });

  it("acima da régua não há o que explicar", () => {
    expect(porQueNaoDaParaLer(3, REGUA.comparacaoEntreGrupos)).toBeNull();
    expect(atende(3, REGUA.comparacaoEntreGrupos)).toBe(true);
  });

  it("toda régua diz por que existe, e não só o número", () => {
    // O número sozinho não sobrevive à primeira pessoa que achar que ele é
    // conservador demais.
    for (const [nome, r] of Object.entries(REGUA)) {
      expect(r.porque.length, `${nome} sem motivo`).toBeGreaterThan(10);
      expect(r.unidade.length, `${nome} sem unidade`).toBeGreaterThan(2);
      expect(r.minimo, `${nome} com mínimo inválido`).toBeGreaterThan(0);
    }
  });

  it("a tendência usa a régua, e não um número solto", () => {
    // Era o primeiro de sete limiares espalhados pelo painel.
    const quase = Array(REGUA.tendencia.minimo - 1).fill(10);
    const bastante = Array(REGUA.tendencia.minimo).fill(10);
    expect(tendencia(quase)).toBeNull();
    expect(tendencia(bastante)).not.toBeNull();
  });

  it("ranking exige mais de um grupo maduro", () => {
    // Ordenar um grupo maduro contra cinco imaturos é pódio de um.
    expect(atende(1, REGUA.ranking)).toBe(false);
    expect(atende(2, REGUA.ranking)).toBe(true);
  });

  it("a janela de sumiço é uma constante só", () => {
    // Estava escrita à mão em dois arquivos com valores que podiam divergir.
    expect(DIAS_ESFRIANDO).toBe(21);
  });
});
