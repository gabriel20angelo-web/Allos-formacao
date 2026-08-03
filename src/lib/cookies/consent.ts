/**
 * Registro de consentimento de cookies (LGPD, Lei nº 13.709/2018).
 *
 * Implementa a cláusula 3 da Política de Cookies da Allos:
 *  - nenhuma categoria opcional vem marcada por padrão;
 *  - recusar é tão simples quanto aceitar;
 *  - o registro guarda data, hora, versão da política e categorias aceitas;
 *  - passados 6 meses o aviso volta a aparecer.
 *
 * Este módulo não depende de React e pode ser importado por qualquer script.
 * Todas as funções têm guarda de SSR.
 */

export const CONSENT_STORAGE_KEY = "allos_consent";
export const CONSENT_VERSION = "1.0";
export const CONSENT_MAX_AGE_MONTHS = 6;
export const CONSENT_EVENT = "allos:consent-change";

export type ConsentCategory =
  | "necessarios"
  | "preferencias"
  | "estatisticos"
  | "marketing";

export const OPTIONAL_CATEGORIES = [
  "preferencias",
  "estatisticos",
  "marketing",
] as const satisfies readonly ConsentCategory[];

export type OptionalCategory = (typeof OPTIONAL_CATEGORIES)[number];

export interface ConsentCategories {
  /** Não depende de consentimento (art. 7º, II, V e IX da LGPD). */
  necessarios: true;
  preferencias: boolean;
  estatisticos: boolean;
  marketing: boolean;
}

export interface ConsentRecord {
  version: string;
  /** ISO 8601, em UTC. */
  timestamp: string;
  categories: ConsentCategories;
}

/** Entrada aceita por saveConsent: qualquer subconjunto das categorias. */
export type ConsentInput = Partial<Record<ConsentCategory, boolean>>;

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

/** Todas as opcionais recusadas. É o estado padrão antes de qualquer escolha. */
export function defaultCategories(): ConsentCategories {
  return {
    necessarios: true,
    preferencias: false,
    estatisticos: false,
    marketing: false,
  };
}

function normalizeCategories(input: unknown): ConsentCategories {
  const raw = (input ?? {}) as Record<string, unknown>;
  return {
    necessarios: true,
    preferencias: raw.preferencias === true,
    estatisticos: raw.estatisticos === true,
    marketing: raw.marketing === true,
  };
}

function parseRecord(raw: string | null): ConsentRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.version !== "string") return null;
    if (typeof parsed.timestamp !== "string") return null;
    if (Number.isNaN(new Date(parsed.timestamp).getTime())) return null;
    return {
      version: parsed.version,
      timestamp: parsed.timestamp,
      categories: normalizeCategories(parsed.categories),
    };
  } catch {
    return null;
  }
}

/** Passaram mais de 6 meses desde o registro? (cláusula 3.3) */
export function isExpired(timestamp: string): boolean {
  const saved = new Date(timestamp).getTime();
  if (Number.isNaN(saved)) return true;
  const limit = new Date(saved);
  limit.setMonth(limit.getMonth() + CONSENT_MAX_AGE_MONTHS);
  return Date.now() > limit.getTime();
}

/**
 * Lê o registro gravado. Devolve null no servidor, quando não há registro
 * ou quando o conteúdo está corrompido.
 */
export function getConsent(): ConsentRecord | null {
  if (!isBrowser()) return null;
  try {
    return parseRecord(localStorage.getItem(CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

/**
 * Grava a escolha do usuário e dispara o CustomEvent `allos:consent-change`
 * no window, para que integrações de terceiros reajam sem acoplamento.
 * Os cookies necessários são sempre gravados como aceitos.
 */
export function saveConsent(cats: ConsentInput): ConsentRecord {
  const record: ConsentRecord = {
    version: CONSENT_VERSION,
    timestamp: new Date().toISOString(),
    categories: normalizeCategories(cats),
  };

  if (!isBrowser()) return record;

  try {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Armazenamento indisponível (modo privado, cota cheia). A escolha vale
    // para a sessão atual e o aviso reaparece na próxima visita.
  }

  try {
    window.dispatchEvent(
      new CustomEvent<ConsentRecord>(CONSENT_EVENT, { detail: record }),
    );
  } catch {
    // Ambiente sem CustomEvent. Nada a fazer.
  }

  return record;
}

/**
 * Uma categoria está autorizada? Necessários sempre respondem true.
 * Registro ausente, de outra versão ou vencido conta como recusa.
 */
export function hasConsent(cat: ConsentCategory): boolean {
  if (cat === "necessarios") return true;
  if (!isBrowser()) return false;

  const record = getConsent();
  if (!record) return false;
  if (record.version !== CONSENT_VERSION) return false;
  if (isExpired(record.timestamp)) return false;

  return record.categories[cat] === true;
}

/**
 * O aviso deve ser reapresentado? Sim quando não há registro, quando a versão
 * da política mudou ou quando o registro tem mais de 6 meses (cláusula 3.3).
 */
export function shouldAskAgain(): boolean {
  if (!isBrowser()) return false;

  const record = getConsent();
  if (!record) return true;
  if (record.version !== CONSENT_VERSION) return true;

  return isExpired(record.timestamp);
}

/** Apaga o registro. Usado por testes e pela revogação total do consentimento. */
export function clearConsent(): void {
  if (!isBrowser()) return;
  try {
    localStorage.removeItem(CONSENT_STORAGE_KEY);
  } catch {
    // Nada a fazer.
  }
}
