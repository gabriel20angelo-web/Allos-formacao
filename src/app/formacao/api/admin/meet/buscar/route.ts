// Busca por palavra dentro das transcrições.
//
// É o motivo de guardar o texto: achar em que encontro alguém falou de um tema,
// sem abrir um documento por vez. Usa o índice de texto em português, então
// "supervisão" também encontra "supervisões".
//
// Devolve o trecho e o contexto (quem falou, em que encontro, em que minuto),
// nunca a transcrição inteira: a tela é de busca, não de leitura corrida.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface FalaRow {
  id: string;
  encontro_id: string;
  display_name: string;
  aluno_id: string | null;
  texto: string;
  inicio: string | null;
  ordem: number;
}

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const termo = (req.nextUrl.searchParams.get("q") || "").trim();
  if (termo.length < 3) {
    return NextResponse.json(
      { error: "Escreva ao menos três letras para buscar." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  // textSearch usa o índice GIN; o fallback em ILIKE cobre busca por pedaço de
  // palavra, que o índice de texto não faz.
  const { data: porIndice } = await sb
    .from("formacao_meet_falas")
    .select("id, encontro_id, display_name, aluno_id, texto, inicio, ordem")
    .textSearch("texto", termo, { type: "websearch", config: "portuguese" })
    .limit(60);

  let falas = (porIndice || []) as FalaRow[];

  if (!falas.length) {
    const { data: porTexto } = await sb
      .from("formacao_meet_falas")
      .select("id, encontro_id, display_name, aluno_id, texto, inicio, ordem")
      .ilike("texto", `%${termo}%`)
      .limit(60);
    falas = (porTexto || []) as FalaRow[];
  }

  if (!falas.length) {
    return NextResponse.json({ termo, resultados: [] });
  }

  const encontroIds = Array.from(new Set(falas.map((f) => f.encontro_id)));
  const { data: encontros } = await sb
    .from("formacao_meet_encontros")
    .select("id, atividade_nome, condutor_nome, data_reuniao, inicio, transcricao_uri")
    .in("id", encontroIds);

  const porEncontro = new Map(
    (encontros || []).map((e: { id: string }) => [e.id, e])
  );

  return NextResponse.json({
    termo,
    resultados: falas.map((f) => ({
      ...f,
      encontro: porEncontro.get(f.encontro_id) || null,
    })),
  });
}
