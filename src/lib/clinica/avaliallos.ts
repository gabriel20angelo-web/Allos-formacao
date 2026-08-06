/**
 * A saída da avaliação clínica: quem foi avaliado e que nota tirou.
 *
 * O painel já cruzava quatro fontes sobre cada pessoa: o formulário de
 * certificado, a plataforma de cursos, a sala do Meet e a entrada do processo
 * seletivo. Faltava a saída, que é esta.
 *
 * Três regras que este módulo existe para fixar:
 *
 * 1. **Contar dia distinto, nunca linha.** Dois avaliadores avaliando a mesma
 *    pessoa no mesmo dia é uma avaliação, não duas. Medido em 06/08: contar
 *    linha infla a lista de "fez mais de uma vez" em seis pessoas.
 *
 * 2. **Não existe coluna de nota.** A nota é a soma de doze competências, cada
 *    uma valendo um de {-9,-3,-1,+1,+3,+9}, então a escala vai de -108 a +108.
 *    Por pessoa vale a MELHOR nota, no mesmo desenho que o processo seletivo já
 *    usa. E é escala com negativo, o que é justamente o motivo de "zero pra
 *    cima" e "dez pra cima" serem cortes que significam alguma coisa.
 *
 * 3. **Trinta das cinquenta e duas avaliações não têm `avaliado_id`**, só o
 *    texto de `nome_sessao`, e boa parte delas é gente que já tem cadastro.
 *    Sem colapsar por nome normalizado, a mesma pessoa conta duas vezes e o
 *    total de avaliados sai inflado.
 *
 * ⚠️ O AvaliAllos não tem e-mail em lugar nenhum. A única chave forte que ele
 * compartilha com a base da formação é o telefone.
 */

import { consultar, clinicaConfigurada } from "./neon";

/** As doze competências. A ordem é a do formulário. */
const COMPETENCIAS = [
  "estagio_mudanca",
  "estrutura_coerencia",
  "encerramento_abertura",
  "acolhimento",
  "seguranca_terapeuta",
  "seguranca_metodo",
  "aprofundamento",
  "hipoteses",
  "interpretacao",
  "frase_timing",
  "corpo_setting",
  "insight_potencia",
] as const;

/** O corte que o Gabriel escolheu em 06/08. Não é o +25 interno do AvaliAllos. */
export const CORTE_DESTAQUE = 10;

export const ESCALA_CLINICA = { min: -108, max: 108 };

export interface AvaliadaClinica {
  /** Identidade dentro do AvaliAllos: o id do cadastro, ou o nome normalizado. */
  chave: string;
  nome: string;
  /** Dias distintos em que foi avaliada. Nunca a contagem de linhas. */
  vezes: number;
  /** Linhas de avaliação. Maior que `vezes` quando dois avaliadores no mesmo dia. */
  avaliacoes: number;
  melhorNota: number;
  ultimaNota: number;
  ultimaEm: string;
  /** Telefone já normalizado para casar com `pessoa_identificadores`. */
  chaveTelefone: string | null;
  /** Existe cadastro em `avaliados`, ou a pessoa só aparece como texto na sessão. */
  temCadastro: boolean;
}

export interface RetratoClinica {
  configurado: boolean;
  avaliadas: AvaliadaClinica[];
  totalAvaliacoes: number;
  primeira: string | null;
  ultima: string | null;
}

/**
 * Sem acento, minúsculo, espaço colapsado.
 *
 * Serve só para colapsar `nome_sessao` no cadastro correspondente DENTRO do
 * AvaliAllos. Não é usado para casar com a base da formação: lá nome é chave
 * fraca e a migration 089 proíbe casar por ele sozinho.
 */
function chaveNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * DDD mais os oito últimos dígitos, sem zero de operadora e sem o 55 do país.
 *
 * É a normalização do processo seletivo, e é a única das três que existem entre
 * os dois repositórios que absorve o nono dígito: um cadastro antigo de dez
 * dígitos e o mesmo número atual de onze colapsam na mesma chave.
 *
 * Medido em 06/08: nesta base ela casa exatamente a mesma gente que a
 * normalização mais frouxa, porque o gargalo da ponte hoje não é o formato do
 * número, é a quantidade de gente em comum. Está aqui porque é a correta
 * quando a base crescer, não porque ganha alguém hoje.
 */
