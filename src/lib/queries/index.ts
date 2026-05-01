// Camada de queries: encapsula chamadas Supabase em funções tipadas.
// Por que: deixar queries reusáveis, testáveis e fáceis de migrar quando o
// schema mudar. Páginas devem importar daqui em vez de fazer
// `createClient().from(...)` inline.
//
// Convenção: cada arquivo agrupa queries por domínio (entidade ou área).
// Funções retornam `{ data, error }` no estilo Supabase pra preservar a
// semântica e permitir tratamento de erro consistente nos callers.

export * from "./condutores";
export * from "./whatsapp-templates";
