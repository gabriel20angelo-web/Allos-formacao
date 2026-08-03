// De quem é cada grupo.
//
// Esta pergunta é feita por mais de uma rota — a tela do grupo, a curadoria
// dos cortes, o resumo da área — e responder a ela em cada lugar seria pedir
// para as respostas divergirem. Quando uma cópia envelhece, a divergência não
// aparece como erro: aparece como sala que some da tela de uma pessoa e
// continua aparecendo na de outra.
//
// O caminho é conta → ficha do condutor → alocação no horário → sala daquele
// horário, e cada elo é uma chave estrangeira de verdade. O resto do sistema
// casa condutor por semelhança de nome, para estatística; aqui isso não serve.
// Dois "Ana Paula", ou um apelido diferente no Meet, já bastariam para abrir o
// grupo de uma pessoa para outra.
//
// É o espelho em TypeScript da função `conduz_a_sala()` do Postgres (migration
// 074). As duas precisam responder a mesma coisa.

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { temCargo } from "@/lib/cargos";

type Sb = Awaited<ReturnType<typeof createServiceRoleClient>>;

export interface Condutor {
  ok: true;
  userId: string;
  /** A ficha em `certificado_condutores`. Nula para o administrador sem ficha. */
  condutorId: string | null;
  ehAdmin: boolean;
}

export interface Barrado {
  ok: false;
  status: 401 | 403;
  erro: string;
}

/** Quem está pedindo, e a qual ficha de condutor ele corresponde. */
export async function identificarCondutor(): Promise<Condutor | Barrado> {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return { ok: false, status: 401, erro: "Não autenticado" };

  const { data: perfil } = await client
    .from("profiles")
    .select("role, cargos")
    .eq("id", user.id)
    .single();

  // Pelos cargos, nunca por `role` direto: quem administra e também conduz um
  // grupo tem "condutor" no papel principal e "admin" nos extras, e a
  // comparação crua o rebaixaria a condutor comum sem dizer nada.
  const ehAdmin = temCargo(perfil, "admin");

  const sb = await createServiceRoleClient();
  const { data: ficha } = await sb
    .from("certificado_condutores")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ehAdmin && !ficha) {
    return {
      ok: false,
      status: 403,
      erro: "Sua conta ainda não está ligada a uma ficha de condutor. Peça isso ao administrador.",
    };
  }

  return { ok: true, userId: user.id, condutorId: ficha?.id || null, ehAdmin };
}

/**
 * As salas que esta pessoa conduz.
 *
 * Administrador vê todas: é a única forma de conferir o que o condutor está
 * vendo, e sem isso a tela responderia "você não conduz nada" para quem
 * mantém o sistema.
 */
export async function salasDoCondutor(
  sb: Sb,
  condutorId: string | null,
  ehAdmin = false
): Promise<string[]> {
  if (ehAdmin && !condutorId) {
    const { data } = await sb
      .from("formacao_meet_spaces")
      .select("space_name")
      .eq("ativo", true);
    return (data || []).map((s: { space_name: string }) => s.space_name);
  }

  if (!condutorId) return [];

  const { data: alocacoes } = await sb
    .from("formacao_alocacoes")
    .select("slot_id")
    .eq("condutor_id", condutorId);

  const slotIds = (alocacoes || []).map((a: { slot_id: string }) => a.slot_id);
  if (!slotIds.length) return [];

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name")
    .in("slot_id", slotIds)
    .eq("ativo", true);

  return (spaces || []).map((s: { space_name: string }) => s.space_name);
}
