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
 * URI de retorno do consentimento.
 *
 * Deriva do request para funcionar igual em localhost e em produção, com
 * override por env var quando houver proxy que mexa no host.
 */
export function redirectUri(req: Request): string {
  if (process.env.GOOGLE_MEET_REDIRECT_URI) {
    return process.env.GOOGLE_MEET_REDIRECT_URI;
  }
  return new URL("/formacao/api/admin/meet/oauth/callback", new URL(req.url).origin).toString();
}
