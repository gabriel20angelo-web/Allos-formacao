// Leitura do CSV do processo seletivo.
//
// Parser próprio e não `split(",")` porque a coluna de avaliação traz o texto
// inteiro do parecer, com vírgulas, aspas e quebras de linha dentro do campo.
// O arquivo de 06/08/2026 tem 65 registros em 1127 linhas de arquivo por causa
// disso: quem dividir por linha lê 1127 candidatos e nenhum deles inteiro.
//
// O mapeamento de coluna é por apelido, não por posição. O cabeçalho de lá vai
// mudar (já mudou uma vez, de 5 para 19 colunas), e uma importação que quebra
// porque alguém renomeou "E-mail" para "Email" é uma importação que ninguém usa.

/** Uma linha do CSV já convertida. */
export interface LinhaSeletivo {
  nome: string;
  nomeNormalizado: string;
  email: string | null;
  emailOriginal: string | null;
  telefone: string | null;
  telefoneOriginal: string | null;
  faculdade: string | null;
  periodo: string | null;
  caso: string | null;
  nota: number | null;
  status: string | null;
  sessoes: number | null;
  duracaoSeg: number | null;
  criterios: Record<string, number> | null;
  avaliacao: string | null;
  realizadaEm: string | null;
  linhaChave: string;
}

/** RFC4180: aspas duplas, `""` escapado, quebra de linha dentro do campo. */
export function parseCSV(texto: string): string[][] {
  const linhas: string[][] = [];
  let campo = "";
  let atual: string[] = [];
  let dentroDeAspas = false;
  const t = texto.replace(/^﻿/, "");

  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dentroDeAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') { campo += '"'; i++; }
        else dentroDeAspas = false;
      } else campo += c;
    } else if (c === '"') dentroDeAspas = true;
    else if (c === ",") { atual.push(campo); campo = ""; }
    else if (c === "\r") { /* engolido: o par vem no \n */ }
    else if (c === "\n") { atual.push(campo); linhas.push(atual); atual = []; campo = ""; }
    else campo += c;
  }
  if (campo || atual.length) { atual.push(campo); linhas.push(atual); }
  return linhas;
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/** Mesma regra de `public.normalizar_nome` no banco. */
export const normalizarNome = (s: string | null | undefined) => semAcento(s ?? "") || "";
export const normalizarEmail = (s: string | null | undefined) =>
  (s ?? "").trim().toLowerCase() || null;

/** Só dígitos, e sem o 55 do país, para que +55 (81) 9... e 81 9... sejam iguais. */
export function normalizarTelefone(s: string | null | undefined): string | null {
  const d = (s ?? "").replace(/\D/g, "");
  if (!d) return null;
  if (d.length >= 12 && d.startsWith("55")) return d.slice(2);
  return d;
}

const APELIDOS: Record<string, string[]> = {
  nome: ["nome completo", "nome", "candidato", "participante"],
  email: ["e-mail", "email", "e mail", "correio"],
  telefone: ["whatsapp", "whats", "telefone", "celular", "fone", "tel"],
  faculdade: ["faculdade", "instituicao", "universidade"],
  periodo: ["periodo", "semestre"],
  caso: ["paciente (caso)", "paciente", "caso"],
  sessoes: ["sessoes"],
  duracao: ["duracao (s)", "duracao"],
  status: ["status", "situacao", "resultado"],
  nota: ["nota final (0-100)", "nota final", "nota", "pontuacao"],
  avaliacao: ["avaliacao (texto)", "avaliacao", "parecer"],
  data: ["data/hora (iso)", "data/hora", "data", "realizada em"],
};

/** Converte as linhas cruas em registros, ignorando o que não tem nome. */
export function mapearColunas(linhas: string[][]): LinhaSeletivo[] {
  if (linhas.length < 2) return [];
  const cab = linhas[0].map((h) => semAcento(h));

  const acha = (campo: string) => {
    for (const apelido of APELIDOS[campo] ?? []) {
      const i = cab.indexOf(apelido);
      if (i >= 0) return i;
    }
    return -1;
  };
  const idx = Object.fromEntries(
    Object.keys(APELIDOS).map((k) => [k, acha(k)]),
  ) as Record<string, number>;

  if (idx.nome < 0) return [];

  // Toda coluna que começa com "criterio" vira uma entrada do objeto, sem
  // precisar saber os nomes de antemão: a rubrica muda e o import continua.
  const colsCriterio = cab
    .map((h, i) => ({ h, i }))
    .filter((c) => c.h.startsWith("criterio"))
    .map((c) => ({ chave: c.h.replace(/^criterio:?\s*/, ""), i: c.i }));

  const num = (v: string | undefined) => {
    const n = Number((v ?? "").replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  };

  const out: LinhaSeletivo[] = [];
  for (const l of linhas.slice(1)) {
    const val = (i: number) => (i >= 0 ? (l[i] ?? "").trim() : "");
    const nome = val(idx.nome);
    if (!nome) continue;

    const emailOriginal = val(idx.email) || null;
    const telefoneOriginal = val(idx.telefone) || null;
    const criterios: Record<string, number> = {};
    for (const c of colsCriterio) {
      const n = num(l[c.i]);
      if (n != null) criterios[c.chave] = n;
    }

    // A chave de idempotência usa o texto cru, não o valor convertido: assim
    // uma mudança no parse não reescreve as chaves e não reimporta tudo.
    const linhaChave = [
      val(idx.data), val(idx.caso), val(idx.nota), val(idx.status),
    ].join("|");

    // Data: ISO primeiro, e dd/mm/yyyy por regex explícita. Nunca Date.parse
    // solto, que lê 03/08/2026 como 8 de março.
    const bruta = val(idx.data);
    let realizadaEm: string | null = null;
    if (bruta) {
      const br = bruta.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
      const d = br ? new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00Z`) : new Date(bruta);
      if (!Number.isNaN(d.getTime())) realizadaEm = d.toISOString();
    }

    out.push({
      nome,
      nomeNormalizado: normalizarNome(nome),
      email: normalizarEmail(emailOriginal),
      emailOriginal,
      telefone: normalizarTelefone(telefoneOriginal),
      telefoneOriginal,
      faculdade: val(idx.faculdade) || null,
      periodo: val(idx.periodo) || null,
      caso: val(idx.caso) || null,
      nota: num(l[idx.nota]),
      status: val(idx.status) || null,
      sessoes: num(l[idx.sessoes]),
      duracaoSeg: num(l[idx.duracao]),
      criterios: Object.keys(criterios).length ? criterios : null,
      avaliacao: val(idx.avaliacao) || null,
      realizadaEm,
      linhaChave,
    });
  }
  return out;
}
