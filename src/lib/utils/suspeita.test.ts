import { describe, expect, it } from "vitest";
import { detectarSinais, personKey } from "./suspeita";
import type { TimelineEvent } from "./activity";

// Os casos abaixo são recortes reais do banco em 2026-08-03 — foi olhando para
// eles que as regras foram calibradas.

function feedback(
  id: string,
  hora: string,
  atividade: string,
  nome = "Sabrina Sales Bezerra"
): TimelineEvent {
  return {
    id,
    type: "feedback",
    timestamp: `2026-07-20T${hora}:00-03:00`,
    person: nome,
    personEmail: "sabrinasales7392@gmail.com",
    title: atividade,
  };
}

function aula(id: string, hora: string): TimelineEvent {
  return {
    id,
    type: "lesson",
    timestamp: `2026-08-01T${hora}-03:00`,
    person: "Otavio Augusto Ribeiro da Silva",
    personEmail: "otavio@example.com",
    title: `${id}º Encontro`,
    detail: "Introdução à C.G. Jung",
  };
}

describe("personKey", () => {
  it("agrupa pelo e-mail, não pelo nome digitado", () => {
    const a = { person: "Sabrina Sales", personEmail: "s@x.com" };
    const b = { person: "Sabrina Sales Bezerra", personEmail: "S@X.com" };
    expect(personKey(a)).toBe(personKey(b));
  });

  it("cai no nome quando não há e-mail", () => {
    expect(personKey({ person: " Fulano " })).toBe("fulano");
  });
});

describe("detectarSinais", () => {
  it("flagra rajada de feedbacks no mesmo dia somando os dois nomes usados", () => {
    const eventos = [
      feedback("1", "01:52", "Construção de caso clínico"),
      feedback("2", "01:55", "Tipos psicológicos"),
      feedback("3", "01:57", "Introdução à ACP"),
      feedback("4", "01:59", "Grupo de prática clínica"),
      feedback("5", "02:02", "Estudos clássicos"),
      feedback("6", "14:10", "Psicologia e Marketing", "Sabrina Sales"),
    ];
    const sinais = detectarSinais(eventos);
    const rajada = sinais.find((s) => s.tipo === "feedback-rajada");
    expect(rajada).toBeDefined();
    expect(rajada!.titulo).toContain("6 feedbacks");
    expect(rajada!.detalhe).toContain("6 atividades diferentes");
    // usa o nome mais completo entre os dois que a pessoa digitou
    expect(rajada!.pessoa).toBe("Sabrina Sales Bezerra");
  });

  it("não flagra cinco feedbacks no mesmo dia: ainda cabe em uso honesto", () => {
    const eventos = [
      feedback("1", "10:00", "Grupo de prática clínica"),
      feedback("2", "11:00", "Tipos psicológicos"),
      feedback("3", "12:00", "Introdução à ACP"),
      feedback("4", "13:00", "Estudos clássicos"),
      feedback("5", "14:00", "Recursos criativos"),
    ];
    expect(detectarSinais(eventos)).toHaveLength(0);
  });

  it("flagra a partir do sexto feedback no mesmo dia", () => {
    const eventos = [
      feedback("1", "10:00", "A"),
      feedback("2", "10:05", "B"),
      feedback("3", "10:09", "C"),
      feedback("4", "10:12", "D"),
      feedback("5", "10:15", "E"),
      feedback("6", "10:19", "F"),
    ];
    const sinais = detectarSinais(eventos);
    expect(sinais.filter((s) => s.tipo === "feedback-rajada")).toHaveLength(1);
  });

  it("flagra muitas aulas concluídas em poucos minutos", () => {
    const eventos = [
      ...Array.from({ length: 10 }, (_, i) => aula(String(i + 1), `11:57:${String(i).padStart(2, "0")}`)),
    ];
    const sinal = detectarSinais(eventos).find((s) => s.tipo === "aula-rajada");
    expect(sinal).toBeDefined();
    expect(sinal!.titulo).toContain("10 aulas");
    expect(sinal!.detalhe).toContain("Introdução à C.G. Jung");
  });

  it("não flagra maratona espalhada pelo dia", () => {
    const eventos = [
      aula("1", "08:00:00"),
      aula("2", "09:30:00"),
      aula("3", "11:00:00"),
      aula("4", "13:00:00"),
      aula("5", "15:00:00"),
      aula("6", "16:00:00"),
      aula("7", "18:00:00"),
      aula("8", "20:00:00"),
    ];
    expect(
      detectarSinais(eventos).filter((s) => s.tipo === "aula-rajada")
    ).toHaveLength(0);
  });

  it("flagra matrícula e conclusão do mesmo curso no mesmo dia", () => {
    const base = {
      person: "José Correia",
      personEmail: "jose@example.com",
      title: "As bases da psicopatologia",
    };
    const eventos: TimelineEvent[] = [
      { ...base, id: "m1", type: "enrollment", timestamp: "2026-06-18T09:00:00-03:00" },
      { ...base, id: "c1", type: "completion", timestamp: "2026-06-18T09:40:00-03:00" },
    ];
    const sinal = detectarSinais(eventos).find(
      (s) => s.tipo === "conclusao-no-mesmo-dia"
    );
    expect(sinal).toBeDefined();
    expect(sinal!.detalhe).toContain("09:00");
  });

  it("ordena o mais fora da curva primeiro", () => {
    const eventos = [
      feedback("1", "01:52", "A"),
      feedback("2", "01:55", "B"),
      feedback("3", "01:57", "C"),
      feedback("4", "01:59", "D"),
      feedback("5", "02:02", "E"),
      feedback("6", "02:05", "F"),
      ...Array.from({ length: 9 }, (_, i) => aula(String(i + 1), `11:57:${String(i).padStart(2, "0")}`)),
    ];
    const sinais = detectarSinais(eventos);
    expect(sinais.length).toBeGreaterThanOrEqual(2);
    expect(sinais[0].peso).toBeGreaterThanOrEqual(sinais[1].peso);
  });

  it("flagra permanência incompatível com o conteúdo concluído", () => {
    const tempoPorPessoa = new Map([
      [
        "otavio@example.com",
        [
          {
            courseId: "c1",
            titulo: "Introdução à C.G. Jung",
            segundos: 120,
            minutosConteudoConcluido: 600,
            aulasConcluidas: 19,
          },
        ],
      ],
    ]);
    const sinal = detectarSinais([aula("1", "11:57:00")], { tempoPorPessoa }).find(
      (s) => s.tipo === "tempo-incompativel"
    );
    expect(sinal).toBeDefined();
    expect(sinal!.titulo).toContain("19 aulas");
    expect(sinal!.detalhe).toContain("600 min");
  });

  it("não flagra tempo quando não há sessão registrada", () => {
    const tempoPorPessoa = new Map([
      [
        "otavio@example.com",
        [
          {
            courseId: "c1",
            titulo: "Curso",
            segundos: 0,
            minutosConteudoConcluido: 600,
            aulasConcluidas: 19,
          },
        ],
      ],
    ]);
    expect(
      detectarSinais([aula("1", "11:57:00")], { tempoPorPessoa }).filter(
        (s) => s.tipo === "tempo-incompativel"
      )
    ).toHaveLength(0);
  });
});
