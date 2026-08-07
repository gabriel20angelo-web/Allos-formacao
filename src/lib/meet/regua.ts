/**
 * Quando um número pode ser lido, e por quê.
 *
 * Antes deste arquivo havia sete limiares espalhados pelo painel, cada um
 * escrito onde deu, dois deles duplicados com valores diferentes: 4 encontros
 * em `quorum.ts`, 5 notas em `PainelCondutores.tsx` e outra vez em
 * `grupos/[id]/page.tsx`, 3 encontros e 21 dias em `sala/route.ts`, 21 dias de
 * novo à mão em `grupos/[id]/page.tsx` ignorando o `DIAS_ESFRIANDO` de
 * `agregar.ts`, 2 encontros com transcrição, 30 estreantes, 25 pessoas.
 *
 * Uma métrica nova tinha que escolher entre inventar o oitavo limiar ou copiar
 * do vizinho mais próximo. O custo disso não é estético: dois limiares com o
 * mesmo nome e valores diferentes fazem a mesma pessoa aparecer como sumida
 * numa tela e ativa na outra.
 *
 * ⭐ Cada régua carrega o **porquê**, e não só o número, porque o número sozinho
 * não sobrevive à primeira pessoa que achar que ele é conservador demais.
 */

export interface Regua {
  /** Mínimo de observações para o número querer dizer alguma coisa. */
  minimo: number;
  /** O que está sendo contado. Entra na frase que a tela mostra. */
  unidade: string;
  /** Por que este número, e não outro. */
  porque: string;
}

export const REGUA = {
  /**
   * Tendência de quórum: metade recente contra metade antiga.
   *
   * Com três, cada ponto move a conta em um terço e a seta vira ruído.
   */
  tendencia: {
    minimo: 4,
    unidade: "encontros do grupo",
    porque: "com três, cada encontro move a conta em um terço",
  },

  /**
   * ⭐ Comparar grupos por interação ou permanência.
   *
   * Com um encontro por grupo, **grupo e dia são a mesma variável**: a Travessia
   * parecer pior pode ser quarta-feira, não a Travessia. Três é o mínimo em que
   * um dia ruim deixa de decidir sozinho.
   */
  comparacaoEntreGrupos: {
    minimo: 3,
    unidade: "encontros com transcrição",
    porque: "com um encontro, grupo e dia são a mesma variável",
  },

  /**
   * Quantos grupos precisam estar acima da régua para existir um ranking.
   *
   * Ordenar um grupo maduro contra cinco imaturos não é comparação, é pódio de
   * um. E ordenar é o que transforma medição em juízo.
   */
  ranking: {
    minimo: 2,
    unidade: "grupos comparáveis",
    porque: "ranking de um só não compara nada",
  },

  /**
   * Média de nota do formulário.
   *
   * Abaixo disso o número existe e não quer dizer nada. Foi o piso que sobrou
   * quando o ranking de condutor por nota foi removido: 21 condutores entre
   * 9,14 e 10, e o primeiro lugar decidido por ruído.
   */
  nota: {
    minimo: 5,
    unidade: "avaliações",
    porque: "abaixo disso a média é decidida por uma pessoa",
  },

  /**
   * Dizer que alguém sumiu.
   *
   * Quem veio uma vez e não voltou não sumiu, nunca chegou. E o relógio é hoje,
   * não o último encontro capturado: ancorar na captura faz ingestão parada
   * virar boa notícia.
   */
  sumico: {
    minimo: 3,
    unidade: "encontros antes de sumir",
    porque: "quem veio uma vez e não voltou não sumiu, nunca chegou",
  },

  /**
   * Dizer que alguém está calado no grupo.
   *
   * Um encontro em que ela não falou é um dia. Dois já é um jeito de estar ali.
   */
  silencio: {
    minimo: 2,
    unidade: "encontros com transcrição",
    porque: "um encontro calada é um dia, não um jeito de estar ali",
  },

  /**
   * Mostrar percentual de uma coorte em vez da fração crua.
   *
   * Com 12 de 40, "30%" soa mais preciso do que é.
   */
  percentual: {
    minimo: 30,
    unidade: "pessoas no denominador",
    porque: "percentual sobre denominador pequeno soa mais preciso do que é",
  },

  /**
   * Acima disto, mostrar o número; abaixo, mostrar os nomes.
   *
   * "5 pessoas" não diz nada que "Sabrina, Mariana, Priscila, Júlia e Sarah"
   * não diga melhor, e com os nomes dá para agir na segunda-feira.
   */
  nomesEmVezDeNumero: {
    minimo: 25,
    unidade: "pessoas",
    porque: "abaixo disso o nome é mais útil que a contagem",
  },
} as const;

/** Dias sem aparecer para alguém entrar na conversa de sumiço. */
export const DIAS_ESFRIANDO = 21;

/** Cobertura de formulário abaixo da qual toda nota vira rumor. */
export const COBERTURA_BAIXA_PCT = 40;

/** A régua foi satisfeita. */
export function atende(n: number, r: Regua): boolean {
  return n >= r.minimo;
}

/**
 * A frase que a tela mostra no lugar do número, ou `null` quando pode mostrar.
 *
 * Sempre no formato "tem N de M": o denominador é o que transforma uma recusa
 * em informação. "Ainda não dá" faz o leitor achar que quebrou; "1 de 3
 * encontros com transcrição" faz ele saber quando volta.
 */
export function porQueNaoDaParaLer(n: number, r: Regua): string | null {
  if (atende(n, r)) return null;
  return `${n} de ${r.minimo} ${r.unidade}`;
}
