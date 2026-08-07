// O vocabulário dos ciclos, fora das rotas.
//
// ⚠️ Isto morava dentro de `api/admin/ciclos/route.ts`, e o Next recusa: um
// arquivo de rota só pode exportar os verbos HTTP e a configuração dele. O erro
// não aparece em `tsc --noEmit` num projeto limpo, só depois que `.next/types`
// existe, o que quer dizer que ele passa no teste local e quebra no build da
// Railway.

/** O código que o PostgREST devolve quando a tabela não existe no esquema. */
export const SEM_TABELA = "PGRST205";

/**
 * A mensagem para quando a migration ainda não rodou.
 *
 * As migrations aqui são aplicadas à mão, então existe sempre uma janela entre
 * o código subir e a tabela existir. Uma tela que quebra nessa janela parece bug
 * do que acabou de ser feito.
 */
export const MIGRACAO_PENDENTE = "A migration 095 ainda não foi aplicada no banco.";

export interface CicloLinha {
  id: string;
  nome: string;
  inicio: string;
  fim: string | null;
  status: "planejado" | "ativo" | "encerrado";
  observacoes: string | null;
  encerrado_em: string | null;
  created_at: string;
}
