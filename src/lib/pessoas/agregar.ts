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

// ═══════════════════════════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════════════════════════

export interface PessoaLinha {
  id: string;
  nome: string;
  email: string | null;
  temConta: boolean;
  /** Presenças em toda a história, formulário e sala somados sem contar duas vezes. */
  presencas: number;
  /** Presenças nos últimos 90 dias. É o que define o núcleo. */
  presencas90: number;
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

export interface RetratoPessoas {
  geradoEm: string;
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
  totais: {
    pessoas: number;
    comConta: number;
    soGrupo: number;
    soPlataforma: number;
    nosDois: number;
    umaVezSo: number;
    escrevemRelato: number;
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

export async function montarRetrato(sb: SupabaseClient): Promise<RetratoPessoas> {
  const agora = Date.now();

  const [pessoas, idents, subs, profs, participacoes, encontros, aulas, sessoes] =
    await Promise.all([
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
      lerTudo<{ user_id: string; completed: boolean | null }>(
        sb, "lesson_progress", "user_id,completed", "id"),
      lerTudo<{ user_id: string; seconds: number | null }>(
        sb, "usage_sessions", "user_id,seconds", "id"),
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
  }
  const acc = new Map<string, Acc>();
  const vazio = (): Acc => ({
    presencaDias: new Set(), presencaDias90: new Set(), atividades: new Set(),
    relatosLongos: 0, aulas: 0, segundos: 0, encontrosMeet: 0, minutosMeet: 0,
    turnosFala: 0, ultimoFormulario: null, ultimoMeet: null, estreia: null,
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
    if (pid) de(pid).aulas++;
  }
  for (const u of sessoes) {
    const pid = pessoaPorPerfil.get(u.user_id);
    if (pid) de(pid).segundos += u.seconds ?? 0;
  }
  // Sobra de segurança: perfil sem identificador (não deveria existir depois da
  // 089, mas se existir a pessoa some da tela em vez de dar erro).
  void emailPorPerfil;

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
    };
  });

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

  // ── Totais dos recortes ──────────────────────────────────────
  const comGrupo = linhas.filter((l) => l.presencas > 0);
  const validas = linhas.filter((l) => l.presencas > 0 || l.temConta);

  return {
    geradoEm: new Date(agora).toISOString(),
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
    pessoas: linhas
      .filter((l) => l.presencas > 0 || l.temConta)
      .sort((a, b) => b.presencas - a.presencas || (a.diasSemAparecer ?? 9e9) - (b.diasSemAparecer ?? 9e9)),
    condutores,
    totais: {
      pessoas: validas.length,
      comConta: validas.filter((l) => l.temConta).length,
      soGrupo: validas.filter((l) => l.presencas > 0 && !l.temConta).length,
      soPlataforma: validas.filter((l) => l.presencas === 0 && l.temConta).length,
      nosDois: validas.filter((l) => l.presencas > 0 && l.temConta).length,
      umaVezSo: comGrupo.filter((l) => l.presencas === 1).length,
      escrevemRelato: validas.filter((l) => l.relatosLongos > 0).length,
    },
  };
}
