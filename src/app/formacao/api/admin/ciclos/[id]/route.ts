// O dossiê de um ciclo, e a comparação com o anterior.
//
// ⭐ É aqui que "este ciclo foi melhor que o anterior, e onde" deixa de ser
// trabalho de memória. A comparação é sempre com o ciclo imediatamente anterior
// por data, porque é essa a pergunta que alguém faz de verdade: o que mudou
// quando mexemos no cronograma.
//
// ⚠️ Os encontros do ciclo saem por DATA, e não por uma coluna em
// `formacao_meet_encontros`. A data já existe, é NOT NULL, funciona
// retroativamente e sobrevive a `slot_id` virar NULL quando alguém apaga um
// slot. O preço é que ciclos não podem se sobrepor, o que o índice único de
// "um ativo por vez" já sustenta.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  lerSala,
  resumir,
  porAtividade,
  porCondutor,
  interacaoDoGrupo,
  chaveTexto,
} from "@/lib/meet/quorum";
import { REGUA, atende, porQueNaoDaParaLer } from "@/lib/meet/regua";
import { SEM_TABELA, type CicloLinha } from "@/lib/meet/ciclos";

export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createServiceRoleClient>>;

/** O retrato de um período. Vale para o ciclo pedido e para o anterior. */
async function medirPeriodo(sb: Sb, inicio: string, fim: string | null) {
  const sala = await lerSala(sb, { desde: inicio, ate: fim });
  const resumo = resumir(sala.encontros);
  const grupos = Array.from(porAtividade(sala.encontros).entries())
    .map(([chave, g]) => ({
      chave,
      nome: g.nome,
      ...resumir(g.encontros),
      interacao: interacaoDoGrupo(sala.pessoaPorGrupo, chave),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const condutores = Array.from(porCondutor(sala.encontros).entries())
    .map(([chave, c]) => ({ chave, nome: c.nome, ...resumir(c.encontros) }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return {
    resumo,
    grupos,
    condutores,
    pessoas: sala.pessoas.length,
    chavesDePessoa: new Set(sala.pessoas.map((p) => p.chave)),
  };
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const { data: ciclo, error } = await sb
    .from("formacao_ciclos")
    .select("id,nome,inicio,fim,status,observacoes,grade_final,encerrado_em,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === SEM_TABELA) {
      return NextResponse.json({ migracaoPendente: true }, { status: 200 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!ciclo) return NextResponse.json({ error: "ciclo não encontrado" }, { status: 404 });

  // O anterior é o de início mais recente ANTES deste. Nunca o "id anterior":
  // ciclos podem ser criados fora de ordem, e a data é o que ordena de verdade.
  const { data: anteriores } = await sb
    .from("formacao_ciclos")
    .select("id,nome,inicio,fim,status,observacoes,encerrado_em,created_at")
    .lt("inicio", ciclo.inicio)
    .order("inicio", { ascending: false })
    .limit(1);
  const anterior = (anteriores?.[0] ?? null) as CicloLinha | null;

  const atual = await medirPeriodo(sb, ciclo.inicio, ciclo.fim);
  const passado = anterior ? await medirPeriodo(sb, anterior.inicio, anterior.fim) : null;

  // Os retratos semanais do ciclo. É deles que sai "o que teve no cronograma",
  // sem congelar nada de novo.
  const { data: snapshots } = await sb
    .from("formacao_snapshots")
    .select("id,semana_inicio,semana_fim,observacoes,origem,created_at")
    .eq("ciclo_id", id)
    .order("semana_inicio", { ascending: true });

  const semanas = snapshots ?? [];
  const { data: linhasGrade } = semanas.length
    ? await sb
        .from("formacao_snapshot_slots")
        .select("snapshot_id,dia_semana,horario_hora,atividade_nome,status,condutores")
        .in(
          "snapshot_id",
          semanas.map((s) => s.id),
        )
    : { data: [] };

  // A grade do ciclo é a união do que apareceu em qualquer semana dele: um grupo
  // que entrou no meio do ciclo fez parte dele, e um que saiu também.
  const grade = new Map<
    string,
    { atividade: string | null; diaSemana: number; hora: string; condutores: string[]; semanas: number; conduzidas: number }
  >();
  for (const l of (linhasGrade ?? []) as {
    dia_semana: number;
    horario_hora: string;
    atividade_nome: string | null;
    status: string;
    condutores: { nome: string }[] | null;
  }[]) {
    const k = `${chaveTexto(l.atividade_nome)}|${l.dia_semana}|${l.horario_hora}`;
    const atual0 = grade.get(k);
    const nomes = (l.condutores ?? []).map((c) => c.nome).filter(Boolean);
    grade.set(k, {
      atividade: l.atividade_nome,
      diaSemana: l.dia_semana,
      hora: l.horario_hora,
      condutores: Array.from(new Set([...(atual0?.condutores ?? []), ...nomes])),
      semanas: (atual0?.semanas ?? 0) + 1,
      conduzidas: (atual0?.conduzidas ?? 0) + (l.status === "conduzido" ? 1 : 0),
    });
  }

  // ⭐ Quantas pessoas atravessaram os dois ciclos. É o número que diz se o
  // cronograma novo levou junto a comunidade do anterior ou recomeçou do zero.
  const atravessaram = passado
    ? Array.from(atual.chavesDePessoa).filter((k) => passado.chavesDePessoa.has(k)).length
    : null;

  const semObj = <T extends { chavesDePessoa: Set<string> }>(x: T) => {
    const { chavesDePessoa: _ignorado, ...resto } = x;
    void _ignorado;
    return resto;
  };

  return NextResponse.json({
    migracaoPendente: false,
    ciclo,
    anterior,
    atual: semObj(atual),
    passado: passado ? semObj(passado) : null,
    atravessaram,
    semanas,
    grade: Array.from(grade.values()).sort(
      (a, b) => a.diaSemana - b.diaSemana || a.hora.localeCompare(b.hora),
    ),
    // ⛔ A mesma régua das outras telas. Comparar dois ciclos com um punhado de
    // encontros cada é o mesmo erro do ranking de grupo, numa escala maior.
    regua: {
      podeComparar:
        Boolean(passado) &&
        atende(atual.resumo.encontrosComTranscricao, REGUA.comparacaoEntreGrupos) &&
        atende(passado?.resumo.encontrosComTranscricao ?? 0, REGUA.comparacaoEntreGrupos),
      faltaNoAtual: porQueNaoDaParaLer(
        atual.resumo.encontrosComTranscricao,
        REGUA.comparacaoEntreGrupos,
      ),
      faltaNoAnterior: passado
        ? porQueNaoDaParaLer(
            passado.resumo.encontrosComTranscricao,
            REGUA.comparacaoEntreGrupos,
          )
        : null,
      porque: REGUA.comparacaoEntreGrupos.porque,
    },
  });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const campos: Record<string, unknown> = {};
  if (typeof body.nome === "string" && body.nome.trim()) campos.nome = body.nome.trim();
  // Anotação aceita string vazia: apagar o que foi escrito é uma edição legítima.
  if (typeof body.observacoes === "string") {
    campos.observacoes = body.observacoes.trim() || null;
  }
  if (typeof body.inicio === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.inicio)) {
    campos.inicio = body.inicio;
  }
  if (body.fim === null) campos.fim = null;
  else if (typeof body.fim === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.fim)) {
    campos.fim = body.fim;
  }
  if (!Object.keys(campos).length) {
    return NextResponse.json({ error: "nada para mudar" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("formacao_ciclos")
    .update(campos)
    .eq("id", id)
    .select("id,nome,inicio,fim,status,observacoes,encerrado_em,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ciclo: data });
}
