import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: NextRequest) {
  try {
    const sb = await createServiceRoleClient();
    const type = req.nextUrl.searchParams.get("type");

    if (type === "horarios") {
      const { data, error } = await sb
        .from("formacao_horarios")
        .select("*")
        .order("ordem");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "slots") {
      const { data, error } = await sb
        .from("formacao_slots")
        .select("*, formacao_horarios(hora, ordem)");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "alocacoes") {
      const { data, error } = await sb
        .from("formacao_alocacoes")
        .select("*, certificado_condutores(id, nome, telefone)");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "condutores") {
      const { data, error } = await sb
        .from("certificado_condutores")
        .select("*")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "cronograma") {
      const { data } = await sb
        .from("formacao_cronograma")
        .select("*")
        .limit(1)
        .single();
      return NextResponse.json(data ?? null, { headers: corsHeaders });
    }

    if (type === "eventos") {
      const { data, error } = await sb
        .from("certificado_eventos")
        .select("*")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "eventos_ativos") {
      const now = new Date().toISOString();
      const { data, error } = await sb
        .from("certificado_eventos")
        .select("*")
        .eq("ativo", true)
        .lte("data_inicio", now)
        .gte("data_fim", now)
        .order("data_fim");
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "config") {
      const { data } = await sb
        .from("formacao_cronograma")
        .select("grupos_visiveis, duracao_minutos")
        .limit(1)
        .single();
      return NextResponse.json(
        data ?? { grupos_visiveis: true, duracao_minutos: 90 },
        { headers: corsHeaders }
      );
    }

    if (type === "snapshots") {
      const { data, error } = await sb
        .from("formacao_snapshots")
        .select("*, formacao_snapshot_slots(*)")
        .order("semana_inicio", { ascending: false });
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "slot_logs") {
      let query = sb
        .from("formacao_slot_logs")
        .select("*")
        .order("changed_at", { ascending: false });
      const from = req.nextUrl.searchParams.get("from");
      const to = req.nextUrl.searchParams.get("to");
      if (from) query = query.gte("changed_at", from);
      if (to) query = query.lte("changed_at", to);
      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (type === "cronograma_publico") {
      const { data: config } = await sb
        .from("formacao_cronograma")
        .select("grupos_visiveis, duracao_minutos")
        .limit(1)
        .single();

      if (!config?.grupos_visiveis) {
        return NextResponse.json(
          { visivel: false, horarios: [], slots: [], atividades: [] },
          { headers: corsHeaders }
        );
      }

      const { data: horarios } = await sb
        .from("formacao_horarios")
        .select("*")
        .eq("ativo", true)
        .order("ordem");

      const { data: slots } = await sb
        .from("formacao_slots")
        .select("*, formacao_horarios(hora, ordem)")
        .eq("ativo", true);

      const { data: atividades } = await sb
        .from("certificado_atividades")
        .select("*")
        .eq("ativo", true);

      return NextResponse.json(
        {
          visivel: true,
          duracao_minutos: config.duracao_minutos,
          horarios: horarios ?? [],
          slots: slots ?? [],
          atividades: atividades ?? [],
        },
        { headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { error: "Invalid type parameter" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const sb = await createServiceRoleClient();
    const body = await req.json();
    const { action } = body;

    // --- Horarios ---

    if (action === "create_horario") {
      const { data: maxRow } = await sb
        .from("formacao_horarios")
        .select("ordem")
        .order("ordem", { ascending: false })
        .limit(1)
        .single();
      const maxOrdem = maxRow?.ordem ?? 0;

      const { data, error } = await sb
        .from("formacao_horarios")
        .insert({ hora: body.hora, ordem: maxOrdem + 1 })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "update_horario") {
      const updates: Record<string, unknown> = {};
      if (body.hora !== undefined) updates.hora = body.hora;
      if (body.ativo !== undefined) updates.ativo = body.ativo;
      const { data, error } = await sb
        .from("formacao_horarios")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "delete_horario") {
      const { error } = await sb
        .from("formacao_horarios")
        .delete()
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Slots ---

    if (action === "create_slot") {
      const { data, error } = await sb
        .from("formacao_slots")
        .insert({ dia_semana: body.dia_semana, horario_id: body.horario_id })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "update_slot") {
      const updates: Record<string, unknown> = {};
      if (body.ativo !== undefined) updates.ativo = body.ativo;
      if (body.status !== undefined) updates.status = body.status;
      if (body.atividade_nome !== undefined) updates.atividade_nome = body.atividade_nome;
      if (body.meet_link !== undefined) updates.meet_link = body.meet_link;
      const { data, error } = await sb
        .from("formacao_slots")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "delete_slot") {
      const { error } = await sb
        .from("formacao_slots")
        .delete()
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Alocacoes ---

    if (action === "add_alocacao") {
      const { data, error } = await sb
        .from("formacao_alocacoes")
        .insert({ slot_id: body.slot_id, condutor_id: body.condutor_id })
        .select("*, certificado_condutores(id, nome, telefone)")
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "remove_alocacao") {
      const { error } = await sb
        .from("formacao_alocacoes")
        .delete()
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Condutor telefone ---

    if (action === "update_condutor_telefone") {
      const { data, error } = await sb
        .from("certificado_condutores")
        .update({ telefone: body.telefone })
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    // --- Cronograma ---

    if (action === "update_cronograma_img") {
      const { data: existing } = await sb
        .from("formacao_cronograma")
        .select("id")
        .limit(1)
        .single();
      if (existing) {
        const { error } = await sb
          .from("formacao_cronograma")
          .update({
            imagem_base64: body.imagem_base64,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("formacao_cronograma").insert({
          imagem_base64: body.imagem_base64,
          updated_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "toggle_grupos_visiveis") {
      const { data: existing } = await sb
        .from("formacao_cronograma")
        .select("id")
        .limit(1)
        .single();
      if (existing) {
        const { error } = await sb
          .from("formacao_cronograma")
          .update({ grupos_visiveis: body.grupos_visiveis })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("formacao_cronograma").insert({
          grupos_visiveis: body.grupos_visiveis,
          duracao_minutos: 90,
        });
        if (error) throw error;
      }
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (action === "update_duracao") {
      const { data: existing } = await sb
        .from("formacao_cronograma")
        .select("id")
        .limit(1)
        .single();
      if (existing) {
        const { error } = await sb
          .from("formacao_cronograma")
          .update({ duracao_minutos: body.duracao_minutos })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from("formacao_cronograma").insert({
          duracao_minutos: body.duracao_minutos,
          grupos_visiveis: true,
        });
        if (error) throw error;
      }
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Snapshots & Logs ---

    if (action === "create_snapshot") {
      const { data: snapshot, error: snapErr } = await sb
        .from("formacao_snapshots")
        .insert({
          semana_inicio: body.semana_inicio,
          semana_fim: body.semana_fim,
        })
        .select()
        .single();
      if (snapErr) throw snapErr;

      const slotRows = (body.slots || []).map((s: Record<string, unknown>) => ({
        snapshot_id: snapshot.id,
        slot_id: s.slot_id,
        dia_semana: s.dia_semana,
        horario_hora: s.horario_hora,
        atividade_nome: s.atividade_nome,
        status: s.status,
        meet_link: s.meet_link,
        condutores: s.condutores,
      }));

      if (slotRows.length > 0) {
        const { error: slotsErr } = await sb
          .from("formacao_snapshot_slots")
          .insert(slotRows);
        if (slotsErr) throw slotsErr;
      }

      return NextResponse.json(snapshot, { headers: corsHeaders });
    }

    if (action === "log_status_change") {
      const { error } = await sb.from("formacao_slot_logs").insert({
        slot_id: body.slot_id,
        status_anterior: body.status_anterior || null,
        status_novo: body.status_novo,
        atividade_nome: body.atividade_nome || null,
        condutor_ids: body.condutor_ids || [],
      });
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Reset statuses ---

    if (action === "reset_statuses") {
      const { error } = await sb
        .from("formacao_slots")
        .update({ status: "pendente" })
        .not("id", "is", null); // match all rows
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    // --- Eventos ---

    if (action === "create_evento") {
      const { data, error } = await sb
        .from("certificado_eventos")
        .insert({
          titulo: body.titulo,
          descricao: body.descricao,
          data_inicio: body.data_inicio,
          data_fim: body.data_fim,
        })
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "update_evento") {
      const updates: Record<string, unknown> = {};
      if (body.titulo !== undefined) updates.titulo = body.titulo;
      if (body.descricao !== undefined) updates.descricao = body.descricao;
      if (body.data_inicio !== undefined) updates.data_inicio = body.data_inicio;
      if (body.data_fim !== undefined) updates.data_fim = body.data_fim;
      if (body.ativo !== undefined) updates.ativo = body.ativo;
      const { data, error } = await sb
        .from("certificado_eventos")
        .update(updates)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      return NextResponse.json(data, { headers: corsHeaders });
    }

    if (action === "delete_evento") {
      const { error } = await sb
        .from("certificado_eventos")
        .delete()
        .eq("id", body.id);
      if (error) throw error;
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400, headers: corsHeaders }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
