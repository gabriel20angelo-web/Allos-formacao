// O gate de página, num lugar só.
//
// Cada tela restrita repetia as mesmas doze linhas: pega o usuário, consulta
// `profiles`, compara o papel com uma lista escrita à mão, redireciona. Como
// eram cópias, envelheceram separadas — quando os cargos extras chegaram, as
// cinco páginas do Aprimoramento continuaram lendo só `role`, e quem tinha o
// cargo na lista de extras via o link no menu e levava um redirect ao clicar.
//
// Aqui a pergunta é feita uma vez, e ela é a mesma que o menu faz.

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cargosDe, conjuntoTemAlgum, type Cargo } from "./cargos";

export interface QuemEsta {
  userId: string;
  /** O papel principal e os extras, juntos. */
  cargos: Set<string>;
}

/** Quem está pedindo, com todos os cargos. `null` se não houver sessão. */
export async function quemEsta(): Promise<QuemEsta | null> {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await client
    .from("profiles")
    .select("role, cargos")
    .eq("id", user.id)
    .single();

  return { userId: user.id, cargos: cargosDe(perfil) };
}

/**
 * Exige pelo menos um dos cargos, ou manda embora.
 *
 * O administrador passa sempre — `conjuntoTemAlgum` cuida disso, então "admin"
 * não precisa (nem deve) ser repetido na lista de cada chamada.
 *
 * `destinoSemSessao` recebe o caminho de volta para que a pessoa termine onde
 * queria entrar, e não na home.
 */
export async function exigirAlgumCargo(
  cargos: readonly Cargo[],
  destinoSemSessao: string
): Promise<QuemEsta> {
  const quem = await quemEsta();

  if (!quem) {
    redirect(`/formacao/auth?next=${encodeURIComponent(destinoSemSessao)}`);
  }

  if (!conjuntoTemAlgum(quem.cargos, cargos)) {
    redirect("/formacao");
  }

  return quem;
}

/** Administrador — pelo papel principal ou pelos extras. */
export async function ehAdmin(): Promise<boolean> {
  const quem = await quemEsta();
  return !!quem?.cargos.has("admin");
}
