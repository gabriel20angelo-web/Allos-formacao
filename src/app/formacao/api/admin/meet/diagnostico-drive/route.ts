// Por que o Drive está recusando.
//
// A mensagem genérica de erro não distingue os três motivos possíveis, e cada
// um tem uma solução diferente: o escopo não foi concedido, o escopo foi
// concedido mas a organização bloqueia o app, ou a pasta é que não existe.
// Aqui perguntamos ao próprio Google o que ele concedeu.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { getAccessToken } from "@/lib/meet/client";

export const dynamic = "force-dynamic";

const ESCOPO_DRIVE = "https://www.googleapis.com/auth/drive";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const diagnostico: Record<string, unknown> = {};

  let token: string;
  try {
    token = await getAccessToken(true);
    diagnostico.token = "obtido";
  } catch (e) {
    return NextResponse.json({
      etapa: "token",
      conclusao: "Não consegui renovar o acesso. Autorize de novo pelo painel.",
      erro: e instanceof Error ? e.message : String(e),
    });
  }

  // O que o Google de fato concedeu, na palavra dele.
  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
    );
    const info = (await r.json()) as { scope?: string; email?: string };
    const escopos = (info.scope || "").split(" ").filter(Boolean);
    diagnostico.conta = info.email || null;
    diagnostico.escopos_concedidos = escopos;
    diagnostico.tem_escopo_drive = escopos.includes(ESCOPO_DRIVE);
  } catch (e) {
    diagnostico.tokeninfo_erro = e instanceof Error ? e.message : String(e);
  }

  // Chamada mais simples possível ao Drive: se falhar aqui, o problema não é a
  // pasta, é o acesso.
  try {
    const r = await fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const corpo = await r.text();
    diagnostico.drive_status = r.status;
    diagnostico.drive_resposta = corpo.slice(0, 400);
  } catch (e) {
    diagnostico.drive_erro = e instanceof Error ? e.message : String(e);
  }

  const temEscopo = diagnostico.tem_escopo_drive === true;
  const driveOk = diagnostico.drive_status === 200;

  diagnostico.conclusao = !temEscopo
    ? "A autorização saiu SEM a permissão de Drive. Ou a tela do Google não mostrou o pedido, ou ele foi recusado. Refaça a autorização e confira se aparece o item sobre arquivos do Drive."
    : !driveOk
      ? "A permissão foi concedida, mas o Google está bloqueando a chamada. Isso costuma ser controle de acesso a apps no Admin do Workspace: o app precisa ser marcado como confiável."
      : "Acesso ao Drive funcionando. Se a pasta continua falhando, o problema é o link da pasta ou a permissão dela.";

  return NextResponse.json(diagnostico);
}
