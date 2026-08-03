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
import { garantirPastaDoGrupo } from "@/lib/meet/pastas";

export const dynamic = "force-dynamic";

interface CorpoPost {
  slot_id?: string;
  rotulo?: string;
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

  // Ou a sala pertence a um grupo da grade, ou tem nome próprio. Sala sem os
  // dois vira quórum órfão, que ninguém sabe de quem é.
  const rotulo = (body.rotulo || "").trim();
  if (!body.slot_id && !rotulo) {
    return NextResponse.json(
      { error: "Informe o grupo da grade ou um nome para a sala." },
      { status: 400 }
    );
  }

  // Gravação de vídeo fica DESLIGADA por padrão, por decisão do Gabriel: o
  // encontro de formação toca em material clínico, e um vídeo existe para
  // sempre e vaza com um link. Transcrição e notas ficam ligadas porque geram
  // os indicadores e não guardam imagem de ninguém.
  const artefatos = {
    gravar: body.gravar === true,
    transcrever: body.transcrever !== false,
    notas: body.notas !== false,
  };

  const sb = await createServiceRoleClient();

  // Um grupo da grade só pode ter uma sala. Sala avulsa pode repetir nome sem
  // problema: são reuniões diferentes com o mesmo assunto.
  if (body.slot_id) {
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
  }

  try {
    const space = await criarSpace(artefatos);

    const { data, error } = await sb
      .from("formacao_meet_spaces")
      .insert({
        slot_id: body.slot_id || null,
        rotulo: rotulo || null,
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

    // Pasta própria do grupo, criada junto com a sala. Se falhar aqui (Drive
    // indisponível, permissão ainda não concedida), a primeira gravação tenta
    // de novo: melhor a sala existir sem pasta do que não existir.
    let pasta: { url: string } | null = null;
    try {
      pasta = await garantirPastaDoGrupo(sb, space.name);
    } catch (e) {
      console.warn("[meet/spaces] pasta do grupo", e);
    }

    // O link do slot passa a ser o da sala nova, senão o grupo continua entrando
    // na sala antiga e o quórum não captura nada. Sala avulsa não tem slot.
    if (body.slot_id) {
      await sb
        .from("formacao_slots")
        .update({ meet_link: space.meetingUri })
        .eq("id", body.slot_id);
    }

    return NextResponse.json({ ok: true, space: data, pasta_url: pasta?.url || null });
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
    janela_automatica?: boolean;
    duracao_min?: number | null;
    curso_id?: string | null;
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
    .select("gravar, transcrever, notas, access_type, janela_automatica")
    .eq("space_name", body.space_name)
    .maybeSingle();

  if (!atual) {
    return NextResponse.json({ error: "Sala não encontrada" }, { status: 404 });
  }

  // Curso que recebe as gravações deste grupo. null desliga a sugestão.
  if (body.curso_id !== undefined) {
    const { error } = await sb
      .from("formacao_meet_spaces")
      .update({ curso_id: body.curso_id || null })
      .eq("space_name", body.space_name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (
      body.access_type === undefined &&
      body.janela_automatica === undefined &&
      body.duracao_min === undefined
    ) {
      return NextResponse.json({ ok: true, curso_id: body.curso_id || null });
    }
  }

  // Duração própria desta sala. null volta ao padrão da Formação.
  if (body.duracao_min !== undefined) {
    const v = body.duracao_min;
    if (v !== null && (!Number.isFinite(Number(v)) || Number(v) < 30 || Number(v) > 600)) {
      return NextResponse.json(
        { error: "Use um valor entre 30 e 600 minutos, ou deixe vazio para usar o padrão." },
        { status: 400 }
      );
    }
    const { error } = await sb
      .from("formacao_meet_spaces")
      .update({ duracao_min: v === null ? null : Math.round(Number(v)) })
      .eq("space_name", body.space_name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (body.access_type === undefined && body.janela_automatica === undefined) {
      return NextResponse.json({ ok: true, duracao_min: v });
    }
  }

  // Religar a janela sozinha, sem trocar acesso: devolve a sala ao horário do
  // grupo na próxima batida do cron.
  if (body.janela_automatica === true && body.access_type === undefined) {
    const { error } = await sb
      .from("formacao_meet_spaces")
      .update({ janela_automatica: true })
      .eq("space_name", body.space_name);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, janela_automatica: true });
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
      // Mexer no acesso à mão desliga a janela automática desta sala: quem
      // abriu fora de hora tem um motivo, e o cron não pode fechar em quinze
      // minutos o que uma pessoa acabou de abrir.
      ...(body.access_type
        ? { access_type: body.access_type, janela_automatica: false }
        : {}),
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
