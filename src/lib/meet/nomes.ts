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

/**
 * Contas da própria instituição, que entram nos encontros mas nunca são aluno.
 *
 * A conta da associação é a dona das salas e é por ela que os condutores
 * entram. Sem isso ela apareceria toda semana na fila de conciliação, e o pior:
 * alguém acabaria ligando ela a uma pessoa, e aí a associação inteira viraria
 * um aluno com presença perfeita.
 */
const NOMES_DA_CASA = ["associacao allos", "allos", "diretoria allos", "diretoria"];

export function ehContaDaCasa(displayName: string): boolean {
  const norm = normalizarNome(displayName);
  return NOMES_DA_CASA.some((n) => norm === n || norm.startsWith(n + " "));
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
 * Distância de edição entre duas palavras.
 *
 * Existe para tolerar o que acontece de verdade em nome digitado: letra
 * trocada, letra faltando, acento que a normalização não pegou. "Gabriel" e
 * "Gabirel" são a mesma pessoa; comparação exata diria que não.
 */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length || !b.length) return Math.max(a.length, b.length);

  // Matriz inteira, e não duas linhas, porque a regra de transposição precisa
  // olhar duas linhas para trás. Trocar duas letras de lugar ("Gabirel" por
  // "Gabriel") é o erro de digitação mais comum, e a distância clássica cobra
  // dois por isso, o que basta para o nome deixar de casar.
  const m: number[][] = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + custo);

      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        m[i][j] = Math.min(m[i][j], m[i - 2][j - 2] + 1);
      }
    }
  }
  return m[a.length][b.length];
}

/** Duas palavras são a mesma, tolerando um erro a cada quatro letras. */
function mesmaPalavra(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 2) return false;
  const limite = Math.max(1, Math.floor(Math.min(a.length, b.length) / 4));
  return distancia(a, b) <= limite;
}

/**
 * Grau de parecença entre dois nomes, de 0 a 1.
 *
 * O caso comum não é nome escrito errado: é nome escrito PELA METADE. A pessoa
 * se cadastra como "Ana Paula Ferreira Lima" e entra no Meet como "Ana Paula".
 * Por isso a cobertura é medida sobre o nome mais curto, e não sobre a união.
 */
export function similaridade(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;

  const menor = ta.length <= tb.length ? ta : tb;
  const maior = ta.length <= tb.length ? tb : ta;

  const comuns = menor.filter((t) => maior.some((m) => mesmaPalavra(t, m))).length;
  const cobertura = comuns / menor.length;

  const primeiroIgual = mesmaPalavra(ta[0], tb[0]) ? 0.2 : 0;
  const sobrenomeIgual =
    ta.length > 1 && tb.length > 1 && mesmaPalavra(ta[ta.length - 1], tb[tb.length - 1])
      ? 0.15
      : 0;

  // Primeiro nome diferente é sinal forte de que são pessoas diferentes, mesmo
  // com sobrenome igual: irmãos existem, e contaminar dois históricos é pior do
  // que deixar um nome na fila.
  const penalidade = !primeiroIgual && menor.length > 1 ? 0.25 : 0;

  return Math.max(0, Math.min(1, cobertura * 0.7 + primeiroIgual + sobrenomeIgual - penalidade));
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

  // Duas condições, e a segunda importa mais que a primeira: além de parecer,
  // o primeiro colocado precisa estar sozinho na frente. Num universo com
  // "Ana Paula Silva" e "Ana Paula Souza", o nome "Ana Paula" se parece muito
  // com as duas, e casar com qualquer uma seria chute travestido de certeza.
  const folgaSuficiente = !segundo || top.score - segundo.score >= 0.12;
  const automatico = top && top.score >= 0.78 && folgaSuficiente ? top.aluno_id : null;

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
