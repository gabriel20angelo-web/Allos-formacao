// Quem estava na sala, descoberto por quem preencheu o formulário.
//
// A Meet API entrega nome exibido e nunca e-mail, e o nome exibido é o que a
// pessoa escreveu no perfil do Google: "Loba", "dreh dessa", "A. Santana",
// "LUCASxy CARV". Comparar isso com `profiles` resolve pouco, e por um motivo
// que não é técnico: a maior parte de quem frequenta os grupos não tem conta
// na plataforma. No encontro de 04/08/2026, das 34 pessoas que preencheram o
// certificado, 21 não tinham perfil.
//
// Mas elas se identificam sozinhas em outro lugar. Logo depois do encontro,
// vão ao formulário de certificado e escrevem nome completo, nome social e
// e-mail, junto do feedback. Duas listas do mesmo encontro, portanto: quem
// esteve na sala (com nome de tela) e quem se identificou (com nome de
// documento). Cruzar as duas é o que este arquivo faz.
//
// A regra de casamento é deliberadamente mais frouxa no limiar e mais rígida
// na exclusividade do que a de `nomes.ts`. Frouxa porque o universo aqui não
// são as 348 pessoas cadastradas, e sim as trinta que estiveram naquele
// encontro — parecer com uma delas significa muito mais. Rígida porque cada
// submissão pertence a uma pessoa só: se dois nomes de tela disputam a mesma
// submissão, quem casa é o mais parecido e o outro volta para a fila. Foi
// exatamente esse teste que impediu "Yasmin Henrique" de virar
// "Yasmin Garcia Figueiró" só porque o nome social dela era "Yasmin".

import { normalizarNome, similaridade, sugerirAluno } from "./nomes";
import type { CandidatoAluno } from "./nomes";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

/** Parecença mínima para casar dentro da coorte de um encontro. */
const LIMIAR = 0.75;

/** Distância mínima para o segundo colocado. Empate não casa. */
const FOLGA = 0.1;

/**
 * Até quando uma submissão ainda pode ser daquele encontro.
 *
 * Quase todo mundo preenche nos minutos seguintes, mas quem sai correndo
 * preenche no dia seguinte. O corte real não é este número: é o próximo
 * encontro da mesma atividade, calculado adiante.
 */
const JANELA_DIAS = 4;

/** Meia hora antes: às vezes o link do formulário é passado no começo. */
const ANTECEDENCIA_MIN = 30;

/** Só olha para trás até aqui. Encontro velho com nome irresolvível não volta. */
const DIAS_PARA_TRAS = 45;

export interface ResultadoCertificados {
  encontros_examinados: number;
  nomes_identificados: number;
  com_conta: number;
  sem_conta: number;
  continuam_na_fila: number;
  aliases_ligados_a_conta_nova: number;
}

interface PessoaDaCoorte {
  chave: string;
  nome_completo: string;
  /** Só quando tem dois nomes ou mais: "Ana" sozinho casa com qualquer Ana. */
  nome_social: string | null;
  email: string | null;
  aluno_id: string | null;
}

interface SubmissaoRow {
  nome_completo: string;
  nome_social: string | null;
  email: string | null;
  created_at: string;
}

function palavrasUteis(nome: string): number {
  return normalizarNome(nome)
    .split(" ")
    .filter((t) => t.length > 1).length;
}

/**
 * Quem preencheu o formulário daquele encontro.
 *
 * A janela fecha no próximo encontro da mesma atividade porque o formulário
 * não pergunta a data: só a atividade. Sem esse corte, a submissão da semana
 * seguinte entraria na coorte da semana anterior e as duas listas passariam a
 * disputar as mesmas pessoas.
 */
