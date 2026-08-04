// A presença medida no Meet, na forma de evento de atividade.
//
// Até aqui o dashboard e o dossiê da pessoa contavam uma história só: o que a
// pessoa DECLAROU no formulário de certificado. A captura do Meet conta a
// outra: o que ela de fato fez, minuto a minuto, na sala. Ver uma sem a outra é
// o que faz alguém parecer ausente por não ter preenchido formulário, ou
// presente por ter preenchido dois.
//
// A ponte entre as duas é o e-mail. O formulário traz o e-mail digitado pela
// própria pessoa; a participação no Meet traz nome de tela, que vira e-mail
// pelo perfil (quando há conta) ou pelo alias do certificado (migration 083).
// Com o mesmo `personEmail` dos dois lados, a timeline agrupa sozinha, sem
// precisar saber que existem duas fontes.
//
// Serve os dois consumidores de propósito: o dashboard, que quer todo mundo, e
// o dossiê, que quer uma pessoa. É a mesma leitura com um filtro a mais, e
// duplicar isso seria assinar que um dia os dois vão discordar.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimelineEvent } from "@/lib/utils/activity";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

/** Teto por leitura. A timeline avisa quando trunca; aqui só não estouramos. */
const TETO = 2000;

export interface ParticipacaoBruta {
  id: string;
  display_name: string;
  display_name_norm: string;
  aluno_id: string | null;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  eh_condutor: boolean;
  encontro: {
    id: string;
    inicio: string;
    data_reuniao: string;
    atividade_nome: string | null;
    condutor_nome: string | null;
    duracao_min: number | null;
  } | null;
}

export interface PresencaMedida {
  /** Chave: e-mail em minúsculas quando existe; senão o nome de tela normalizado. */
  chave: string;
  dia: string;
  atividade: string;
  minutos: number;
}

export interface ResultadoEventosMeet {
  eventos: TimelineEvent[];
  /** Toda presença medida, para cruzar com o que foi declarado no formulário. */
  presencas: PresencaMedida[];
  /**
   * Encontros capturados, por "atividade|dia", com quantos nomes daquele
   * encontro ainda não foram identificados.
   *
   * O contador não é enfeite: é o que separa "esta pessoa não estava lá" de
   * "esta pessoa pode estar lá sob um nome de tela que ninguém resolveu ainda".
   * Sem ele, quem entrou no Meet como "Loba" viraria uma acusação de presença
   * declarada e não cumprida.
   */
  encontrosCapturados: Map<string, { pendentes: number }>;
  truncado: boolean;
}

