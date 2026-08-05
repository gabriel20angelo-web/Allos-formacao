// Identidade que viaja pela conta Google, e não pelo nome de tela.
//
// O alias nasceu indexado por nome exibido, e nome exibido é a coisa menos
// estável do Meet: a mesma pessoa entra como "Andréa", na semana seguinte como
// "Dreh", e do celular como "iPhone da Dreh". Cada variação chega à fila como se
// fosse gente nova, e alguém identifica de novo o que já tinha sido
// identificado. Do outro lado, quem foi reconhecido pelo formulário do
// certificado só continua reconhecido enquanto não trocar o nome na tela.
//
// A API entrega, junto do nome, o identificador da conta Google de quem entrou
// logado. Ele já era gravado em cada participação desde o começo e nunca tinha
// servido para casar ninguém. Numa medição de 05/08/2026, 42 de 43
// participações pendentes traziam esse identificador: é a chave estável que
// faltava.
//
// São dois movimentos, nesta ordem, e a ordem importa:
//
// 1. SEMEAR: todo alias que já identifica alguém aprende qual é a conta Google
//    daquela pessoa, olhando as participações que ele resolve.
// 2. PROPAGAR: todo nome de tela ainda sem dono, cuja conta Google já é
//    conhecida por um alias, herda aquela identidade.
//
// A regra que segura a precisão é a mesma dos outros casamentos automáticos:
// na dúvida, não casa. Se a mesma conta Google aparece em dois aliases que
// apontam para pessoas diferentes, nada é propagado, porque um dos dois está
// errado e adivinhar qual contaminaria as duas histórias.

import { ehContaDaCasa } from "./nomes";
import { recontarIdentificados } from "./certificados";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ResultadoIdentidadeGoogle {
  /** Aliases que aprenderam qual é a conta Google da pessoa. */
  semeados: number;
  /** Nomes de tela novos resolvidos porque a conta já era conhecida. */
  propagados: number;
  /** Participações que ganharam dono nessa propagação. */
  participacoes_ligadas: number;
  /** Contas Google vistas em dois aliases discordantes, deixadas de lado. */
  ambiguos: number;
}

interface AliasRow {
  display_name_norm: string;
  display_name: string;
  aluno_id: string | null;
  google_user_id: string | null;
  pessoa_nome: string | null;
  pessoa_email: string | null;
  origem: string;
}

interface ParticipacaoRow {
  display_name: string;
  display_name_norm: string;
  aluno_id: string | null;
  google_user_id: string | null;
  encontro_id: string;
}

