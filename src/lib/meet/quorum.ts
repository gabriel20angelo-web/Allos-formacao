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
import { ehContaDaCasa } from "@/lib/meet/nomes";

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

/** Mediana. Existe porque a média de permanência mente, e por muito. */
export function mediana(ns: number[]): number | null {
  const v = ns.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!v.length) return null;
  const meio = Math.floor(v.length / 2);
  const m = v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
  return Math.round(m * 10) / 10;
}

/**
 * A identidade da pessoa na sala, em três degraus de força.
 *
 * ⚠️ Medido em 06/08/2026: acrescentar `google_user_id` **não muda nada hoje**,
 * 134 entidades e 39 em mais de um grupo com ou sem ele. Ele está aqui porque a
 * conta Google cobre 97% das participações contra 41% de `aluno_id`, e porque a
 * regra da casa é que chave forte casa sozinha e nome nunca. O dia em que dois
 * homônimos aparecerem sem conta da plataforma, o nome funde duas séries
 * históricas em silêncio, sem erro e sem sintoma. Hoje 10 dos 137 nomes de tela
 * têm uma palavra só.
 *
 * ⚠️ O contrário também é verdade e por isso `aluno_id` vem primeiro: existe uma
 * pessoa com um `aluno_id` e DUAS contas Google, em três grupos. Nenhuma chave
 * única basta, é a escada que resolve.
 */
export function chavePessoa(p: {
  aluno_id: string | null;
  google_user_id?: string | null;
  display_name_norm: string;
}): string {
  if (p.aluno_id) return p.aluno_id;
  if (p.google_user_id) return `google:${p.google_user_id}`;
  return `nome:${p.display_name_norm}`;
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
  /**
   * ⭐ Minutos de fala de quem não é a conta institucional. É a "interação" do
   * pedido: o tempo de microfone de quem não é a Associação Allos.
   *
   * ⚠️ `null` quando não houve transcrição, nunca zero. Sem transcrição, "ninguém
   * falou" e "não medimos" são a mesma linha no banco, e só este campo separa.
   *
   * ⛔ Nunca divida isto pela duração do encontro para dizer "quanto do encontro
   * foi falado". Medido: dá até 124%, porque as pessoas falam por cima umas das
   * outras e a soma conta a sobreposição duas vezes. Como divisão entre pessoas
   * a soma continua válida; como fração do encontro, não.
   */
  interacaoMin: number | null;
  /**
   * Segmentos de fala, não turnos.
   *
   * ⚠️ A API do Meet corta a transcrição em pedaços de no máximo 30 segundos.
   * Medido: 1317 segmentos são 623 vezes que alguém abriu o microfone, ou seja,
   * o número aqui é cerca de 2,5 vezes maior que a intuição de "turno". Serve
   * para comparar grupos entre si; não serve para dizer "ela falou N vezes".
   */
  segmentosFala: number | null;
  permanenciaMediaPct: number | null;
  /** Mediana da permanência dos presentes. A média mente em até 20 pontos. */
  permanenciaMedianaPct: number | null;
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
  falas_gravadas: number | null;
  descartado: boolean | null;
}

