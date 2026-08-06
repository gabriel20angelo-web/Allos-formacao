// Em que proporção quem conduz quer os cortes.
//
// Rota curta e sem consequência de dinheiro: guarda um pedido, não manda cortar
// nada. Quem envia continua sendo o administrador, e é no envio que a conta
// corre. Por isso ela cabe na área do condutor, ao lado dos interruptores da
// sala, e não junto do botão que gasta.
//
// A escolha vale para o PRÓXIMO envio. O corte que já saiu não muda de
// proporção: ele foi renderizado e pago naquele formato, e não há como
// reconverter pela API do OpusClip, só cortando de novo, o que seria pagar os
// mesmos minutos duas vezes.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { identificarCondutor, salasDoCondutor } from "@/lib/condutor";
import { ehFormato, guardarPedidoDeFormato } from "@/lib/meet/formato";

export const dynamic = "force-dynamic";

export async function GET() {
  const quem = await identificarCondutor();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  const sb = await createServiceRoleClient();
  const { data } = await sb
    .from("formacao_clip_formato")
    .select("escopo, chave, formato");

  const salas: Record<string, string> = {};
  const cursos: Record<string, string> = {};
  for (const p of (data || []) as { escopo: string; chave: string; formato: string }[]) {
    if (p.escopo === "sala") salas[p.chave] = p.formato;
    else if (p.escopo === "curso") cursos[p.chave] = p.formato;
  }

  return NextResponse.json({ salas, cursos });
}

export async function PATCH(req: NextRequest) {
  const quem = await identificarCondutor();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  let body: { escopo?: string; chave?: string; formato?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!ehFormato(body.formato)) {
    return NextResponse.json(
      { error: "Formato inválido. Use reels ou horizontal." },
      { status: 400 }
    );
  }
  if (!body.chave) {
    return NextResponse.json({ error: "chave obrigatória" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // A chave vem do cliente, e gravar uma que não corresponde a nada produziria
  // um pedido órfão: ninguém o leria no envio, e a tela mostraria a escolha
  // feita. É o tipo de silêncio que só aparece semanas depois, quando o corte
  // sai no formato antigo e ninguém entende por quê.
  if (body.escopo === "sala") {
    const nomes = await salasDoCondutor(sb);
    if (!nomes.includes(body.chave)) {
      return NextResponse.json(
        { error: "Esta sala não existe ou está inativa." },
        { status: 404 }
      );
    }
  } else if (body.escopo === "curso") {
    const { data: curso } = await sb
      .from("courses")
      .select("id")
      .eq("id", body.chave)
      .maybeSingle();
    if (!curso) {
      return NextResponse.json({ error: "Curso não encontrado." }, { status: 404 });
    }
  } else {
    return NextResponse.json(
      { error: "Escopo inválido. Use sala ou curso." },
      { status: 400 }
    );
  }

  const r = await guardarPedidoDeFormato(
    sb,
    body.escopo,
    body.chave,
    body.formato,
    quem.userId
  );
  if (!r.ok) return NextResponse.json({ error: r.erro }, { status: 500 });

  return NextResponse.json({ ok: true });
}
