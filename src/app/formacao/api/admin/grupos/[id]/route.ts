// O dossiê de um grupo, numa chamada.
//
// Até aqui, saber tudo sobre um grupo exigia abrir cinco telas e saber qual
// guardava o quê: o cadastro em Atividades, o horário e os condutores no
// Calendário, a sala e os encontros no Meet, o quórum em Grupos, e os relatos
// em Envios. Esta rota junta as sete peças.
//
// ⚠️ A identidade do grupo é `certificado_atividades.id`, e não o slot nem a
// sala. Medido em 06/08/2026: slot e sala têm chave estrangeira de verdade para
// encontros, mas **não alcançam nenhum dos 516 feedbacks**, porque
// `certificado_submissions` não tem coluna de slot nem de sala. E só enxergam
// os 6 grupos que estão na grade desta semana, deixando 185 feedbacks de 13
// grupos fora de qualquer página. O catálogo alcança as sete peças e é o único
// identificador opaco: renomear a atividade e mudar o grupo de horário não
// matam o link.
//
// A ligação slot para atividade aceita dois caminhos de propósito: `atividade_id`
// quando a migration 093 já estiver aplicada, e o nome normalizado enquanto não
// estiver. O segundo é o que o resto do sistema já usa.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { lerTudo } from "@/lib/supabase/paginar";
import { chaveTexto, resumir, type EncontroMedido } from "@/lib/meet/quorum";
import { lerSala } from "@/lib/meet/quorum";

export const dynamic = "force-dynamic";

