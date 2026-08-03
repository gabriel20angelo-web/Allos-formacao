// Lista dos encontros capturados, com os arquivos que o Google gerou.
//
// A gravação e a transcrição ficam no Drive da conta organizadora, e o que
// guardamos é o endereço delas. Esta rota é o que transforma isso em algo
// clicável: sem ela, os arquivos existem mas ninguém acha.
//
// Devolve as participações junto porque a tela mostra quem esteve em cada
// encontro, e são dezenas de linhas por encontro, não milhares.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface ParticipacaoRow {
  encontro_id: string;
  display_name: string;
  aluno_id: string | null;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
  eh_condutor: boolean;
}

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const limite = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limite")) || 30, 1), 100);
  const sb = await createServiceRoleClient();

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("tolerancia_atraso_min")
    .maybeSingle();
  const tolerancia = cronograma?.tolerancia_atraso_min ?? 7;

  const { data: encontros, error } = await sb
    .from("formacao_meet_encontros")
    .select("*")
    .order("inicio", { ascending: false })
    .limit(limite);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!encontros?.length) {
    return NextResponse.json({ encontros: [], tolerancia });
  }

  const ids = encontros.map((e: { id: string }) => e.id);
  const { data: parts } = await sb
    .from("formacao_meet_participacoes")
    .select(
      "encontro_id, display_name, aluno_id, minutos_presentes, permanencia_pct, atraso_min, minutos_fala, n_turnos_fala, n_sessoes, eh_condutor"
    )
    .in("encontro_id", ids)
    .order("minutos_presentes", { ascending: false });

  const porEncontro = new Map<string, ParticipacaoRow[]>();
  for (const p of (parts || []) as ParticipacaoRow[]) {
    porEncontro.set(p.encontro_id, [...(porEncontro.get(p.encontro_id) || []), p]);
  }

  return NextResponse.json({
    tolerancia,
    encontros: encontros.map((e: { id: string }) => ({
      ...e,
      participacoes: porEncontro.get(e.id) || [],
    })),
  });
}
