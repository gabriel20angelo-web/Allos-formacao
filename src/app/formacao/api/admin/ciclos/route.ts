// Os ciclos de cronograma.
//
// O ciclo é a entidade que faltava para comparar qualquer coisa. O painel sabia
// dois recortes de tempo, "esta semana" e "tudo", e a formação não roda assim:
// um cronograma abre, roda alguns meses, fecha, e outro abre no lugar.
//
// ⚠️ Esta rota funciona ANTES da migration 095 ser aplicada, e diz isso em vez
// de estourar. As migrations aqui são rodadas à mão, então existe sempre uma
// janela entre o código subir e a tabela existir, e uma tela que quebra nessa
// janela parece bug do que acabou de ser feito.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SEM_TABELA, MIGRACAO_PENDENTE, type CicloLinha } from "@/lib/meet/ciclos";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("formacao_ciclos")
    .select("id,nome,inicio,fim,status,observacoes,encerrado_em,created_at")
    .order("inicio", { ascending: false });

  if (error) {
    if (error.code === SEM_TABELA) {
      return NextResponse.json({ migracaoPendente: true, ciclos: [] });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ciclos = (data ?? []) as CicloLinha[];
  return NextResponse.json({
    migracaoPendente: false,
    ciclos,
    ativo: ciclos.find((c) => c.status === "ativo") ?? null,
  });
}

export async function POST(req: Request) {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const nome = String(body.nome ?? "").trim();
  const inicio = String(body.inicio ?? "").trim();
  if (!nome) return NextResponse.json({ error: "o ciclo precisa de um nome" }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicio)) {
    return NextResponse.json({ error: "data de início inválida" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // ⚠️ Abrir um ciclo novo ENCERRA o anterior na véspera, em vez de recusar.
  //
  // O índice único garante um ativo por vez, e sem este passo a tela devolveria
  // um erro de constraint que ninguém sabe traduzir. Encerrar na véspera é o que
  // "abrimos outro cronograma" quer dizer na prática, e deixa os dois períodos
  // colados sem buraco nem sobreposição, que é o que a junção por data exige.
  const { data: ativo } = await sb
    .from("formacao_ciclos")
    .select("id, inicio, nome")
    .eq("status", "ativo")
    .maybeSingle();

  if (ativo) {
    if (ativo.inicio >= inicio) {
      return NextResponse.json(
        {
          error: `O ciclo "${ativo.nome}" começou em ${ativo.inicio}. O novo precisa começar depois disso.`,
        },
        { status: 400 },
      );
    }
    const vespera = new Date(inicio + "T12:00:00");
    vespera.setDate(vespera.getDate() - 1);
    const { error: errFecha } = await sb
      .from("formacao_ciclos")
      .update({
        status: "encerrado",
        fim: vespera.toISOString().slice(0, 10),
        encerrado_em: new Date().toISOString(),
      })
      .eq("id", ativo.id);
    if (errFecha) return NextResponse.json({ error: errFecha.message }, { status: 500 });
  }

  const { data, error } = await sb
    .from("formacao_ciclos")
    .insert({
      nome,
      inicio,
      status: "ativo",
      observacoes: typeof body.observacoes === "string" ? body.observacoes : null,
    })
    .select("id,nome,inicio,fim,status,observacoes,encerrado_em,created_at")
    .single();

  if (error) {
    if (error.code === SEM_TABELA) {
      return NextResponse.json({ error: MIGRACAO_PENDENTE }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Os retratos semanais que caem dentro do ciclo passam a pertencer a ele.
  // Vale para os que já existem e para os que vierem: `fecharSemanaSePreciso`
  // não conhece ciclo, e amarrar por data aqui evita que ele precise conhecer.
  await sb
    .from("formacao_snapshots")
    .update({ ciclo_id: data.id })
    .gte("semana_inicio", inicio)
    .is("ciclo_id", null);

  return NextResponse.json({ ciclo: data });
}
