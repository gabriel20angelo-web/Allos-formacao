// O que uma pessoa é.
//
// `profiles.role` é o papel principal e `profiles.cargos` são os extras. Quem
// cuida dos eventos e conduz um grupo é as duas coisas, e durante um tempo
// escolher um cargo apagava o outro (migration 078 resolveu isso no banco).
//
// A pergunta certa nunca é "o papel dela é exatamente tal?" — é "esta pessoa
// tem tal cargo?". Comparar `role` direto é o erro que reaparece: funciona no
// teste, porque quem testa costuma ter o cargo no papel principal, e falha em
// silêncio para quem o tem na lista de extras. O menu mostra o link, a página
// redireciona, e ninguém vê erro nenhum.
//
// Este arquivo é o lado do TypeScript da função `tem_cargo()` do Postgres. Os
// dois precisam responder a mesma coisa; quando divergem, o botão aparece e a
// gravação falha calada.

import type { UserRole } from "@/types";

export type Cargo = UserRole;

/**
 * Qualquer coisa que carregue papel e cargos: o perfil do banco, os claims do
 * JWT no middleware, uma linha crua de `profiles`. Aceita `string` porque o
 * token entrega texto, sem o tipo do enum.
 */
export interface PortadorDeCargos {
  role?: UserRole | string | null;
  cargos?: (UserRole | string | null)[] | null;
}

/** Todos os cargos desta pessoa: o principal e os extras, num conjunto só. */
export function cargosDe(quem: PortadorDeCargos | null | undefined): Set<string> {
  if (!quem) return new Set();
  const todos = [quem.role, ...(quem.cargos || [])];
  return new Set(todos.filter(Boolean) as string[]);
}

/** Esta pessoa tem tal cargo? */
export function temCargo(quem: PortadorDeCargos | null | undefined, cargo: Cargo): boolean {
  return cargosDe(quem).has(cargo);
}

/**
 * Basta um dos cargos servir.
 *
 * O administrador passa sempre, e é por isso que ele não aparece nas listas de
 * quem-pode espalhadas pelo sistema: repetir "admin" em cada linha é uma
 * repetição que alguém esquece justamente na linha que importa.
 */
export function temAlgumCargo(
  quem: PortadorDeCargos | null | undefined,
  cargos: readonly Cargo[]
): boolean {
  const meus = cargosDe(quem);
  if (meus.has("admin")) return true;
  return cargos.some((c) => meus.has(c));
}

/** O mesmo, quando os cargos já estão num conjunto (middleware, gates de rota). */
export function conjuntoTemAlgum(meus: Set<string>, cargos: readonly Cargo[]): boolean {
  if (meus.has("admin")) return true;
  return cargos.some((c) => meus.has(c));
}

/** Como o cargo se chama na tela. */
export const NOME_DO_CARGO: Record<string, string> = {
  admin: "Administrador",
  instructor: "Professor",
  associado: "Associado",
  eventos: "Eventos",
  condutor: "Condutor",
  student: "Aluno",
};
