// Cada grupo tem a sua pasta, criada sozinha.
//
// A alternativa seria o admin colar um link por grupo, e com trinta grupos isso
// não acontece: alguém cola cinco, cansa, e o resto fica sem. Aqui ele indica
// UMA pasta raiz, uma vez, e cada grupo ganha a sua dentro dela.
//
// A criação é preguiçosa de propósito: acontece quando a sala é criada e, se
// falhar ali, de novo na primeira vez que houver arquivo para guardar. Assim
// uma indisponibilidade do Drive não deixa o grupo sem pasta para sempre, e
// salas criadas antes desta funcionalidade também ganham a sua.

import { garantirSubpasta, nomeDaPastaDoGrupo, urlDaPasta, extrairIdDaPasta } from "./drive";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface PastaDoGrupo {
  id: string;
  url: string;
  criada: boolean;
}

/**
 * Devolve a pasta daquele grupo, criando se ainda não existir.
 *
 * Retorna null quando não há pasta raiz configurada, que é o modo "deixa os
 * arquivos onde o Meet põe".
 */
export async function garantirPastaDoGrupo(
  sb: Sb,
  spaceName: string
): Promise<PastaDoGrupo | null> {
  const { data: space } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, slot_id, rotulo, pasta_drive_id")
    .eq("space_name", spaceName)
    .maybeSingle();

  if (!space) return null;

  // Já tem: nada a fazer. É o caminho da esmagadora maioria das chamadas.
  if (space.pasta_drive_id) {
    return { id: space.pasta_drive_id, url: urlDaPasta(space.pasta_drive_id), criada: false };
  }

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("pasta_drive_id")
    .maybeSingle();

  const raiz = cronograma?.pasta_drive_id
    ? extrairIdDaPasta(cronograma.pasta_drive_id)
    : null;
  if (!raiz) return null;

  // O nome sai do slot, quando houver: dia e hora identificam o grupo de forma
  // mais estável que o nome da atividade, que muda de semestre para semestre.
  let diaSemana: number | null = null;
  let hora: string | null = null;
  let atividade: string | null = null;

  if (space.slot_id) {
    const { data: slot } = await sb
      .from("formacao_slots")
      .select("dia_semana, atividade_nome, horario_id")
      .eq("id", space.slot_id)
      .maybeSingle();

    if (slot) {
      diaSemana = slot.dia_semana;
      atividade = slot.atividade_nome;
      const { data: h } = await sb
        .from("formacao_horarios")
        .select("hora")
        .eq("id", slot.horario_id)
        .maybeSingle();
      hora = h?.hora || null;
    }
  }

  const nome = nomeDaPastaDoGrupo(diaSemana, hora, atividade, space.rotulo);
  const pasta = await garantirSubpasta(nome, raiz);

  await sb
    .from("formacao_meet_spaces")
    .update({ pasta_drive_id: pasta.id, pasta_drive_url: urlDaPasta(pasta.id) })
    .eq("space_name", spaceName);

  return { id: pasta.id, url: urlDaPasta(pasta.id), criada: true };
}
