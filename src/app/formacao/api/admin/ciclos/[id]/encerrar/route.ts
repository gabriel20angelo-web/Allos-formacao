// Encerrar um ciclo: fixa o fim e congela o retrato final da grade.
//
// ⭐ `grade_final` existe mesmo sendo derivável dos snapshots semanais, e o
// motivo é durabilidade: `formacao_snapshot_slots.slot_id` não tem chave
// estrangeira, e apagar um horário derruba os slots dele em cascata. Um ciclo
// encerrado precisa sobreviver a uma faxina na grade feita seis meses depois,
// quando ninguém mais lembrar que aquele grupo existiu.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { lerSala, resumir, porAtividade, chaveTexto } from "@/lib/meet/quorum";
import { SEM_TABELA, MIGRACAO_PENDENTE } from "@/lib/meet/ciclos";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}) as Record<string, unknown>);
  const fim =
    typeof body.fim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fim)
      ? body.fim
      : new Date().toISOString().slice(0, 10);

  const sb = await createServiceRoleClient();
  const { data: ciclo, error: errLer } = await sb
    .from("formacao_ciclos")
    .select("id,nome,inicio,fim,status")
    .eq("id", id)
    .maybeSingle();

  if (errLer) {
    if (errLer.code === SEM_TABELA) {
      return NextResponse.json({ error: MIGRACAO_PENDENTE }, { status: 409 });
    }
    return NextResponse.json({ error: errLer.message }, { status: 500 });
  }
  if (!ciclo) return NextResponse.json({ error: "ciclo não encontrado" }, { status: 404 });
  if (ciclo.status === "encerrado") {
    return NextResponse.json({ error: "este ciclo já foi encerrado" }, { status: 400 });
  }
  if (fim < ciclo.inicio) {
    return NextResponse.json(
      { error: `O ciclo começou em ${ciclo.inicio} e não pode terminar antes disso.` },
      { status: 400 },
    );
  }

  // O retrato do que este ciclo foi, medido no momento do encerramento.
  const sala = await lerSala(sb, { desde: ciclo.inicio, ate: fim });
  const grupos = Array.from(porAtividade(sala.encontros).entries()).map(([chave, g]) => {
    const r = resumir(g.encontros);
    const condutores = new Set<string>();
    g.encontros.forEach((e) => e.condutores.forEach((n) => condutores.add(n)));
    return {
      chave,
      nome: g.nome,
      encontros: r.encontros,
      quorumMedio: r.quorumMedio,
      interacaoMin: r.interacaoMin,
      interacaoPorPessoaMin: r.interacaoPorPessoaMin,
      permanenciaMedianaPct: r.permanenciaMedianaPct,
      vozesAtivasPct: r.vozesAtivasPct,
      condutores: Array.from(condutores),
      primeiro: r.primeiro,
      ultimo: r.ultimo,
    };
  });

  // A grade como ela estava no último dia, direto dos slots: é o retrato que
  // precisa sobreviver a alguém apagar um horário depois.
  const { data: slots } = await sb
    .from("formacao_slots")
    .select("id,dia_semana,horario_id,atividade_nome,status,ativo")
    .eq("ativo", true);
  const { data: horarios } = await sb.from("formacao_horarios").select("id,hora");
  const horaPorId = new Map((horarios ?? []).map((h) => [h.id, h.hora]));
  const { data: alocacoes } = await sb
    .from("formacao_alocacoes")
    .select("slot_id,certificado_condutores(nome)");
  const condutorPorSlot = new Map<string, string[]>();
  for (const a of (alocacoes ?? []) as unknown as {
    slot_id: string;
    certificado_condutores: { nome: string } | { nome: string }[] | null;
  }[]) {
    const bruto = a.certificado_condutores;
    const nome = Array.isArray(bruto) ? bruto[0]?.nome : bruto?.nome;
    if (!nome) continue;
    condutorPorSlot.set(a.slot_id, [...(condutorPorSlot.get(a.slot_id) ?? []), nome]);
  }

  const gradeFinal = {
    fechadoEm: new Date().toISOString(),
    periodo: { inicio: ciclo.inicio, fim },
    resumo: resumir(sala.encontros),
    pessoas: sala.pessoas.length,
    grupos,
    grade: (slots ?? []).map((s) => ({
      diaSemana: s.dia_semana,
      hora: horaPorId.get(s.horario_id) ?? "",
      atividade: s.atividade_nome,
      atividadeChave: chaveTexto(s.atividade_nome),
      status: s.status,
      condutores: condutorPorSlot.get(s.id) ?? [],
    })),
  };

  const { data, error } = await sb
    .from("formacao_ciclos")
    .update({
      status: "encerrado",
      fim,
      encerrado_em: new Date().toISOString(),
      grade_final: gradeFinal,
    })
    .eq("id", id)
    .select("id,nome,inicio,fim,status,observacoes,encerrado_em,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ciclo: data, congelou: gradeFinal.grupos.length });
}
