import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Lê uma tabela inteira, de mil em mil.
 *
 * O PostgREST desta instância devolve no máximo mil linhas e **não avisa que
 * cortou**: a resposta chega com status 200 e a tela passa a mostrar números
 * menores que a verdade, sem nenhum sintoma. O erro se disfarça de descoberta,
 * e é o pior tipo de erro que um painel pode ter.
 *
 * O `order` é obrigatório e não é decorativo: sem ordem estável, páginas
 * sucessivas do mesmo `range` podem repetir e pular linhas.
 *
 * O teto de 50 páginas existe para que um filtro errado não vire varredura
 * infinita. Ele é silencioso de propósito: cinquenta mil linhas numa tabela do
 * painel é sinal de que a consulta está errada, não de que a base cresceu.
 *
 * Esta é a cópia compartilhada. Existem outras quatro espalhadas pelo
 * repositório (agregar.ts, admin/page.tsx, analytics/page.tsx, api/ranking),
 * anteriores a este arquivo. Código novo usa esta.
 */
export async function lerTudo<T>(
  sb: SupabaseClient,
  tabela: string,
  colunas: string,
  ordenarPor: string,
  opcional = false,
): Promise<T[]> {
  const PAGINA = 1000;
  const TETO = 50;
  const out: T[] = [];
  for (let p = 0; p < TETO; p++) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .order(ordenarPor, { ascending: true })
      .range(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (error) {
      // `opcional` serve para tabela que só nasce depois de uma migration: a
      // tela abre sem aquele pedaço em vez de não abrir.
      if (opcional) return [];
      throw new Error(`${tabela}: ${error.message}`);
    }
    const lote = (data ?? []) as T[];
    out.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return out;
}
