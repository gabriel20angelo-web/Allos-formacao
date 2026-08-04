// O que a lista de presença e a ficha de pessoa trocam entre si.
//
// Fica fora dos dois componentes porque o painel do administrador e a área de
// quem conduz leem rotas diferentes que devolvem o mesmo formato. Declarar em
// cada lugar seria pedir para os dois divergirem quando um campo mudar.

export interface ParticipacaoUI {
  display_name: string;
  display_name_norm: string;
  aluno_id: string | null;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
  eh_condutor: boolean;
  /** Sabemos de quem é esta presença — por conta ou pelo certificado. */
  identificada?: boolean;
  /** Nome de documento, quando diferente do nome de tela. */
  pessoa_nome?: string | null;
  pessoa_email?: string | null;
  tem_conta?: boolean;
  origem_identidade?: string | null;
}

export interface EncontroDaPessoaUI {
  encontro_id: string;
  data_reuniao: string;
  inicio: string;
  atividade_nome: string | null;
  condutor_nome: string | null;
  duracao_min: number | null;
  display_name: string;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
}

export interface RetratoUI {
  pessoa: {
    nome: string;
    email: string | null;
    aluno_id: string | null;
    tem_conta: boolean;
    origem: string | null;
    evidencia: string | null;
    nomes_de_tela: string[];
  };
  resumo: {
    encontros: number;
    minutos_totais: number;
    media_permanencia_pct: number | null;
    minutos_fala: number | null;
    turnos_fala: number | null;
    encontros_em_que_falou: number;
    atrasos: number;
    primeiro: string | null;
    ultimo: string | null;
  };
  encontros: EncontroDaPessoaUI[];
  feedback: {
    atividade_nome: string | null;
    nota_grupo: number | null;
    nota_condutor: number | null;
    relato: string | null;
    created_at: string;
  }[];
  recortado: boolean;
}

export type CriterioRanking = "fala" | "presenca";

export const ROXO = "#6C5CE7";

/** "12,3 min" com vírgula, que é como se lê em português. */
export function minutos(n: number | null | undefined, casas = 1): string {
  if (n === null || n === undefined) return "—";
  return n.toFixed(casas).replace(".", ",").replace(/,0$/, "");
}