export async function coorteDoEncontro(
  sb: Sb,
  encontro: { atividade_nome: string | null; inicio: string },
  proximoInicio: string | null,
  candidatos: CandidatoAluno[],
  perfilPorEmail: Map<string, string>
): Promise<PessoaDaCoorte[]> {
  if (!encontro.atividade_nome) return [];

  const ini = new Date(new Date(encontro.inicio).getTime() - ANTECEDENCIA_MIN * 60_000);
  const tetoPadrao = new Date(ini.getTime() + JANELA_DIAS * 24 * 3_600_000);
  const teto =
    proximoInicio && new Date(proximoInicio) < tetoPadrao ? new Date(proximoInicio) : tetoPadrao;

  const { data: subs } = await sb
    .from("certificado_submissions")
    .select("nome_completo, nome_social, email, created_at")
    .eq("atividade_nome", encontro.atividade_nome)
    .gte("created_at", ini.toISOString())
    .lt("created_at", teto.toISOString())
    .limit(300);

  // Uma entrada por pessoa: preencher duas vezes é comum e não são duas
  // pessoas. Sem isto, a segunda submissão viraria concorrente da primeira e
  // as duas se anulariam no teste de folga.
  const porPessoa = new Map<string, PessoaDaCoorte>();

  for (const s of (subs || []) as SubmissaoRow[]) {
    const email = s.email?.toLowerCase().trim() || null;
    const chave = email || normalizarNome(s.nome_completo || "");
    if (!chave || porPessoa.has(chave)) continue;

    let alunoId = email ? perfilPorEmail.get(email) || null : null;
    if (!alunoId && s.nome_completo) {
      // Sem e-mail cadastrado ainda vale tentar pelo nome, que aqui é o nome
      // de documento e não o apelido do Google — bem mais confiável.
      alunoId = sugerirAluno(s.nome_completo, candidatos).automatico;
    }

    porPessoa.set(chave, {
      chave,
      nome_completo: s.nome_completo,
      nome_social: s.nome_social && palavrasUteis(s.nome_social) >= 2 ? s.nome_social : null,
      email,
      aluno_id: alunoId,
    });
  }

  return Array.from(porPessoa.values());
}

/** Melhor parecença entre um nome de tela e uma pessoa da coorte. */
function pontuar(displayNorm: string, pessoa: PessoaDaCoorte): number {
  const nomes = [pessoa.nome_completo, pessoa.nome_social].filter(Boolean) as string[];
  return Math.max(...nomes.map((n) => similaridade(displayNorm, normalizarNome(n))));
}

interface Pendente {
  display_name: string;
  display_name_norm: string;
}

/**
 * Atribuição um-para-um entre nomes de tela e pessoas da coorte.
 *
 * Guloso por pontuação, que é o suficiente aqui: as pontuações são esparsas e
 * altas (0,9 e 1,0 dominam), então o ótimo global e o guloso coincidem na
 * prática. O que não pode faltar é a exclusividade — sem ela, uma submissão
 * com nome social curto vira ímã e atrai meia dúzia de nomes parecidos.
 */
export function casarCoorte(
  pendentes: Pendente[],
  coorte: PessoaDaCoorte[]
): { pendente: Pendente; pessoa: PessoaDaCoorte; score: number }[] {
  const pares: { pendente: Pendente; pessoa: PessoaDaCoorte; score: number }[] = [];

  for (const p of pendentes) {
    for (const c of coorte) {
      const score = pontuar(p.display_name_norm, c);
      if (score >= LIMIAR) pares.push({ pendente: p, pessoa: c, score });
    }
  }

  pares.sort((a, b) => b.score - a.score);

  const nomesUsados = new Set<string>();
  const pessoasUsadas = new Set<string>();
  const casados: { pendente: Pendente; pessoa: PessoaDaCoorte; score: number }[] = [];

  for (const par of pares) {
    if (nomesUsados.has(par.pendente.display_name_norm)) continue;
    if (pessoasUsadas.has(par.pessoa.chave)) continue;

    // O concorrente que importa é o melhor ainda LIVRE: se a outra pessoa
    // parecida já casou com alguém, ela não é mais uma dúvida.
    const concorrente = pares.find(
      (x) =>
        x.pendente.display_name_norm === par.pendente.display_name_norm &&
        x.pessoa.chave !== par.pessoa.chave &&
        !pessoasUsadas.has(x.pessoa.chave)
    );
    if (concorrente && par.score - concorrente.score < FOLGA) continue;

    nomesUsados.add(par.pendente.display_name_norm);
    pessoasUsadas.add(par.pessoa.chave);
    casados.push(par);
  }

  return casados;
}

