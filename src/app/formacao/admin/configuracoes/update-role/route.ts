import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { temCargo } from "@/lib/cargos";

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
    .select("role, cargos")
    .eq("id", user.id)
    .single();

  // Pelos cargos. Esta rota é justamente a que distribui cargos, então a
  // comparação crua tinha o efeito mais desconfortável de todos: um
  // administrador com "admin" entre os extras não conseguia arrumar o cargo de
  // ninguém, nem o próprio, e a tela só dizia "Sem permissão".
  if (!temCargo(callerProfile, "admin")) {
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

  // Não sair sozinho pela porta que se está guardando.
  //
  // A checagem olhava só o papel principal, então quem carregava "admin" entre
  // os extras passava por ela e se rebaixava mandando a lista de extras vazia:
  // o papel continuava sendo o mesmo, e o cargo que dava acesso ia embora junto
  // com o resto. Com a conta administrativa fora do ar, o conserto exige alguém
  // com acesso ao banco.
  // Sem `cargos` no corpo, os extras de hoje ficam como estão — e são eles que
  // decidem se a pessoa continua administradora.
  const extrasFinais =
    cargos !== undefined ? extras : ((callerProfile?.cargos as string[] | null) ?? []);
  const aindaSeraAdmin = role === "admin" || extrasFinais.includes("admin");
  if (userId === user.id && !aindaSeraAdmin) {
    return Response.json({ error: "Não pode remover sua própria permissão" }, { status: 400 });
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
