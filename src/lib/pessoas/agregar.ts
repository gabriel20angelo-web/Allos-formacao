// Uma pessoa, os três lugares onde ela aparece.
//
// A mesma pessoa existe hoje em três tabelas que não se conheciam: o formulário
// de certificado (nome e e-mail que ela digita), a sala do Meet (nome de tela do
// Google) e a plataforma (`profiles`). A migration 089 criou `pessoas` e
// `pessoa_identificadores` para dizer que os três são a mesma gente; este
// arquivo é quem finalmente lê isso e monta o retrato.
//
// Roda no servidor, com service role, por dois motivos. Primeiro, o volume: são
// cerca de 1 MB de linhas cruas para cruzar, e mandar isso para o navegador do
// admin a cada abertura de tela é desperdício. Segundo, e mais importante, o
// PostgREST desta instância corta em mil linhas EM SILÊNCIO, então qualquer
// leitura precisa paginar de propósito; fazer isso no cliente é convidar a
// tela a mentir para menos sem avisar ninguém.
//
// A palavra "presença" aqui vale para os dois lados: formulário enviado E nome
// capturado na sala. Se acontecem no mesmo dia, contam uma. Isso importa porque
// o formulário registra só metade de quem esteve na sala, e essa metade não é
// sorteada: das 14 pessoas que estiveram nos dois encontros capturados, cinco
// preencheram os dois formulários e cinco não preencheram nenhum, quando o
// acaso previa sete preenchendo exatamente um. Preencher é hábito de pessoa,
// não sorte do dia. Contar só formulário, portanto, não é ver metade de todo
// mundo: é ver todo mundo de metade das pessoas, e nunca enxergar a outra.

import type { SupabaseClient } from "@supabase/supabase-js";
import { getRangeStart, type ActivityRange } from "@/lib/utils/activity";

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

/** O que o processo seletivo sabe sobre esta pessoa. */
export interface SeletivoDaPessoa {
  /** Status da tentativa mais recente, como veio do AvaliAllos. */
  status: string | null;
  /** `true` quando alguma tentativa saiu como aprovada. */
  aprovado: boolean;
  /** Melhor nota entre as tentativas, na escala de 0 a 100. */
  nota: number | null;
  tentativas: number;
  ultimaEm: string | null;
}

export interface PessoaLinha {
  id: string;
  nome: string;
  email: string | null;
  temConta: boolean;
  /** Presenças em toda a história, formulário e sala somados sem contar duas vezes. */
  presencas: number;
  /** Presenças nos últimos 90 dias. É o que define o núcleo. */
  presencas90: number;
  /**
   * Presenças dentro da janela escolhida no seletor. Igual a `presencas`
   * quando a janela é "tudo".
   */
  presencasJanela: number;
  atividades: number;
  /** Relatos com mais de 200 caracteres: o sinal barato de quem topa conversar. */
  relatosLongos: number;
  aulas: number;
  horasPlataforma: number;
  encontrosMeet: number;
  minutosMeet: number;
  turnosFala: number;
  /** Dias desde o último sinal de qualquer tipo. `null` = nunca deu sinal. */
  diasSemAparecer: number | null;
  ultimoFormulario: string | null;
  ultimoMeet: string | null;
  estreia: string | null;
  /** `null` quando a pessoa nunca fez o processo seletivo. */
  seletivo: SeletivoDaPessoa | null;
}

export interface CondutorLinha {
  nome: string;
  encontros: number;
  avaliacoes: number;
  notaMedia: number | null;
  relatos: { texto: string; data: string }[];
  encontrosMeet: number;
  falaPct: number | null;
}

/** O que o processo seletivo mostra sobre o conjunto, não sobre uma pessoa. */
export interface RetratoSeletivo {
  /** Quantas candidaturas existem no banco. Zero antes da primeira importação. */
  candidatos: number;
  aprovados: number;
  rejeitados: number;
  semStatus: number;
  /** Nota de corte observada: a menor nota entre os aprovados. */
  corte: number | null;
  /** Quantos candidatos o banco reconheceu como pessoa já conhecida. */
  jaEramPessoa: number;
  /**
   * Aprovados que depois apareceram em algum grupo. São poucos por natureza,
   * então vêm com nome: contar dois numa base de 33 e escrever "6%" seria
   * inventar precisão.
   */
  aprovadosQueVieram: PessoaLinha[];
  /** Aprovados sem nenhuma presença. É a fila de convite. */
  aprovadosQueNaoVieram: PessoaLinha[];
  /** Reprovados que apareceram assim mesmo. A formação é aberta, então acontece. */
  rejeitadosQueVieram: PessoaLinha[];
}

