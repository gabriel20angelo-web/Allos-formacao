// O cruzamento entre o que foi declarado e o que foi medido.
//
// É a lógica mais delicada do módulo, porque a mesma linha de texto pode ser
// uma informação ("esteve 78 minutos") ou uma acusação ("declarou e não
// esteve"), e a diferença entre as duas depende de um detalhe que ninguém vê:
// se todo mundo daquele encontro já foi identificado. Enquanto houver nome de
// tela sem dono, a ausência não pode ser afirmada.

import { describe, expect, it } from "vitest";
import { anotarPresencaMedida } from "./eventos";
import type { TimelineEvent } from "@/lib/utils/activity";

const DIA = "2026-08-04T17:30:00-03:00";

function feedback(over: Partial<TimelineEvent> = {}): TimelineEvent {
  return {
    id: "sub-1",
    type: "feedback",
    timestamp: DIA,
    person: "Márcia Maria Pinho Pacheco de Aquino",
    personEmail: "marcia@exemplo.com",
    title: "Construção de caso clínico",
    ...over,
  };
}

const presencaDela = {
  chave: "marcia@exemplo.com",
  dia: "2026-08-04",
  atividade: "construção de caso clínico",
  minutos: 59,
};

describe("anotarPresencaMedida", () => {
  it("mostra os minutos medidos quando a pessoa esteve no encontro", () => {
    const [ev] = anotarPresencaMedida([feedback()], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBe("presença medida: 59 min");
  });

  it("não afirma ausência enquanto houver nome sem dono naquele encontro", () => {
    const [ev] = anotarPresencaMedida([feedback({ personEmail: "outra@exemplo.com" })], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 28 }]]),
    });
    expect(ev.detail).toContain("sem presença medida");
    expect(ev.detail).toContain("28 nomes");
    expect(ev.detail).not.toContain("não esteve");
  });

  it("afirma a ausência só quando o encontro inteiro está identificado", () => {
    const [ev] = anotarPresencaMedida([feedback({ personEmail: "outra@exemplo.com" })], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBe("declarou, mas não esteve no encontro");
  });

  it("cala quando aquele encontro não foi capturado", () => {
    const [ev] = anotarPresencaMedida([feedback({ title: "Grupo de outra sala" })], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBeUndefined();
  });

  it("casa pelo e-mail, mesmo com o nome escrito de outro jeito", () => {
    const [ev] = anotarPresencaMedida([feedback({ person: "Márcia Aquino" })], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBe("presença medida: 59 min");
  });

  it("preserva o que já estava no detalhe em vez de sobrescrever", () => {
    const [ev] = anotarPresencaMedida([feedback({ detail: "com Laura · condutor 10/10" })], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBe("com Laura · condutor 10/10 · presença medida: 59 min");
  });

  it("não encosta em evento que não é feedback", () => {
    const encontro: TimelineEvent = {
      id: "meet-1",
      type: "encontro",
      timestamp: DIA,
      person: "Márcia",
      title: "Construção de caso clínico",
      detail: "59 min",
    };
    const [ev] = anotarPresencaMedida([encontro], {
      presencas: [presencaDela],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBe("59 min");
  });

  it("devolve a lista intacta quando não há presença medida nenhuma", () => {
    const entrada = [feedback()];
    const saida = anotarPresencaMedida(entrada, {
      presencas: [],
      encontrosCapturados: new Map(),
    });
    expect(saida).toBe(entrada);
  });

  it("fica com a maior presença quando a pessoa entrou duas vezes no mesmo dia", () => {
    const [ev] = anotarPresencaMedida([feedback()], {
      presencas: [presencaDela, { ...presencaDela, minutos: 82 }],
      encontrosCapturados: new Map([["construção de caso clínico|2026-08-04", { pendentes: 0 }]]),
    });
    expect(ev.detail).toBe("presença medida: 82 min");
  });
});