function diaLocal(iso: string): string {
  const d = new Date(iso);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${dia}`;
}

/** "84 min · falou 12,3 min em 18 turnos · chegou 6 min depois" */
function descrever(p: ParticipacaoBruta, tolerancia: number): string {
  const partes: string[] = [`${p.minutos_presentes} min`];

  // Vírgula decimal, porque o número aparece no meio de uma frase em português
  // e o ponto lido como separador de milhar faz "91.8%" parecer outra coisa.
  const numero = (n: number) => n.toFixed(1).replace(".", ",").replace(",0", "");

  if (p.permanencia_pct !== null) partes.push(`${numero(p.permanencia_pct)}% do encontro`);

  if (p.minutos_fala !== null) {
    partes.push(
      p.minutos_fala > 0
        ? `falou ${numero(p.minutos_fala)} min em ${p.n_turnos_fala} turnos`
        : "não falou"
    );
  }

  if (p.atraso_min !== null && p.atraso_min > tolerancia) {
    partes.push(`chegou ${p.atraso_min} min depois`);
  }

  if (p.eh_condutor) partes.push("conduziu");

  return partes.join(" · ");
}

/**
 * Presença capturada virada em evento de atividade.
 *
 * `alunoId` e `email` filtram para uma pessoa só (dossiê). Sem eles, vem tudo
 * (dashboard). Encontro descartado nunca entra: ele existe para tirar teste de
 * link das estatísticas, e deixá-lo aqui recolocaria pela porta dos fundos.
 */
export async function carregarEventosDeEncontros(
  sb: Sb,
  filtro?: { alunoId?: string | null; email?: string | null; normsExtras?: string[] }
): Promise<ResultadoEventosMeet> {
  const vazio: ResultadoEventosMeet = {
    eventos: [],
    presencas: [],
    encontrosCapturados: new Map(),
    truncado: false,
  };

  // Quais nomes de tela representam a pessoa pedida. Uma pessoa costuma ter
  // mais de um, e buscar só pelo id perderia os encontros em que ela entrou
  // sem conta.
  let norms: string[] | null = null;
  if (filtro?.email || filtro?.normsExtras?.length) {
    const conjunto = new Set(filtro?.normsExtras || []);
    if (filtro?.email) {
      const { data } = await sb
        .from("formacao_meet_aliases")
        .select("display_name_norm, pessoa_email")
        .ilike("pessoa_email", filtro.email);
      for (const a of (data || []) as { display_name_norm: string }[]) {
        conjunto.add(a.display_name_norm);
      }
    }
    norms = Array.from(conjunto);
  }

  let q = sb
    .from("formacao_meet_participacoes")
    .select(
      "id, display_name, display_name_norm, aluno_id, minutos_presentes, permanencia_pct, atraso_min, minutos_fala, n_turnos_fala, eh_condutor, encontro:formacao_meet_encontros!inner(id, inicio, data_reuniao, atividade_nome, condutor_nome, duracao_min, descartado)",
      { count: "exact" }
    )
    .eq("formacao_meet_encontros.descartado", false)
    .order("id", { ascending: false })
    .limit(TETO);

  // Para uma pessoa: ou a conta, ou qualquer uma das grafias dela. São duas
  // consultas porque o `or` do PostgREST quebra com valores que contêm vírgula,
  // e nome de tela contém vírgula com frequência ("Sandra Dias - Psicologia").
  const consultas = [];
  if (filtro?.alunoId) consultas.push(q.eq("aluno_id", filtro.alunoId));
  if (norms?.length) consultas.push(q.in("display_name_norm", norms));
  if (!consultas.length) {
    // Pedir uma pessoa e não ter por onde procurá-la devolve nada, nunca tudo.
    // A diferença é grande: a ficha de quem não tem conta nem e-mail passaria a
    // mostrar a presença do grupo inteiro como se fosse dela. "Quero todo
    // mundo" se diz não passando filtro nenhum, e só assim.
    if (filtro) return vazio;
    consultas.push(q);
  }

  const respostas = await Promise.all(consultas);

  const porId = new Map<string, ParticipacaoBruta>();
  let truncado = false;
  for (const r of respostas) {
    if (r.error) continue;
    if ((r.count ?? 0) > TETO) truncado = true;
    for (const p of (r.data || []) as unknown as ParticipacaoBruta[]) {
      porId.set(p.id, p);
    }
  }

  const participacoes = Array.from(porId.values()).filter((p) => p.encontro);
  if (!participacoes.length) return vazio;

  // ── de quem é cada nome de tela ──
  const alunoIds = Array.from(
    new Set(participacoes.map((p) => p.aluno_id).filter(Boolean) as string[])
  );
  const todosNorms = Array.from(new Set(participacoes.map((p) => p.display_name_norm)));

  const [perfisRes, aliasesRes, cronogramaRes] = await Promise.all([
    alunoIds.length
      ? sb.from("profiles").select("id, full_name, email").in("id", alunoIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string | null }[] }),
    // `*` porque as colunas de identidade nascem na migration 083 e nomeá-las
    // antes de ela rodar derrubaria a consulta inteira.
    sb.from("formacao_meet_aliases").select("*").in("display_name_norm", todosNorms),
    sb.from("formacao_cronograma").select("tolerancia_atraso_min").maybeSingle(),
  ]);

  const perfil = new Map(
    ((perfisRes.data || []) as { id: string; full_name: string; email: string | null }[]).map(
      (p) => [p.id, p]
    )
  );
  const alias = new Map(
    ((aliasesRes.data || []) as {
      display_name_norm: string;
      pessoa_nome?: string | null;
      pessoa_email?: string | null;
    }[]).map((a) => [a.display_name_norm, a])
  );
  const tolerancia =
    (cronogramaRes.data as { tolerancia_atraso_min?: number } | null)?.tolerancia_atraso_min ?? 7;

  const eventos: TimelineEvent[] = [];
  const presencas: PresencaMedida[] = [];
  const encontrosCapturados = new Map<string, { pendentes: number }>();

  for (const p of participacoes) {
    const e = p.encontro!;
    const perfilDela = p.aluno_id ? perfil.get(p.aluno_id) : undefined;
    const aliasDela = alias.get(p.display_name_norm);

    const email = (perfilDela?.email || aliasDela?.pessoa_email || "")?.toLowerCase().trim();
    const nome = perfilDela?.full_name || aliasDela?.pessoa_nome || p.display_name;
    const atividade = e.atividade_nome || "encontro";

    const dia = diaLocal(e.inicio);
    const chaveEncontro = `${atividade.toLowerCase()}|${dia}`;
    const captura = encontrosCapturados.get(chaveEncontro) || { pendentes: 0 };

    // Quem conduz não é participante para efeito de cruzamento: a conta da casa
    // e o condutor entram em todo encontro e inflariam qualquer comparação com
    // o formulário, que é coisa de aluno.
    if (!p.eh_condutor) {
      presencas.push({
        chave: email || p.display_name_norm,
        dia,
        atividade: atividade.toLowerCase(),
        minutos: p.minutos_presentes,
      });
      // Sem e-mail, esta presença não casa com nenhuma declaração, e é isso que
      // torna o silêncio da comparação ambíguo naquele encontro.
      if (!email) captura.pendentes++;
    }

    encontrosCapturados.set(chaveEncontro, captura);

    eventos.push({
      id: `meet-${p.id}`,
      type: "encontro",
      timestamp: e.inicio,
      person: nome,
      personEmail: email || undefined,
      title: atividade,
      detail: [descrever(p, tolerancia), e.condutor_nome ? `com ${e.condutor_nome}` : ""]
        .filter(Boolean)
        .join(" · "),
    });
  }

  return { eventos, presencas, encontrosCapturados, truncado };
}

/**
 * Costura o que foi declarado com o que foi medido.
 *
 * O formulário de certificado é autodeclaração: quem preenche diz que esteve,
 * e ninguém confere. Agora existe com que conferir, e o lugar certo de mostrar
 * isso é a própria linha do feedback — não um relatório à parte, que ninguém
 * abre.
 *
 * A ausência só é afirmada quando o encontro daquela atividade FOI capturado
 * naquele dia. Sem essa guarda, todo grupo fora das salas monitoradas viraria
 * uma fileira de acusações falsas.
 */
export function anotarPresencaMedida(
  eventos: TimelineEvent[],
  medido: {
    presencas: PresencaMedida[];
    encontrosCapturados: Map<string, { pendentes: number }>;
  }
): TimelineEvent[] {
  if (!medido.presencas.length) return eventos;

  const porChave = new Map<string, number>();
  for (const p of medido.presencas) {
    const k = `${p.chave}|${p.atividade}|${p.dia}`;
    porChave.set(k, Math.max(porChave.get(k) || 0, p.minutos));
  }

  return eventos.map((ev) => {
    if (ev.type !== "feedback") return ev;

    const dia = diaLocal(ev.timestamp);
    const atividade = ev.title.toLowerCase();
    const chave = (ev.personEmail || ev.person).toLowerCase().trim();

    const minutos = porChave.get(`${chave}|${atividade}|${dia}`);
    if (minutos !== undefined) {
      return {
        ...ev,
        detail: [ev.detail, `presença medida: ${minutos} min`].filter(Boolean).join(" · "),
      };
    }

    const captura = medido.encontrosCapturados.get(`${atividade}|${dia}`);
    if (!captura) return ev;

    // Aqui mora a diferença entre uma informação e uma acusação. Enquanto
    // houver nome de tela sem dono naquele encontro, a pessoa pode estar na
    // sala sob um apelido que ninguém resolveu, e afirmar ausência seria
    // inventar. Só quando o encontro inteiro está identificado a frase pode
    // dizer que ela não estava.
    return {
      ...ev,
      detail: [
        ev.detail,
        captura.pendentes > 0
          ? `sem presença medida (${captura.pendentes} ${captura.pendentes === 1 ? "nome" : "nomes"} desse encontro ainda por identificar)`
          : "declarou, mas não esteve no encontro",
      ]
        .filter(Boolean)
        .join(" · "),
    };
  });
}
