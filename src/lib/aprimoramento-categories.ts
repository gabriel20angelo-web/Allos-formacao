// Mapas de apresentação compartilhados entre index e detalhe do Aprimoramento de Dinâmicas.
// Mantém cor/ícone/label de cada categoria, formato e número de pessoas em um único lugar.

import type {
  CategorySlug,
  FormatoSlug,
  Pessoas,
} from "@/lib/aprimoramento-dinamicas";

export interface CategoryMeta {
  slug: CategorySlug;
  label: string;
  description: string;
  /** Texto longo usado na página de categoria (/categoria/[slug]). */
  longDescription: string;
  /** rgba/hex base, usado no acento (texto, ícone, ring) */
  color: string;
  /** background semi-transparente complementar */
  tint: string;
  /** borda complementar (acento sutil) */
  border: string;
}

export const CATEGORIES: Record<CategorySlug, CategoryMeta> = {
  relacao: {
    slug: "relacao",
    label: "Relação terapêutica",
    description: "Vínculo, aliança, manejo da transferência e feedbacks",
    longDescription:
      "Exercícios voltados ao que acontece entre terapeuta e paciente: a postura, o vínculo, a leitura sensível do que o paciente comunica para além do verbal, a capacidade de receber crítica sem dissolver a presença clínica. Aqui se cultiva uma aliança que não confunde acolhimento com agrado.",
    color: "#1BBAB0",
    tint: "rgba(27,186,176,0.10)",
    border: "rgba(27,186,176,0.28)",
  },
  tecnica: {
    slug: "tecnica",
    label: "Técnica & Intervenção",
    description: "Repertório de intervenções, confronto, leitura do corpo, ecletismo",
    longDescription:
      "Repertório técnico do terapeuta: quando confrontar, como ler dissonâncias entre fala e corpo, como sustentar uma intervenção que incomoda sem perder a aliança. É a parte do ofício que se afia com prática deliberada — não basta saber, é preciso treinar.",
    color: "#C84B31",
    tint: "rgba(200,75,49,0.10)",
    border: "rgba(200,75,49,0.28)",
  },
  autoconhecimento: {
    slug: "autoconhecimento",
    label: "Autoconhecimento",
    description: "Preconceitos, estilo, preparação, limites e nicho",
    longDescription:
      "Antes da técnica, há o terapeuta como instrumento. Preconceitos não nomeados, limites de nicho, preparação pré-sessão, identidade dentro da sala — esse bloco torna visíveis os filtros pelos quais sua escuta acontece, pra que você os use com intenção e não apesar deles.",
    color: "#8B5CF6",
    tint: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.28)",
  },
  manejo: {
    slug: "manejo",
    label: "Manejo difícil",
    description: "Tópicos tabu, cuidados de saúde, áreas desconfortáveis",
    longDescription:
      "Conversas que terapeutas costumam evitar por desconforto próprio: cuidados básicos de saúde, ideação, sexualidade, religião, dinheiro, raça. Aqui se trabalha exatamente esse músculo — abordar o difícil quando é clinicamente indicado, sem se esconder atrás da neutralidade.",
    color: "#E07A5F",
    tint: "rgba(224,122,95,0.10)",
    border: "rgba(224,122,95,0.28)",
  },
  operacional: {
    slug: "operacional",
    label: "Operacional",
    description: "Prontuário, tele-atendimento e ferramentas do dia-a-dia",
    longDescription:
      "A engenharia da clínica: prontuário, tele-atendimento, contingência (internet caiu, paciente atrasou), papel administrativo. Coisas que ninguém ensina na graduação, mas que sustentam a rotina sustentável de quem atende.",
    color: "#7A8A6B",
    tint: "rgba(122,138,107,0.10)",
    border: "rgba(122,138,107,0.28)",
  },
};

export const CATEGORY_ORDER: CategorySlug[] = [
  "relacao",
  "tecnica",
  "autoconhecimento",
  "manejo",
  "operacional",
];

export interface FormatoMeta {
  slug: FormatoSlug;
  label: string;
  /** identificador de ícone do lucide-react */
  icon: "Drama" | "BrainCog" | "MessagesSquare" | "ClipboardList";
}

export const FORMATOS: Record<FormatoSlug, FormatoMeta> = {
  roleplay: { slug: "roleplay", label: "Roleplay", icon: "Drama" },
  reflexao: { slug: "reflexao", label: "Reflexão", icon: "BrainCog" },
  discussao: { slug: "discussao", label: "Discussão", icon: "MessagesSquare" },
  preenchimento: {
    slug: "preenchimento",
    label: "Preenchimento",
    icon: "ClipboardList",
  },
};

export const PESSOAS_LABEL: Record<Pessoas, string> = {
  solo: "Individual",
  dupla: "Em dupla",
  grupo: "Grupo",
};

export function formatDuracao([min, max]: [number, number]): string {
  if (min === max) return `${min} min`;
  return `${min}-${max} min`;
}

// ─── Buckets de duração (curto / médio / longo) ─────────────────────────────
// Usados pra filtrar e agrupar no catálogo. Thresholds escolhidos pra dar uma
// distribuição balanceada entre os 13 exercícios atuais (~4/6/3).

export type DurationBucket = "curto" | "medio" | "longo";

export interface DurationBucketMeta {
  slug: DurationBucket;
  label: string;
  hint: string;
  color: string;
  tint: string;
  border: string;
}

export const DURATION_BUCKETS: Record<DurationBucket, DurationBucketMeta> = {
  curto: {
    slug: "curto",
    label: "Curto",
    hint: "até 45 min",
    color: "#3ECFBE",
    tint: "rgba(62,207,190,0.10)",
    border: "rgba(62,207,190,0.28)",
  },
  medio: {
    slug: "medio",
    label: "Médio",
    hint: "45 a 60 min",
    color: "#D4854A",
    tint: "rgba(212,133,74,0.10)",
    border: "rgba(212,133,74,0.28)",
  },
  longo: {
    slug: "longo",
    label: "Longo",
    hint: "60 min ou mais",
    color: "#A78BFA",
    tint: "rgba(167,139,250,0.10)",
    border: "rgba(167,139,250,0.28)",
  },
};

export const DURATION_ORDER: DurationBucket[] = ["curto", "medio", "longo"];

export function durationBucket([min, max]: [number, number]): DurationBucket {
  const mid = (min + max) / 2;
  if (mid <= 45) return "curto";
  if (mid <= 60) return "medio";
  return "longo";
}

export const PESSOAS_ORDER = ["solo", "dupla", "grupo"] as const;
export const FORMATOS_ORDER = [
  "roleplay",
  "reflexao",
  "discussao",
  "preenchimento",
] as const;
