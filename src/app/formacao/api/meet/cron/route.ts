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
import { sincronizarExcecoes } from "@/lib/meet/excecoes";
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
    const excecoes = await sincronizarExcecoes(sb);
    const ingestao = await ingerir({ origem: "cron", diasAtras: 15 });

    // Nesta ordem, de propósito: capturar, marcar o que a captura revelou, e só
    // então fechar a semana. Fechar antes de marcar arquivaria um retrato com
    // status desatualizado, e o snapshot é o que vira histórico.
    const status = await atualizarStatusSlots(sb);
    const semana = await fecharSemanaSePreciso(sb);

    return NextResponse.json({
      ok: true,
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
