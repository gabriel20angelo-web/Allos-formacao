/**
 * Horas de formação, do lado do painel.
 *
 * Espelha `src/lib/certificados-horas.ts` do allos-site, e a parte que NÃO
 * pode divergir é a chave do certificado: os dois sistemas emitem o mesmo
 * documento para a mesma pessoa, e uma chave diferente criaria dois
 * certificados válidos para as mesmas horas, um por porta de entrada.
 *
 *   chave = `formacao:${identificador}:${atividade}`
 *   identificador = e-mail em minúsculas, ou `nome:<nome normalizado>`
 *
 * As três regras que sustentam o resto:
 *
 * 1. Identidade é o e-mail. Medido em 20/09/2026: 894 submissões, nenhuma sem
 *    e-mail, e 25 e-mails aparecem com mais de uma grafia de nome. Agrupar por
 *    nome fragmenta essas pessoas e funde homônimos ao mesmo tempo.
 * 2. O acumulado é a vida inteira da pessoa. `certificado_resgatado` deixou de
 *    filtrar qualquer coisa: era ele que fazia dez encontros virarem zero.
 * 3. Um certificado por atividade, atualizado quando as horas crescem, em vez
 *    de um documento novo a cada emissão.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export const HORAS_MINIMO = 20;
export const HORAS_PADRAO = 2;

export interface SubmissaoHoras {
  id: string;
  nome_completo: string | null;
  email: string | null;
  atividade_nome: string;
  created_at: string;
  certificado_resgatado: boolean | null;
}

export interface PorAtividade {
  count: number;
  horas: number;
  dataInicio: string;
  dataFim: string;
}

export interface CertificadoRegistrado {
  atividade: string;
  codigo: string;
  horas: number | null;
  anulado: boolean;
  emitidoEm: string | null;
}

export interface PessoaHoras {
  chave: string;
  identificador: string;
  nome: string;
  email: string | null;
  nomesUsados: string[];
  participacoes: number;
  totalHoras: number;
  porAtividade: Record<string, PorAtividade>;
  primeira: string;
  ultima: string;
  certificados: CertificadoRegistrado[];
  /** Outras contas que usaram o mesmo nome. Não são somadas: podem ser homônimas. */
  outrosEmails: string[];
  /** Participações marcadas pelo resgate antigo, que zerava o contador. */
  marcadasResgatadas: number;
}

export function normalizarEmail(v?: string | null): string {
  return (v || "").trim().toLowerCase();
}

export function normalizarNome(v?: string | null): string {
  return (v || "").trim().toLowerCase().replace(/\s+/g, " ");
}

export function identificadorDe(s: { email?: string | null; nome_completo?: string | null }): string {
  const e = normalizarEmail(s.email);
  return e || `nome:${normalizarNome(s.nome_completo)}`;
}

export function chaveCertificado(identificador: string, atividade: string): string {
  return `formacao:${identificador}:${atividade}`;
}

export function gerarCodigoCertificado(): string {
  const ano = new Date().getFullYear();
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const bytes = new Uint8Array(8);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let code = "";
  for (let i = 0; i < 8; i++) code += chars.charAt(bytes[i] % chars.length);
  return `ALLOS-${ano}-${code}`;
}

/** O PostgREST devolve no máximo mil linhas por vez, e a tabela já passou disso. */
async function lerTudo<T>(
  sb: SupabaseClient,
  tabela: string,
  colunas: string,
  aplicar?: (q: ReturnType<SupabaseClient["from"]>) => unknown,
): Promise<T[]> {
  const pagina = 1000;
  let de = 0;
  const tudo: T[] = [];
  for (;;) {
    let q = sb.from(tabela).select(colunas).range(de, de + pagina - 1);
    if (aplicar) q = aplicar(q as never) as typeof q;
    const { data, error } = await q;
    if (error || !data) break;
    tudo.push(...(data as unknown as T[]));
    if (data.length < pagina) break;
    de += pagina;
  }
  return tudo;
}

/**
 * Todas as pessoas que já registraram participação, com o que cada uma
 * acumulou e o que já foi emitido no nome dela.
 */