/**
 * Passa por todos os encontros recentes e identifica quem der.
 *
 * Roda depois da ingestão e depois da conciliação por perfil, porque as duas
 * já resolvem o caso fácil (nome de tela igual ao nome cadastrado) e não faz
 * sentido gastar coorte com quem já tem dono.
 */
export async function identificarPorCertificado(sb: Sb): Promise<ResultadoCertificados> {
  const res: ResultadoCertificados = {
    encontros_examinados: 0,
    nomes_identificados: 0,
    com_conta: 0,
    sem_conta: 0,
    continuam_na_fila: 0,
    aliases_ligados_a_conta_nova: 0,
  };

  const desde = new Date(Date.now() - DIAS_PARA_TRAS * 24 * 3_600_000).toISOString();

  const { data: encontros } = await sb
    .from("formacao_meet_encontros")
    .select("id, atividade_nome, inicio")
    .eq("descartado", false)
    .gte("inicio", desde)
    .order("inicio", { ascending: false })
    .limit(120);

  if (!encontros?.length) {
    res.aliases_ligados_a_conta_nova = await ligarAliasesAContaNova(sb);
    return res;
  }

  const { data: perfis } = await sb.from("profiles").select("id, full_name, email").limit(5000);
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

  // Nome que já tem dono não se toca, inclusive os marcados como "não é
  // aluno": decisão de gente não é revista por rotina.
  const { data: aliasRows } = await sb.from("formacao_meet_aliases").select("display_name_norm");
  const jaResolvidos = new Set(
    (aliasRows || []).map((a: { display_name_norm: string }) => a.display_name_norm)
  );

  // Quando o próximo encontro da mesma atividade começa. Fecha a janela do
  // formulário sem precisar de outra consulta por encontro.
  const proximoDaAtividade = new Map<string, string>();
  const ordenados = [...(encontros as { id: string; atividade_nome: string | null; inicio: string }[])].sort(
    (a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime()
  );
  for (let i = 0; i < ordenados.length; i++) {
    const atual = ordenados[i];
    const proximo = ordenados
      .slice(i + 1)
      .find((e) => e.atividade_nome === atual.atividade_nome);
    if (proximo) proximoDaAtividade.set(atual.id, proximo.inicio);
  }

  const encontrosTocados = new Set<string>();

  for (const enc of encontros as { id: string; atividade_nome: string | null; inicio: string }[]) {
    if (!enc.atividade_nome) continue;

    const { data: parts } = await sb
      .from("formacao_meet_participacoes")
      .select("display_name, display_name_norm")
      .eq("encontro_id", enc.id)
      .eq("eh_condutor", false)
      .is("aluno_id", null);

    const pendentes = ((parts || []) as Pendente[]).filter(
      (p) => !jaResolvidos.has(p.display_name_norm) && !p.display_name_norm.endsWith("[ignorado]")
    );
    if (!pendentes.length) continue;

    res.encontros_examinados++;

    const coorte = await coorteDoEncontro(
      sb,
      enc,
      proximoDaAtividade.get(enc.id) || null,
      candidatos,
      perfilPorEmail
    );
    if (!coorte.length) {
      res.continuam_na_fila += pendentes.length;
      continue;
    }

    // Nomes repetidos dentro do mesmo encontro seriam duas linhas disputando a
    // mesma pessoa; para o casamento, o que existe é o nome.
    const unicos = Array.from(
      new Map(pendentes.map((p) => [p.display_name_norm, p])).values()
    );

    const casados = casarCoorte(unicos, coorte);
    res.continuam_na_fila += unicos.length - casados.length;

    const dataEncontro = new Date(enc.inicio).toLocaleDateString("pt-BR");

    for (const { pendente, pessoa, score } of casados) {
      const { error } = await sb.from("formacao_meet_aliases").upsert(
        {
          display_name_norm: pendente.display_name_norm,
          display_name: pendente.display_name,
          aluno_id: pessoa.aluno_id,
          pessoa_nome: pessoa.nome_completo,
          pessoa_email: pessoa.email,
          origem: "certificado",
          evidencia: `Preencheu o certificado de ${enc.atividade_nome} em ${dataEncontro}. Semelhança de ${Math.round(
            score * 100
          )}%.`,
        },
        { onConflict: "display_name_norm" }
      );
      if (error) continue;

      jaResolvidos.add(pendente.display_name_norm);
      res.nomes_identificados++;

      if (pessoa.aluno_id) {
        res.com_conta++;
        await sb
          .from("formacao_meet_participacoes")
          .update({ aluno_id: pessoa.aluno_id })
          .eq("display_name_norm", pendente.display_name_norm)
          .is("aluno_id", null);
        await sb
          .from("formacao_meet_falas")
          .update({ aluno_id: pessoa.aluno_id })
          .eq("display_name", pendente.display_name)
          .is("aluno_id", null);
        encontrosTocados.add(enc.id);
      } else {
        res.sem_conta++;
      }
    }
  }

  await recontarIdentificados(sb, Array.from(encontrosTocados));
  res.aliases_ligados_a_conta_nova = await ligarAliasesAContaNova(sb);

  return res;
}

/**
 * Alias identificado por e-mail que ganhou conta depois.
 *
 * Quem participou dos grupos por meses sem cadastro e um dia se inscreve
 * ficaria com duas metades de história: a presença guardada sob um nome de
 * tela e a conta nova sem encontro nenhum. Como o e-mail já está guardado
 * desde o formulário, a costura é automática.
 */
async function ligarAliasesAContaNova(sb: Sb): Promise<number> {
  const { data: soltos } = await sb
    .from("formacao_meet_aliases")
    .select("display_name_norm, display_name, pessoa_email")
    .is("aluno_id", null)
    .not("pessoa_email", "is", null)
    .limit(500);

  if (!soltos?.length) return 0;

  const emails = Array.from(
    new Set(
      (soltos as { pessoa_email: string }[]).map((a) => a.pessoa_email.toLowerCase().trim())
    )
  );

  const { data: perfis } = await sb
    .from("profiles")
    .select("id, email")
    .in("email", emails)
    .limit(1000);

  if (!perfis?.length) return 0;

  const idPorEmail = new Map(
    (perfis as { id: string; email: string | null }[])
      .filter((p) => p.email)
      .map((p) => [p.email!.toLowerCase().trim(), p.id])
  );

  let ligados = 0;
  const encontrosTocados = new Set<string>();

  for (const a of soltos as {
    display_name_norm: string;
    display_name: string;
    pessoa_email: string;
  }[]) {
    const alunoId = idPorEmail.get(a.pessoa_email.toLowerCase().trim());
    if (!alunoId) continue;

    await sb
      .from("formacao_meet_aliases")
      .update({ aluno_id: alunoId })
      .eq("display_name_norm", a.display_name_norm);

    const { data: afetadas } = await sb
      .from("formacao_meet_participacoes")
      .update({ aluno_id: alunoId })
      .eq("display_name_norm", a.display_name_norm)
      .is("aluno_id", null)
      .select("encontro_id");

    for (const p of (afetadas || []) as { encontro_id: string }[]) {
      encontrosTocados.add(p.encontro_id);
    }

    await sb
      .from("formacao_meet_falas")
      .update({ aluno_id: alunoId })
      .eq("display_name", a.display_name)
      .is("aluno_id", null);

    ligados++;
  }

  await recontarIdentificados(sb, Array.from(encontrosTocados));
  return ligados;
}

/**
 * Refaz a conta de identificados dos encontros mexidos.
 *
 * O número é gravado na ingestão e a ingestão não volta em encontro já
 * concluído. Sem refazer aqui, ligar dez pessoas a contas deixaria o cabeçalho
 * do encontro dizendo o número de antes — para sempre, e sem erro nenhum.
 */
async function recontarIdentificados(sb: Sb, encontroIds: string[]): Promise<void> {
  for (const id of encontroIds) {
    const { count } = await sb
      .from("formacao_meet_participacoes")
      .select("id", { count: "exact", head: true })
      .eq("encontro_id", id)
      .not("aluno_id", "is", null);

    await sb
      .from("formacao_meet_encontros")
      .update({ identificados: count ?? 0 })
      .eq("id", id);
  }
}
