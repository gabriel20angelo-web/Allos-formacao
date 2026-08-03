// Porteiro das rotas do Meet.
//
// Toda rota administrativa passa por aqui antes de tocar em qualquer coisa: as
// tabelas do Meet só têm policy de leitura para admin, e a escrita acontece
// pelo service role, que bypassa RLS. Se o porteiro falhar, o service role vira
// uma porta aberta.

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface AdminOk {
  ok: true;
  userId: string;
}
export interface AdminNegado {
  ok: false;
  status: 401 | 403;
  erro: string;
}

export async function exigirAdmin(): Promise<AdminOk | AdminNegado> {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return { ok: false, status: 401, erro: "Não autenticado" };

  const { data: perfil } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (perfil?.role !== "admin") {
    return { ok: false, status: 403, erro: "Sem permissão" };
  }
  return { ok: true, userId: user.id };
}

/**
 * Endereço público do app, que NÃO é o host que este processo enxerga.
 *
 * allos.org.br/formacao é um rewrite do Vercel (repo allos-site) apontando
 * para o serviço no Railway, então `req.url` chega com o host cru do Railway.
 * Derivar a URL do request faria o consentimento voltar num domínio onde o
 * cookie de sessão do admin não existe (cookies são host-only aqui), e o
 * callback morreria em 401 antes de salvar coisa alguma.
 *
 * Mesmo padrão já usado em /formacao/auth/callback para o login do Supabase.
 * Localhost continua valendo pelo request, senão não dá para testar local.
 */
export function baseUrlPublica(req: Request): string {
  // Só em desenvolvimento o request diz a verdade sobre o endereço público.
  //
  // No Railway o Next escuta em localhost:8080 dentro do contêiner, então
  // `req.url` chega como http://localhost:8080 mesmo quando o usuário está em
  // allos.org.br. Uma checagem de "contém localhost" para separar dev de
  // produção acerta na máquina do desenvolvedor e erra no servidor, mandando
  // o admin para um endereço que só existe dentro do contêiner.
  if (process.env.NODE_ENV === "development") {
    return new URL(req.url).origin;
  }
  return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://allos.org.br";
}

/**
 * URI de retorno do consentimento.
 *
 * Precisa ser byte a byte igual nos dois passos do OAuth (pedido e troca do
 * código), senão o Google devolve redirect_uri_mismatch.
 */
export function redirectUri(req: Request): string {
  if (process.env.GOOGLE_MEET_REDIRECT_URI) {
    return process.env.GOOGLE_MEET_REDIRECT_URI;
  }
  return new URL("/formacao/api/admin/meet/oauth/callback", baseUrlPublica(req)).toString();
}
