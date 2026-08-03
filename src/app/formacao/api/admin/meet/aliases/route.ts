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
    // Condutor e conta da casa não são aluno: pedir para conciliar toda semana
    // é convidar o erro, porque a saída óbvia (ligar a alguém) é a errada.
    .eq("eh_condutor", false)
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

/**
 * Desfaz um vínculo entre nome do Meet e pessoa.
 *
 * Existe porque um clique errado aqui é silencioso e contamina duas histórias
 * ao mesmo tempo: a pessoa passa a ter encontros que não foram dela, e o dono
 * verdadeiro do nome fica sem os dele. Desfazer devolve o nome para a fila,
 * inclusive os que foram marcados como "não é aluno".
 */
export async function DELETE(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const norm = req.nextUrl.searchParams.get("norm");
  if (!norm) {
    return NextResponse.json({ error: "norm obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  await sb.from("formacao_meet_aliases").delete().eq("display_name_norm", norm);

  const { count } = await sb
    .from("formacao_meet_participacoes")
    .update({ aluno_id: null }, { count: "exact" })
    .eq("display_name_norm", norm);

  // "Não é aluno" renomeia a chave para tirar da fila; desfazer precisa
  // devolver o nome original, senão ele nunca mais reaparece para conciliar.
  const semSufixo = norm.replace(/ \[ignorado\]$/, "");
  let restaurados = 0;
  if (semSufixo !== norm) {
    const { count: c2 } = await sb
      .from("formacao_meet_participacoes")
      .update({ display_name_norm: semSufixo }, { count: "exact" })
      .eq("display_name_norm", norm);
    restaurados = c2 ?? 0;
  }

  // As falas guardam o vínculo por conta própria, para busca por pessoa.
  await sb.from("formacao_meet_falas").update({ aluno_id: null }).eq("display_name", norm);

  return NextResponse.json({
    ok: true,
    participacoes_desvinculadas: count ?? 0,
    voltaram_para_a_fila: restaurados,
  });
}

/** Vínculos já confirmados, para poder conferir e desfazer. */
export async function PUT() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

  const { data: aliases } = await sb
    .from("formacao_meet_aliases")
    .select("display_name, display_name_norm, aluno_id, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const ids = Array.from(
    new Set((aliases || []).map((a: { aluno_id: string }) => a.aluno_id).filter(Boolean))
  );
  const { data: perfis } = ids.length
    ? await sb.from("profiles").select("id, full_name").in("id", ids)
    : { data: [] };

  const nomePorId = new Map(
    (perfis || []).map((p: { id: string; full_name: string }) => [p.id, p.full_name])
  );

  // Nomes tirados da fila como "não é aluno" também precisam poder voltar.
  const { data: ignorados } = await sb
    .from("formacao_meet_participacoes")
    .select("display_name, display_name_norm")
    .like("display_name_norm", "%[ignorado]")
    .limit(200);

  const vistos = new Set<string>();
  const listaIgnorados = ((ignorados || []) as { display_name: string; display_name_norm: string }[])
    .filter((i) => {
      if (vistos.has(i.display_name_norm)) return false;
      vistos.add(i.display_name_norm);
      return true;
    })
    .map((i) => ({
      display_name: i.display_name,
      display_name_norm: i.display_name_norm,
      aluno_nome: null as string | null,
      ignorado: true,
    }));

  return NextResponse.json({
    vinculos: [
      ...(aliases || []).map(
        (a: { display_name: string; display_name_norm: string; aluno_id: string }) => ({
          display_name: a.display_name,
          display_name_norm: a.display_name_norm,
          aluno_nome: nomePorId.get(a.aluno_id) || "pessoa removida",
          ignorado: false,
        })
      ),
      ...listaIgnorados,
    ],
  });
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