/**
 * O movimento dentro da janela. É o que o dashboard mostrava numa faixa de seis
 * números, três dos quais ignoravam o próprio seletor ao lado deles.
 */
export interface FluxoNaJanela {
  presencas: number;
  pessoas: number;
  /** Presenças divididas por pessoas. Média, com a mediana ao lado na tela. */
  vezesPorPessoa: number | null;
  /** Mediana de presenças por pessoa: com 62% vindo uma vez, ela costuma ser 1. */
  medianaVezes: number;
  /** Pessoas cuja primeira presença de todas caiu dentro da janela. */
  estreantes: number;
}

export interface RetratoPessoas {
  geradoEm: string;
  /** A janela que o servidor de fato aplicou, ecoada para a tela conferir. */
  janela: ActivityRange;
  fluxo: FluxoNaJanela;
  cobertura: {
    encontrosCapturados: number;
    presencasMedidas: number;
    formulariosNoMesmoDia: number;
    pct: number | null;
  };
  nucleo: {
    total: number;
    serie: { rotulo: string; valor: number }[];
    quentes: number;
    esfriando: number;
    frios: number;
    aproximacao: number;
  };
  sumidos: { semSinal: PessoaLinha[]; soFormulario: PessoaLinha[] };
  coortes: { mes: string; rotulo: string; estreantes: number; voltaram: number }[];
  pessoas: PessoaLinha[];
  condutores: CondutorLinha[];
  seletivo: RetratoSeletivo;
  totais: {
    pessoas: number;
    comConta: number;
    soGrupo: number;
    soPlataforma: number;
    nosDois: number;
    umaVezSo: number;
    escrevemRelato: number;
    doSeletivo: number;
    /** Quantas pessoas a base conhece, ignorando a janela. Denominador honesto. */
    pessoasNaBase: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Leitura paginada
// ═══════════════════════════════════════════════════════════════

/**
 * Lê a tabela inteira, de mil em mil.
 *
 * O `range` é obrigatório: sem ele o PostgREST devolve as primeiras mil linhas
 * e não avisa que cortou, e a tela passa a mostrar números menores do que a
 * verdade sem nenhum sintoma. O teto de 50 páginas existe para que um erro de
 * filtro não vire uma varredura infinita.
 */
async function lerTudo<T>(
  sb: SupabaseClient,
  tabela: string,
  colunas: string,
  ordenarPor: string,
): Promise<T[]> {
  const PAGINA = 1000;
  const TETO = 50;
  const out: T[] = [];
  for (let p = 0; p < TETO; p++) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .order(ordenarPor, { ascending: true })
      .range(p * PAGINA, p * PAGINA + PAGINA - 1);
    if (error) throw new Error(`${tabela}: ${error.message}`);
    const lote = (data ?? []) as T[];
    out.push(...lote);
    if (lote.length < PAGINA) break;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════
// Auxiliares
// ═══════════════════════════════════════════════════════════════

const DIA = 86_400_000;
const norm = (s: string | null | undefined) => (s ?? "").trim().toLowerCase();
const dia = (iso: string) => iso.slice(0, 10);

const MESES_PT = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

// ═══════════════════════════════════════════════════════════════
// O retrato
// ═══════════════════════════════════════════════════════════════

/**
 * Monta o retrato.
 *
 * A janela vale para o que é fluxo (quem apareceu, quem foi avaliado, quem se
 * candidatou) e NÃO vale para o que é definição. Núcleo é cinco presenças em
 * noventa dias porque essa é a definição do núcleo, não porque noventa é o
 * valor de um seletor; sumiço é quarenta e cinco dias pelo mesmo motivo; coorte
 * é por mês de estreia. Se esses três seguissem o seletor, escolher "hoje"
 * devolveria um núcleo de zero pessoas, medido no banco, e a tela estaria
 * dizendo que a formação acabou.
 *
 * Os recortes que falam do histórico da pessoa (veio uma vez só, escreve
 * relato, está nos dois mundos) continuam olhando a vida inteira dela. A janela
 * decide QUEM entra na lista, não o que se sabe de quem entrou. Assim "vieram
 * uma vez só" dentro de trinta dias lê como "estreantes do mês que não
 * voltaram", que é a pergunta útil, e não como "todo mundo que apareceu".
 */
export async function montarRetrato(
  sb: SupabaseClient,
  opcoes: { janela?: ActivityRange } = {},
): Promise<RetratoPessoas> {
  const agora = Date.now();
  const janela = opcoes.janela ?? "all";
  const inicioJanela = getRangeStart(janela, new Date(agora))?.getTime() ?? null;
  const naJanela = (t: number | null | undefined) =>
    t != null && (inicioJanela === null || t >= inicioJanela);

  const [
    pessoas, idents, subs, profs, participacoes, encontros, aulas, sessoes,
    candidaturas, tentativas,
  ] = await Promise.all([
      lerTudo<{ id: string; nome_canonico: string }>(
        sb, "pessoas", "id,nome_canonico", "id"),
      lerTudo<{ pessoa_id: string; tipo: string; valor: string }>(
        sb, "pessoa_identificadores", "pessoa_id,tipo,valor", "id"),
      lerTudo<{
        email: string | null; atividade_nome: string | null; created_at: string;
        relato: string | null; condutores: string[] | null; nota_condutor: number | null;
      }>(sb, "certificado_submissions",
        "email,atividade_nome,created_at,relato,condutores,nota_condutor", "id"),
      lerTudo<{ id: string; email: string | null }>(
        sb, "profiles", "id,email", "id"),
      lerTudo<{
        encontro_id: string; aluno_id: string | null; display_name_norm: string | null;
        minutos_presentes: number | null; n_turnos_fala: number | null; eh_condutor: boolean;
      }>(sb, "formacao_meet_participacoes",
        "encontro_id,aluno_id,display_name_norm,minutos_presentes,n_turnos_fala,eh_condutor", "id"),
      lerTudo<{
        id: string; data_reuniao: string | null; atividade_nome: string | null;
        condutor_nome: string | null; descartado: boolean | null; fala_condutor_pct: number | null;
      }>(sb, "formacao_meet_encontros",
        "id,data_reuniao,atividade_nome,condutor_nome,descartado,fala_condutor_pct", "id"),
      lerTudo<{ user_id: string; completed: boolean | null; completed_at: string | null }>(
        sb, "lesson_progress", "user_id,completed,completed_at", "id"),
      lerTudo<{ user_id: string; seconds: number | null; created_at: string | null }>(
        sb, "usage_sessions", "user_id,seconds,created_at", "id"),
      // O seletivo pode não ter sido importado ainda, e nesse caso as duas
      // tabelas voltam vazias. Vazio aqui é estado normal, não erro: a tela
      // trata isso mostrando o convite para soltar o CSV.
      lerTudo<{ id: string; pessoa_id: string | null; nome: string; email: string | null }>(
        sb, "seletivo_candidaturas", "id,pessoa_id,nome,email", "id"),
      lerTudo<{
        candidatura_id: string; nota: number | null; status: string | null;
        realizada_em: string | null;
      }>(sb, "seletivo_tentativas", "candidatura_id,nota,status,realizada_em", "id"),
    ]);

  // ── Índices de identidade ────────────────────────────────────
  // Tudo converge para `pessoa_id`. Quem não estiver ligado a uma pessoa não
  // entra: é dado órfão, e inventar uma pessoa aqui só para não perder a linha
  // seria recriar pelo lado de dentro o problema que a 089 resolveu.
  const pessoaPorEmail = new Map<string, string>();
  const pessoaPorPerfil = new Map<string, string>();
  const pessoaPorNomeMeet = new Map<string, string>();
  const temConta = new Set<string>();

  for (const i of idents) {
    if (i.tipo === "email") pessoaPorEmail.set(i.valor, i.pessoa_id);
    else if (i.tipo === "profile_id") {
      pessoaPorPerfil.set(i.valor, i.pessoa_id);
      temConta.add(i.pessoa_id);
    } else if (i.tipo === "nome_exibicao") pessoaPorNomeMeet.set(i.valor, i.pessoa_id);
  }

  const emailPorPerfil = new Map(profs.map((p) => [p.id, norm(p.email)]));

  // ── Acumulador ───────────────────────────────────────────────
  interface Acc {
    presencaDias: Set<string>;
    presencaDias90: Set<string>;
    presencaDiasJanela: Set<string>;
    atividades: Set<string>;
    relatosLongos: number;
    aulas: number;
    segundos: number;
    encontrosMeet: number;
    minutosMeet: number;
    turnosFala: number;
    ultimoFormulario: number | null;
    ultimoMeet: number | null;
    estreia: number | null;
    /**
     * Deu qualquer sinal dentro da janela, inclusive sinal de plataforma.
     * Sem isso, quem só assiste aula sumiria da lista em toda janela que não
     * fosse "tudo", e o recorte "só na plataforma" ficaria permanentemente
     * vazio justamente onde ele deveria aparecer.
     */
    sinalNaJanela: boolean;
  }
  const acc = new Map<string, Acc>();
  const vazio = (): Acc => ({
    presencaDias: new Set(), presencaDias90: new Set(), presencaDiasJanela: new Set(),
    atividades: new Set(),
    relatosLongos: 0, aulas: 0, segundos: 0, encontrosMeet: 0, minutosMeet: 0,
    turnosFala: 0, ultimoFormulario: null, ultimoMeet: null, estreia: null,
    sinalNaJanela: false,
  });
  const de = (id: string) => {
    let a = acc.get(id);
    if (!a) { a = vazio(); acc.set(id, a); }
    return a;
  };

  // ── Formulário de certificado ────────────────────────────────
  const emailPresencaDia = new Set<string>();
  for (const s of subs) {
    const pid = pessoaPorEmail.get(norm(s.email));
    if (!pid) continue;
    const a = de(pid);
    const t = new Date(s.created_at).getTime();
    const d = dia(s.created_at);
    // A chave inclui a atividade: a mesma pessoa em dois grupos no mesmo dia são
    // duas presenças, e duas linhas do mesmo grupo no mesmo dia são uma só
    // (existem 20 dessas na base, de reenvio do formulário).
    a.presencaDias.add(`${d}|${norm(s.atividade_nome)}`);
    if (agora - t <= 90 * DIA) a.presencaDias90.add(`${d}|${norm(s.atividade_nome)}`);
    if (naJanela(t)) {
      a.presencaDiasJanela.add(`${d}|${norm(s.atividade_nome)}`);
      a.sinalNaJanela = true;
    }
    if (s.atividade_nome) a.atividades.add(s.atividade_nome);
    if ((s.relato ?? "").trim().length > 200) a.relatosLongos++;
    if (!a.ultimoFormulario || t > a.ultimoFormulario) a.ultimoFormulario = t;
    if (!a.estreia || t < a.estreia) a.estreia = t;
    emailPresencaDia.add(`${pid}|${d}`);
  }

  // ── Sala do Meet ─────────────────────────────────────────────
  const encontroPorId = new Map(encontros.map((e) => [e.id, e]));
  let presencasMedidas = 0;
  let formulariosNoMesmoDia = 0;

  for (const p of participacoes) {
    const enc = encontroPorId.get(p.encontro_id);
    if (!enc || enc.descartado || p.eh_condutor) continue;
    const pid =
      (p.aluno_id ? pessoaPorPerfil.get(p.aluno_id) : undefined) ??
      (p.display_name_norm ? pessoaPorNomeMeet.get(p.display_name_norm) : undefined);
    presencasMedidas++;
    if (!pid) continue;

    const a = de(pid);
    const d = enc.data_reuniao ? dia(enc.data_reuniao) : null;
    if (d) {
      const t = new Date(d).getTime();
      a.presencaDias.add(`${d}|${norm(enc.atividade_nome)}`);
      if (agora - t <= 90 * DIA) a.presencaDias90.add(`${d}|${norm(enc.atividade_nome)}`);
      if (naJanela(t)) {
        a.presencaDiasJanela.add(`${d}|${norm(enc.atividade_nome)}`);
        a.sinalNaJanela = true;
      }
      if (!a.ultimoMeet || t > a.ultimoMeet) a.ultimoMeet = t;
      if (!a.estreia || t < a.estreia) a.estreia = t;
      if (emailPresencaDia.has(`${pid}|${d}`)) formulariosNoMesmoDia++;
    }
    if (enc.atividade_nome) a.atividades.add(enc.atividade_nome);
    a.encontrosMeet++;
    a.minutosMeet += p.minutos_presentes ?? 0;
    a.turnosFala += p.n_turnos_fala ?? 0;
  }

  // ── Plataforma ───────────────────────────────────────────────
  for (const l of aulas) {
    if (!l.completed) continue;
    const pid = pessoaPorPerfil.get(l.user_id);
    if (!pid) continue;
    const a = de(pid);
    a.aulas++;
    // Aula concluída conta como sinal, mas nunca como presença: presença é
    // encontro com outras pessoas, e assistir vídeo sozinho não é isso. A
    // diferença importa porque o núcleo se define por presença.
    if (l.completed_at && naJanela(new Date(l.completed_at).getTime())) a.sinalNaJanela = true;
  }
  for (const u of sessoes) {
    const pid = pessoaPorPerfil.get(u.user_id);
    if (!pid) continue;
    const a = de(pid);
    a.segundos += u.seconds ?? 0;
    if (u.created_at && naJanela(new Date(u.created_at).getTime())) a.sinalNaJanela = true;
  }
  // Sobra de segurança: perfil sem identificador (não deveria existir depois da
  // 089, mas se existir a pessoa some da tela em vez de dar erro).
  void emailPorPerfil;

  // ── Processo seletivo ────────────────────────────────────────
  // O status vem do AvaliAllos e não é normalizado lá, então a comparação é
  // frouxa de propósito: hoje o arquivo escreve "Ativo" e "Rejeitado", e um dia
  // vai escrever outra coisa. O que não pode acontecer é uma mudança de rótulo
  // transformar aprovado em reprovado em silêncio, então tudo que não for
  // reconhecido como aprovado fica em `semStatus` e aparece separado na tela.
  const APROVADO = new Set(["ativo", "aprovado", "aprovada", "selecionado", "selecionada"]);
  const REPROVADO = new Set(["rejeitado", "rejeitada", "reprovado", "reprovada", "recusado"]);

  const tentPorCand = new Map<string, typeof tentativas>();
  for (const t of tentativas) {
    const arr = tentPorCand.get(t.candidatura_id) ?? [];
    arr.push(t);
    tentPorCand.set(t.candidatura_id, arr);
  }

  // O seletivo NÃO segue a janela. Ele é um evento com data própria, e não um
  // fluxo: filtrar "aprovados" por trinta dias esconderia justamente as pessoas
  // aprovadas há mais tempo que nunca vieram, que são as que interessam.
  const seletivoPorPessoa = new Map<string, SeletivoDaPessoa>();
  let jaEramPessoa = 0;
  for (const c of candidaturas) {
    const ts = (tentPorCand.get(c.id) ?? [])
      .slice()
      .sort((x, y) => (x.realizada_em ?? "").localeCompare(y.realizada_em ?? ""));
    const ultima = ts.at(-1) ?? null;
    const notas = ts.map((t) => t.nota).filter((n): n is number => n != null);
    const aprovado = ts.some((t) => APROVADO.has(norm(t.status)));
    const dado: SeletivoDaPessoa = {
      status: ultima?.status ?? null,
      aprovado,
      nota: notas.length ? Math.max(...notas) : null,
      tentativas: ts.length,
      ultimaEm: ultima?.realizada_em ?? null,
    };
    if (c.pessoa_id) {
      jaEramPessoa++;
      // Uma pessoa pode ter duas candidaturas se o e-mail e o WhatsApp dela
      // caíram em linhas diferentes do arquivo. Fica a melhor: aprovado vence
      // reprovado, e entre iguais vence a nota maior.
      const antes = seletivoPorPessoa.get(c.pessoa_id);
      const melhor =
        !antes ||
        (dado.aprovado && !antes.aprovado) ||
        (dado.aprovado === antes.aprovado && (dado.nota ?? -1) > (antes.nota ?? -1));
      if (melhor) {
        seletivoPorPessoa.set(c.pessoa_id, {
          ...dado,
          tentativas: (antes?.tentativas ?? 0) + dado.tentativas,
        });
      } else if (antes) {
        antes.tentativas += dado.tentativas;
      }
    }
  }

  // ── Linhas ───────────────────────────────────────────────────
  const linhas: PessoaLinha[] = pessoas.map((p) => {
    const a = acc.get(p.id) ?? vazio();
    const ultimoSinal = Math.max(a.ultimoFormulario ?? 0, a.ultimoMeet ?? 0);
    return {
      id: p.id,
      nome: p.nome_canonico,
      email: null as string | null,
      temConta: temConta.has(p.id),
      presencas: a.presencaDias.size,
      presencas90: a.presencaDias90.size,
      presencasJanela: a.presencaDiasJanela.size,
      atividades: a.atividades.size,
      relatosLongos: a.relatosLongos,
      aulas: a.aulas,
      horasPlataforma: Math.round((a.segundos / 3600) * 10) / 10,
      encontrosMeet: a.encontrosMeet,
      minutosMeet: Math.round(a.minutosMeet),
      turnosFala: a.turnosFala,
      diasSemAparecer: ultimoSinal ? Math.floor((agora - ultimoSinal) / DIA) : null,
      ultimoFormulario: a.ultimoFormulario ? new Date(a.ultimoFormulario).toISOString() : null,
      ultimoMeet: a.ultimoMeet ? new Date(a.ultimoMeet).toISOString() : null,
      estreia: a.estreia ? new Date(a.estreia).toISOString() : null,
      seletivo: seletivoPorPessoa.get(p.id) ?? null,
    };
  });

  /** Deu algum sinal dentro da janela escolhida. Com "tudo", todo mundo dá. */
  const dentroDaJanela = (l: PessoaLinha) =>
    inicioJanela === null || (acc.get(l.id)?.sinalNaJanela ?? false);

  // O e-mail entra por mapa invertido, não por varredura dentro do map acima:
  // com 511 pessoas a busca linear seria irrelevante, mas ela é O(n²) e vira
  // problema silencioso quando a base crescer.
  const emailPorPessoa = new Map<string, string>();
  Array.from(pessoaPorEmail.entries()).forEach(([email, pid]) => {
    if (!emailPorPessoa.has(pid)) emailPorPessoa.set(pid, email);
  });
  for (const l of linhas) l.email = emailPorPessoa.get(l.id) ?? null;

  // ── Núcleo ───────────────────────────────────────────────────
  const nucleo = linhas.filter((l) => l.presencas90 >= 5);
  const frios = nucleo.filter((l) => (l.diasSemAparecer ?? 0) >= 45);
  const esfriando = nucleo.filter(
    (l) => (l.diasSemAparecer ?? 0) >= 21 && (l.diasSemAparecer ?? 0) < 45);

  // A série é recalculada para trás: em cada quinzena, quem tinha 5 presenças
  // nos 90 dias anteriores àquela data. Sem isso a linha do tempo seria o mesmo
  // número repetido sete vezes.
  const presencasPorPessoa = new Map<string, number[]>();
  for (const s of subs) {
    const pid = pessoaPorEmail.get(norm(s.email));
    if (!pid) continue;
    const arr = presencasPorPessoa.get(pid) ?? [];
    arr.push(new Date(s.created_at).getTime());
    presencasPorPessoa.set(pid, arr);
  }
  const serie: { rotulo: string; valor: number }[] = [];
  for (let q = 6; q >= 0; q--) {
    const ref = agora - q * 15 * DIA;
    const ini = ref - 90 * DIA;
    let n = 0;
    presencasPorPessoa.forEach((ts) => {
      if (ts.filter((t) => t > ini && t <= ref).length >= 5) n++;
    });
    const d = new Date(ref);
    serie.push({ rotulo: `${d.getDate()}/${MESES_PT[d.getMonth()]}`, valor: n });
  }

  // ── Sumidos ──────────────────────────────────────────────────
  // A separação entre os dois grupos é a peça mais importante da tela: quem
  // parou de preencher mas continua aparecendo na sala não sumiu, e cobrar
  // ausência de quem estava lá é o jeito mais rápido de queimar o vínculo.
  const sumidos = linhas
    .filter((l) => l.presencas >= 5 && (l.diasSemAparecer ?? 0) >= 45)
    .sort((a, b) => b.presencas - a.presencas);
  const recente = (iso: string | null) => !!iso && agora - new Date(iso).getTime() < 45 * DIA;

  // ── Coortes ──────────────────────────────────────────────────
  const coortes: RetratoPessoas["coortes"] = [];
  const porMes = new Map<string, { estreantes: number; voltaram: number }>();
  for (const l of linhas) {
    if (!l.estreia || l.presencas === 0) continue;
    const e = new Date(l.estreia);
    // O mês corrente fica de fora: quem estreou anteontem ainda não teve tempo
    // de voltar, e incluí-lo derruba a taxa sem que nada tenha acontecido.
    if (e.getFullYear() === new Date(agora).getFullYear() && e.getMonth() === new Date(agora).getMonth()) continue;
    const k = `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}`;
    const c = porMes.get(k) ?? { estreantes: 0, voltaram: 0 };
    c.estreantes++;
    if (l.presencas >= 2) c.voltaram++;
    porMes.set(k, c);
  }
  Array.from(porMes.entries()).sort().forEach(([k, v]) => {
    const [ano, mes] = k.split("-");
    coortes.push({ mes: k, rotulo: `${MESES_PT[+mes - 1]}/${ano.slice(2)}`, ...v });
  });

  // ── Condutores ───────────────────────────────────────────────
  // A nota só entra quando havia condutor a avaliar. O formulário público grava
  // 5 fixo quando a atividade é evento sem condutor, e são 66 linhas assim: sem
  // esse filtro a média de todo mundo cai 0,67 ponto por causa de uma pergunta
  // que nunca foi feita.
  const cond = new Map<string, { soma: number; n: number; relatos: { texto: string; data: string }[] }>();
  for (const s of subs) {
    if (!naJanela(new Date(s.created_at).getTime())) continue;
    const nomes = (s.condutores ?? []).filter(Boolean);
    if (nomes.length === 0) continue;
    for (const c of nomes) {
      const e = cond.get(c) ?? { soma: 0, n: 0, relatos: [] };
      e.soma += s.nota_condutor ?? 0;
      e.n++;
      const r = (s.relato ?? "").trim();
      if (r.length > 60) e.relatos.push({ texto: r, data: s.created_at });
      cond.set(c, e);
    }
  }
  const meetPorCondutor = new Map<string, { n: number; fala: number[] }>();
  for (const e of encontros) {
    if (e.descartado || !e.condutor_nome) continue;
    if (e.data_reuniao && !naJanela(new Date(dia(e.data_reuniao)).getTime())) continue;
    const m = meetPorCondutor.get(e.condutor_nome) ?? { n: 0, fala: [] };
    m.n++;
    // Zero aqui não quer dizer que o condutor ficou calado, quer dizer que a
    // ingestão não reconheceu ninguém como condutor naquele encontro e gravou
    // zero em vez de nulo (`ingest.ts`, na guarda que testa se ALGUÉM falou em
    // vez de testar se o condutor foi identificado). Enquanto isso não for
    // corrigido na origem, incluir esses zeros puxaria a média para baixo e
    // faria um problema de casamento de nome parecer um traço da pessoa.
    if (e.fala_condutor_pct != null && e.fala_condutor_pct > 0) {
      m.fala.push(e.fala_condutor_pct);
    }
    meetPorCondutor.set(e.condutor_nome, m);
  }
  const condutores: CondutorLinha[] = Array.from(cond.entries())
    .map(([nome, d]) => {
      const m = meetPorCondutor.get(nome);
      return {
        nome,
        encontros: d.n,
        avaliacoes: d.n,
        notaMedia: d.n > 0 ? Math.round((d.soma / d.n) * 10) / 10 : null,
        relatos: d.relatos
          .sort((x: { data: string }, y: { data: string }) => y.data.localeCompare(x.data))
          .slice(0, 12),
        encontrosMeet: m?.n ?? 0,
        falaPct: m && m.fala.length
          ? Math.round((m.fala.reduce((s, x) => s + x, 0) / m.fala.length) * 10) / 10
          : null,
      };
    })
    .sort((a, b) => b.encontros - a.encontros);

  // ── O retrato do seletivo ────────────────────────────────────
  // Quem foi aprovado e ainda não veio é a fila de convite mais óbvia que a
  // formação tem, e até hoje ela não existia em lugar nenhum: o resultado do
  // seletivo morria no AvaliAllos e a presença morria no formulário.
  const doSeletivo = linhas.filter((l) => l.seletivo != null);
  const aprovados = doSeletivo.filter((l) => l.seletivo!.aprovado);
  const rejeitados = doSeletivo.filter(
    (l) => !l.seletivo!.aprovado && REPROVADO.has(norm(l.seletivo!.status)),
  );
  const notasAprovados = aprovados
    .map((l) => l.seletivo!.nota)
    .filter((n): n is number => n != null);
  const porPresenca = (a: PessoaLinha, b: PessoaLinha) =>
    b.presencas - a.presencas || (b.seletivo?.nota ?? 0) - (a.seletivo?.nota ?? 0);

  const seletivo: RetratoSeletivo = {
    candidatos: candidaturas.length,
    aprovados: aprovados.length,
    rejeitados: rejeitados.length,
    semStatus: doSeletivo.length - aprovados.length - rejeitados.length,
    corte: notasAprovados.length ? Math.min(...notasAprovados) : null,
    jaEramPessoa,
    aprovadosQueVieram: aprovados.filter((l) => l.presencas > 0).sort(porPresenca),
    aprovadosQueNaoVieram: aprovados
      .filter((l) => l.presencas === 0)
      .sort((a, b) => (b.seletivo?.nota ?? 0) - (a.seletivo?.nota ?? 0)),
    rejeitadosQueVieram: rejeitados.filter((l) => l.presencas > 0).sort(porPresenca),
  };

  // ── Totais dos recortes ──────────────────────────────────────
  // A janela decide quem entra na lista; os recortes continuam lendo a vida
  // inteira de quem entrou. Ver o comentário da assinatura da função.
  const naBase = linhas.filter((l) => l.presencas > 0 || l.temConta);
  const validas = naBase.filter(dentroDaJanela);
  const comGrupo = validas.filter((l) => l.presencas > 0);

  // ── O movimento da janela ────────────────────────────────────
  // A média de vezes por pessoa vem acompanhada da mediana porque as duas
  // discordam muito aqui: com 62% da base vindo uma única vez, a média fica
  // perto de 2 e a mediana é 1. Publicar só a média descreveria uma formação
  // que não existe.
  const presentesNaJanela = validas.filter((l) => l.presencasJanela > 0);
  const presencasNaJanela = presentesNaJanela.reduce((s, l) => s + l.presencasJanela, 0);
  const vezes = presentesNaJanela.map((l) => l.presencasJanela).sort((a, b) => a - b);
  const fluxo: FluxoNaJanela = {
    presencas: presencasNaJanela,
    pessoas: presentesNaJanela.length,
    vezesPorPessoa: presentesNaJanela.length
      ? Math.round((presencasNaJanela / presentesNaJanela.length) * 10) / 10
      : null,
    medianaVezes: vezes.length ? vezes[Math.floor(vezes.length / 2)] : 0,
    estreantes: validas.filter((l) => l.estreia && naJanela(new Date(l.estreia).getTime())).length,
  };

  return {
    geradoEm: new Date(agora).toISOString(),
    janela,
    fluxo,
    cobertura: {
      encontrosCapturados: encontros.filter((e) => !e.descartado).length,
      presencasMedidas,
      formulariosNoMesmoDia,
      pct: presencasMedidas > 0
        ? Math.round((formulariosNoMesmoDia / presencasMedidas) * 100)
        : null,
    },
    nucleo: {
      total: nucleo.length,
      serie,
      quentes: nucleo.length - esfriando.length - frios.length,
      esfriando: esfriando.length,
      frios: frios.length,
      aproximacao: linhas.filter((l) => l.presencas90 === 3 || l.presencas90 === 4).length,
    },
    sumidos: {
      semSinal: sumidos.filter((l) => !recente(l.ultimoMeet)),
      soFormulario: sumidos.filter((l) => recente(l.ultimoMeet)),
    },
    coortes,
    pessoas: validas
      .slice()
      .sort((a, b) => b.presencas - a.presencas || (a.diasSemAparecer ?? 9e9) - (b.diasSemAparecer ?? 9e9)),
    condutores,
    seletivo,
    totais: {
      pessoas: validas.length,
      comConta: validas.filter((l) => l.temConta).length,
      soGrupo: validas.filter((l) => l.presencas > 0 && !l.temConta).length,
      soPlataforma: validas.filter((l) => l.presencas === 0 && l.temConta).length,
      nosDois: validas.filter((l) => l.presencas > 0 && l.temConta).length,
      umaVezSo: comGrupo.filter((l) => l.presencas === 1).length,
      escrevemRelato: validas.filter((l) => l.relatosLongos > 0).length,
      doSeletivo: validas.filter((l) => l.seletivo != null).length,
      pessoasNaBase: naBase.length,
    },
  };
}
