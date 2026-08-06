// Em que proporção os cortes daquele grupo ou daquele curso devem sair.
//
// Quem conduz pede, quem administra envia. A separação não é cerimônia: o
// envio é o que gasta crédito, e o crédito é da associação. O pedido fica
// guardado à parte justamente para poder existir sem custo nenhum, esperando o
// próximo envio.
//
// Fica em arquivo próprio porque três lugares fazem a mesma pergunta: a rota
// que enfileira aula, a que enfileira encontro, e a que mostra ao condutor o
// que ele pediu. Repetir a consulta nos três é como se cria a divergência que
// ninguém nota, porque cada cópia continua respondendo alguma coisa.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FormatoCorte } from "./opusclip";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export type { FormatoCorte };

export const FORMATOS: FormatoCorte[] = ["reels", "horizontal"];

/** O que sai quando ninguém pediu nada: é como sempre foi até agora. */
export const FORMATO_PADRAO: FormatoCorte = "reels";

export function ehFormato(v: unknown): v is FormatoCorte {
  return v === "reels" || v === "horizontal";
}

export type Escopo = "sala" | "curso";

/**
 * O pedido guardado, ou `null` quando não há nenhum.
 *
 * `null` e "reels" não são a mesma coisa aqui, mesmo que produzam o mesmo
 * corte: a tela precisa saber a diferença entre "escolheram o formato em pé" e
 * "ninguém escolheu nada ainda".
 */
export async function pedidoDeFormato(
  sb: Sb,
  escopo: Escopo,
  chave: string | null | undefined
): Promise<FormatoCorte | null> {
  if (!chave) return null;
  const { data } = await sb
    .from("formacao_clip_formato")
    .select("formato")
    .eq("escopo", escopo)
    .eq("chave", chave)
    .maybeSingle();
  return ehFormato(data?.formato) ? data.formato : null;
}

/** Os pedidos de várias chaves de uma vez, para listas. */
export async function pedidosDeFormato(
  sb: Sb,
  escopo: Escopo,
  chaves: string[]
): Promise<Map<string, FormatoCorte>> {
  const mapa = new Map<string, FormatoCorte>();
  if (!chaves.length) return mapa;
  const { data } = await sb
    .from("formacao_clip_formato")
    .select("chave, formato")
    .eq("escopo", escopo)
    .in("chave", chaves);
  for (const linha of (data || []) as { chave: string; formato: string }[]) {
    if (ehFormato(linha.formato)) mapa.set(linha.chave, linha.formato);
  }
  return mapa;
}

/**
 * Guarda o pedido.
 *
 * Uma linha por escopo e chave: o pedido é o estado atual, não um histórico.
 * Quem pediu e quando ficam gravados porque a pergunta "quem mandou cortar
 * assim?" aparece depois, quando o corte já saiu e alguém estranha.
 */
export async function guardarPedidoDeFormato(
  sb: Sb,
  escopo: Escopo,
  chave: string,
  formato: FormatoCorte,
  quem: string | null
): Promise<{ ok: boolean; erro?: string }> {
  const { error } = await sb.from("formacao_clip_formato").upsert(
    {
      escopo,
      chave,
      formato,
      pedido_por: quem,
      pedido_em: new Date().toISOString(),
    },
    { onConflict: "escopo,chave" }
  );
  return error ? { ok: false, erro: error.message } : { ok: true };
}
