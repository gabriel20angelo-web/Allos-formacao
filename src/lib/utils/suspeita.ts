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
  | "tempo-incompativel"
  | "conclusao-no-mesmo-dia";

/**
 * Tempo medido de permanência por curso, para a regra que compara o registrado
 * com a duração do que a pessoa marcou como concluído.
 *
 * Sem isto, a única defesa contra "concluí tudo em um minuto" é a rajada, que
 * só pega quem clica em sequência. Quem espaça os cliques ao longo do dia
 * passa batido pela rajada, mas não passa por aqui: o tempo total continua
 * pequeno demais para o conteúdo declarado.
 */
export interface TempoDeCurso {
  courseId: string;
  titulo: string;
  segundos: number;
  /** Duração somada das aulas que a pessoa concluiu, em minutos. */
  minutosConteudoConcluido: number;
  aulasConcluidas: number;
}

export interface ContextoSinais {
  /** personKey → tempo por curso daquela pessoa. */
  tempoPorPessoa?: Map<string, TempoDeCurso[]>;
}

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

// Formação síncrona. Preencher vários formulários de uma vez é comum em quem
// participa de muitos grupos e deixa para regularizar tudo junto, então o
// limiar precisa ficar longe do uso honesto: seis declarações no mesmo dia já
// são doze horas de carga horária, o que não se explica por rotina.
const LIMIAR_FEEDBACKS_DIA = 6;
const LIMIAR_AULAS = 8;
const LIMIAR_AULAS_MINUTOS = 15;

// Abaixo disto o tempo registrado não sustenta a carga declarada. 30% é
// deliberadamente generoso: cobre quem assiste em velocidade acelerada, quem já
// conhecia o conteúdo e quem deixou a aba em segundo plano por um trecho.
const PROPORCAO_TEMPO_MINIMA = 0.3;
// Conteúdo curto não gera conclusão confiável: cinco minutos de vídeo com dois
// de permanência não dizem nada.
const MINUTOS_CONTEUDO_MINIMO = 20;

export function detectarSinais(
  events: TimelineEvent[],
  contexto: ContextoSinais = {}
): Sinal[] {
  const sinais: Sinal[] = [];

  // ── Tempo de permanência incompatível com o que foi concluído ──
  // Independe de dia: olha o acumulado da pessoa em cada curso.
  if (contexto.tempoPorPessoa) {
    const nomePorChave = new Map<string, string>();
    const emailPorChave = new Map<string, string>();
    const ultimoDiaPorChave = new Map<string, string>();
    events.forEach((e) => {
      const k = personKey(e);
      const nomeAtual = nomePorChave.get(k) ?? "";
      if (e.person.length > nomeAtual.length) nomePorChave.set(k, e.person);
      if (e.personEmail) emailPorChave.set(k, e.personEmail);
      const dia = dayKey(e.timestamp);
      const ultimo = ultimoDiaPorChave.get(k);
      if (!ultimo || dia > ultimo) ultimoDiaPorChave.set(k, dia);
    });

    contexto.tempoPorPessoa.forEach((cursos, chave) => {
      cursos.forEach((c) => {
        if (c.minutosConteudoConcluido < MINUTOS_CONTEUDO_MINIMO) return;
        // Sem nenhuma sessão registrada a pessoa é anterior ao rastreio: não dá
        // para afirmar nada, e afirmar seria acusar por ausência de dado.
        if (c.segundos === 0) return;

        const proporcao = c.segundos / (c.minutosConteudoConcluido * 60);
        if (proporcao >= PROPORCAO_TEMPO_MINIMA) return;

        const minutosRegistrados = Math.round(c.segundos / 60);
        sinais.push({
          id: `tempo-${chave}|${c.courseId}`,
          tipo: "tempo-incompativel",
          pessoa: nomePorChave.get(chave) || chave,
          email: emailPorChave.get(chave),
          dia: ultimoDiaPorChave.get(chave) || dayKey(new Date().toISOString()),
          titulo: `${c.aulasConcluidas} aulas concluídas em ${c.titulo} com ${minutosRegistrados} min de permanência`,
          detalhe:
            `O conteúdo concluído soma ${c.minutosConteudoConcluido} min, e o tempo ` +
            `registrado na plataforma é ${Math.round(proporcao * 100)}% disso. ` +
            `Marcar aula como assistida é um clique, e o clique não exige ter assistido.`,
          // peso cresce conforme a distância: quanto menos tempo, mais grave
          peso: Math.round(10 + (1 - proporcao) * 10),
          eventos: [],
        });
      });
    });
  }

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