export function chaveTelefone(valor: string | null | undefined): string | null {
  let d = String(valor ?? "").replace(/\D/g, "");
  d = d.replace(/^0+/, "");
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2);
  if (d.length < 10) return null;
  return d.slice(0, 2) + d.slice(-8);
}

interface LinhaAvaliacao {
  dia: string;
  avaliado_id: string | null;
  nome_sessao: string;
  telefone: string | null;
  [k: string]: unknown;
}

interface LinhaAvaliado {
  id: string;
  nome_completo: string;
  telefone: string | null;
}

function somar(linha: LinhaAvaliacao): number {
  return COMPETENCIAS.reduce((s, c) => s + (Number(linha[c]) || 0), 0);
}

export async function montarRetratoClinica(): Promise<RetratoClinica> {
  if (!clinicaConfigurada()) {
    return {
      configurado: false,
      avaliadas: [],
      totalAvaliacoes: 0,
      primeira: null,
      ultima: null,
    };
  }

  // `to_char` e não a coluna crua: o driver devolveria um `Date` e a contagem
  // por dia distinto passaria a depender do fuso do servidor.
  const [avaliacoes, avaliados] = await Promise.all([
    consultar<LinhaAvaliacao>(
      `SELECT to_char(data, 'YYYY-MM-DD') AS dia, avaliado_id, nome_sessao, telefone,
              ${COMPETENCIAS.join(", ")}
       FROM avaliacoes
       ORDER BY data ASC`,
    ),
    consultar<LinhaAvaliado>(
      `SELECT id, nome_completo, telefone FROM avaliados`,
    ),
  ]);

  const cadastroPorId = new Map(avaliados.map((a) => [a.id, a]));
  const idPorNome = new Map(avaliados.map((a) => [chaveNome(a.nome_completo), a.id]));

  const acc = new Map<
    string,
    {
      nome: string;
      dias: Set<string>;
      linhas: number;
      notas: number[];
      ultimaNota: number;
      ultimaEm: string;
      telefone: string | null;
      temCadastro: boolean;
    }
  >();

  for (const linha of avaliacoes) {
    let chave = linha.avaliado_id;
    let nome = linha.nome_sessao;
    let temCadastro = Boolean(linha.avaliado_id);

    if (!chave) {
      // Colapsa no cadastro quando o nome digitado na sessão é o de alguém que
      // já existe. Sem isso, "Leonara" cadastrada e "Leonara" digitada viram
      // duas pessoas e o total de avaliados sai inflado.
      const porNome = idPorNome.get(chaveNome(linha.nome_sessao));
      if (porNome) {
        chave = porNome;
        temCadastro = true;
      } else {
        chave = `nome:${chaveNome(linha.nome_sessao)}`;
      }
    }

    const cadastro = cadastroPorId.get(chave);
    if (cadastro) nome = cadastro.nome_completo;

    const nota = somar(linha);
    const atual = acc.get(chave);
    if (atual) {
      atual.dias.add(linha.dia);
      atual.linhas++;
      atual.notas.push(nota);
      // A lista vem ordenada por data crescente, então a última a passar aqui
      // é mesmo a mais recente.
      atual.ultimaNota = nota;
      atual.ultimaEm = linha.dia;
    } else {
      acc.set(chave, {
        nome,
        dias: new Set([linha.dia]),
        linhas: 1,
        notas: [nota],
        ultimaNota: nota,
        ultimaEm: linha.dia,
        telefone: cadastro?.telefone ?? linha.telefone,
        temCadastro,
      });
    }
  }

  const avaliadas: AvaliadaClinica[] = Array.from(acc.entries())
    .map(([chave, d]) => ({
      chave,
      nome: d.nome,
      vezes: d.dias.size,
      avaliacoes: d.linhas,
      melhorNota: Math.max(...d.notas),
      ultimaNota: d.ultimaNota,
      ultimaEm: d.ultimaEm,
      chaveTelefone: chaveTelefone(d.telefone),
      temCadastro: d.temCadastro,
    }))
    .sort((a, b) => b.melhorNota - a.melhorNota);

  const dias = avaliacoes.map((a) => a.dia).sort();

  return {
    configurado: true,
    avaliadas,
    totalAvaliacoes: avaliacoes.length,
    primeira: dias[0] ?? null,
    ultima: dias[dias.length - 1] ?? null,
  };
}
