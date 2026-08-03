import { describe, expect, it } from "vitest";
import {
  blocosParaTexto,
  falasParaBlocos,
  formatarTempo,
  lerSrt,
  limparTextoCorrido,
} from "./transcricao";

// Trecho real do primeiro encontro da Alice, encurtado. Os tempos são os que
// vieram: repare que entre o bloco 3 e o 4 há uma pausa de mais de dois
// segundos, e é ela que precisa virar parágrafo.
const SRT = `1
00:00:02,000 --> 00:00:02,544
Pronto.

2
00:00:03,429 --> 00:00:05,854
Então vamos dar início ao nosso primeiro encontro.

3
00:00:06,820 --> 00:00:11,580
A foto do nosso querido pai, pelo menos de meu pai.

4
00:00:15,000 --> 00:00:21,182
É, de novo, né, esse é um grupo que é facilitado por mim.
`;

describe("lerSrt", () => {
  it("lê os blocos com tempo e texto", () => {
    const b = lerSrt(SRT);
    expect(b).toHaveLength(4);
    expect(b[0].texto).toBe("Pronto.");
    expect(b[0].inicioSeg).toBeCloseTo(2.0, 2);
    expect(b[3].inicioSeg).toBeCloseTo(15.0, 2);
  });

  it("aceita quebra de linha do Windows", () => {
    expect(lerSrt(SRT.replace(/\n/g, "\r\n"))).toHaveLength(4);
  });

  it("não quebra com arquivo vazio ou lixo", () => {
    expect(lerSrt("")).toEqual([]);
    expect(lerSrt("isso não é um srt")).toEqual([]);
  });
});

describe("blocosParaTexto", () => {
  it("corta parágrafo na pausa longa, não a cada bloco", () => {
    const md = blocosParaTexto(lerSrt(SRT));
    const paragrafos = md
      .split("\n")
      .filter((l) => l.trim() && !l.startsWith("#") && !l.startsWith("*"));

    // Três primeiros blocos são contíguos e viram um parágrafo só; o quarto
    // vem depois de 3,4s de silêncio e vira outro.
    expect(paragrafos).toHaveLength(2);
    expect(paragrafos[0]).toContain("Pronto. Então vamos dar início");
    expect(paragrafos[1]).toContain("esse é um grupo");
  });

  it("não emenda palavra no ponto final", () => {
    const md = blocosParaTexto(lerSrt(SRT));
    // O defeito do arquivo de texto do OpusClip: "poucoÉ, e as críticas".
    expect(md).not.toMatch(/[a-zà-ú][.!?][A-ZÀ-Ú]/);
  });

  it("marca quem falou quando a fonte sabe", () => {
    const md = blocosParaTexto([
      { inicioSeg: 0, fimSeg: 2, texto: "Boa noite a todos.", quem: "Alice" },
      { inicioSeg: 2, fimSeg: 4, texto: "Boa noite.", quem: "Fabiana" },
    ]);
    expect(md).toContain("**Alice:** Boa noite a todos.");
    expect(md).toContain("**Fabiana:** Boa noite.");
  });

  it("troca de falante quebra parágrafo mesmo sem pausa", () => {
    const md = blocosParaTexto([
      { inicioSeg: 0, fimSeg: 2, texto: "Uma pergunta.", quem: "Fabiana" },
      { inicioSeg: 2, fimSeg: 4, texto: "Pois não.", quem: "Alice" },
    ]);
    const linhas = md.split("\n").filter((l) => l.trim());
    expect(linhas).toHaveLength(2);
  });

  it("devolve vazio sem blocos, em vez de um cabeçalho órfão", () => {
    expect(blocosParaTexto([], { titulo: "Aula" })).toBe("");
  });
});

describe("limparTextoCorrido", () => {
  it("conserta o ponto colado e agrupa em parágrafos", () => {
    const cru =
      "mas pouco sentir, pouco.É, e as críticas do behaviorismo.Reduzir o ser humano.Essa visão mecanicista.E pensava-se na terceira força.Outra frase aqui.";
    const limpo = limparTextoCorrido(cru, 3);
    expect(limpo).toContain("pouco. É, e as críticas");
    expect(limpo.split("\n\n").length).toBeGreaterThan(1);
  });
});

describe("falasParaBlocos", () => {
  it("converte hora de parede em segundos desde o começo", () => {
    const b = falasParaBlocos([
      {
        display_name: "Alice",
        texto: "Começando.",
        inicio: "2026-08-03T19:00:00Z",
        fim: "2026-08-03T19:00:04Z",
      },
      {
        display_name: "Fabiana",
        texto: "Ok.",
        inicio: "2026-08-03T19:01:00Z",
        fim: "2026-08-03T19:01:02Z",
      },
    ]);
    expect(b[0].inicioSeg).toBe(0);
    expect(b[1].inicioSeg).toBe(60);
    expect(b[1].quem).toBe("Fabiana");
  });
});

describe("formatarTempo", () => {
  it("mostra hora só quando passa de uma", () => {
    expect(formatarTempo(65)).toBe("1:05");
    expect(formatarTempo(3661)).toBe("1:01:01");
  });
});
