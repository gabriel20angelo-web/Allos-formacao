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
    color: "#1BBAB0",
    tint: "rgba(27,186,176,0.10)",
    border: "rgba(27,186,176,0.28)",
  },
  tecnica: {
    slug: "tecnica",
    label: "Técnica & Intervenção",
    description: "Repertório de intervenções, confronto, leitura do corpo, ecletismo",
    color: "#C84B31",
    tint: "rgba(200,75,49,0.10)",
    border: "rgba(200,75,49,0.28)",
  },
  autoconhecimento: {
    slug: "autoconhecimento",
    label: "Autoconhecimento",
    description: "Preconceitos, estilo, preparação, limites e nicho",
    color: "#8B5CF6",
    tint: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.28)",
  },
  manejo: {
    slug: "manejo",
    label: "Manejo difícil",
    description: "Tópicos tabu, cuidados de saúde, áreas desconfortáveis",
    color: "#E07A5F",
    tint: "rgba(224,122,95,0.10)",
    border: "rgba(224,122,95,0.28)",
  },
  operacional: {
    slug: "operacional",
    label: "Operacional",
    description: "Prontuário, tele-atendimento e ferramentas do dia-a-dia",
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
  icon: "Drama" | "BrainCog" | "MessagesSquare" | "ClipboardList" | "Eye";
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
  supervisao: { slug: "supervisao", label: "Supervisão", icon: "Eye" },
};

export const PESSOAS_LABEL: Record<Pessoas, string> = {
  solo: "Individual",
  dupla: "Em dupla",
  grupo: "Grupo",
  supervisor: "Com supervisor",
};

export function formatDuracao([min, max]: [number, number]): string {
  if (min === max) return `${min} min`;
  return `${min}-${max} min`;
}
