/**
 * A definição de quórum da casa, num lugar só.
 *
 * Antes deste arquivo existiam quatro contagens diferentes de "quantos vieram",
 * e as telas não diziam qual usavam. Duas delas liam `formacao_meet_presencas`,
 * que **nunca recebeu uma linha derivada da ingestão**: o upsert de
 * `ingest.ts` aponta para um índice único PARCIAL, o Postgres recusa índice
 * parcial como árbitro de `ON CONFLICT`, e o erro nunca apareceu porque aquela
 * chamada não desestrutura `{ error }`. O resultado é que o painel afirmava que
 * um grupo reuniu 20 pessoas quando ele reuniu 77.
 *
 * As três regras que este módulo existe para fixar:
 *
 * 1. **Quórum é presença medida, sem o condutor.** Contar quem conduz junto com
 *    quem participa infla todo grupo em uma pessoa e faz grupo vazio parecer
 *    grupo de um. A fonte é `formacao_meet_participacoes`, nunca
 *    `total_participantes` do encontro, que inclui quem conduz.
 *
 * 2. **`condutor_nome` guarda a dupla inteira, e ninguém separava.** A ingestão
 *    grava `nomesCondutores.join(", ")`, então numa dupla o campo chega como
 *    "Ana, João". Quem usa a string inteira como chave de mapa cria uma chave
 *    que não casa com condutor nenhum, e o encontro some da conta dos dois.
 *
 * 3. **`fala_condutor_pct = 0` quase sempre significa "não reconheci o
 *    condutor", não "ele ficou calado".** A guarda da ingestão testa se ALGUÉM
 *    falou, não se o condutor foi identificado. Incluir esses zeros numa média
 *    faz um problema de casamento de nome parecer traço de uma pessoa. Aqui o
 *    zero vira `null` na leitura, para que nenhuma tela precise lembrar disso.
 *
 * ⚠️ `dia_semana` NÃO é a convenção do JavaScript: **0 é segunda-feira**, 6 é
 * domingo (`nomes.ts`, `diaSemanaLocal`). Rotular com um array que começa em
 * domingo erra o dia inteiro.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { lerTudo } from "@/lib/supabase/paginar";

/**
 * Sem acento, minúsculo, espaço colapsado. Renomear só o acento não parte o grupo.
 *
 * A faixa `̀-ͯ` é a dos sinais diacríticos combinantes, que é o que
 * `NFD` separa das letras. Escrita com escape porque o caractere combinante
 * literal num arquivo fonte é invisível e a próxima pessoa a editar apaga sem ver.
 */