interface ParticipacaoRow {
  encontro_id: string;
  aluno_id: string | null;
  google_user_id: string | null;
  display_name: string;
  display_name_norm: string;
  minutos_presentes: number;
  permanencia_pct: number | null;
  saida_antecipada_min: number | null;
  n_sessoes: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
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

/**
 * A mesma pessoa, dentro de UM grupo.
 *
 * ⭐ É a peça que faltava. `PessoaNaSala` soma a pessoa na formação inteira e
 * joga fora de qual grupo veio cada minuto, e sem esse recorte não existe
 * "ela fala mais no grupo A que no grupo B", que é a pergunta que o painel
 * nunca soube responder.
 */
export interface MetricaNoGrupo {
  grupo: string;
  nome: string;
  encontros: number;
  /** Presença somada, em minutos, só neste grupo. */
  minutos: number;
  minutosFala: number;
  segmentosFala: number;
  /** Encontros com transcrição em que esteve e não falou. */
  caladaEm: number;
  /** Denominador honesto de `caladaEm` e de `minutosFala`. */
  comTranscricao: number;
  /** Uma entrada por encontro. Guardado cru porque a mediana precisa da lista. */
  permanencias: number[];
  primeira: string;
  ultima: string;
}

export interface DadosDaSala {
  encontros: EncontroMedido[];
  pessoas: PessoaNaSala[];
  /** Por encontro, as chaves de quem esteve. Serve a série semanal sem reler nada. */
  pessoasPorEncontro: Map<string, Set<string>>;
  /**
   * ⭐ Por pessoa, por grupo. Nenhuma consulta a mais: sai das mesmas linhas que
   * já estão em memória. É a base de tudo que compara grupo com grupo e da
   * comparação da mesma pessoa entre grupos.
   */
  pessoaPorGrupo: Map<string, Map<string, MetricaNoGrupo>>;
}

function media(ns: number[]): number | null {
  const validos = ns.filter((n) => Number.isFinite(n));
  if (!validos.length) return null;
  return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10;
}

/**
 * Quem sai da conta: a conta institucional e quem a ingestão marcou como condutor.
 *
 * ⭐ Medido em 06/08/2026, e é o contrário do que se supunha: **a conta
 * "Associação Allos" é o microfone do condutor**. Nos quatro encontros válidos
 * ela fala 35%, 41%, 80% e 82% do tempo, e Laura, Gabbie e Gabriel Felipe não
 * aparecem falando pela conta própria nos grupos que conduzem. Então excluir a
 * casa é exatamente o filtro que o pedido descreve, e não uma aproximação dele.
 *
 * ⚠️ `eh_condutor` responde outra pergunta e responde mal: a ingestão o define
 * por igualdade exata de nome contra o cadastro, e isso falha para três dos
 * quatro condutores ("Tácia" não é "Tácia Hellen"). Quem conduz é
 * `formacao_alocacoes`, nunca esta coluna.
 *
 * O teste pelo nome é rede, não conserto: medido, ele pega **zero linhas** além
 * do flag, porque a ingestão já marca a casa. Está aqui porque as duas perguntas
 * dividem uma coluna, e o dia em que o flag mudar de sentido o filtro continua.
 */
function ehDaCasaOuConduz(p: { eh_condutor: boolean; display_name: string }): boolean {
  return p.eh_condutor || ehContaDaCasa(p.display_name);
}

/**
 * Houve transcrição neste encontro.
 *
 * `falas_gravadas` é a contagem de segmentos de fala efetivamente gravados, e é
 * mais direto que `vozes_ativas_pct`, que a ingestão só preenche quando alguém
 * falou acima do arredondamento. Os dois juntos porque o segundo é o que a base
 * tinha antes da coluna existir.
 */
function temFala(e: EncontroRow): boolean {
  return (e.falas_gravadas ?? 0) > 0 || e.vozes_ativas_pct !== null;
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
      "id,slot_id,atividade_nome,condutor_nome,data_reuniao,dia_semana,duracao_min,duracao_prevista_min,vozes_ativas_pct,fala_condutor_pct,falas_gravadas,descartado",
      "id",
    ),
    lerTudo<ParticipacaoRow>(
      sb,
      "formacao_meet_participacoes",
      "encontro_id,aluno_id,google_user_id,display_name,display_name_norm,minutos_presentes,permanencia_pct,saida_antecipada_min,n_sessoes,minutos_fala,n_turnos_fala,eh_condutor",
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
    const presentes = todas.filter((p) => !ehDaCasaOuConduz(p));
    const temTranscricao = temFala(e);
    const falas = presentes
      .map((p) => p.minutos_fala)
      .filter((n): n is number => n !== null);
    const segmentos = presentes
      .map((p) => p.n_turnos_fala)
      .filter((n): n is number => n !== null);
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
      // Sem transcrição não é zero, é ausência de medida. Ver o comentário do campo.
      interacaoMin: temTranscricao
        ? Math.round(falas.reduce((a, b) => a + b, 0) * 10) / 10
        : null,
      segmentosFala: temTranscricao ? segmentos.reduce((a, b) => a + b, 0) : null,
      permanenciaMediaPct: media(presentes.map((p) => p.permanencia_pct ?? NaN)),
      permanenciaMedianaPct: mediana(
        presentes
          .map((p) => p.permanencia_pct)
          .filter((n): n is number => n !== null),
      ),
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
  const comTranscricao = new Set(validos.filter(temFala).map((e) => e.id));
  // O grupo de cada encontro, para o recorte por grupo sair no mesmo laço.
  const grupoDoEncontro = new Map(
    validos.map((e) => [
      e.id,
      {
        chave: chaveTexto(e.atividade_nome) || "sem atividade",
        nome: e.atividade_nome ?? "Sem atividade",
      },
    ]),
  );

  const acc = new Map<string, PessoaNaSala>();
  const pessoasPorEncontro = new Map<string, Set<string>>();
  const pessoaPorGrupo = new Map<string, Map<string, MetricaNoGrupo>>();
  for (const p of partRows) {
    if (!idsValidos.has(p.encontro_id) || ehDaCasaOuConduz(p)) continue;
    const chave = chavePessoa(p);
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

    // ── o mesmo, recortado por grupo ──
    const g = grupoDoEncontro.get(p.encontro_id);
    if (!g) continue;
    let porGrupo = pessoaPorGrupo.get(chave);
    if (!porGrupo) {
      porGrupo = new Map<string, MetricaNoGrupo>();
      pessoaPorGrupo.set(chave, porGrupo);
    }
    const noGrupo = porGrupo.get(g.chave);
    porGrupo.set(g.chave, {
      grupo: g.chave,
      nome: g.nome,
      encontros: (noGrupo?.encontros ?? 0) + 1,
      minutos: (noGrupo?.minutos ?? 0) + p.minutos_presentes,
      minutosFala:
        Math.round(((noGrupo?.minutosFala ?? 0) + (p.minutos_fala ?? 0)) * 100) / 100,
      segmentosFala: (noGrupo?.segmentosFala ?? 0) + (p.n_turnos_fala ?? 0),
      caladaEm:
        (noGrupo?.caladaEm ?? 0) + (houve && (p.minutos_fala ?? 0) === 0 ? 1 : 0),
      comTranscricao: (noGrupo?.comTranscricao ?? 0) + (houve ? 1 : 0),
      permanencias:
        p.permanencia_pct === null
          ? (noGrupo?.permanencias ?? [])
          : [...(noGrupo?.permanencias ?? []), p.permanencia_pct],
      primeira:
        noGrupo && noGrupo.primeira < dataEnc ? noGrupo.primeira : dataEnc,
      ultima: noGrupo && noGrupo.ultima > dataEnc ? noGrupo.ultima : dataEnc,
    });
  }

  return {
    encontros,
    pessoas: Array.from(acc.values()),
    pessoasPorEncontro,
    pessoaPorGrupo,
  };
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
  /**
   * ⭐ Fala de quem não é a conta institucional, somada nos encontros com
   * transcrição. É a interação do pedido.
   */
  interacaoMin: number | null;
  /** A mesma, por encontro medido. Comparável entre grupos de tamanho diferente. */
  interacaoPorEncontroMin: number | null;
  /**
   * A mesma, dividida pelas presenças.
   *
   * ⚠️ Existe porque o total sozinho premia grupo grande. Medido em 06/08 os dois
   * deram a mesma ordem, o que foi sorte e não regra: sem este número, um grupo
   * de 77 pessoas com pouca conversa passa na frente de um de 33 com muita.
   */
  interacaoPorPessoaMin: number | null;
  /** Mediana das medianas de permanência. Ver `permanenciaDoGrupo` para a de pessoa. */
  permanenciaMedianaPct: number | null;
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
    // Só os encontros com transcrição entram, no numerador e no denominador.
    // Misturar encontro sem transcrição diluiria a interação por ausência de
    // dado, exatamente como aconteceria com vozes ativas.
    interacaoMin: comTrans.length
      ? Math.round(comTrans.reduce((a, e) => a + (e.interacaoMin ?? 0), 0) * 10) / 10
      : null,
    interacaoPorEncontroMin: media(
      comTrans.map((e) => e.interacaoMin ?? NaN),
    ),
    interacaoPorPessoaMin: (() => {
      const presencas = comTrans.reduce((a, e) => a + e.quorum, 0);
      if (!presencas) return null;
      const min = comTrans.reduce((a, e) => a + (e.interacaoMin ?? 0), 0);
      return Math.round((min / presencas) * 100) / 100;
    })(),
    permanenciaMedianaPct: mediana(
      ordenados
        .map((e) => e.permanenciaMedianaPct)
        .filter((n): n is number => n !== null),
    ),
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

export interface FluxoNoEncontro {
  encontroId: string;
  grupo: string;
  data: string;
  presentes: number;
  /**
   * ⛔ `null`, e nunca zero, no primeiro encontro medido do grupo.
   *
   * Não há encontro anterior contra o qual comparar, e "0 estrearam" leria como
   * "ninguém novo apareceu", que é o oposto da verdade: todo mundo é novo.
   */
  estrearam: number | null;
  /** Estavam no encontro imediatamente anterior deste grupo. */
  voltaram: number | null;
  /** Faltaram ao anterior e já tinham vindo antes dele. */
  retomaram: number | null;
  /** Estavam no anterior e não estão neste. */
  sumiram: number | null;
}

/**
 * Estreou, voltou, retomou e sumiu, encontro a encontro, DENTRO de cada grupo.
 *
 * ⚠️ A comparação é sempre com o encontro anterior **do mesmo grupo**, nunca com
 * o anterior no calendário. Duas turmas diferentes na mesma quarta não têm nada
 * a ver uma com a outra, e comparar as duas produziria uma debandada por semana.
 *
 * "Retomou" não foi pedido e sai da mesma conta. É o único dos quatro que separa
 * o grupo que perde gente do grupo que tem gente indo e voltando, e essas duas
 * coisas pedem providências opostas.
 */
export function fluxoDeEncontros(
  lista: EncontroMedido[],
  pessoasPorEncontro: Map<string, Set<string>>,
): FluxoNoEncontro[] {
  const saida: FluxoNoEncontro[] = [];
  // `Array.from` e não `for...of` no Map: o alvo de compilação do projeto não
  // aceita iterar o Map direto, e o erro só aparece no build.
  for (const [chave, grupo] of Array.from(porAtividade(lista).entries())) {
    const ordenados = [...grupo.encontros].sort((a, b) => a.data.localeCompare(b.data));
    // Quem já apareceu neste grupo antes do encontro corrente. Acumula ao andar.
    const jaVieram = new Set<string>();
    let anterior: Set<string> | null = null;
    for (const e of ordenados) {
      const atual = pessoasPorEncontro.get(e.id) ?? new Set<string>();
      const primeiro = anterior === null;
      const antes: Set<string> = anterior ?? new Set<string>();
      saida.push({
        encontroId: e.id,
        grupo: chave,
        data: e.data,
        presentes: atual.size,
        estrearam: primeiro
          ? null
          : Array.from(atual).filter((k) => !jaVieram.has(k)).length,
        voltaram: primeiro ? null : Array.from(atual).filter((k) => antes.has(k)).length,
        retomaram: primeiro
          ? null
          : Array.from(atual).filter((k) => !antes.has(k) && jaVieram.has(k)).length,
        sumiram: primeiro ? null : Array.from(antes).filter((k) => !atual.has(k)).length,
      });
      atual.forEach((k) => jaVieram.add(k));
      anterior = atual;
    }
  }
  return saida.sort((a, b) => b.data.localeCompare(a.data));
}

export interface InteracaoNoGrupo {
  grupo: string;
  nome: string;
  /** Pessoas distintas que passaram pelo grupo na janela. */
  pessoas: number;
  /** Quantas delas falaram ao menos uma vez. */
  falaram: number;
  minutosFala: number;
  /** Mediana da permanência, POR PESSOA, que é o que o pedido descreve. */
  permanenciaMedianaPct: number | null;
  permanenciaMediaPct: number | null;
  /** Quantas nunca falaram em nenhum encontro com transcrição deste grupo. */
  mudas: number;
  /** Denominador honesto: pessoas que estiveram em ao menos um encontro medido. */
  comTranscricao: number;
}

/**
 * A interação e a permanência de um grupo, medidas POR PESSOA.
 *
 * Difere de `resumir` de propósito. `resumir` agrega encontros, e responde
 * "como foram os encontros deste grupo". Esta responde "quanto as pessoas deste
 * grupo falam e quanto tempo elas ficam", que é a pergunta do pedido, e por isso
 * o denominador aqui é gente e não sessão.
 */
export function interacaoDoGrupo(
  pessoaPorGrupo: Map<string, Map<string, MetricaNoGrupo>>,
  chaveDoGrupo: string,
): InteracaoNoGrupo | null {
  const linhas: MetricaNoGrupo[] = [];
  for (const porGrupo of Array.from(pessoaPorGrupo.values())) {
    const m = porGrupo.get(chaveDoGrupo);
    if (m) linhas.push(m);
  }
  if (!linhas.length) return null;
  const permanencias = linhas.flatMap((l) => l.permanencias);
  const comTrans = linhas.filter((l) => l.comTranscricao > 0);
  return {
    grupo: chaveDoGrupo,
    nome: linhas[0].nome,
    pessoas: linhas.length,
    falaram: linhas.filter((l) => l.minutosFala > 0).length,
    minutosFala: Math.round(linhas.reduce((a, l) => a + l.minutosFala, 0) * 10) / 10,
    permanenciaMedianaPct: mediana(permanencias),
    permanenciaMediaPct: media(permanencias),
    // Muda é quem não falou em NENHUM encontro medido deste grupo. Derivado de
    // `minutosFala` e não de `caladaEm === comTranscricao`, que diz o mesmo por
    // outro caminho: um invariante a menos para manter de pé.
    mudas: comTrans.filter((l) => l.minutosFala === 0).length,
    comTranscricao: comTrans.length,
  };
}

export interface LinhaEntreGrupos extends MetricaNoGrupo {
  permanenciaMedianaPct: number | null;
  /** Minutos de fala por encontro frequentado, que é o que compara os grupos. */
  falaPorEncontroMin: number;
}

export interface ComparacaoEntreGrupos {
  chave: string;
  grupos: LinhaEntreGrupos[];
  /** Diferença entre a maior e a menor fala por encontro. Zero quando só há um grupo. */
  amplitudeFalaMin: number;
  /** Idem, em pontos de permanência mediana. */
  amplitudePermanenciaPct: number;
  /** ⭐ Fala num grupo e é muda em outro. É o sinal mais forte que a base tem hoje. */
  falaEmUmCalaEmOutro: boolean;
}

/**
 * A mesma pessoa, grupo a grupo.
 *
 * ⭐ É o pedido 1.3, e é a única família de métricas legível hoje, porque não
 * depende de série temporal. Medido em 06/08 com um encontro por grupo: 39
 * pessoas já estão em mais de um grupo, e **15 delas falam num e ficam
 * completamente mudas em outro**. Uma fala 25,1 minutos num grupo e 0,9 no
 * outro, com permanência praticamente igual nos dois.
 *
 * O que isso mede é o grupo, não a pessoa. É esse o ponto.
 */
export function pessoaEntreGrupos(
  pessoaPorGrupo: Map<string, Map<string, MetricaNoGrupo>>,
  chave: string,
): ComparacaoEntreGrupos | null {
  const porGrupo = pessoaPorGrupo.get(chave);
  if (!porGrupo) return null;
  const grupos: LinhaEntreGrupos[] = Array.from(porGrupo.values())
    .map((m) => ({
      ...m,
      permanenciaMedianaPct: mediana(m.permanencias),
      falaPorEncontroMin:
        m.comTranscricao > 0
          ? Math.round((m.minutosFala / m.comTranscricao) * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.falaPorEncontroMin - a.falaPorEncontroMin || b.encontros - a.encontros);

  // Só compara onde houve transcrição: sem ela, "não falou" e "não medimos" são
  // a mesma linha, e a amplitude viraria artefato de cobertura.
  const medidos = grupos.filter((g) => g.comTranscricao > 0);
  const falas = medidos.map((g) => g.falaPorEncontroMin);
  const perms = grupos
    .map((g) => g.permanenciaMedianaPct)
    .filter((n): n is number => n !== null);
  return {
    chave,
    grupos,
    amplitudeFalaMin:
      falas.length > 1 ? Math.round((Math.max(...falas) - Math.min(...falas)) * 100) / 100 : 0,
    amplitudePermanenciaPct:
      perms.length > 1 ? Math.round((Math.max(...perms) - Math.min(...perms)) * 10) / 10 : 0,
    falaEmUmCalaEmOutro:
      medidos.length > 1 &&
      medidos.some((g) => g.minutosFala > 0) &&
      medidos.some((g) => g.minutosFala === 0),
  };
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
