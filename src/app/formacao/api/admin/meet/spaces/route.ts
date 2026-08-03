// Criação e reconfiguração da sala permanente de cada slot.
//
// POST cria a sala uma vez. PATCH troca o padrão de artefatos, tanto no nosso
// banco quanto no space do Google: guardar só localmente faria o painel mentir.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  atualizarAcesso,
  atualizarArtefatos,
  criarSpace,
  MeetApiError,
} from "@/lib/meet/client";
import type { AccessType } from "@/lib/meet/types";

export const dynamic = "force-dynamic";

interface CorpoPost {
  slot_id?: string;
  gravar?: boolean;
  transcrever?: boolean;
  notas?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: CorpoPost;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.slot_id) {
    return NextResponse.json({ error: "slot_id obrigatório" }, { status: 400 });
  }

  const artefatos = {
    gravar: body.gravar !== false, // grava por padrão; a chave do painel desliga
    transcrever: body.transcrever !== false, // é ela que gera os indicadores
    notas: body.notas === true,
  };

  const sb = await createServiceRoleClient();

  const { data: jaTem } = await sb
    .from("formacao_meet_spaces")
    .select("id, meeting_uri")
    .eq("slot_id", body.slot_id)
    .maybeSingle();

  if (jaTem) {
    return NextResponse.json(
      { error: "Este grupo já tem sala.", meeting_uri: jaTem.meeting_uri },
      { status: 409 }
    );
  }

  try {
    const space = await criarSpace(artefatos);

    const { data, error } = await sb
      .from("formacao_meet_spaces")
      .insert({
        slot_id: body.slot_id,
        space_name: space.name,
        meeting_code: space.meetingCode || null,
        meeting_uri: space.meetingUri || null,
        ...artefatos,
        criado_por: auth.userId,
      })
      .select()
      .single();

    if (error) {
      // A sala existe no Google mas não no banco. Devolver o link evita que ela
      // vire órfã invisível.
      console.error("[meet/spaces] insert", error);
      return NextResponse.json(
        {
          error: `Sala criada no Google (${space.meetingUri}) mas não salva: ${error.message}`,
        },
        { status: 500 }
      );
    }

    // O link do slot passa a ser o da sala nova, senão o grupo continua entrando
    // na sala antiga e o quórum não captura nada.
    await sb
      .from("formacao_slots")
      .update({ meet_link: space.meetingUri })
      .eq("id", body.slot_id);

    return NextResponse.json({ ok: true, space: data });
  } catch (e) {
    const msg = e instanceof MeetApiError ? e.message : String(e);
    const detalhe = e instanceof MeetApiError ? e.body : undefined;
    console.error("[meet/spaces] criar", msg, detalhe);
    return NextResponse.json({ error: msg, detalhe }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: {
    space_name?: string;
    gravar?: boolean;
    transcrever?: boolean;
    notas?: boolean;
    ativo?: boolean;
    access_type?: AccessType;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.space_name) {
    return NextResponse.json({ error: "space_name obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const { data: atual } = await sb
    .from("formacao_meet_spaces")
    .select("gravar, transcrever, notas, access_type")
    .eq("space_name", body.space_name)
    .maybeSingle();

  if (!atual) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  // Acesso e artefatos são dois updateMask diferentes na API, então viram duas
  // chamadas. Só mexe no acesso quem pediu explicitamente.
  if (body.access_type && body.access_type !== atual.access_type) {
    if (!["OPEN", "TRUSTED", "RESTRICTED"].includes(body.access_type)) {
      return NextResponse.json({ error: "access_type inválido" }, { status: 400 });
    }
    try {
      await atualizarAcesso(body.space_name, body.access_type);
    } catch (e) {
      const msg = e instanceof MeetApiError ? e.message : String(e);
      const detalhe = e instanceof MeetApiError ? e.body : undefined;
      console.error("[meet/spaces] patch", msg, detalhe);
      return NextResponse.json({ error: msg, detalhe }, { status: 400 });
    }
  }

  const artefatos = {
    gravar: body.gravar ?? atual.gravar,
    transcrever: body.transcrever ?? atual.transcrever,
    notas: body.notas ?? atual.notas,
  };

  // Só o que veio no pedido vai para o Google, para não tocar em recurso que a
  // licença talvez não cubra sem que ninguém tenha pedido.
  const alteracao = {
    ...(body.gravar !== undefined ? { gravar: body.gravar } : {}),
    ...(body.transcrever !== undefined ? { transcrever: body.transcrever } : {}),
    ...(body.notas !== undefined ? { notas: body.notas } : {}),
  };

  if (Object.keys(alteracao).length > 0) {
    try {
      await atualizarArtefatos(body.space_name, alteracao);
    } catch (e) {
      const msg = e instanceof MeetApiError ? e.message : String(e);
      const detalhe = e instanceof MeetApiError ? e.body : undefined;
      console.error("[meet/spaces] patch", msg, detalhe);
      return NextResponse.json({ error: msg, detalhe }, { status: 400 });
    }
  }

  const { error } = await sb
    .from("formacao_meet_spaces")
    .update({
      ...artefatos,
      ...(body.access_type ? { access_type: body.access_type } : {}),
      ...(body.ativo !== undefined ? { ativo: body.ativo } : {}),
    })
    .eq("space_name", body.space_name);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    ...artefatos,
    access_type: body.access_type ?? atual.access_type,
  });
}