export function chaveTexto(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Separa a string de condutores do encontro nos nomes que ela guarda.
 *
 * Devolve lista vazia para encontro sem condutor reconhecido, e "Sem condutor"
 * conta como ausência, não como uma pessoa chamada assim.
 */
export function separarCondutores(campo: string | null | undefined): string[] {
  if (!campo) return [];
  return campo
    .split(",")
    .map((n) => n.trim())
    .filter((n) => n.length > 0 && chaveTexto(n) !== "sem condutor");
}

export interface EncontroMedido {
  id: string;
  slotId: string | null;
  atividade: string | null;
  atividadeChave: string;
  condutores: string[];
  data: string;
  /** 0 = segunda, 6 = domingo. */
  diaSemana: number;
  duracaoMin: number | null;
  duracaoPrevistaMin: number | null;
  /** Presentes distintos, SEM o condutor. Esta é a definição da casa. */
  quorum: number;
  /** Quantos dos presentes falaram ao menos uma vez. Só faz sentido com transcrição. */
  falaram: number;
  temTranscricao: boolean;
  permanenciaMediaPct: number | null;
  /** Minutos de saída antes do fim, média dos presentes. */
  saidaAntecipadaMediaMin: number | null;
  /** Entradas e saídas por pessoa, média. Acima de 1 é gente entrando e saindo. */
  sessoesMedia: number | null;
  /** `null` quando o condutor não foi reconhecido. Nunca zero. */
  falaCondutorPct: number | null;
  /**
   * Quantos preencheram o formulário de certificado por este encontro.
   *
   * Não é quórum, e nunca entra numa média de presença: é o denominador da
   * confiança. O formulário pega cerca de metade de quem esteve na sala, e não
   * por sorteio, então grupo com cobertura baixa não tem nota, tem rumor.
   */
  declararam: number;
}

interface EncontroRow {
  id: string;
  slot_id: string | null;
  atividade_nome: string | null;
  condutor_nome: string | null;
  data_reuniao: string;
  dia_semana: number | null;
  duracao_min: number | null;
  duracao_prevista_min: number | null;
  vozes_ativas_pct: number | null;
  fala_condutor_pct: number | null;
  descartado: boolean | null;
}

interface ParticipacaoRow {
  encontro_id: string;
  aluno_id: string | null;
  display_name: string;
  display_name_norm: string;
  minutos_presentes: number;
  permanencia_pct: number | null;
  saida_antecipada_min: number | null;
  n_sessoes: number | null;
  minutos_fala: number | null;
  eh_condutor: boolean;
}

export interface PessoaNaSala {
  chave: string;
  nome: string;
  alunoId: string | null;
  encontros: number;
  minutos: number;
  minutosFala: number;
  /** Encontros com transcrição em que não falou nada. */
  caladaEm: number;
  /** Encontros com transcrição em que esteve. Denominador honesto de `caladaEm`. */
  comTranscricao: number;
  ultima: string;
}

export interface DadosDaSala {
  encontros: EncontroMedido[];
  pessoas: PessoaNaSala[];
  /** Por encontro, as chaves de quem esteve. Serve a série semanal sem reler nada. */
  pessoasPorEncontro: Map<string, Set<string>>;
}

function media(ns: number[]): number | null {
  const validos = ns.filter((n) => Number.isFinite(n));
  if (!validos.length) return null;
  return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10;
}

/**
 * Lê a sala inteira: encontros medidos e as pessoas que estiveram neles.
 *
 * Pagina de propósito. A rota de métricas antiga usava `.limit(30000)` numa
 * instância que corta em mil sem avisar, o que hoje não dói porque a captura
 * começou em agosto, e passa a doer sozinho quando a base crescer.
 */
export async function lerSala(
  sb: SupabaseClient,
  opcoes: { desde?: string | null } = {},
): Promise<DadosDaSala> {
  const [encRows, partRows, subRows] = await Promise.all([
    lerTudo<EncontroRow>(
      sb,
      "formacao_meet_encontros",
      "id,slot_id,atividade_nome,condutor_nome,data_reuniao,dia_semana,duracao_min,duracao_prevista_min,vozes_ativas_pct,fala_condutor_pct,descartado",
      "id",
    ),
    lerTudo<ParticipacaoRow>(
      sb,
      "formacao_meet_participacoes",
      "encontro_id,aluno_id,display_name,display_name_norm,minutos_presentes,permanencia_pct,saida_antecipada_min,n_sessoes,minutos_fala,eh_condutor",
      "id",
    ),
    lerTudo<{ created_at: string; atividade_nome: string | null }>(
      sb,
      "certificado_submissions",
      "created_at,atividade_nome",
      "id",
    ),
  ]);

  // O formulário é a outra porta do mesmo evento. A chave é dia mais atividade,
  // igual à de `agregar.ts`.
  // ⚠️ O dia do formulário é quando a pessoa enviou, e o do encontro é quando
  // ele aconteceu. Quem preenche na manhã seguinte não casa. É um erro pequeno
  // e conhecido, e é para menos: a cobertura real é igual ou maior que a medida.
  const declaracoes = new Map<string, number>();
  for (const s of subRows) {
    const dia = s.created_at.slice(0, 10);
    const k = `${dia}|${chaveTexto(s.atividade_nome)}`;
    declaracoes.set(k, (declaracoes.get(k) ?? 0) + 1);
  }

  const desde = opcoes.desde ?? null;
  // Encontro descartado é teste de link, não encontro. Fica fora de toda média.
  const validos = encRows.filter(
    (e) => !e.descartado && (!desde || e.data_reuniao >= desde),
  );

  const porEncontro = new Map<string, ParticipacaoRow[]>();
  for (const p of partRows) {
    const lista = porEncontro.get(p.encontro_id);
    if (lista) lista.push(p);
    else porEncontro.set(p.encontro_id, [p]);
  }

  const encontros: EncontroMedido[] = validos.map((e) => {
    const todas = porEncontro.get(e.id) ?? [];
    // O único ponto onde o condutor sai. Vale para tudo que vem depois.
    const presentes = todas.filter((p) => !p.eh_condutor);
    const temTranscricao = e.vozes_ativas_pct !== null;
    return {
      id: e.id,
      slotId: e.slot_id,
      atividade: e.atividade_nome,
      atividadeChave: chaveTexto(e.atividade_nome) || "sem atividade",
      condutores: separarCondutores(e.condutor_nome),
      data: e.data_reuniao,
      diaSemana: e.dia_semana ?? 0,
      duracaoMin: e.duracao_min,
      duracaoPrevistaMin: e.duracao_prevista_min,
      quorum: presentes.length,
      falaram: presentes.filter((p) => (p.minutos_fala ?? 0) > 0).length,
      temTranscricao,
      permanenciaMediaPct: media(presentes.map((p) => p.permanencia_pct ?? NaN)),
      saidaAntecipadaMediaMin: media(
        presentes.map((p) => p.saida_antecipada_min ?? NaN),
      ),
      sessoesMedia: media(presentes.map((p) => p.n_sessoes ?? NaN)),
      // Zero é ausência de reconhecimento, não silêncio. Ver regra 3 no topo.
      falaCondutorPct:
        e.fala_condutor_pct !== null && e.fala_condutor_pct > 0
          ? e.fala_condutor_pct
          : null,
      declararam:
        declaracoes.get(`${e.data_reuniao}|${chaveTexto(e.atividade_nome)}`) ?? 0,
    };
  });

  // ── as pessoas ──
  const idsValidos = new Set(validos.map((e) => e.id));
  const dataDoEncontro = new Map(validos.map((e) => [e.id, e.data_reuniao]));
  const comTranscricao = new Set(
    validos.filter((e) => e.vozes_ativas_pct !== null).map((e) => e.id),
  );

  const acc = new Map<string, PessoaNaSala>();
  const pessoasPorEncontro = new Map<string, Set<string>>();
  for (const p of partRows) {
    if (!idsValidos.has(p.encontro_id) || p.eh_condutor) continue;
    // Chave forte quando existe. O nome cru só quando não há conta, e aí a
    // mesma pessoa que trocou a grafia do nome de tela vira duas: é limitação
    // conhecida, e o conserto mora em `pessoa_identificadores`, não aqui.
    const chave = p.aluno_id || `nome:${p.display_name_norm}`;
    const dataEnc = dataDoEncontro.get(p.encontro_id) ?? "";
    const houve = comTranscricao.has(p.encontro_id);
    const noEncontro = pessoasPorEncontro.get(p.encontro_id);
    if (noEncontro) noEncontro.add(chave);
    else pessoasPorEncontro.set(p.encontro_id, new Set([chave]));
    const atual = acc.get(chave);
    acc.set(chave, {
      chave,
      nome: p.display_name,
      alunoId: p.aluno_id,
      encontros: (atual?.encontros ?? 0) + 1,
      minutos: (atual?.minutos ?? 0) + p.minutos_presentes,
      minutosFala: (atual?.minutosFala ?? 0) + (p.minutos_fala ?? 0),
      caladaEm:
        (atual?.caladaEm ?? 0) + (houve && (p.minutos_fala ?? 0) === 0 ? 1 : 0),
      comTranscricao: (atual?.comTranscricao ?? 0) + (houve ? 1 : 0),
      ultima: atual && atual.ultima > dataEnc ? atual.ultima : dataEnc,
    });
  }

  return { encontros, pessoas: Array.from(acc.values()), pessoasPorEncontro };
}

/**
 * Metade recente contra metade antiga, em pessoas, com sinal.
 *
 * Exige quatro encontros: com três, cada ponto move a conta em um terço e a
 * "tendência" vira ruído com seta.
 */
export function tendencia(quoruns: number[]): number | null {
  if (quoruns.length < 4) return null;
  const meio = Math.floor(quoruns.length / 2);
  const antiga = media(quoruns.slice(0, meio));
  const recente = media(quoruns.slice(meio));
  if (antiga === null || recente === null) return null;
  return Math.round((recente - antiga) * 10) / 10;
}

export interface ResumoDeEncontros {
  encontros: number;
  quorumMedio: number | null;
  quorumMaximo: number;
  tendencia: number | null;
  vozesAtivasPct: number | null;
  encontrosComTranscricao: number;
  falaCondutorPct: number | null;
  /** Em quantos encontros o condutor foi reconhecido. Denominador de `falaCondutorPct`. */
  encontrosComCondutorReconhecido: number;
  duracaoMediaMin: number | null;
  permanenciaMediaPct: number | null;
  /** Formulários recebidos, somados. Não é presença. */
  declararam: number;
  /**
   * Formulários sobre presentes. É o grau de confiança de todo número tirado do
   * formulário deste recorte, não um indicador de participação.
   */
  coberturaPct: number | null;
  primeiro: string | null;
  ultimo: string | null;
}

/** Resume um conjunto de encontros já filtrado. Ordena por data antes de medir tendência. */
export function resumir(lista: EncontroMedido[]): ResumoDeEncontros {
  const ordenados = [...lista].sort((a, b) => a.data.localeCompare(b.data));
  const quoruns = ordenados.map((e) => e.quorum);
  const comTrans = ordenados.filter((e) => e.temTranscricao);
  const comCondutor = ordenados.filter((e) => e.falaCondutorPct !== null);
  return {
    encontros: ordenados.length,
    quorumMedio: media(quoruns),
    quorumMaximo: quoruns.length ? Math.max(...quoruns) : 0,
    tendencia: tendencia(quoruns),
    // Só encontros com transcrição entram: misturar encontro sem transcrição
    // puxaria o indicador para baixo por ausência de dado, não por silêncio.
    vozesAtivasPct: media(
      comTrans.map((e) => (e.quorum > 0 ? (e.falaram / e.quorum) * 100 : NaN)),
    ),
    encontrosComTranscricao: comTrans.length,
    falaCondutorPct: media(comCondutor.map((e) => e.falaCondutorPct as number)),
    encontrosComCondutorReconhecido: comCondutor.length,
    duracaoMediaMin: media(ordenados.map((e) => e.duracaoMin ?? NaN)),
    permanenciaMediaPct: media(ordenados.map((e) => e.permanenciaMediaPct ?? NaN)),
    declararam: ordenados.reduce((a, e) => a + e.declararam, 0),
    coberturaPct: (() => {
      const presentes = quoruns.reduce((a, b) => a + b, 0);
      if (!presentes) return null;
      const decl = ordenados.reduce((a, e) => a + e.declararam, 0);
      return Math.round((decl / presentes) * 1000) / 10;
    })(),
    primeiro: ordenados[0]?.data ?? null,
    ultimo: ordenados[ordenados.length - 1]?.data ?? null,
  };
}

/**
 * Agrupa por condutor, atribuindo o encontro a CADA nome da dupla.
 *
 * É o que recupera o segundo condutor, invisível em toda tela até aqui.
 */
export function porCondutor(
  lista: EncontroMedido[],
): Map<string, { nome: string; encontros: EncontroMedido[] }> {
  const acc = new Map<string, { nome: string; encontros: EncontroMedido[] }>();
  for (const e of lista) {
    for (const nome of e.condutores) {
      const chave = chaveTexto(nome);
      const atual = acc.get(chave);
      if (atual) atual.encontros.push(e);
      else acc.set(chave, { nome, encontros: [e] });
    }
  }
  return acc;
}

/**
 * Agrupa por ATIVIDADE, não por slot.
 *
 * A rota antiga agrupava por `slot_id`, e isso parte em dois todo grupo que
 * mudou de horário. O grupo é a coisa; o horário é onde ela está na grade.
 */
export function porAtividade(
  lista: EncontroMedido[],
): Map<string, { nome: string; encontros: EncontroMedido[]; slots: Set<string> }> {
  const acc = new Map<
    string,
    { nome: string; encontros: EncontroMedido[]; slots: Set<string> }
  >();
  for (const e of lista) {
    const atual = acc.get(e.atividadeChave);
    if (atual) {
      atual.encontros.push(e);
      if (e.slotId) atual.slots.add(e.slotId);
    } else {
      acc.set(e.atividadeChave, {
        nome: e.atividade ?? "Sem atividade",
        encontros: [e],
        slots: new Set(e.slotId ? [e.slotId] : []),
      });
    }
  }
  return acc;
}

/** Quórum médio por dia da semana. Separa efeito de horário de efeito de condução. */
export function porDiaSemana(
  lista: EncontroMedido[],
): { dia: number; encontros: number; quorumMedio: number | null }[] {
  const acc = new Map<number, number[]>();
  for (const e of lista) {
    const atual = acc.get(e.diaSemana);
    if (atual) atual.push(e.quorum);
    else acc.set(e.diaSemana, [e.quorum]);
  }
  return Array.from(acc.entries())
    .map(([dia, ns]) => ({ dia, encontros: ns.length, quorumMedio: media(ns) }))
    .sort((a, b) => a.dia - b.dia);
}

/** 0 = segunda. A ordem é a da coluna `dia_semana`, não a do JavaScript. */
export const DIAS_DA_SEMANA = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

/** Segunda-feira da semana de uma data `YYYY-MM-DD`. */
function segundaDa(data: string): string {
  const d = new Date(data + "T12:00:00");
  const diff = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/**
 * Série semanal de pessoas distintas, **com as semanas vazias preenchidas**.
 *
 * A rota antiga omitia semana sem encontro, e um gráfico de linha que liga os
 * pontos direto desenha uma pausa de férias como declínio suave.
 */
export function serieSemanal(
  lista: EncontroMedido[],
  participacoesPorEncontro: Map<string, Set<string>>,
): { semana: string; pessoas: number }[] {
  if (!lista.length) return [];
  const acc = new Map<string, Set<string>>();
  for (const e of lista) {
    const chave = segundaDa(e.data);
    const set = acc.get(chave) ?? new Set<string>();
    participacoesPorEncontro.get(e.id)?.forEach((pessoa) => set.add(pessoa));
    acc.set(chave, set);
  }
  const ordenadas = Array.from(acc.keys()).sort();
  const saida: { semana: string; pessoas: number }[] = [];
  const cursor = new Date(ordenadas[0] + "T12:00:00");
  const fim = new Date(ordenadas[ordenadas.length - 1] + "T12:00:00");
  while (cursor <= fim) {
    const chave = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    saida.push({ semana: chave, pessoas: acc.get(chave)?.size ?? 0 });
    cursor.setDate(cursor.getDate() + 7);
  }
  return saida;
}
