// O que a rota /api/condutor/grupo devolve.
//
// Fica separado porque as três abas leem os mesmos objetos, e declarar de novo
// em cada uma seria pedir para elas divergirem quando um campo mudar.

import type { ClipeC } from "./ClipeGrade";

export type { ClipeC };

export interface EncontroC {
  id: string;
  data_reuniao: string;
  inicio: string;
  duracao_min: number | null;
  total_participantes: number | null;
  youtube_video_id: string | null;
  gravacao_uri: string | null;
  clipes: ClipeC[];
}

export interface SalaC {
  space_name: string;
  rotulo: string | null;
  meeting_uri: string | null;
  meeting_code: string | null;
  gravar: boolean;
  transcrever: boolean;
  notas: boolean;
  access_type: string;
  janela_automatica: boolean;
  duracao_min: number | null;
  dia_semana: number | null;
  hora: string | null;
  atividade_nome: string | null;
  /**
   * Esta é a sala do vínculo de quem está olhando.
   *
   * Não é permissão: todo condutor abre e mexe em todas. É o rótulo que faz a
   * pessoa achar a dela entre seis, e vem primeiro na lista por isso.
   */
  minha: boolean;
  encontros: EncontroC[];
}

/**
 * Os dias, na convenção de `formacao_slots.dia_semana`.
 *
 * A coluna é `CHECK (dia_semana >= 0 AND dia_semana <= 4)`: zero é segunda, e
 * não domingo. Contar a partir do domingo desloca a semana inteira em um dia,
 * e o erro passa despercebido porque continua mostrando um dia plausível.
 */
export const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"];

export const ROXO = "#6C5CE7";
