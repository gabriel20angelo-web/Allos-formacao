// Estado do módulo para o painel.
//
// Existe porque formacao_meet_credenciais não tem policy de leitura nenhuma
// (nem para admin): o refresh token não deve trafegar para o browser em
// hipótese alguma. Daqui sai só o e-mail e a data, nunca o token.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

  const { data: cred } = await sb
    .from("formacao_meet_credenciais")
    .select("organizer_email, atualizado_em")
    .eq("id", 1)
    .maybeSingle();

  const { data: ultimaIngestao } = await sb
    .from("formacao_meet_ingest_logs")
    .select("*")
    .order("executado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { count: totalSalas } = await sb
    .from("formacao_meet_spaces")
    .select("id", { count: "exact", head: true })
    .eq("ativo", true);

  const { count: totalEncontros } = await sb
    .from("formacao_meet_encontros")
    .select("id", { count: "exact", head: true });

  const { count: pendentes } = await sb
    .from("formacao_meet_participacoes")
    .select("id", { count: "exact", head: true })
    .is("aluno_id", null);

  return NextResponse.json({
    autorizado: !!cred,
    organizer_email: cred?.organizer_email || null,
    autorizado_em: cred?.atualizado_em || null,
    credenciais_app_configuradas: !!(
      process.env.GOOGLE_MEET_CLIENT_ID && process.env.GOOGLE_MEET_CLIENT_SECRET
    ),
    cron_configurado: !!process.env.MEET_CRON_SECRET,
    total_salas: totalSalas ?? 0,
    total_encontros: totalEncontros ?? 0,
    nomes_pendentes: pendentes ?? 0,
    ultima_ingestao: ultimaIngestao || null,
  });
}
