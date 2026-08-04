// Como cada tipo de evento se apresenta: rótulo, verbo, ícone e cor.
//
// Mora fora do `ActivityTimeline` porque três telas precisam disto e só uma
// delas precisa do componente. A ficha de pessoa, que abre pelo painel do Meet
// e também pela área de quem conduz, importava o módulo inteiro só para ler
// este mapa, e junto vinham framer-motion, o painel de anotações do dia e o
// hook que fala com o banco. Peso que não faz sentido no celular de quem
// conduz um grupo.
//
// Fica em `lib/utils` e não em `components` porque é dado, não interface: o
// componente que desenha é quem escolhe o que fazer com a cor.

import {
  Award,
  BookOpen,
  CheckCircle,
  FileText,
  MessageCircle,
  MessageSquare,
  PlayCircle,
  Star,
  UserPlus,
  Video,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TimelineEventType } from "./activity";

export interface TipoDeEvento {
  label: string;
  plural: string;
  verb: string;
  icon: LucideIcon;
  color: string;
}

export const TYPE_META: Record<TimelineEventType, TipoDeEvento> = {
  feedback: {
    label: "Feedback",
    plural: "Feedbacks",
    verb: "enviou feedback de",
    icon: MessageSquare,
    color: "#C84B31",
  },
  // A presença medida na sala, ao lado do feedback que é autodeclarado. Cor
  // própria porque a diferença entre declarar e ter estado é justamente o que
  // se quer enxergar de relance.
  encontro: {
    label: "Encontro",
    plural: "Encontros",
    verb: "esteve em",
    icon: Video,
    color: "#2E9E8F",
  },
  signup: {
    label: "Cadastro",
    plural: "Cadastros",
    verb: "criou conta",
    icon: UserPlus,
    color: "#22C55E",
  },
  enrollment: {
    label: "Matrícula",
    plural: "Matrículas",
    verb: "matriculou-se em",
    icon: BookOpen,
    color: "#2E9E8F",
  },
  lesson: {
    label: "Aula concluída",
    plural: "Aulas concluídas",
    verb: "concluiu a aula",
    icon: PlayCircle,
    color: "#6C5CE7",
  },
  completion: {
    label: "Curso concluído",
    plural: "Cursos concluídos",
    verb: "concluiu o curso",
    icon: CheckCircle,
    color: "#D4A857",
  },
  review: {
    label: "Avaliação",
    plural: "Avaliações",
    verb: "avaliou",
    icon: Star,
    color: "#F59E0B",
  },
  certificate: {
    label: "Certificado",
    plural: "Certificados",
    verb: "recebeu certificado de",
    icon: Award,
    color: "#D4854A",
  },
  comment: {
    label: "Comentário",
    plural: "Comentários",
    verb: "comentou em",
    icon: MessageCircle,
    color: "#38BDF8",
  },
  exam: {
    label: "Prova",
    plural: "Provas",
    verb: "fez a prova de",
    icon: FileText,
    color: "#EF4444",
  },
};
