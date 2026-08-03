// Batida periódica: aplica as exceções do dia e ingere o que já terminou.
//
// Chamada por agendador externo com um segredo no header. Não usa cookie de
// admin de propósito: cron não tem sessão.
//
// Roda de hora em hora sem problema. A ingestão pula conferência em curso e é
// idempotente, então a única consequência de rodar demais é gastar quota.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { encerrarReunioesLongas } from "@/lib/meet/encerramento";
import { sincronizarExcecoes } from "@/lib/meet/excecoes";
import { aplicarJanelaDeAcesso } from "@/lib/meet/janela";
import { ingerir } from "@/lib/meet/ingest";
import { atualizarStatusSlots, fecharSemanaSePreciso } from "@/lib/meet/status-slots";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.MEET_CRON_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization");
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = bearer || req.nextUrl.searchParams.get("token");

  if (!segredoConfere(token)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const sb = await createServiceRoleClient();

    // Primeiro de tudo: sala aberta além do teto continua gravando enquanto o
    // resto roda. Encerrar antes também faz a captura logo abaixo já pegar o
    // encontro fechado, em vez de esperar a próxima batida.
    const encerramento = await encerrarReunioesLongas(sb);

    // Depois de encerrar: fechar a porta antes disso deixaria quem está dentro
    // preso numa sala que não aceita mais ninguém, sem encerrar a reunião.
    const janela = await aplicarJanelaDeAcesso(sb);

    const excecoes = await sincronizarExcecoes(sb);
    const ingestao = await ingerir({ origem: "cron", diasAtras: 15 });

    // Fechar a semana ANTES de marcar a semana corrente, porque o fechamento
    // zera todos os status: na ordem inversa ele apagaria a marcação recém-feita.
    // O fechamento cuida sozinho de marcar a semana que terminou antes de
    // arquivá-la.
    const semana = await fecharSemanaSePreciso(sb);
    const status = await atualizarStatusSlots(sb);

    return NextResponse.json({
      ok: true,
      encerramento,
      janela,
      excecoes,
      ingestao,
      status,
      semana,
    });
  } catch (e) {
    console.error("[meet/cron]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    );
  }
}
