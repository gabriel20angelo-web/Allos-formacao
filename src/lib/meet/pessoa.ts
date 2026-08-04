// O retrato de uma pessoa dentro dos encontros.
//
// Existe porque a lista de presença é boa para responder "como foi este
// encontro" e péssima para responder "como está esta pessoa". A segunda
// pergunta é a que aparece quando alguém repara num nome: veio quantas vezes,
// fala ou fica calada, chega atrasada sempre, o que escreveu no formulário.
//
// A mesma pessoa costuma ter mais de um nome de tela — o celular entra como
// "Ana" e o computador como "Ana Paula Ferreira" —, então o retrato começa
// juntando todas as grafias que apontam para a mesma identidade. Sem isso,
// clicar num nome mostraria um terço da história e pareceria completo.
//
// O mesmo módulo serve o painel do administrador e a área de quem conduz. A
// diferença é o recorte: passando `spaceNames`, só entram os encontros
// daquelas salas, que é o que quem conduz um grupo tem que ver.

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface EncontroDaPessoa {
  encontro_id: string;
  data_reuniao: string;
  inicio: string;
  atividade_nome: string | null;
  condutor_nome: string | null;
  duracao_min: number | null;
  display_name: string;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
}

export interface FeedbackDaPessoa {
  atividade_nome: string | null;
  nota_grupo: number | null;
  nota_condutor: number | null;
  relato: string | null;
  created_at: string;
}

export interface Retrato {
  pessoa: {
    nome: string;
    email: string | null;
    aluno_id: string | null;
    tem_conta: boolean;
    origem: string | null;
    evidencia: string | null;
    nomes_de_tela: string[];
  };
  resumo: {
    encontros: number;
    minutos_totais: number;
    media_permanencia_pct: number | null;
    minutos_fala: number | null;
    turnos_fala: number | null;
    encontros_em_que_falou: number;
    atrasos: number;
    primeiro: string | null;
    ultimo: string | null;
  };
  encontros: EncontroDaPessoa[];
  feedback: FeedbackDaPessoa[];
  /** Verdadeiro quando a lista foi recortada às salas de quem consultou. */
  recortado: boolean;
}

interface AliasRow {
  display_name_norm: string;
  display_name: string;
  aluno_id: string | null;
  pessoa_nome: string | null;
  pessoa_email: string | null;
  origem: string | null;
  evidencia: string | null;
}

interface ParticipacaoRow {
  encontro_id: string;
  display_name: string;
  display_name_norm: string;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
}

export interface ChavePessoa {
  norm?: string | null;
  aluno_id?: string | null;
  email?: string | null;
}

/**
 * Reúne todas as grafias que são a mesma pessoa.
 *
 * A ordem das perguntas importa: conta primeiro (é a identidade mais forte),
 * depois e-mail declarado no certificado, e só então o nome de tela sozinho,
 * que é o caso de quem ainda não foi identificado por nada.
 */
async function juntarIdentidade(
  sb: Sb,
  chave: ChavePessoa
): Promise<{
  norms: string[];
  alunoId: string | null;
  email: string | null;
  alias: AliasRow | null;
}> {
  let alunoId = chave.aluno_id || null;
  let email = chave.email?.toLowerCase().trim() || null;
  let alias: AliasRow | null = null;

  if (chave.norm) {
    // `*` e não a lista de colunas: os campos de identidade nascem na
    // migration 083 e, sem ela, nomear `pessoa_email` faria o PostgREST
    // recusar a consulta inteira em vez de devolver o alias antigo.
    const { data } = await sb
      .from("formacao_meet_aliases")
      .select("*")
      .eq("display_name_norm", chave.norm)
      .maybeSingle();
    alias = (data as AliasRow) || null;
    if (alias) {
      alunoId = alunoId || alias.aluno_id;
      email = email || alias.pessoa_email?.toLowerCase().trim() || null;
    }
  }

  const norms = new Set<string>();
  if (chave.norm) norms.add(chave.norm);

  if (alunoId) {
    const [{ data: porAluno }, { data: partsAluno }] = await Promise.all([
      sb.from("formacao_meet_aliases").select("display_name_norm").eq("aluno_id", alunoId),
      sb
        .from("formacao_meet_participacoes")
        .select("display_name_norm")
        .eq("aluno_id", alunoId)
        .limit(500),
    ]);
    for (const a of (porAluno || []) as { display_name_norm: string }[]) {
      norms.add(a.display_name_norm);
    }
    for (const p of (partsAluno || []) as { display_name_norm: string }[]) {
      norms.add(p.display_name_norm);
    }
  }

  if (email) {
    // Filtrar por uma coluna que ainda não existe devolve erro, não lista
    // vazia. Aqui isso só significa "não há outras grafias conhecidas", e
    // deixar o erro subir tiraria a ficha do ar por um detalhe de migration.
    const { data: porEmail } = await sb
      .from("formacao_meet_aliases")
      .select("display_name_norm")
      .ilike("pessoa_email", email);
    for (const a of (porEmail || []) as { display_name_norm: string }[]) {
      norms.add(a.display_name_norm);
    }
  }

  return { norms: Array.from(norms), alunoId, email, alias };
}

