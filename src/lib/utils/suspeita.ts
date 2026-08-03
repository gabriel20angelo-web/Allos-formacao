// Sinais de atenção — padrões que valem uma conferida humana.
//
// Não são acusações: o formulário de /certificado é auto-declaratório e as
// aulas se marcam como concluídas com um clique, então dá para acumular horas
// sem ter participado. Cada sinal diz o que foi observado, com números
// verificáveis, e deixa o julgamento para quem lê.
//
// A chave da pessoa é o e-mail quando existe: o mesmo cadastro aparece com
// nomes diferentes conforme o que foi digitado no formulário.

import { dayKey, hourLabel, type TimelineEvent } from "./activity";

export type SinalTipo =
  | "feedback-rajada"
  | "aula-rajada"
  | "conclusao-no-mesmo-dia";

export interface Sinal {
  id: string;
  tipo: SinalTipo;
  /** Nome mais completo visto para essa pessoa. */
  pessoa: string;
  email?: string;
  dia: string;
  titulo: string;
  detalhe: string;
  /** Quanto mais alto, mais fora da curva. Ordena a lista. */
  peso: number;
  eventos: TimelineEvent[];
}

/** Chave da pessoa: e-mail se houver, senão o nome normalizado. */
export function personKey(e: {
  person: string;
  personEmail?: string;
}): string {
  return (e.personEmail || e.person).trim().toLowerCase();
}

function minutosEntre(a: TimelineEvent, b: TimelineEvent): number {
  return (
    Math.abs(new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) /
    60000
  );
}

function nomeMaisCompleto(eventos: TimelineEvent[]): string {
  return eventos
    .map((e) => e.person)
    .reduce((maior, n) => (n.length > maior.length ? n : maior), "");
}

function janela(eventos: TimelineEvent[]): string {
  const ordenados = [...eventos].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const ini = hourLabel(ordenados[0].timestamp);
  const fim = hourLabel(ordenados[ordenados.length - 1].timestamp);
  return ini === fim ? ini : `${ini}–${fim}`;
}

const LIMIAR_FEEDBACKS_DIA = 3;
const LIMIAR_AULAS = 8;
const LIMIAR_AULAS_MINUTOS = 15;

export function detectarSinais(events: TimelineEvent[]): Sinal[] {
  const sinais: Sinal[] = [];

  // pessoa+dia → eventos
  const porPessoaDia = new Map<string, TimelineEvent[]>();
  events.forEach((e) => {
    const k = `${personKey(e)}|${dayKey(e.timestamp)}`;
    const lista = porPessoaDia.get(k);
    if (lista) lista.push(e);
    else porPessoaDia.set(k, [e]);
  });

  porPessoaDia.forEach((doDia, chave) => {
    const [, dia] = chave.split("|");
    const email = doDia.find((e) => e.personEmail)?.personEmail;

    // ── 1. Vários feedbacks de certificação no mesmo dia ──
    const feedbacks = doDia.filter((e) => e.type === "feedback");
    if (feedbacks.length >= LIMIAR_FEEDBACKS_DIA) {
      const atividades = new Set(feedbacks.map((f) => f.title));
      sinais.push({
        id: `fb-${chave}`,
        tipo: "feedback-rajada",
        pessoa: nomeMaisCompleto(feedbacks),
        email,
        dia,
        titulo: `${feedbacks.length} feedbacks de certificação no mesmo dia`,
        detalhe: `${atividades.size} atividade${atividades.size > 1 ? "s" : ""} diferente${atividades.size > 1 ? "s" : ""}, entre ${janela(feedbacks)}. Cada um vale carga horária no certificado.`,
        peso: feedbacks.length * 2,
        eventos: feedbacks,
      });
    }

    // ── 2. Muitas aulas concluídas em poucos minutos ──
    const aulas = doDia
      .filter((e) => e.type === "lesson")
      .sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
    if (aulas.length >= LIMIAR_AULAS) {
      const span = minutosEntre(aulas[0], aulas[aulas.length - 1]);
      if (span <= LIMIAR_AULAS_MINUTOS) {
        sinais.push({
          id: `aula-${chave}`,
          tipo: "aula-rajada",
          pessoa: nomeMaisCompleto(aulas),
          email,
          dia,
          titulo: `${aulas.length} aulas concluídas em ${span < 1 ? "menos de 1 minuto" : `${Math.round(span)} min`}`,
          detalhe: `${aulas[0].detail || "curso"} — marcar como assistido é um clique, então a sequência pode ser só para liberar o certificado.`,
          peso: aulas.length,
          eventos: aulas,
        });
      }
    }

    // ── 3. Matrícula e conclusão do mesmo curso no mesmo dia ──
    const matriculas = doDia.filter((e) => e.type === "enrollment");
    const conclusoes = doDia.filter((e) => e.type === "completion");
    conclusoes.forEach((c) => {
      const par = matriculas.find((m) => m.title === c.title);
      if (!par) return;
      sinais.push({
        id: `mesmo-dia-${chave}-${c.id}`,
        tipo: "conclusao-no-mesmo-dia",
        pessoa: nomeMaisCompleto([c]),
        email,
        dia,
        titulo: `Matriculou-se e concluiu ${c.title} no mesmo dia`,
        detalhe: `Matrícula às ${hourLabel(par.timestamp)}, conclusão às ${hourLabel(c.timestamp)}.`,
        peso: 6,
        eventos: [par, c],
      });
    });
  });

  return sinais.sort(
    (a, b) => b.peso - a.peso || b.dia.localeCompare(a.dia)
  );
}
