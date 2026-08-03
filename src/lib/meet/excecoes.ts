// Exceções pontuais de gravação.
//
// A sala é permanente, então "nesta terça não grava" não é um atributo do
// encontro: é uma troca temporária na configuração da sala, aplicada antes e
// desfeita depois. Sem a reversão, um "não gravar" pontual viraria permanente
// no silêncio.

import { atualizarArtefatos } from "./client";
import { dataLocal } from "./nomes";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ExcecaoRow {
  id: string;
  slot_id: string;
  data: string;
  gravar: boolean | null;
  transcrever: boolean | null;
  notas: boolean | null;
}

interface SpacePadrao {
  space_name: string;
  gravar: boolean;
  transcrever: boolean;
  notas: boolean;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

async function spaceDoSlot(sb: Sb, slotId: string): Promise<SpacePadrao | null> {
  const { data } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, gravar, transcrever, notas")
    .eq("slot_id", slotId)
    .maybeSingle();
  return (data as SpacePadrao) || null;
}

export async function sincronizarExcecoes(
  sb: Sb
): Promise<{ aplicadas: number; revertidas: number; erros: string[] }> {
  const hoje = dataLocal(new Date());
  const erros: string[] = [];
  let aplicadas = 0;
  let revertidas = 0;

  const { data: pendentes } = await sb
    .from("formacao_meet_excecoes")
    .select("id, slot_id, data, gravar, transcrever, notas")
    .eq("data", hoje)
    .is("aplicada_em", null);

  for (const ex of (pendentes || []) as ExcecaoRow[]) {
    const padrao = await spaceDoSlot(sb, ex.slot_id);
    if (!padrao) {
      erros.push(`Exceção ${ex.id}: grupo sem sala criada.`);
      continue;
    }
    try {
      await atualizarArtefatos(padrao.space_name, {
        gravar: ex.gravar ?? padrao.gravar,
        transcrever: ex.transcrever ?? padrao.transcrever,
        notas: ex.notas ?? padrao.notas,
      });
      await sb
        .from("formacao_meet_excecoes")
        .update({ aplicada_em: new Date().toISOString() })
        .eq("id", ex.id);
      aplicadas++;
    } catch (e) {
      erros.push(`Exceção ${ex.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const { data: vencidas } = await sb
    .from("formacao_meet_excecoes")
    .select("id, slot_id, data, gravar, transcrever, notas")
    .lt("data", hoje)
    .not("aplicada_em", "is", null)
    .is("revertida_em", null);

  for (const ex of (vencidas || []) as ExcecaoRow[]) {
    const padrao = await spaceDoSlot(sb, ex.slot_id);
    if (!padrao) {
      // Sala apagada: nada a reverter, mas fechar a exceção evita repetir todo dia.
      await sb
        .from("formacao_meet_excecoes")
        .update({ revertida_em: new Date().toISOString() })
        .eq("id", ex.id);
      continue;
    }
    try {
      await atualizarArtefatos(padrao.space_name, {
        gravar: padrao.gravar,
        transcrever: padrao.transcrever,
        notas: padrao.notas,
      });
      await sb
        .from("formacao_meet_excecoes")
        .update({ revertida_em: new Date().toISOString() })
        .eq("id", ex.id);
      revertidas++;
    } catch (e) {
      erros.push(`Reversão ${ex.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return { aplicadas, revertidas, erros };
}
