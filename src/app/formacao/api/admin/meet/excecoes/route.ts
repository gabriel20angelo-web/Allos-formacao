// "Nesta data, grava diferente do padrão."
//
// Só registra a intenção. Quem mexe no space é o cron, que aplica no dia e
// reverte depois. Aplicar aqui, na hora do clique, deixaria a sala configurada
// errado por dias até chegar a data.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { dataLocal } from "@/lib/meet/nomes";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: {
    slot_id?: string;
    data?: string;
    gravar?: boolean | null;
    transcrever?: boolean | null;
    notas?: boolean | null;
    motivo?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.slot_id || !body.data) {
    return NextResponse.json({ error: "slot_id e data obrigatórios" }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data)) {
    return NextResponse.json({ error: "data no formato AAAA-MM-DD" }, { status: 400 });
  }
  if (body.data < dataLocal(new Date())) {
    return NextResponse.json(
      { error: "Não dá para configurar gravação de um encontro que já passou." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("formacao_meet_excecoes")
    .upsert(
      {
        slot_id: body.slot_id,
        data: body.data,
        gravar: body.gravar ?? null,
        transcrever: body.transcrever ?? null,
        notas: body.notas ?? null,
        motivo: body.motivo || null,
        criado_por: auth.userId,
        aplicada_em: null,
        revertida_em: null,
      },
      { onConflict: "slot_id,data" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, excecao: data });
}

export async function DELETE(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const sb = await createServiceRoleClient();

  // Exceção já aplicada não pode simplesmente sumir: a sala está configurada
  // fora do padrão e alguém precisa desfazer. Marcar como vencida faz o cron
  // reverter na próxima batida.
  const { data: atual } = await sb
    .from("formacao_meet_excecoes")
    .select("aplicada_em, revertida_em")
    .eq("id", id)
    .maybeSingle();

  if (atual?.aplicada_em && !atual.revertida_em) {
    const { error } = await sb
      .from("formacao_meet_excecoes")
      .update({ data: "1970-01-01" })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, revertendo: true });
  }

  const { error } = await sb.from("formacao_meet_excecoes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
