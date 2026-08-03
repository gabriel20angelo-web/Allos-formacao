// Ingestão sob demanda, pelo botão do painel.
//
// Mesma função do cron, com janela maior: serve pra primeira carga (puxar o
// histórico que já existe nas salas) e pra conferir na hora se um encontro
// entrou, sem esperar a próxima batida.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { ingerir } from "@/lib/meet/ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { dias?: number; space_name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // corpo vazio é uso legítimo: ingerir o padrão
  }

  try {
    const resultado = await ingerir({
      origem: "manual",
      diasAtras: Math.min(Math.max(body.dias ?? 30, 1), 30),
      spaceName: body.space_name,
    });
    return NextResponse.json({ ok: true, resultado });
  } catch (e) {
    console.error("[meet/ingerir]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    );
  }
}
