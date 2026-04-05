import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json; charset=utf-8",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const sb = await createServiceRoleClient();

    // Dia da semana: JS 0=domingo, formacao_slots 0=segunda
    const hoje = new Date();
    const jsDay = hoje.getDay();
    const diaSemana = jsDay === 0 ? 6 : jsDay - 1;

    // Buscar slots ativos do dia de hoje
    const { data: slots, error } = await sb
      .from("formacao_slots")
      .select(`
        id,
        dia_semana,
        ativo,
        status,
        atividade_nome,
        meet_link,
        formacao_horarios (hora, ordem)
      `)
      .eq("dia_semana", diaSemana)
      .eq("ativo", true)
      .order("dia_semana");

    if (error) throw error;

    // Buscar alocações com nomes dos condutores para cada slot
    const slotIds = (slots || []).map((s) => s.id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let alocacoes: any[] = [];
    if (slotIds.length > 0) {
      const { data: alocs, error: alocError } = await sb
        .from("formacao_alocacoes")
        .select("slot_id, certificado_condutores (id, nome)")
        .in("slot_id", slotIds);

      if (alocError) throw alocError;
      alocacoes = alocs || [];
    }

    // Juntar condutores nos slots
    const result = (slots || [])
      .map((slot) => ({
        ...slot,
        condutores: alocacoes
          .filter((a) => a.slot_id === slot.id)
          .map((a) => a.certificado_condutores)
          .filter(Boolean),
      }))
      .sort((a, b) => {
        const hA = a.formacao_horarios as any;
        const hB = b.formacao_horarios as any;
        const ordemA = (Array.isArray(hA) ? hA[0]?.ordem : hA?.ordem) ?? 99;
        const ordemB = (Array.isArray(hB) ? hB[0]?.ordem : hB?.ordem) ?? 99;
        return ordemA - ordemB;
      });

    return NextResponse.json(result, { headers: corsHeaders });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Erro interno";
    console.error("[meet-slots-hoje] Erro:", message);
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders }
    );
  }
}
