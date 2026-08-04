// Fila de conciliação: nomes do Meet que ainda não viraram pessoa.
//
// GET devolve cada nome pendente com as melhores sugestões. POST amarra o nome
// a alguém e reprocessa o histórico daquele nome, pra que encontros antigos
// também passem a contar para a pessoa. Sem esse reprocessamento, resolver um
// nome só valeria dali para frente e a série histórica ficaria pela metade.
//
// Duas fontes de sugestão, e a segunda costuma ser a boa:
//
// 1. `profiles`, por semelhança de nome. Resolve quem tem conta e entrou no
//    Meet com o nome do cadastro.
// 2. Quem preencheu o formulário de certificado daquele mesmo encontro. É de
//    onde vem a identificação de quem NÃO tem conta, que é a maioria — e como
//    a comparação acontece dentro das trinta pessoas daquele encontro, e não
//    das centenas cadastradas, um nome pela metade já basta.
//
// A fila também passou a respeitar o alias: nome com alias está resolvido,
// mesmo quando o alias não aponta para conta nenhuma. Sem isso, quem foi
// identificado pelo certificado sem ter perfil voltaria para cá toda semana,
// pedindo um trabalho que já foi feito.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { normalizarNome, similaridade, sugerirAluno } from "@/lib/meet/nomes";
import type { CandidatoAluno } from "@/lib/meet/nomes";
import { coorteDoEncontro } from "@/lib/meet/certificados";

export const dynamic = "force-dynamic";

/** Quantos encontros no máximo entram no cálculo das coortes por rodada. */
const TETO_ENCONTROS = 40;