export async function retratoDaPessoa(
  sb: Sb,
  chave: ChavePessoa,
  spaceNames?: string[]
): Promise<Retrato | null> {
  const { norms, alunoId, email, alias } = await juntarIdentidade(sb, chave);
  if (!norms.length && !alunoId) return null;

  // Duas consultas em vez de um `or`: o filtro composto do PostgREST com lista
  // de valores que contêm vírgula (nome de tela tem vírgula) monta uma query
  // ambígua, e o erro aparece como resultado errado, não como erro.
  const [porNome, porConta] = await Promise.all([
    norms.length
      ? sb
          .from("formacao_meet_participacoes")
          .select(
            "encontro_id, display_name, display_name_norm, minutos_presentes, permanencia_pct, atraso_min, minutos_fala, n_turnos_fala, n_sessoes"
          )
          .in("display_name_norm", norms)
          .limit(500)
      : Promise.resolve({ data: [] as ParticipacaoRow[] }),
    alunoId
      ? sb
          .from("formacao_meet_participacoes")
          .select(
            "encontro_id, display_name, display_name_norm, minutos_presentes, permanencia_pct, atraso_min, minutos_fala, n_turnos_fala, n_sessoes"
          )
          .eq("aluno_id", alunoId)
          .limit(500)
      : Promise.resolve({ data: [] as ParticipacaoRow[] }),
  ]);

  const participacoes = new Map<string, ParticipacaoRow>();
  for (const p of [
    ...((porNome.data || []) as ParticipacaoRow[]),
    ...((porConta.data || []) as ParticipacaoRow[]),
  ]) {
    participacoes.set(`${p.encontro_id}:${p.display_name_norm}`, p);
  }

  const encontroIds = Array.from(new Set(Array.from(participacoes.values()).map((p) => p.encontro_id)));

  let encontros: {
    id: string;
    data_reuniao: string;
    inicio: string;
    atividade_nome: string | null;
    condutor_nome: string | null;
    duracao_min: number | null;
    space_name: string;
  }[] = [];

  if (encontroIds.length) {
    let q = sb
      .from("formacao_meet_encontros")
      .select("id, data_reuniao, inicio, atividade_nome, condutor_nome, duracao_min, space_name")
      .in("id", encontroIds)
      .eq("descartado", false);
    // O recorte de quem conduz: só as salas dele. Feito aqui, e não filtrando
    // a lista depois, para que o resumo não seja calculado sobre encontros que
    // a pessoa não pode ver.
    if (spaceNames) q = q.in("space_name", spaceNames);
    const { data } = await q;
    encontros = (data || []) as typeof encontros;
  }

  const encontroPorId = new Map(encontros.map((e) => [e.id, e]));

  const linhas: EncontroDaPessoa[] = Array.from(participacoes.values())
    .filter((p) => encontroPorId.has(p.encontro_id))
    .map((p) => {
      const e = encontroPorId.get(p.encontro_id)!;
      return {
        encontro_id: p.encontro_id,
        data_reuniao: e.data_reuniao,
        inicio: e.inicio,
        atividade_nome: e.atividade_nome,
        condutor_nome: e.condutor_nome,
        duracao_min: e.duracao_min,
        display_name: p.display_name,
        minutos_presentes: p.minutos_presentes,
        permanencia_pct: p.permanencia_pct,
        atraso_min: p.atraso_min,
        minutos_fala: p.minutos_fala,
        n_turnos_fala: p.n_turnos_fala,
        n_sessoes: p.n_sessoes,
      };
    })
    .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime());

  // Nome e conta: o perfil manda, porque é o que a própria pessoa mantém.
  let nome = alias?.pessoa_nome || null;
  let emailFinal = email;
  if (alunoId) {
    const { data: perfil } = await sb
      .from("profiles")
      .select("full_name, email")
      .eq("id", alunoId)
      .maybeSingle();
    if (perfil) {
      nome = (perfil as { full_name: string }).full_name || nome;
      emailFinal = (perfil as { email: string | null }).email || emailFinal;
    }
  }
  if (!nome) nome = linhas[0]?.display_name || alias?.display_name || chave.norm || "Sem nome";

  // O que a pessoa escreveu ao pedir o certificado. É o outro lado do mesmo
  // encontro: a presença medida de um lado, a avaliação dela do outro.
  let feedback: FeedbackDaPessoa[] = [];
  if (emailFinal) {
    const { data } = await sb
      .from("certificado_submissions")
      .select("atividade_nome, nota_grupo, nota_condutor, relato, created_at")
      .ilike("email", emailFinal)
      .order("created_at", { ascending: false })
      .limit(30);
    feedback = (data || []) as FeedbackDaPessoa[];
  }

  const comFala = linhas.filter((l) => (l.minutos_fala || 0) > 0);
  const somaPermanencia = linhas.reduce((a, l) => a + (l.permanencia_pct || 0), 0);
  const houveTranscricao = linhas.some((l) => l.minutos_fala !== null);

  return {
    pessoa: {
      nome,
      email: emailFinal,
      aluno_id: alunoId,
      tem_conta: !!alunoId,
      origem: alias?.origem || (alunoId ? "automatico" : null),
      evidencia: alias?.evidencia || null,
      nomes_de_tela: Array.from(new Set(linhas.map((l) => l.display_name))),
    },
    resumo: {
      encontros: linhas.length,
      minutos_totais: linhas.reduce((a, l) => a + l.minutos_presentes, 0),
      media_permanencia_pct: linhas.length
        ? Math.round((somaPermanencia / linhas.length) * 10) / 10
        : null,
      minutos_fala: houveTranscricao
        ? Math.round(linhas.reduce((a, l) => a + (l.minutos_fala || 0), 0) * 10) / 10
        : null,
      turnos_fala: houveTranscricao
        ? linhas.reduce((a, l) => a + (l.n_turnos_fala || 0), 0)
        : null,
      encontros_em_que_falou: comFala.length,
      atrasos: linhas.filter((l) => (l.atraso_min || 0) > 0).length,
      primeiro: linhas.length ? linhas[linhas.length - 1].data_reuniao : null,
      ultimo: linhas.length ? linhas[0].data_reuniao : null,
    },
    encontros: linhas,
    feedback,
    recortado: !!spaceNames,
  };
}