export async function carregarPessoas(sb: SupabaseClient): Promise<PessoaHoras[]> {
  const submissoes = await lerTudo<SubmissaoHoras>(
    sb,
    "certificado_submissions",
    "id, nome_completo, email, atividade_nome, created_at, certificado_resgatado",
  );

  const { data: atividades } = await sb
    .from("certificado_atividades")
    .select("nome, carga_horaria");

  // Atividade arquivada continua valendo as horas de quem participou dela.
  const horasDe: Record<string, number> = {};
  for (const a of (atividades || []) as { nome: string; carga_horaria: number | null }[]) {
    horasDe[a.nome.toLowerCase()] = a.carga_horaria || HORAS_PADRAO;
  }

  const certificados = await lerTudo<{
    certificate_code: string;
    horas: number | null;
    anulado: boolean | null;
    issued_at: string | null;
    detalhes: Record<string, unknown> | null;
  }>(sb, "certificates", "certificate_code, horas, anulado, issued_at, detalhes", (q) =>
    (q as unknown as { eq: (c: string, v: string) => unknown }).eq("tipo", "formacao"),
  );

  const certPorIdent = new Map<string, CertificadoRegistrado[]>();
  for (const c of certificados) {
    const det = (c.detalhes || {}) as { identificador?: string; email?: string; atividade?: string };
    const ident = det.identificador || normalizarEmail(det.email) || "";
    if (!ident) continue;
    const lista = certPorIdent.get(ident) || [];
    lista.push({
      atividade: det.atividade || "(sem atividade)",
      codigo: c.certificate_code,
      horas: c.horas,
      anulado: !!c.anulado,
      emitidoEm: c.issued_at,
    });
    certPorIdent.set(ident, lista);
  }

  const porPessoa = new Map<string, PessoaHoras>();
  const contasPorNome = new Map<string, Set<string>>();

  for (const s of [...submissoes].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    const ident = identificadorDe(s);
    const atividade = (s.atividade_nome || "").trim() || "Atividade";
    const horas = horasDe[atividade.toLowerCase()] ?? HORAS_PADRAO;
    const dia = s.created_at.split("T")[0];
    const nome = (s.nome_completo || "").trim();

    const nomeNorm = normalizarNome(nome);
    if (nomeNorm) {
      const contas = contasPorNome.get(nomeNorm) || new Set<string>();
      contas.add(ident);
      contasPorNome.set(nomeNorm, contas);
    }

    let p = porPessoa.get(ident);
    if (!p) {
      p = {
        chave: ident,
        identificador: ident,
        nome,
        email: normalizarEmail(s.email) || null,
        nomesUsados: [],
        participacoes: 0,
        totalHoras: 0,
        porAtividade: {},
        primeira: dia,
        ultima: dia,
        certificados: certPorIdent.get(ident) || [],
        outrosEmails: [],
        marcadasResgatadas: 0,
      };
      porPessoa.set(ident, p);
    }

    if (nome && !p.nomesUsados.includes(nome)) p.nomesUsados.push(nome);
    // O nome mais longo é o que vai impresso: quem assinou "Mariana Alves" e
    // "Mariana Alves Ribeiro do Nascimento" é uma pessoa só, com um nome só.
    if (nome.length > p.nome.length) p.nome = nome;

    if (!p.porAtividade[atividade]) {
      p.porAtividade[atividade] = { count: 0, horas: 0, dataInicio: dia, dataFim: dia };
    }
    p.porAtividade[atividade].count += 1;
    p.porAtividade[atividade].horas += horas;
    if (dia < p.porAtividade[atividade].dataInicio) p.porAtividade[atividade].dataInicio = dia;
    if (dia > p.porAtividade[atividade].dataFim) p.porAtividade[atividade].dataFim = dia;

    p.participacoes += 1;
    p.totalHoras += horas;
    if (dia < p.primeira) p.primeira = dia;
    if (dia > p.ultima) p.ultima = dia;
    if (s.certificado_resgatado) p.marcadasResgatadas += 1;
  }

  for (const p of Array.from(porPessoa.values())) {
    const contas = contasPorNome.get(normalizarNome(p.nome));
    if (contas && contas.size > 1) {
      p.outrosEmails = Array.from(contas).filter((c) => c !== p.identificador);
    }
  }

  return Array.from(porPessoa.values()).sort((a, b) => b.totalHoras - a.totalHoras);
}

/**
 * Registra ou atualiza os certificados de uma pessoa e devolve os códigos.
 *
 * Mesma chave do fluxo público, de propósito: emitir pelo painel depois que a
 * pessoa já baixou pelo site atualiza o documento dela em vez de criar um
 * segundo com o mesmo período.
 */
export async function emitirCertificadosDe(
  sb: SupabaseClient,
  pessoa: PessoaHoras,
  emitidoPor: string | null,
): Promise<CertificadoRegistrado[]> {
  const emitidos: CertificadoRegistrado[] = [];
  const email = pessoa.email || "";

  let userId: string | null = null;
  if (email) {
    const { data: perfil } = await sb.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (perfil) userId = (perfil as { id: string }).id;
  }

  for (const [atividade, info] of Object.entries(pessoa.porAtividade)) {
    const chave = chaveCertificado(pessoa.identificador, atividade);
    const detalhes = {
      chave,
      identificador: pessoa.identificador,
      atividade,
      presencas: info.count,
      periodo_inicio: info.dataInicio,
      periodo_fim: info.dataFim,
      origem: "painel-horas-formacao",
      email: email || null,
      emitido_por: emitidoPor,
      atualizado_em: new Date().toISOString(),
    };

    const { data: existente } = await sb
      .from("certificates")
      .select("id, certificate_code, anulado, horas, issued_at")
      .eq("detalhes->>chave", chave)
      .maybeSingle();

    if (existente) {
      const atual = existente as {
        id: string;
        certificate_code: string;
        anulado: boolean | null;
        horas: number | null;
        issued_at: string | null;
      };
      if (!atual.anulado && atual.horas !== info.horas) {
        await sb
          .from("certificates")
          .update({ horas: info.horas, nome_certificado: pessoa.nome, detalhes })
          .eq("id", atual.id);
      }
      emitidos.push({
        atividade,
        codigo: atual.certificate_code,
        horas: atual.anulado ? atual.horas : info.horas,
        anulado: !!atual.anulado,
        emitidoEm: atual.issued_at,
      });
      continue;
    }

    for (let tentativa = 0; tentativa < 3; tentativa++) {
      const code = gerarCodigoCertificado();
      const { data, error } = await sb
        .from("certificates")
        .insert({
          user_id: userId,
          course_id: null,
          certificate_code: code,
          tipo: "formacao",
          horas: info.horas,
          nome_certificado: pessoa.nome,
          detalhes,
          issued_at: new Date().toISOString(),
        })
        .select("certificate_code, issued_at")
        .single();

      if (!error && data) {
        const novo = data as { certificate_code: string; issued_at: string | null };
        emitidos.push({
          atividade,
          codigo: novo.certificate_code,
          horas: info.horas,
          anulado: false,
          emitidoEm: novo.issued_at,
        });
        break;
      }
      if (error && !error.message.toLowerCase().includes("unique")) {
        console.error("[horas-formacao] registro falhou", error.message);
        break;
      }
    }
  }

  return emitidos;
}
