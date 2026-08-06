import { describe, it, expect } from "vitest";
import {
  chaveTexto,
  separarCondutores,
  tendencia,
  porCondutor,
  porAtividade,
  porDiaSemana,
  resumir,
  serieSemanal,
  type EncontroMedido,
} from "./quorum";
import { chaveTelefone } from "@/lib/clinica/avaliallos";

function enc(p: Partial<EncontroMedido> & { id: string }): EncontroMedido {
  return {
    slotId: null,
    atividade: "Grupo",
    atividadeChave: "grupo",
    condutores: [],
    data: "2026-08-01",
    diaSemana: 0,
    duracaoMin: 90,
    duracaoPrevistaMin: 90,
    quorum: 10,
    falaram: 5,
    temTranscricao: true,
    permanenciaMediaPct: 80,
    saidaAntecipadaMediaMin: 0,
    sessoesMedia: 1,
    falaCondutorPct: 40,
    declararam: 0,
    ...p,
  };
}

describe("separarCondutores", () => {
  it("separa a dupla que a ingestão grava como uma string só", () => {
    // `formacao_meet_encontros.condutor_nome` recebe nomesCondutores.join(", ").
    // Quem usa a string inteira como chave perde os dois condutores de uma vez.
    expect(separarCondutores("Ana, João")).toEqual(["Ana", "João"]);
  });

  it("trata o condutor solo", () => {
    expect(separarCondutores("Laura")).toEqual(["Laura"]);
  });

  it("não inventa uma pessoa chamada Sem condutor", () => {
    expect(separarCondutores("Sem condutor")).toEqual([]);
    expect(separarCondutores(null)).toEqual([]);
    expect(separarCondutores("")).toEqual([]);
  });

  it("descarta espaço solto entre vírgulas", () => {
    expect(separarCondutores("Ana ,  , João ")).toEqual(["Ana", "João"]);
  });
});

describe("chaveTexto", () => {
  it("ignora acento, caixa e espaço repetido", () => {
    expect(chaveTexto("Tácia  DE  Souza")).toBe(chaveTexto("tacia de souza"));
  });

  it("renomear só o acento não parte o grupo", () => {
    expect(chaveTexto("Construção de caso clínico")).toBe(
      chaveTexto("Construcao de caso clinico"),
    );
  });
});

describe("tendencia", () => {
  it("exige quatro encontros, senão é ruído com seta", () => {
    expect(tendencia([10, 8, 6])).toBeNull();
  });

  it("mede a metade recente contra a antiga, em pessoas", () => {
    expect(tendencia([10, 10, 6, 6])).toBe(-4);
    expect(tendencia([6, 6, 10, 10])).toBe(4);
  });
});

describe("porCondutor", () => {
  it("credita o encontro aos DOIS condutores da dupla", () => {
    // Era o defeito das telas antigas: num slot com dois condutores, o segundo
    // ficava invisível, porque `condutorPrincipal` só guarda o primeiro.
    const m = porCondutor([enc({ id: "a", condutores: ["Ana", "João"], quorum: 12 })]);
    expect(m.get("ana")?.encontros).toHaveLength(1);
    expect(m.get("joao")?.encontros).toHaveLength(1);
  });

  it("junta encontros do mesmo condutor escritos com grafia diferente", () => {
    const m = porCondutor([
      enc({ id: "a", condutores: ["Tácia"] }),
      enc({ id: "b", condutores: ["tacia"] }),
    ]);
    expect(m.size).toBe(1);
    expect(m.get("tacia")?.encontros).toHaveLength(2);
  });
});

describe("porAtividade", () => {
  it("agrupa por atividade, não por slot: mudar de horário não parte o grupo", () => {
    const m = porAtividade([
      enc({ id: "a", slotId: "slot-terca", atividadeChave: "grupo", quorum: 10 }),
      enc({ id: "b", slotId: "slot-quarta", atividadeChave: "grupo", quorum: 12 }),
    ]);
    expect(m.size).toBe(1);
    expect(m.get("grupo")?.encontros).toHaveLength(2);
    expect(m.get("grupo")?.slots.size).toBe(2);
  });
});

describe("porDiaSemana", () => {
  it("agrupa pela convenção da coluna, onde 0 é segunda", () => {
    const r = porDiaSemana([
      enc({ id: "a", diaSemana: 1, quorum: 10 }),
      enc({ id: "b", diaSemana: 1, quorum: 20 }),
      enc({ id: "c", diaSemana: 2, quorum: 4 }),
    ]);
    expect(r).toEqual([
      { dia: 1, encontros: 2, quorumMedio: 15 },
      { dia: 2, encontros: 1, quorumMedio: 4 },
    ]);
  });
});