interface PendenteRow {
  display_name: string;
  display_name_norm: string;
  minutos_presentes: number;
  encontro_id: string;
}

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

  const { data: pendentes } = await sb
    .from("formacao_meet_participacoes")
    .select(
      "display_name, display_name_norm, minutos_presentes, encontro_id, formacao_meet_encontros!inner(descartado)"
    )
    .is("aluno_id", null)
    // Condutor e conta da casa não são aluno: pedir para conciliar toda semana
    // é convidar o erro, porque a saída óbvia (ligar a alguém) é a errada.
    .eq("eh_condutor", false)
    // Nem quem apareceu num teste de link: identificar essa pessoa não serve
    // para nada, porque o encontro dela está fora de toda estatística.
    .eq("formacao_meet_encontros.descartado", false)
    .order("created_at", { ascending: false })
    .limit(500);

  const { data: perfis } = await sb.from("profiles").select("id, full_name, email");
  const candidatos: CandidatoAluno[] = (perfis || []).map(
    (p: { id: string; full_name: string }) => ({
      id: p.id,
      full_name: p.full_name,
      nomeNorm: normalizarNome(p.full_name || ""),
    })
  );
  const perfilPorEmail = new Map<string, string>();
  for (const p of (perfis || []) as { id: string; email: string | null }[]) {
    if (p.email) perfilPorEmail.set(p.email.toLowerCase().trim(), p.id);
  }

  // Nome com alias já tem dono, com ou sem conta ligada.
  const { data: aliasRows } = await sb
    .from("formacao_meet_aliases")
    .select("display_name_norm");
  const jaResolvidos = new Set(
    (aliasRows || []).map((a: { display_name_norm: string }) => a.display_name_norm)
  );

  // Agrupa por nome: a mesma pessoa aparece em vários encontros e resolver uma
  // vez resolve todos. Os encontros vêm junto porque é neles que está a coorte
  // do certificado.
  const porNome = new Map<
    string,
    { display_name: string; ocorrencias: number; minutos: number; encontros: Set<string> }
  >();

  for (const p of (pendentes || []) as unknown as PendenteRow[]) {
    if (jaResolvidos.has(p.display_name_norm)) continue;
    if (p.display_name_norm.endsWith("[ignorado]")) continue;
    const atual = porNome.get(p.display_name_norm);
    porNome.set(p.display_name_norm, {
      display_name: p.display_name,
      ocorrencias: (atual?.ocorrencias || 0) + 1,
      minutos: (atual?.minutos || 0) + (p.minutos_presentes || 0),
      encontros: (atual?.encontros || new Set<string>()).add(p.encontro_id),
    });
  }

  // ── coortes do certificado, uma vez por encontro ──
  const encontrosEnvolvidos = Array.from(
    new Set(Array.from(porNome.values()).flatMap((v) => Array.from(v.encontros)))
  ).slice(0, TETO_ENCONTROS);

  const coortePorEncontro = new Map<
    string,
    { nome_completo: string; nome_social: string | null; email: string | null; aluno_id: string | null }[]
  >();

  if (encontrosEnvolvidos.length) {
    const { data: encontros } = await sb
      .from("formacao_meet_encontros")
      .select("id, atividade_nome, inicio")
      .in("id", encontrosEnvolvidos);

    const lista = ((encontros || []) as { id: string; atividade_nome: string | null; inicio: string }[])
      .slice()
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime());

    for (let i = 0; i < lista.length; i++) {
      const enc = lista[i];
      const proximo = lista.slice(i + 1).find((e) => e.atividade_nome === enc.atividade_nome);
      const coorte = await coorteDoEncontro(
        sb,
        enc,
        proximo?.inicio || null,
        candidatos,
        perfilPorEmail
      );
      coortePorEncontro.set(enc.id, coorte);
    }
  }

  // Quem já foi identificado não deve aparecer como sugestão para OUTRO nome:
  // cada pessoa do formulário é de uma pessoa só. A consulta é por `*` porque
  // a coluna nasce na migration 083, e nomeá-la antes disso derrubaria a fila
  // inteira em vez de apenas repetir uma sugestão já usada.
  const { data: jaUsados } = await sb.from("formacao_meet_aliases").select("*");
  const emailsUsados = new Set(
    ((jaUsados || []) as { pessoa_email?: string | null }[])
      .map((a) => a.pessoa_email?.toLowerCase().trim())
      .filter(Boolean) as string[]
  );

  const fila = Array.from(porNome.entries())
    .map(([norm, info]) => {
      // Do certificado: junta as coortes de todos os encontros em que o nome
      // apareceu e pontua cada pessoa contra ele.
      const vistos = new Map<
        string,
        { nome: string; email: string | null; aluno_id: string | null; score: number }
      >();

      for (const encId of Array.from(info.encontros)) {
        for (const c of coortePorEncontro.get(encId) || []) {
          if (c.email && emailsUsados.has(c.email.toLowerCase().trim())) continue;
          const nomes = [c.nome_completo, c.nome_social].filter(Boolean) as string[];
          const score = Math.max(...nomes.map((n) => similaridade(norm, normalizarNome(n))));
          const chave = c.email || c.nome_completo;
          const anterior = vistos.get(chave);
          if (!anterior || score > anterior.score) {
            vistos.set(chave, {
              nome: c.nome_completo,
              email: c.email,
              aluno_id: c.aluno_id,
              score,
            });
          }
        }
      }

      const doCertificado = Array.from(vistos.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);

      return {
        display_name_norm: norm,
        display_name: info.display_name,
        ocorrencias: info.ocorrencias,
        minutos_totais: info.minutos,
        sugestoes: sugerirAluno(info.display_name, candidatos).sugestoes,
        do_certificado: doCertificado,
      };
    })
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
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);

  const ids = Array.from(
    new Set((aliases || []).map((a: { aluno_id: string | null }) => a.aluno_id).filter(Boolean))
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
      pessoa_nome: null as string | null,
      tem_conta: false,
      origem: null as string | null,
      evidencia: null as string | null,
      ignorado: true,
    }));

  return NextResponse.json({
    vinculos: [
      ...(aliases || []).map(
        (a: {
          display_name: string;
          display_name_norm: string;
          aluno_id: string | null;
          pessoa_nome: string | null;
          origem: string | null;
          evidencia: string | null;
        }) => ({
          display_name: a.display_name,
          display_name_norm: a.display_name_norm,
          aluno_nome: a.aluno_id ? nomePorId.get(a.aluno_id) || "pessoa removida" : null,
          pessoa_nome: a.pessoa_nome,
          tem_conta: !!a.aluno_id,
          origem: a.origem,
          evidencia: a.evidencia,
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

  let body: {
    display_name?: string;
    aluno_id?: string;
    ignorar?: boolean;
    pessoa_nome?: string;
    pessoa_email?: string;
  };
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

  if (!body.aluno_id && !body.pessoa_email && !body.pessoa_nome) {
    return NextResponse.json(
      { error: "Informe uma conta ou uma pessoa do certificado." },
      { status: 400 }
    );
  }

  // Identificar alguém que preencheu o certificado e por acaso tem conta com o
  // mesmo e-mail deve ligar as duas coisas de uma vez: a identidade e o
  // histórico. Perguntar ao banco é mais barato do que confiar na tela.
  let alunoId = body.aluno_id || null;
  if (!alunoId && body.pessoa_email) {
    const { data: perfil } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", body.pessoa_email.trim())
      .maybeSingle();
    alunoId = (perfil as { id: string } | null)?.id || null;
  }

  const { error: errAlias } = await sb.from("formacao_meet_aliases").upsert(
    {
      display_name_norm: norm,
      display_name: body.display_name,
      aluno_id: alunoId,
      pessoa_nome: body.pessoa_nome || null,
      pessoa_email: body.pessoa_email?.toLowerCase().trim() || null,
      origem: "manual",
      evidencia: body.pessoa_email
        ? `Ligado à mão a quem preencheu o certificado como ${body.pessoa_nome || body.pessoa_email}.`
        : "Ligado à mão pelo painel.",
      confirmado_por: auth.userId,
    },
    { onConflict: "display_name_norm" }
  );
  if (errAlias) {
    return NextResponse.json({ error: errAlias.message }, { status: 500 });
  }

  if (!alunoId) {
    // Identidade sem conta: o nome sai da fila e passa a aparecer com o nome
    // verdadeiro, mas não há histórico de aluno para atualizar.
    return NextResponse.json({ ok: true, participacoes_atualizadas: 0, sem_conta: true });
  }

  const { data: afetadas, error: errUpd } = await sb
    .from("formacao_meet_participacoes")
    .update({ aluno_id: alunoId })
    .eq("display_name_norm", norm)
    .is("aluno_id", null)
    .select("encontro_id");

  if (errUpd) {
    return NextResponse.json({ error: errUpd.message }, { status: 500 });
  }

  await sb
    .from("formacao_meet_falas")
    .update({ aluno_id: alunoId })
    .eq("display_name", body.display_name)
    .is("aluno_id", null);

  // O contador de identificados do encontro é gravado na ingestão, e a
  // ingestão não volta em encontro concluído. Sem refazer aqui, o cabeçalho
  // continuaria mostrando o número de antes do vínculo.
  const encontros = Array.from(
    new Set(((afetadas || []) as { encontro_id: string }[]).map((a) => a.encontro_id))
  );
  for (const id of encontros) {
    const { count } = await sb
      .from("formacao_meet_participacoes")
      .select("id", { count: "exact", head: true })
      .eq("encontro_id", id)
      .not("aluno_id", "is", null);
    await sb.from("formacao_meet_encontros").update({ identificados: count ?? 0 }).eq("id", id);
  }

  return NextResponse.json({ ok: true, participacoes_atualizadas: afetadas?.length ?? 0 });
}
