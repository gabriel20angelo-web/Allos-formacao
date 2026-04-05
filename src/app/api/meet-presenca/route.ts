import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      meet_link,
      condutor_nome,
      slot_id,
      hora_inicio,
      hora_fim,
      duracao_minutos,
      participantes,
      total_participantes,
      media_participantes,
      pico_participantes,
    } = body;

    if (!meet_link || !condutor_nome || !hora_inicio || !hora_fim) {
      return NextResponse.json(
        { error: "Campos obrigatórios: meet_link, condutor_nome, hora_inicio, hora_fim" },
        { status: 400, headers: corsHeaders }
      );
    }

    const dataReuniao = new Date(hora_inicio);
    const diaSemana = dataReuniao.getDay();
    // JS: 0=domingo, ajustar para 0=segunda como no formacao_slots
    const diaSemanaAjustado = diaSemana === 0 ? 6 : diaSemana - 1;

    const sb = await createServiceRoleClient();

    const { data, error } = await sb.from("formacao_meet_presencas").insert({
      slot_id: slot_id || null,
      meet_link,
      condutor_nome,
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("[meet-presenca] Erro:", message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function GET(req: NextRequest) {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
