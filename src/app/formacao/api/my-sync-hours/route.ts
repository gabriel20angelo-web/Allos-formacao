import { NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { escapeLikePattern } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

/**
 * GET /formacao/api/my-sync-hours
 *
 * Devolve total de horas síncronas (grupos) que o usuário acumulou,
 * baseado no nome em `certificado_submissions`. RLS bloqueia leitura
 * direta dessa tabela pra não-admin (migration 023), então server-side
 * com service role + filtro pelo nome do profile do user logado.
 */
export async function GET() {
  const userClient = await createServerSupabaseClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sb = await createServiceRoleClient();

  const { data: profile } = await sb
    .from("profiles")
    .select("full_name, certificate_name")
    .eq("id", user.id)
    .single();

  const nameToMatch = profile?.certificate_name || profile?.full_name || "";
  if (!nameToMatch) {
    return NextResponse.json({ syncHours: 0, syncMinutes: 0 });
  }

  const [subsRes, atvRes] = await Promise.all([
    sb
      .from("certificado_submissions")
      .select("atividade_nome")
      .ilike("nome_completo", `%${escapeLikePattern(nameToMatch)}%`),
    sb
      .from("certificado_atividades")
      .select("nome, carga_horaria"),
  ]);

  if (!subsRes.data || !atvRes.data) {
    return NextResponse.json({ syncHours: 0, syncMinutes: 0 });
  }

  const horasMap = new Map<string, number>();
  for (const a of atvRes.data) {
    horasMap.set((a.nome as string).toLowerCase(), a.carga_horaria as number);
  }

  let syncHoursTotal = 0;
  for (const s of subsRes.data) {
    syncHoursTotal += horasMap.get((s.atividade_nome as string)?.toLowerCase() ?? "") || 2;
  }

  return NextResponse.json({
    syncHours: syncHoursTotal,
    syncMinutes: syncHoursTotal * 60,
  });
}
