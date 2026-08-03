// Casamento entre o nome exibido no Meet e a pessoa cadastrada.
//
// A API do Meet devolve nome exibido e nunca e-mail, então esta é a peça que
// transforma "Ana Paula" em histórico individual. A regra é conservadora de
// propósito: na dúvida não casa, e o nome vai para a fila de conciliação. Um
// falso positivo aqui contamina a série histórica de duas pessoas ao mesmo
// tempo, o que é bem pior do que um clique a mais no painel.

/** Minúsculo, sem acento, sem pontuação, espaços colapsados. */
export function normalizarNome(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Partículas que não ajudam a distinguir ninguém. */
const IRRELEVANTES = new Set([
  "de", "da", "do", "das", "dos", "e", "di", "du",
  "iphone", "ipad", "galaxy", "celular", "notebook", "pc",
]);

function tokens(nomeNorm: string): string[] {
  return nomeNorm.split(" ").filter((t) => t.length > 1 && !IRRELEVANTES.has(t));
}

/**
 * Grau de parecença entre dois nomes, de 0 a 1.
 *
 * Combina cobertura de tokens com um peso maior para o primeiro nome: quem
 * escreve "Ana" no Meet e "Ana Paula Ferreira" no cadastro é a mesma pessoa
 * com muito mais frequência do que "Paula Ferreira" e "Ana Ferreira".
 */
export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;

  const setB = new Set(tb);
  const comuns = ta.filter((t) => setB.has(t)).length;
  const cobertura = comuns / Math.min(ta.length, tb.length);

  const primeiroIgual = ta[0] === tb[0] ? 0.15 : 0;
  const sobrenomeIgual =
    ta.length > 1 && tb.length > 1 && ta[ta.length - 1] === tb[tb.length - 1]
      ? 0.1
      : 0;

  return Math.min(1, cobertura * 0.75 + primeiroIgual + sobrenomeIgual);
}

export interface CandidatoAluno {
  id: string;
  full_name: string;
  nomeNorm: string;
}

export interface Sugestao {
  aluno_id: string;
  full_name: string;
  score: number;
}

/**
 * Sugestões ordenadas para um nome não reconhecido.
 *
 * `automatico` só vem verdadeiro quando há UM candidato forte e o segundo
 * colocado está claramente atrás. Empate entre homônimos nunca casa sozinho.
 */
export function sugerirAluno(
  displayName: string,
  candidatos: CandidatoAluno[]
): { sugestoes: Sugestao[]; automatico: string | null } {
  const alvo = normalizarNome(displayName);
  if (!alvo) return { sugestoes: [], automatico: null };

  const notas = candidatos
    .map((c) => ({
      aluno_id: c.id,
      full_name: c.full_name,
      score: c.nomeNorm === alvo ? 1 : similaridade(alvo, c.nomeNorm),
    }))
    .filter((s) => s.score > 0.35)
    .sort((a, b) => b.score - a.score);

  const top = notas[0];
  const segundo = notas[1];
  const automatico =
    top && top.score >= 0.92 && (!segundo || top.score - segundo.score >= 0.25)
      ? top.aluno_id
      : null;

  return { sugestoes: notas.slice(0, 5), automatico };
}

// ── Datas no fuso de quem participa ──────────────────────────
// O servidor roda em UTC. Um encontro das 21h de terça vira quarta se a data
// for extraída do ISO cru, e o quórum aparece no dia errado do calendário.

const TZ = "America/Sao_Paulo";

/** "2026-08-03" no fuso de São Paulo. */
export function dataLocal(d: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
  return partes; // en-CA já formata como YYYY-MM-DD
}

/** 0 = Segunda ... 6 = Domingo, que é a convenção de formacao_meet_presencas. */
export function diaSemanaLocal(d: Date): number {
  const nome = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    weekday: "short",
  }).format(d);
  const mapa: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  return mapa[nome] ?? 0;
}
