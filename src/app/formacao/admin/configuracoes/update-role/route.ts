import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return Response.json(
      { error: "Configuração do servidor incompleta" },
      { status: 500 }
    );
  }

  // Validação do caller via anon client com cookies do user (getUser faz
  // round-trip ao Supabase, validando assinatura do JWT).
  const userClient = await createServerSupabaseClient();
  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user) {
    return Response.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: callerProfile } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (callerProfile?.role !== "admin") {
    return Response.json({ error: "Sem permissão" }, { status: 403 });
  }

  const { userId, role, cargos } = await request.json();

  if (!userId || !role) {
    return Response.json({ error: "userId e role são obrigatórios" }, { status: 400 });
  }

  const ALLOWED_ROLES = ["student", "instructor", "admin", "associado", "eventos", "condutor"] as const;
  if (!ALLOWED_ROLES.includes(role)) {
    return Response.json({ error: "Role inválido" }, { status: 400 });
  }

  if (userId === user.id && role !== "admin") {
    return Response.json({ error: "Não pode remover sua própria permissão" }, { status: 400 });
  }

  // Cargos extras. O papel principal continua sendo um só e governa tudo que
  // já existia; estes somam por cima, para quem faz duas coisas.
  let extras: string[] = [];
  if (cargos !== undefined) {
    if (!Array.isArray(cargos)) {
      return Response.json({ error: "cargos precisa ser uma lista" }, { status: 400 });
    }
    const invalido = cargos.find(
      (c: string) => !(ALLOWED_ROLES as readonly string[]).includes(c)
    );
    if (invalido) {
      return Response.json({ error: `Cargo inválido: ${invalido}` }, { status: 400 });
    }
    // O papel principal já está lá: repetir na lista de extras só criaria dois
    // lugares para dizer a mesma coisa, e um deles ficaria desatualizado.
    extras = Array.from(new Set(cargos.filter((c: string) => c !== role)));
  }

  // Service role só agora, exclusivamente pra escrita (bypassa RLS).
  const sb = await createServiceRoleClient();
  const { error } = await sb
    .from("profiles")
    .update({ role, ...(cargos !== undefined ? { cargos: extras } : {}) })
    .eq("id", userId);

  if (error) {
    console.error("[update-role]", error);
    return Response.json({ error: "Erro interno" }, { status: 500 });
  }

  return Response.json({ success: true });
}
