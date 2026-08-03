// Encerra a reunião em andamento de uma sala.
//
// Serve para dois casos reais: o condutor esqueceu a sala aberta, e alguém
// precisa fechar de fora; ou a reunião acabou de fato mas ninguém clicou em
// encerrar, e o registro do encontro fica pendurado sem hora de fim, atrasando
// a captura do quórum.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { encerrarConferencia, MeetApiError } from "@/lib/meet/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { space_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.space_name) {
    return NextResponse.json({ error: "space_name obrigatório" }, { status: 400 });
  }

  try {
    await encerrarConferencia(body.space_name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof MeetApiError ? e.message : String(e);
    const detalhe = e instanceof MeetApiError ? e.body : undefined;

    // Sala vazia devolve erro do Google, e isso não é falha: é resposta.
    if (e instanceof MeetApiError && (e.status === 404 || e.status === 400)) {
      return NextResponse.json(
        { error: "Não há reunião acontecendo nesta sala agora.", detalhe },
        { status: 409 }
      );
    }
    console.error("[meet/encerrar]", msg, detalhe);
    return NextResponse.json({ error: msg, detalhe }, { status: 400 });
  }
}
