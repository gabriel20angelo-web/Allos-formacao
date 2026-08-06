// O retrato de pessoas do painel.
//
// Uma chamada só devolve a tela inteira já cruzada. A alternativa seria a tela
// puxar as sete tabelas cruas e cruzar no navegador, que é como o resto do
// admin faz, mas aqui isso custaria cerca de 1 MB por abertura e obrigaria o
// cliente a paginar à mão para não bater no corte silencioso de mil linhas do
// PostgREST.
//
// Service role depois do porteiro, pelo motivo de sempre: `pessoas` e
// `pessoa_identificadores` guardam nome e e-mail de gente que nunca pediu conta
// na plataforma, e a policy delas é `is_admin()`. Se `exigirAdmin` falhar, o
// service role vira porta aberta.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { montarRetrato } from "@/lib/pessoas/agregar";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  try {
    const sb = await createServiceRoleClient();
    const retrato = await montarRetrato(sb);
    return NextResponse.json(retrato);
  } catch (err) {
    console.error("[admin/pessoas]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? `Não consegui montar o retrato: ${err.message}`
            : "Erro interno",
      },
      { status: 500 },
    );
  }
}
