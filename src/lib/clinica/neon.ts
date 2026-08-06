import { Pool } from "pg";

/**
 * Conexão de LEITURA com o banco da avaliação clínica, que vive na Neon.
 *
 * O AvaliAllos é outro sistema, em outro repositório, em outro servidor. Este
 * módulo existe só para ler dele. Nada aqui escreve, e nada aqui deve passar a
 * escrever: quem é dono daquele dado é o `allos-site`.
 *
 * ⚠️ O driver `pg` converte coluna `DATE` num `Date` do JavaScript, que ao
 * virar JSON sai como "2026-08-03T00:00:00.000Z" em vez de "2026-08-03". Isso
 * já quebrou um quadro de semana inteiro em outro projeto, e o sintoma é uma
 * comparação de string que nunca casa, sem erro nenhum. Aqui a defesa é no SQL:
 * toda data sai por `to_char(...,'YYYY-MM-DD')`, e nenhuma consulta deste
 * módulo devolve `DATE` cru.
 */

let _pool: Pool | null = null;

export function clinicaConfigurada(): boolean {
  return Boolean(process.env.NEON_DATABASE_URL);
}

function getPool(): Pool {
  if (_pool) return _pool;
  const url = process.env.NEON_DATABASE_URL;
  if (!url) {
    throw new Error("NEON_DATABASE_URL não está definida neste ambiente");
  }
  _pool = new Pool({
    connectionString: url,
    // Teto baixo: o endpoint agrupado da Neon já enfileira do lado de lá, e
    // este painel faz uma consulta por abertura de tela, não um fluxo.
    max: 2,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl: { rejectUnauthorized: false },
  });
  return _pool;
}

export async function consultar<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await getPool().query(sql, params);
  return r.rows as T[];
}
