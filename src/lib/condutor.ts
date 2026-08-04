// Quem entra na área de quem conduz.
//
// Durante um tempo a resposta foi uma cadeia de quatro elos: conta → ficha em
// `certificado_condutores` → alocação no horário → sala daquele horário. Cada
// elo era uma chave estrangeira de verdade, e a ideia era boa no papel: um
// condutor não tem por que mexer no grupo do outro.
//
// Na prática a cadeia fechava a porta na cara de quem trabalha. Faltar
// qualquer elo dava uma tela diferente, nenhuma delas acionável por quem lia:
// "sua conta não está ligada a uma ficha", "você não está alocado em nenhum
// horário", "nenhum curso seu tem cortes". Em 04/08/2026 eram 9 pessoas com o
// cargo, 6 fichas ligadas, e nenhuma das 6 salas vinculada a um curso — ou
// seja, a aba de cortes dos cursos abria vazia para todo mundo, inclusive para
// quem tinha a cadeia inteira montada.
//
// A regra agora é uma só: **o cargo é a permissão**. Quem tem `condutor` entra
// e alcança a área inteira, sem ficha, sem alocação e sem curso vinculado. São
// pessoas da mesma casa fazendo o mesmo trabalho, e o custo de uma ver o grupo
// da outra é muito menor que o de ninguém conseguir entrar.
//
// A ficha não sumiu: ela continua dizendo QUAL grupo é o da pessoa, e é isso
// que a tela usa para marcar "seu grupo" no meio dos outros. Só deixou de ser
// o cadeado.

import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { temAlgumCargo, temCargo } from "@/lib/cargos";

type Sb = Awaited<ReturnType<typeof createServiceRoleClient>>;

export interface Condutor {
  ok: true;
  userId: string;
  /**
   * A ficha em `certificado_condutores`, quando existir. Serve para saber qual
   * grupo é o dela; não decide mais o que ela pode abrir.
   */
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

  // O cargo é a única porta. Antes era a ficha, e por isso três das nove
  // pessoas com o cargo levavam 403 numa área que é delas.
  if (!temAlgumCargo(perfil, ["condutor"])) {
    return {
      ok: false,
      status: 403,
      erro: "Esta área é de quem conduz um grupo. Peça o cargo ao administrador.",
    };
  }

  const sb = await createServiceRoleClient();
  const { data: ficha } = await sb
    .from("certificado_condutores")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return { ok: true, userId: user.id, condutorId: ficha?.id || null, ehAdmin };
}

/**
 * As salas que a área mostra: todas as ativas.
 *
 * O recorte por alocação saiu. Ele fazia sentido enquanto a promessa era "cada
 * um cuida do seu"; a promessa agora é acesso pleno para quem conduz, e um
 * recorte que sobrevive só no servidor vira exatamente a divergência cara de
 * achar: a tela mostra o grupo, o botão responde "esta sala não é sua".
 */
export async function salasDoCondutor(sb: Sb): Promise<string[]> {
  const { data } = await sb
    .from("formacao_meet_spaces")
    .select("space_name")
    .eq("ativo", true);
  return (data || []).map((s: { space_name: string }) => s.space_name);
}

/**
 * As salas do vínculo desta pessoa.
 *
 * Não é permissão, é rótulo: com seis grupos na tela, saber qual é o seu é a
 * diferença entre ligar a gravação certa e ligar a do vizinho. Sem ficha ou
 * sem alocação devolve lista vazia, e a tela simplesmente não marca nada.
 */
export async function salasDaFicha(sb: Sb, condutorId: string | null): Promise<string[]> {
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
