// Estado do módulo para o painel.
//
// Existe porque formacao_meet_credenciais não tem policy de leitura nenhuma
// (nem para admin): o refresh token não deve trafegar para o browser em
// hipótese alguma. Daqui sai só o e-mail e a data, nunca o token.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { capturaSaudavel } from "@/lib/meet/status-slots";
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

  // Sem o filtro, o número no alto da tela contava o lixo: vinte testes de
  // link viravam "vinte encontros capturados", e nenhum deles era encontro.
  const { count: totalEncontros } = await sb
    .from("formacao_meet_encontros")
    .select("id", { count: "exact", head: true })
    .eq("descartado", false);

  // Junção interna com o encontro para não pedir que alguém identifique o nome
  // de um participante de um teste de link. Era o caso mais irritante: a fila
  // enchia de nomes que ninguém precisava resolver.
  const { count: pendentes } = await sb
    .from("formacao_meet_participacoes")
    .select("id, formacao_meet_encontros!inner(descartado)", {
      count: "exact",
      head: true,
    })
    .is("aluno_id", null)
    .eq("formacao_meet_encontros.descartado", false);

  // A configuração vem junto de propósito. Cada rota administrativa valida a
  // sessão com o Supabase, e várias chamadas simultâneas disputam a renovação
  // do token, o que devolve 409 e derruba a sessão. Menos requisições no
  // carregamento da tela é menos disputa.
  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("tolerancia_atraso_min, limite_encerramento_min, pasta_drive_url")
    .maybeSingle();

  // O mesmo veredito que decide se o sistema pode marcar um encontro como não
  // conduzido. Reaproveitado aqui de propósito: se a regra do painel fosse
  // escrita à parte, as duas versões divergiriam com o tempo e a tela diria
  // "tudo certo" enquanto o automático se recusa a concluir qualquer coisa.
  const saude = await capturaSaudavel(sb);

  // Nulo quando nunca rodou, e não zero: zero significaria "acabou de rodar",
  // que é o oposto do que aconteceu. Quem lê trata a ausência à parte.
  const horasDesdeUltimaIngestao = ultimaIngestao?.executado_em
    ? (Date.now() - new Date(ultimaIngestao.executado_em).getTime()) / 3_600_000
    : null;

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
    captura: {
      saudavel: saude.ok,
      motivo: saude.motivo ?? null,
      horas_desde_ultima_ingestao:
        horasDesdeUltimaIngestao === null
          ? null
          : Math.round(horasDesdeUltimaIngestao * 10) / 10,
    },
  });
}
