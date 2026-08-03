// Fila de conciliação: nomes do Meet que ainda não viraram pessoa.
//
// GET devolve cada nome pendente com as melhores sugestões. POST amarra o nome
// a um aluno e reprocessa o histórico daquele nome, pra que encontros antigos
// também passem a contar para a pessoa. Sem esse reprocessamento, resolver um
// nome só valeria dali para frente e a série histórica ficaria pela metade.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizarNome, sugerirAluno } from "@/lib/meet/nomes";
import type { CandidatoAluno } from "@/lib/meet/nomes";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

  const { data: pendentes } = await sb
    .from("formacao_meet_participacoes")
    .select("display_name, display_name_norm, minutos_presentes, encontro_id")
    .is("aluno_id", null)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: perfis } = await sb.from("profiles").select("id, full_name");
  const candidatos: CandidatoAluno[] = (perfis || []).map(
    (p: { id: string; full_name: string }) => ({
      id: p.id,
      full_name: p.full_name,
      nomeNorm: normalizarNome(p.full_name || ""),
    })
  );

  // Agrupa por nome: a mesma pessoa aparece em vários encontros e resolver uma
  // vez resolve todos.
  const porNome = new Map<
    string,
    { display_name: string; ocorrencias: number; minutos: number }
  >();

  for (const p of (pendentes || []) as {
    display_name: string;
    display_name_norm: string;
    minutos_presentes: number;
  }[]) {
    const atual = porNome.get(p.display_name_norm);
    porNome.set(p.display_name_norm, {
      display_name: p.display_name,
      ocorrencias: (atual?.ocorrencias || 0) + 1,
      minutos: (atual?.minutos || 0) + (p.minutos_presentes || 0),
    });
  }

  const fila = Array.from(porNome.entries())
    .map(([norm, info]) => ({
      display_name_norm: norm,
      display_name: info.display_name,
      ocorrencias: info.ocorrencias,
      minutos_totais: info.minutos,
      sugestoes: sugerirAluno(info.display_name, candidatos).sugestoes,
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias);

  return NextResponse.json({ fila, total: fila.length });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { display_name?: string; aluno_id?: string; ignorar?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (!body.display_name) {
    return NextResponse.json({ error: "display_name obrigatório" }, { status: 400 });
  }
  const norm = normalizarNome(body.display_name);
  const sb = await createServiceRoleClient();

  if (body.ignorar) {
    // Visitante, conta de sala, alguém que não é aluno: sai da fila sem virar
    // ninguém. Marcar com o próprio nome evita reaparecer toda semana.
    const { error } = await sb
      .from("formacao_meet_participacoes")
      .update({ display_name_norm: `${norm} [ignorado]` })
      .eq("display_name_norm", norm);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, ignorado: true });
  }

  if (!body.aluno_id) {
    return NextResponse.json({ error: "aluno_id obrigatório" }, { status: 400 });
  }

  const { error: errAlias } = await sb.from("formacao_meet_aliases").upsert(
    {
      display_name_norm: norm,
      display_name: body.display_name,
      aluno_id: body.aluno_id,
      confirmado_por: auth.userId,
    },
    { onConflict: "display_name_norm" }
  );
  if (errAlias) {
    return NextResponse.json({ error: errAlias.message }, { status: 500 });
  }

  const { count, error: errUpd } = await sb
    .from("formacao_meet_participacoes")
    .update({ aluno_id: body.aluno_id }, { count: "exact" })
    .eq("display_name_norm", norm)
    .is("aluno_id", null);

  if (errUpd) {
    return NextResponse.json({ error: errUpd.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, participacoes_atualizadas: count ?? 0 });
}
