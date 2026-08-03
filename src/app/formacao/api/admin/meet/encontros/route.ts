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

/**
 * Apaga um encontro capturado e tudo que veio com ele.
 *
 * Existe porque o Google abre um registro novo a cada vez que a sala fica
 * vazia e alguém entra de novo: testar o link três vezes produz três
 * "encontros" de um minuto com uma pessoa. São reais, mas são lixo, e lixo
 * dentro da média de quórum distorce todo indicador do grupo.
 *
 * Participações e falas somem por cascata; a linha derivada na tabela antiga
 * precisa ser apagada à mão, senão o quórum continua aparecendo nas telas
 * velhas depois de excluído aqui.
 */
export async function DELETE(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const id = req.nextUrl.searchParams.get("id");
  const restaurar = req.nextUrl.searchParams.get("restaurar") === "1";
  const apagar = req.nextUrl.searchParams.get("apagar") === "1";
  const todosDescartados = req.nextUrl.searchParams.get("apagar_descartados") === "1";

  const sb = await createServiceRoleClient();

  // ── apagar de vez os que já estão descartados ──
  // Descartar esconde e é reversível; isto não é. Existe porque testar um link
  // cinco vezes produz cinco encontros de um minuto, e a lista fica ilegível
  // para sempre por causa de lixo que ninguém vai querer de volta.
  if (todosDescartados) {
    const { data: alvos } = await sb
      .from("formacao_meet_encontros")
      .select("id, conference_record_id")
      .eq("descartado", true);

    if (!alvos?.length) {
      return NextResponse.json({ ok: true, apagados: 0, aviso: "Não havia nada descartado." });
    }

    const conferencias = alvos
      .map((e: { conference_record_id: string | null }) => e.conference_record_id)
      .filter(Boolean) as string[];

    if (conferencias.length) {
      await sb.from("formacao_meet_presencas").delete().in("conference_record_id", conferencias);
    }

    const { error } = await sb
      .from("formacao_meet_encontros")
      .delete()
      .eq("descartado", true);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      apagados: alvos.length,
      aviso: `${alvos.length} ${alvos.length === 1 ? "encontro apagado" : "encontros apagados"} de vez. Participações e falas foram junto.`,
    });
  }

  if (!id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });

  const { data: encontro } = await sb
    .from("formacao_meet_encontros")
    .select("conference_record_id, descartado")
    .eq("id", id)
    .maybeSingle();

  if (!encontro) {
    return NextResponse.json({ error: "Encontro não encontrado" }, { status: 404 });
  }

  // ── apagar um ──
  if (apagar) {
    if (encontro.conference_record_id) {
      await sb
        .from("formacao_meet_presencas")
        .delete()
        .eq("conference_record_id", encontro.conference_record_id);
    }
    const { error } = await sb.from("formacao_meet_encontros").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({
      ok: true,
      apagado: true,
      aviso: "Apagado de vez, com as participações e falas.",
    });
  }

  // `descartado_manual` é o que impede a ingestão de desfazer isto na rodada
  // seguinte: a heurística automática só reconhece encontro de uma pessoa por
  // até cinco minutos, então tudo que uma pessoa descartou voltava sozinho.
  const { error } = await sb
    .from("formacao_meet_encontros")
    .update({
      descartado: !restaurar,
      descartado_manual: true,
      descartado_motivo: restaurar ? null : "Descartado pelo administrador.",
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A ponte com as telas antigas some junto: elas não têm como saber que este
  // encontro foi descartado, e o quórum delas ficaria errado.
  if (encontro.conference_record_id && !restaurar) {
    await sb
      .from("formacao_meet_presencas")
      .delete()
      .eq("conference_record_id", encontro.conference_record_id);
  }

  return NextResponse.json({
    ok: true,
    descartado: !restaurar,
    aviso: restaurar
      ? "Restaurado. A próxima captura recalcula o quórum deste encontro."
      : "Fora de todas as estatísticas. O registro continua guardado e dá para restaurar.",
  });
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

  // Ou os normais, ou os descartados. Misturar os dois esconde justamente o que
  // se foi procurar: quem pede para ver o descartado quer ver o descartado.
  const soDescartados = req.nextUrl.searchParams.get("descartados") === "1";

  const q = sb
    .from("formacao_meet_encontros")
    .select("*")
    .eq("descartado", soDescartados)
    .order("inicio", { ascending: false })
    .limit(limite);

  const { data: encontros, error } = await q;

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
