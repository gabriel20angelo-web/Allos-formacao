import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { buildCorsHeaders, isAdminOrSharedSecret } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, {
    headers: buildCorsHeaders(req.headers.get("origin"), {
      methods: "GET, POST, DELETE, OPTIONS",
    }),
  });
}

export async function POST(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"), {
    methods: "GET, POST, DELETE, OPTIONS",
  });
  if (!(await isAdminOrSharedSecret(req))) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401, headers: corsHeaders },
    );
  }
  try {
    const body = await req.json();

    const {
      meet_link,
      condutor_nome,
      slot_id,
      atividade_nome,
      hora_inicio,
      hora_fim,
      duracao_minutos,
      participantes,
      total_participantes,
      media_participantes,
      pico_participantes,
    } = body;

    if (!condutor_nome || !hora_inicio || !hora_fim) {
      return NextResponse.json(
        { error: "Campos obrigatórios: condutor_nome, hora_inicio, hora_fim" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validação de tipos/limites pra evitar DB pollution caso shared
    // secret vaze.
    if (typeof condutor_nome !== "string" || condutor_nome.length > 200) {
      return NextResponse.json({ error: "condutor_nome inválido" }, { status: 400, headers: corsHeaders });
    }
    const numericFields = { total_participantes, media_participantes, pico_participantes, duracao_minutos };
    for (const [k, v] of Object.entries(numericFields)) {
      if (v !== undefined && v !== null && (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 100000)) {
        return NextResponse.json({ error: `${k} inválido` }, { status: 400, headers: corsHeaders });
      }
    }
    if (participantes !== undefined && participantes !== null) {
      if (!Array.isArray(participantes) || participantes.length > 500) {
        return NextResponse.json({ error: "participantes inválido" }, { status: 400, headers: corsHeaders });
      }
    }
    if (atividade_nome !== undefined && atividade_nome !== null) {
      if (typeof atividade_nome !== "string" || atividade_nome.length > 200) {
        return NextResponse.json({ error: "atividade_nome inválido" }, { status: 400, headers: corsHeaders });
      }
    }

    const dataReuniao = new Date(hora_inicio);
    const diaSemana = dataReuniao.getDay();
    const diaSemanaAjustado = diaSemana === 0 ? 6 : diaSemana - 1;

    const sb = await createServiceRoleClient();

    const { data, error } = await sb.from("formacao_meet_presencas").insert({
      slot_id: slot_id || null,
      meet_link: meet_link || "manual",
      condutor_nome,
      atividade_nome: atividade_nome || null,
      data_reuniao: dataReuniao.toISOString().split("T")[0],
      dia_semana: diaSemanaAjustado,
      hora_inicio,
      hora_fim,
      duracao_minutos: duracao_minutos || 0,
      participantes: participantes || [],
      total_participantes: total_participantes || 0,
      media_participantes: media_participantes || 0,
      pico_participantes: pico_participantes || 0,
    }).select().single();

    if (error) throw error;

    return NextResponse.json(
      { success: true, id: data.id },
      { headers: corsHeaders }
    );
  } catch (err) {
    console.error("[meet-presenca]", err);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"), {
    methods: "GET, POST, DELETE, OPTIONS",
  });
  if (!(await isAdminOrSharedSecret(req))) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401, headers: corsHeaders },
    );
  }
  try {
    const sb = await createServiceRoleClient();
    const slotId = req.nextUrl.searchParams.get("slot_id");
    const dataInicio = req.nextUrl.searchParams.get("data_inicio");
    const dataFim = req.nextUrl.searchParams.get("data_fim");

    let query = sb
      .from("formacao_meet_presencas")
      .select("*")
      .order("data_reuniao", { ascending: false })
      .order("hora_inicio", { ascending: false });

    if (slotId) query = query.eq("slot_id", slotId);
    if (dataInicio) query = query.gte("data_reuniao", dataInicio);
    if (dataFim) query = query.lte("data_reuniao", dataFim);

    const { data, error } = await query.limit(200);
    if (error) throw error;

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (err) {
    console.error("[meet-presenca]", err);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const corsHeaders = buildCorsHeaders(req.headers.get("origin"), {
    methods: "GET, POST, DELETE, OPTIONS",
  });
  if (!(await isAdminOrSharedSecret(req))) {
    return NextResponse.json(
      { error: "Não autorizado" },
      { status: 401, headers: corsHeaders },
    );
  }
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "ID obrigatório" },
        { status: 400, headers: corsHeaders }
      );
    }

    const sb = await createServiceRoleClient();
    const { error } = await sb
      .from("formacao_meet_presencas")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[meet-presenca]", err);
    return NextResponse.json(
      { error: "Erro interno" },
      { status: 500, headers: corsHeaders }
    );
  }
}
