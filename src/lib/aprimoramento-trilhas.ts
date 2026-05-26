// Trilhas curadas: coleções ordenadas de exercícios que fazem sentido em sequência.
// Por enquanto hardcoded; quando virar editável, mover pra Supabase preservando
// o mesmo formato (slug, title, descricao, exercise_slugs[], color, tint, border).

import { EXERCISES, type Exercise } from "@/lib/aprimoramento-dinamicas";

export interface Trilha {
  slug: string;
  title: string;
  pretitle: string;
  descricao: string;
  longDescricao: string;
  /** Slugs ordenados — ordem é a sequência sugerida. */
  exercise_slugs: string[];
  color: string;
  tint: string;
  border: string;
}

export const TRILHAS: Trilha[] = [
  {
    slug: "para-comecar-a-coordenar",
    title: "Para começar a coordenar",
    pretitle: "Trilha do facilitador",
    descricao:
      "Cinco passos para quem vai conduzir grupos de aprimoramento pela primeira vez.",
    longDescricao:
      "Começa pelo operacional (registrar atendimentos), passa pelo autoconhecimento clínico (saber o que se atende), depois ensaia desafios técnicos comuns (instabilidade da chamada, feedback negativo) e fecha com a postura de parceria pra melhoria contínua.",
    exercise_slugs: [
      "aprendendo-a-fazer-prontuario",
      "o-que-eu-consigo-e-quero-atender",
      "a-internet-esta-instavel",
      "feedback-negativo",
      "parceria-para-melhoria",
    ],
    color: "#D4A857",
    tint: "rgba(212,168,87,0.10)",
    border: "rgba(212,168,87,0.28)",
  },
  {
    slug: "alianca-terapeutica",
    title: "Aliança terapêutica",
    pretitle: "Vínculo e manejo",
    descricao:
      "Quatro dinâmicas focadas na relação terapeuta-paciente: leitura do corpo, feedback, parceria e limites.",
    longDescricao:
      "Aliança é mais do que rapport — é a postura de quem se deixa ser corrigido, lê o paciente para além do que ele diz, e não confunde acolhimento com agrado. Estes quatro exercícios ajudam a calibrar essa postura.",
    exercise_slugs: [
      "feedback-negativo",
      "a-boca-fala-uma-coisa-o-corpo-outra",
      "parceria-para-melhoria",
      "parar-de-tentar-agradar",
    ],
    color: "#6B9BD1",
    tint: "rgba(107,155,209,0.10)",
    border: "rgba(107,155,209,0.28)",
  },
  {
    slug: "autoconhecimento-clinico",
    title: "Autoconhecimento clínico",
    pretitle: "O terapeuta como instrumento",
    descricao:
      "Quatro dinâmicas para olhar quem você é dentro da sala e como isso afeta o que você atende.",
    longDescricao:
      "Antes da técnica, há o terapeuta. Preconceitos, vocação, energia, identidade — esses são os filtros pelos quais sua escuta acontece. Esse bloco convida a tornar visíveis os filtros para poder usá-los com intenção.",
    exercise_slugs: [
      "preconceitos-e-estereotipos",
      "o-que-eu-consigo-e-quero-atender",
      "set-your-heart-right-adaptado",
      "parar-de-tentar-agradar",
    ],
    color: "#7B5EA7",
    tint: "rgba(123,94,167,0.10)",
    border: "rgba(123,94,167,0.28)",
  },
  {
    slug: "manejo-do-dificil",
    title: "Manejo do difícil",
    pretitle: "Tópicos desconfortáveis",
    descricao:
      "Quatro dinâmicas pra atravessar conversas tabu, confronto e dissonâncias na conduta do paciente.",
    longDescricao:
      "Algumas conversas o terapeuta evita por desconforto próprio, não por estratégia clínica. Esse bloco trabalha exatamente esse músculo: abordar o desconfortável, intervir confrontativamente quando necessário e reconhecer dissonâncias entre o que o paciente diz e faz.",
    exercise_slugs: [
      "abordando-o-desconfortavel",
      "atencao-aos-cuidados-basicos",
      "manejo-paciente-teoria-x-teoria-y",
      "intervencao-confrontativa",
    ],
    color: "#B85450",
    tint: "rgba(184,84,80,0.10)",
    border: "rgba(184,84,80,0.28)",
  },
];

export function getTrilhaBySlug(slug: string): Trilha | undefined {
  return TRILHAS.find((t) => t.slug === slug);
}

/**
 * Resolve os exercícios de uma trilha, na ordem. Slugs que não existem mais
 * no dataset são silenciosamente ignorados (resiliência contra renomeação).
 */
export function resolveTrilhaExercises(trilha: Trilha): Exercise[] {
  const out: Exercise[] = [];
  for (const slug of trilha.exercise_slugs) {
    const ex = EXERCISES.find((e) => e.slug === slug);
    if (ex) out.push(ex);
  }
  return out;
}

/**
 * Trilhas que contêm o exercício, com posição (1-based) e total. Usado pelo
 * badge "Etapa N de M da Trilha X" no detail.
 */
export function getTrilhasOf(slug: string): {
  trilha: Trilha;
  step: number;
  total: number;
}[] {
  const out: { trilha: Trilha; step: number; total: number }[] = [];
  for (const t of TRILHAS) {
    const idx = t.exercise_slugs.indexOf(slug);
    if (idx >= 0) {
      out.push({ trilha: t, step: idx + 1, total: t.exercise_slugs.length });
    }
  }
  return out;
}
