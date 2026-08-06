import { describe, expect, it } from "vitest";
import {
  TETO_POR_RODADA,
  aindaTemTrabalho,
  ordenarPorUrgencia,
  type EncontroConhecido,
} from "./fila";

const AGORA = new Date("2026-08-06T03:00:00Z").getTime();

function enc(p: Partial<EncontroConhecido>): EncontroConhecido {
  return {
    conference_record_id: "conferenceRecords/x",
    inicio: "2026-08-05T18:56:00Z",
    fim: "2026-08-05T20:05:00Z",
    descartado: false,
    transcricao_ingerida: true,
    gravacao_uri: "https://drive.google.com/file/d/abc/view",
    ...p,
  };
}

describe("aindaTemTrabalho", () => {
  it("cobra o encontro que nunca fechou a transcrição", () => {
    expect(aindaTemTrabalho(enc({ transcricao_ingerida: false }), AGORA)).toBe(true);
  });

  it("cobra o encontro ingerido que ainda está sem gravação", () => {
    // O caso de 05/08/2026: transcrição colhida, vídeo pronto no Google horas
    // depois, e nada voltava para buscá-lo.
    expect(aindaTemTrabalho(enc({ gravacao_uri: null }), AGORA)).toBe(true);
  });

  it("não cobra nada de quem já tem transcrição e gravação", () => {
    expect(aindaTemTrabalho(enc({}), AGORA)).toBe(false);
  });

  it("desiste da gravação depois de dois dias", () => {
    const velho = enc({
      gravacao_uri: null,
      inicio: "2026-08-01T18:00:00Z",
      fim: "2026-08-01T19:00:00Z",
    });
    expect(aindaTemTrabalho(velho, AGORA)).toBe(false);
  });

  it("ignora o descartado mesmo sem transcrição ingerida", () => {
    // Teste de link de dez segundos nunca ganha transcrição do Google, e por
    // 48 horas contava como pendência de verdade.
    const lixo = enc({ descartado: true, transcricao_ingerida: false, gravacao_uri: null });
    expect(aindaTemTrabalho(lixo, AGORA)).toBe(false);
  });

  it("usa o início quando o fim não foi gravado", () => {
    const semFim = enc({ fim: null, gravacao_uri: null, inicio: "2026-08-06T01:00:00Z" });
    expect(aindaTemTrabalho(semFim, AGORA)).toBe(true);
  });

  it("não trava em data inválida", () => {
    const quebrado = enc({ fim: "não é data", gravacao_uri: null, inicio: "também não" });
    expect(aindaTemTrabalho(quebrado, AGORA)).toBe(false);
  });
});

describe("ordenarPorUrgencia", () => {
  const conf = (id: string, hora: string) => ({
    name: id,
    startTime: `2026-08-05T${hora}:00Z`,
  });

  it("põe o pendente na frente de tudo", () => {
    const lista = [conf("nova", "21:30"), conf("pendente", "18:56")];
    const ordem = ordenarPorUrgencia(lista, new Set(["pendente"]), new Set());
    expect(ordem.map((c) => c.name)).toEqual(["pendente", "nova"]);
  });

  it("empurra o lixo conhecido para o fim, mesmo sendo mais recente", () => {
    const lista = [
      conf("lixo1", "21:30"),
      conf("lixo2", "20:57"),
      conf("real", "18:56"),
    ];
    const ordem = ordenarPorUrgencia(lista, new Set(), new Set(["lixo1", "lixo2"]));
    expect(ordem.map((c) => c.name)).toEqual(["real", "lixo1", "lixo2"]);
  });

  it("desempata as novas da mais recente para a mais antiga", () => {
    const lista = [conf("antiga", "14:00"), conf("recente", "20:00")];
    const ordem = ordenarPorUrgencia(lista, new Set(), new Set());
    expect(ordem.map((c) => c.name)).toEqual(["recente", "antiga"]);
  });

  it("salva o encontro real quando o teto está tomado por testes de link", () => {
    // A falha exata de 05/08/2026: oito testes de link no mesmo dia, teto de
    // oito por rodada, e o encontro de 69 minutos era sempre o nono.
    const lixo = Array.from({ length: 8 }, (_, i) =>
      conf(`lixo${i}`, String(20 + Math.floor(i / 4)).padStart(2, "0") + ":0" + (i % 4))
    );
    const real = conf("real", "18:56");
    const ordem = ordenarPorUrgencia(
      [...lixo, real],
      new Set(["real"]),
      new Set(lixo.map((c) => c.name))
    ).slice(0, TETO_POR_RODADA);

    expect(ordem[0].name).toBe("real");
    expect(ordem).toHaveLength(TETO_POR_RODADA);
  });

  it("não modifica a lista recebida", () => {
    const lista = [conf("a", "14:00"), conf("b", "20:00")];
    ordenarPorUrgencia(lista, new Set(["b"]), new Set());
    expect(lista.map((c) => c.name)).toEqual(["a", "b"]);
  });
});
