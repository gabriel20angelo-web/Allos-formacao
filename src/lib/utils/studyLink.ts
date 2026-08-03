// Atalho publico (study link). Slug fica em /formacao/[slug] e redireciona
// pra destination_url da tabela study_links. Reserva nomes que ja sao rotas.

// Rota de verdade vence atalho: o Next serve a pasta e o atalho nunca é
// alcançado. Sem estes nomes aqui, o admin deixa criar um atalho que nasce
// morto e não avisa. As sete últimas são páginas que existem hoje e faltavam.
export const RESERVED_STUDY_LINK_SLUGS = new Set<string>([
  "acervo",
  "acesso-suspenso",
  "admin",
  "api",
  "aprimoramento-dinamicas",
  "auth",
  "cadastro",
  "certificado",
  "cookies",
  "curso",
  "cursos",
  "entrar",
  "formacao",
  "ocorrencia",
  "termos",
  "versoes",
  "favicon.ico",
  "icon",
  "icon.png",
  "apple-icon",
  "apple-icon.png",
  "login",
  "logout",
  "manifest.json",
  "meus-cursos",
  "opengraph-image",
  "painel",
  "register",
  "robots.txt",
  "sair",
  "signin",
  "signup",
  "sitemap.xml",
]);

const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{0,63}$/;

export type SlugValidation = { ok: true } | { ok: false; reason: string };

export function validateStudyLinkSlug(slug: string): SlugValidation {
  const trimmed = slug.trim().toLowerCase();
  if (!trimmed) return { ok: false, reason: "Slug obrigatorio." };
  if (!SLUG_REGEX.test(trimmed))
    return {
      ok: false,
      reason: "Use minusculas, numeros e traco; comece com letra/numero (max 64).",
    };
  if (RESERVED_STUDY_LINK_SLUGS.has(trimmed))
    return { ok: false, reason: `"${trimmed}" e uma rota reservada.` };
  return { ok: true };
}

export function validateStudyLinkUrl(url: string): SlugValidation {
  const trimmed = url.trim();
  if (!trimmed) return { ok: false, reason: "URL obrigatoria." };
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return { ok: false, reason: "URL deve comecar com http:// ou https://" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "URL invalida." };
  }
}