describe("resumir", () => {
  it("mede vozes ativas sobre o quórum, que já exclui quem conduz", () => {
    const r = resumir([enc({ id: "a", quorum: 10, falaram: 4 })]);
    expect(r.vozesAtivasPct).toBe(40);
  });

  it("encontro sem transcrição não puxa vozes ativas para baixo", () => {
    // Ausência de dado não é silêncio. Sem esta regra, ligar a transcrição em
    // metade dos grupos faria o indicador despencar sem nada ter mudado.
    const r = resumir([
      enc({ id: "a", quorum: 10, falaram: 5, temTranscricao: true }),
      enc({ id: "b", quorum: 10, falaram: 0, temTranscricao: false }),
    ]);
    expect(r.vozesAtivasPct).toBe(50);
    expect(r.encontrosComTranscricao).toBe(1);
  });

  it("não conta como calado o encontro em que o condutor não foi reconhecido", () => {
    // `falaCondutorPct: null` é o zero da ingestão já convertido na leitura.
    const r = resumir([
      enc({ id: "a", falaCondutorPct: 60 }),
      enc({ id: "b", falaCondutorPct: null }),
    ]);
    expect(r.falaCondutorPct).toBe(60);
    expect(r.encontrosComCondutorReconhecido).toBe(1);
  });

  it("mede tendência na ordem cronológica, não na ordem que chegou", () => {
    const r = resumir([
      enc({ id: "d", data: "2026-08-22", quorum: 4 }),
      enc({ id: "a", data: "2026-08-01", quorum: 10 }),
      enc({ id: "c", data: "2026-08-15", quorum: 6 }),
      enc({ id: "b", data: "2026-08-08", quorum: 10 }),
    ]);
    expect(r.tendencia).toBe(-5);
    expect(r.primeiro).toBe("2026-08-01");
    expect(r.ultimo).toBe("2026-08-22");
  });
});

describe("serieSemanal", () => {
  it("preenche a semana sem encontro com zero", () => {
    // Sem isso, um gráfico de linha desenha uma pausa de férias como declínio
    // suave, porque liga o ponto de antes direto no ponto de depois.
    const mapa = new Map([
      ["a", new Set(["p1", "p2"])],
      ["c", new Set(["p1"])],
    ]);
    const r = serieSemanal(
      [
        enc({ id: "a", data: "2026-08-03" }),
        enc({ id: "c", data: "2026-08-17" }),
      ],
      mapa,
    );
    expect(r).toEqual([
      { semana: "2026-08-03", pessoas: 2 },
      { semana: "2026-08-10", pessoas: 0 },
      { semana: "2026-08-17", pessoas: 1 },
    ]);
  });

  it("conta pessoa distinta, não presença: dois grupos na mesma semana contam um", () => {
    const mapa = new Map([
      ["a", new Set(["p1"])],
      ["b", new Set(["p1"])],
    ]);
    const r = serieSemanal(
      [enc({ id: "a", data: "2026-08-04" }), enc({ id: "b", data: "2026-08-06" })],
      mapa,
    );
    expect(r).toEqual([{ semana: "2026-08-03", pessoas: 1 }]);
  });
});

describe("chaveTelefone", () => {
  it("absorve as formas de escrever o mesmo número", () => {
    const esperado = "8199998888";
    expect(chaveTelefone("(81) 99999-8888")).toBe(esperado);
    expect(chaveTelefone("81999998888")).toBe(esperado);
    expect(chaveTelefone("5581999998888")).toBe(esperado);
    expect(chaveTelefone("+55 81 99999-8888")).toBe(esperado);
    expect(chaveTelefone("0 81 99999-8888")).toBe(esperado);
  });

  it("casa o cadastro antigo de dez dígitos com o atual de onze", () => {
    // É a diferença entre esta normalização e a que a base usa hoje: sem tratar
    // o nono dígito, a mesma pessoa vira duas.
    expect(chaveTelefone("81 9999-8888")).toBe(chaveTelefone("81 99999-8888"));
  });

  it("recusa o que é curto demais para ser telefone", () => {
    expect(chaveTelefone("999888")).toBeNull();
    expect(chaveTelefone("")).toBeNull();
    expect(chaveTelefone(null)).toBeNull();
  });
});
