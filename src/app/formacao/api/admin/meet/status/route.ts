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

  // A configuração vem junto de propósito. Cada rota administrativa valida a
  // sessão com o Supabase, e várias chamadas simultâneas disputam a renovação
  // do token, o que devolve 409 e derruba a sessão. Menos requisições no
  // carregamento da tela é menos disputa.
  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("tolerancia_atraso_min, limite_encerramento_min, pasta_drive_url")
    .maybeSingle();

  return NextResponse.json({
    config: {
      tolerancia_atraso_min: cronograma?.tolerancia_atraso_min ?? 7,
      limite_encerramento_min: cronograma?.limite_encerramento_min ?? 120,
      pasta_drive_url: cronograma?.pasta_drive_url ?? null,
    },
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