export async function identificarPorContaGoogle(
  sb: Sb
): Promise<ResultadoIdentidadeGoogle> {
  const res: ResultadoIdentidadeGoogle = {
    semeados: 0,
    propagados: 0,
    participacoes_ligadas: 0,
    ambiguos: 0,
  };

  const { data: aliasesRaw } = await sb
    .from("formacao_meet_aliases")
    .select(
      "display_name_norm, display_name, aluno_id, google_user_id, pessoa_nome, pessoa_email, origem"
    )
    .limit(1000);
  const aliases = (aliasesRaw || []) as AliasRow[];
  if (!aliases.length) return res;

  // Encontro descartado não vale como evidência de nada: é teste de link, e
  // quem apareceu ali não estava num encontro de verdade.
  const { data: descartadosRaw } = await sb
    .from("formacao_meet_encontros")
    .select("id")
    .eq("descartado", true)
    .limit(1000);
  const descartados = new Set(
    ((descartadosRaw || []) as { id: string }[]).map((e) => e.id)
  );

  const { data: partRaw } = await sb
    .from("formacao_meet_participacoes")
    .select("display_name, display_name_norm, aluno_id, google_user_id, encontro_id")
    .eq("eh_condutor", false)
    .not("google_user_id", "is", null)
    .limit(5000);
  const participacoes = ((partRaw || []) as ParticipacaoRow[]).filter(
    (p) => !descartados.has(p.encontro_id)
  );
  if (!participacoes.length) return res;

  // ── 1. Semear ──
  // Qual conta Google corresponde a cada nome de tela já resolvido. Só vale
  // quando o nome foi usado por uma conta só: nome genérico como "Psi" pode ter
  // sido digitado por duas pessoas diferentes, e nesse caso o alias não pode
  // reivindicar nenhuma das duas contas.
  const contasPorNome = new Map<string, Set<string>>();
  for (const p of participacoes) {
    if (!p.google_user_id) continue;
    const atual = contasPorNome.get(p.display_name_norm) || new Set<string>();
    atual.add(p.google_user_id);
    contasPorNome.set(p.display_name_norm, atual);
  }

  for (const a of aliases) {
    if (a.google_user_id) continue;
    const contas = contasPorNome.get(a.display_name_norm);
    if (!contas || contas.size !== 1) continue;

    const gid = Array.from(contas)[0];
    const { error } = await sb
      .from("formacao_meet_aliases")
      .update({ google_user_id: gid })
      .eq("display_name_norm", a.display_name_norm);

    if (!error) {
      a.google_user_id = gid;
      res.semeados++;
    }
  }

  // ── 2. Propagar ──
  // Uma conta Google, uma identidade. Duas identidades para a mesma conta é
  // engano humano em algum dos dois aliases, e propagar qualquer uma delas
  // espalharia o engano por todo o histórico da pessoa.
  const identidadePorConta = new Map<string, AliasRow>();
  const contasAmbiguas = new Set<string>();

  for (const a of aliases) {
    if (!a.google_user_id) continue;
    const anterior = identidadePorConta.get(a.google_user_id);
    if (!anterior) {
      identidadePorConta.set(a.google_user_id, a);
      continue;
    }
    const mesmaPessoa =
      (anterior.aluno_id && anterior.aluno_id === a.aluno_id) ||
      (!anterior.aluno_id &&
        !a.aluno_id &&
        (anterior.pessoa_email || "").toLowerCase() ===
          (a.pessoa_email || "").toLowerCase());
    if (!mesmaPessoa) contasAmbiguas.add(a.google_user_id);
  }

  for (const gid of Array.from(contasAmbiguas)) {
    identidadePorConta.delete(gid);
    res.ambiguos++;
  }

  const jaTemAlias = new Set(aliases.map((a) => a.display_name_norm));
  const encontrosTocados = new Set<string>();

  // Um nome de tela, não uma participação: resolver "Dreh dessa" resolve todas
  // as vezes em que ela apareceu assim.
  const pendentesPorNome = new Map<string, ParticipacaoRow>();
  for (const p of participacoes) {
    if (jaTemAlias.has(p.display_name_norm)) continue;
    if (!p.google_user_id) continue;
    if (ehContaDaCasa(p.display_name)) continue;
    if (p.display_name_norm.endsWith("[ignorado]")) continue;
    if (!pendentesPorNome.has(p.display_name_norm)) {
      pendentesPorNome.set(p.display_name_norm, p);
    }
  }

  for (const [norm, p] of Array.from(pendentesPorNome.entries())) {
    const dona = identidadePorConta.get(p.google_user_id!);
    if (!dona) continue;

    const { error } = await sb.from("formacao_meet_aliases").upsert(
      {
        display_name_norm: norm,
        display_name: p.display_name,
        aluno_id: dona.aluno_id,
        google_user_id: p.google_user_id,
        pessoa_nome: dona.pessoa_nome,
        pessoa_email: dona.pessoa_email,
        origem: "conta_google",
        evidencia: `Mesma conta Google de "${dona.display_name}", que já estava identificada.`,
      },
      { onConflict: "display_name_norm" }
    );
    if (error) continue;

    res.propagados++;

    // Sem conta ligada não há o que atualizar nas participações: o alias
    // identifica a pessoa, mas não existe aluno_id para escrever. É o caso da
    // maioria, que participa sem ter cadastro.
    if (!dona.aluno_id) continue;

    const { data: afetadas } = await sb
      .from("formacao_meet_participacoes")
      .update({ aluno_id: dona.aluno_id })
      .eq("display_name_norm", norm)
      .is("aluno_id", null)
      .select("encontro_id");

    for (const linha of (afetadas || []) as { encontro_id: string }[]) {
      encontrosTocados.add(linha.encontro_id);
      res.participacoes_ligadas++;
    }

    await sb
      .from("formacao_meet_falas")
      .update({ aluno_id: dona.aluno_id })
      .eq("display_name", p.display_name)
      .is("aluno_id", null);
  }

  await recontarIdentificados(sb, Array.from(encontrosTocados));

  return res;
}