/**
 * O cadastro do grupo, editável de dentro da página dele.
 *
 * Os quatro campos não são cosméticos. `carga_horaria` alimenta o cálculo de
 * horas de certificado em cinco lugares (`api/ranking`, `api/my-sync-hours`,
 * `lib/plataforma/ficha-aluno`, `PessoaModal`, `api/admin/email-suspeita`), e
 * `ativo` controla o que aparece no formulário público de certificação e na
 * grade pública. Mudar aqui muda o que o participante vê.
 *
 * Vai por rota de servidor com `exigirAdmin`, e não pelo cliente como a tela de
 * Atividades faz, porque a policy de `certificado_atividades` é a antiga, que
 * compara `role = 'admin'` direto. Desde a 078 os cargos são acumuláveis, então
 * quem administra e também conduz um grupo seria barrado em silêncio.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

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

  const mudanca: Record<string, unknown> = {};
  if (typeof body.nome === "string") {
    const nome = body.nome.trim();
    if (!nome) return NextResponse.json({ error: "O nome não pode ficar vazio." }, { status: 400 });
    mudanca.nome = nome;
  }
  if (typeof body.carga_horaria === "number" && body.carga_horaria > 0) {
    mudanca.carga_horaria = Math.round(body.carga_horaria);
  }
  if (typeof body.descricao === "string") {
    mudanca.descricao = body.descricao.trim() || null;
  }
  if (typeof body.ativo === "boolean") mudanca.ativo = body.ativo;
  if (typeof body.arquivado === "boolean") {
    mudanca.arquivado = body.arquivado;
    // Arquivar tira do formulário junto: um grupo que sumiu da lista do painel
    // e continua aceitando feedback é a receita de dado órfão.
    if (body.arquivado === true) mudanca.ativo = false;
  }

  if (!Object.keys(mudanca).length) {
    return NextResponse.json({ error: "nada para mudar" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("certificado_atividades")
    .update(mudanca)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    // 23505 é o índice único de nome normalizado que a migration 093 criou.
    // A mensagem crua do Postgres não diz nada a quem está na tela.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe um grupo com esse nome. Dois nomes iguais fazem o histórico dos dois se misturar." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ atividade: data });
}

interface SlotRow {
  id: string;
  dia_semana: number;
  horario_id: string;
  ativo: boolean | null;
  status: string | null;
  atividade_nome: string | null;
  atividade_id?: string | null;
  meet_link: string | null;
  status_automatico_em: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  const { data: atividade, error: errAtv } = await sb
    .from("certificado_atividades")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (errAtv) {
    return NextResponse.json({ error: errAtv.message }, { status: 500 });
  }
  if (!atividade) {
    return NextResponse.json({ error: "Grupo não encontrado." }, { status: 404 });
  }

  const chave = chaveTexto(atividade.nome);

  const [slotsTodos, horarios, alocacoes, condutores, spaces, sala, submissions] =
    await Promise.all([
      lerTudo<SlotRow>(
        sb,
        // `atividade_id` é a chave forte da migration 093. Sem ela no select,
        // a coluna chega indefinida, o casamento cai no nome e a tela avisa que
        // a migration não rodou mesmo depois de ela ter rodado.
        "id,dia_semana,horario_id,ativo,status,atividade_nome,atividade_id,meet_link,status_automatico_em",
        "id",
      ),
      lerTudo<{ id: string; hora: string; ordem: number; ativo: boolean }>(
        sb,
        "formacao_horarios",
        "id,hora,ordem,ativo",
        "id",
      ),
      lerTudo<{ id: string; slot_id: string; condutor_id: string }>(
        sb,
        "formacao_alocacoes",
        "id,slot_id,condutor_id",
        "id",
      ),
      lerTudo<{ id: string; nome: string; telefone: string | null }>(
        sb,
        "certificado_condutores",
        "id,nome,telefone",
        "id",
      ),
      lerTudo<Record<string, unknown>>(sb, "formacao_meet_spaces", "*", "id"),
      lerSala(sb),
      lerTudo<{
        id: string;
        created_at: string;
        nome_completo: string | null;
        email: string | null;
        atividade_nome: string | null;
        nota_grupo: number | null;
        nota_condutor: number | null;
        relato: string | null;
        condutores: string[] | null;
      }>(
        sb,
        "certificado_submissions",
        "id,created_at,nome_completo,email,atividade_nome,nota_grupo,nota_condutor,relato,condutores",
        "id",
      ),
    ]);

  // Dois caminhos para achar o slot deste grupo. O primeiro só existe depois da
  // migration 093; o segundo é o que o resto do sistema usa hoje.
  const meusSlots = slotsTodos.filter(
    (s) =>
      (s.atividade_id && s.atividade_id === id) ||
      (!s.atividade_id && chaveTexto(s.atividade_nome) === chave),
  );
  const slotIds = new Set(meusSlots.map((s) => s.id));

  const horarioPorId = new Map(horarios.map((h) => [h.id, h]));
  const condutorPorId = new Map(condutores.map((c) => [c.id, c]));

  const grade = meusSlots.map((s) => ({
    id: s.id,
    diaSemana: s.dia_semana,
    hora: horarioPorId.get(s.horario_id)?.hora ?? null,
    ativo: s.ativo !== false,
    status: s.status,
    statusAutomatico: Boolean(s.status_automatico_em),
    meetLink: s.meet_link,
    condutores: alocacoes
      .filter((a) => a.slot_id === s.id)
      .map((a) => condutorPorId.get(a.condutor_id))
      .filter(Boolean)
      .map((c) => ({ id: c!.id, nome: c!.nome, telefone: c!.telefone })),
    sala: spaces.find((sp) => sp.slot_id === s.id) ?? null,
  }));

  // Os encontros deste grupo. A sala mede por atividade normalizada, que é a
  // chave que alcança tanto o encontro quanto o formulário.
  const encontros: EncontroMedido[] = sala.encontros
    .filter((e) => e.atividadeChave === chave || (e.slotId && slotIds.has(e.slotId)))
    .sort((a, b) => b.data.localeCompare(a.data));

  const feedbacks = submissions
    .filter((s) => chaveTexto(s.atividade_nome) === chave)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // As pessoas deste grupo, recortadas da sala inteira.
  const idsDosEncontros = new Set(encontros.map((e) => e.id));
  const pessoas = new Map<
    string,
    { chave: string; nome: string; alunoId: string | null; encontros: number; minutos: number; caladaEm: number; comTranscricao: number; ultima: string }
  >();
  sala.pessoasPorEncontro.forEach((set, encontroId) => {
    if (!idsDosEncontros.has(encontroId)) return;
    const enc = encontros.find((e) => e.id === encontroId);
    set.forEach((k) => {
      const base = sala.pessoas.find((p) => p.chave === k);
      if (!base) return;
      const atual = pessoas.get(k);
      pessoas.set(k, {
        chave: k,
        nome: base.nome,
        alunoId: base.alunoId,
        encontros: (atual?.encontros ?? 0) + 1,
        minutos: atual?.minutos ?? base.minutos,
        caladaEm: atual?.caladaEm ?? base.caladaEm,
        comTranscricao: atual?.comTranscricao ?? base.comTranscricao,
        ultima: atual && atual.ultima > (enc?.data ?? "") ? atual.ultima : (enc?.data ?? ""),
      });
    });
  });

  // A nota do condutor só conta quando havia condutor a avaliar: evento sem
  // condutor grava 5 fixo no formulário, e sem este filtro a média cai por causa
  // de uma pergunta que nunca foi feita. A do grupo não tem esse problema.
  const comCondutor = feedbacks.filter((f) => (f.condutores ?? []).filter(Boolean).length > 0);
  const notasGrupo = feedbacks.map((f) => f.nota_grupo).filter((n): n is number => n != null);
  const notasCondutor = comCondutor.map((f) => f.nota_condutor).filter((n): n is number => n != null);
  const media = (ns: number[]) =>
    ns.length ? Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10 : null;

  return NextResponse.json({
    atividade,
    // `true` quando a migration 093 já está aplicada e este slot foi ligado por
    // id. Enquanto for `false`, renomear a atividade parte o histórico.
    chaveForte: meusSlots.some((s) => Boolean(s.atividade_id)),
    grade,
    medido: resumir(encontros),
    encontros,
    pessoas: Array.from(pessoas.values()).sort((a, b) => b.encontros - a.encontros),
    feedbacks,
    notas: {
      grupo: media(notasGrupo),
      grupoN: notasGrupo.length,
      condutor: media(notasCondutor),
      condutorN: notasCondutor.length,
      semCondutor: feedbacks.length - comCondutor.length,
      relatos: feedbacks.filter((f) => (f.relato ?? "").trim().length > 0).length,
    },
  });
}
