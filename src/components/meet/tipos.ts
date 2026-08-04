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

export interface CursoUI {
  curso_id: string;
  titulo: string;
  status: string | null;
  matriculado_em: string | null;
  concluido_em: string | null;
  aulas_total: number;
  aulas_concluidas: number;
  pct: number | null;
  minutos_uso: number;
  tem_certificado: boolean;
}

/** A metade da ficha que só existe para quem tem conta na plataforma. */
export interface PlataformaUI {
  conta: {
    papel: string | null;
    cargos: string[];
    membro_desde: string | null;
    nome_no_certificado: string | null;
    bloqueado: boolean;
    bloqueado_motivo: string | null;
    bloqueado_em: string | null;
    termos_versao: string | null;
    termos_aceito_em: string | null;
  };
  uso: {
    minutos_totais: number;
    sessoes: number;
    dias_com_acesso: number;
    primeiro_acesso: string | null;
    ultimo_acesso: string | null;
  };
  cursos: CursoUI[];
  certificados: { curso: string; codigo: string | null; emitido_em: string | null }[];
  verificacoes: { curso: string; status: string | null; motivo: string | null; created_at: string | null }[];
  provas: {
    curso: string;
    tentativas: number;
    melhor_nota: number | null;
    passou: boolean;
    ultima_em: string | null;
  }[];
  horas_sincronas: { horas: number; encontros: number };
  avaliacoes: { curso: string; nota: number | null; comentario: string | null; created_at: string | null }[];
  participacao: { comentarios: number; duvidas: number; favoritos: number };
  ocorrencias: {
    origem: string | null;
    status: string | null;
    relato: string | null;
    resposta: string | null;
    created_at: string | null;
  }[];
  bloqueios: { acao: string | null; motivo: string | null; created_at: string | null }[];
}

export interface RetratoUI {
  plataforma?: PlataformaUI | null;
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
