// O vocabulário da tela, num lugar só.
//
// Cada estado tem rótulo, cor e uma frase que diz a regra por extenso. A frase
// não é enfeite: "núcleo" e "sumiu" são palavras que parecem óbvias e não são,
// e um rótulo cuja definição mora escondida atrás de um ícone de ajuda é um
// rótulo que ninguém confere. Aqui a definição aparece ao lado do recorte
// escolhido, sempre, escrita com os números que a régua está usando de fato.

import type { EstadoPessoa } from "@/lib/pessoas/agregar";

export interface Regras {
  janelaNucleoDias: number;
  barraNucleo: number;
  barraChegando: number;
  diasSumiu: number;
  diasEsfriando: number;
  diasEstreante: number;
}

export const CORES: Record<EstadoPessoa, string> = {
  nucleo: "#C84B31",
  chegando: "#2E9E8F",
  esporadico: "#5FA89C",
  esfriando: "#D4854A",
  sumiu: "#EF4444",
  estreante: "#6C5CE7",
  "uma-vez": "rgba(253,251,247,0.32)",
  "so-assiste": "#7C93B8",
  "sem-sinal": "rgba(253,251,247,0.18)",
};

export const ROTULOS: Record<EstadoPessoa, string> = {
  nucleo: "Núcleo",
  chegando: "Chegando perto",
  esporadico: "Vem de vez em quando",
  esfriando: "Esfriando",
  sumiu: "Sumiu",
  estreante: "Estreou agora",
  "uma-vez": "Veio pouco e parou",
  "so-assiste": "Só assiste curso",
  "sem-sinal": "Só tem conta",
};

/** A ordem em que os recortes aparecem: do mais quente para o mais frio. */
export const ORDEM_ESTADOS: EstadoPessoa[] = [
  "nucleo",
  "chegando",
  "esporadico",
  "esfriando",
  "sumiu",
  "estreante",
  "uma-vez",
  "so-assiste",
  "sem-sinal",
];

export function definicao(estado: EstadoPessoa, r: Regras): string {
  switch (estado) {
    case "nucleo":
      return `${r.barraNucleo} encontros ou mais nos últimos ${r.janelaNucleoDias} dias. É quem já faz parte.`;
    case "chegando":
      return `Entre ${r.barraChegando} e ${r.barraNucleo - 1} encontros nos últimos ${r.janelaNucleoDias} dias. Falta pouco para entrar no núcleo, e é o empurrão mais barato que existe.`;
    case "esporadico":
      return `Já veio mais de uma vez e apareceu nos últimos ${r.diasEsfriando} dias, mas em ritmo espaçado. Não é gente que a formação perdeu, é gente que vem quando dá.`;
    case "esfriando":
      return `Já veio 3 vezes ou mais, e está entre ${r.diasEsfriando} e ${r.diasSumiu} dias sem aparecer. Ainda dá tempo de chamar.`;
    case "sumiu":
      return `Já veio 3 vezes ou mais, e está há ${r.diasSumiu} dias ou mais sem nenhum sinal. Confira a sala antes de cobrar: pode ter parado só de preencher o formulário.`;
    case "estreante":
      return `Veio pela primeira vez nos últimos ${r.diasEstreante} dias. Um terço de quem estreia volta, e esse número não se mexe desde abril.`;
    case "uma-vez":
      return "Veio uma ou duas vezes e não voltou. É onde mora a maior parte da base.";
    case "so-assiste":
      return "Nunca veio a um grupo, mas assiste curso na plataforma.";
    case "sem-sinal":
      return "Tem conta e ainda não fez nada: nem grupo, nem aula.";
  }
}

/** Frase curta para o selo dentro da linha da pessoa. */
export function selo(estado: EstadoPessoa): string {
  return ROTULOS[estado];
}
