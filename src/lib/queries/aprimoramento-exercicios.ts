// Queries do banco pra `aprimoramento_exercicios`. Usado pelas páginas RSC
// que antes liam o array EXERCISES hardcoded em aprimoramento-dinamicas.ts.
//
// Convenção: queries server-side usam createServerSupabaseClient (que respeita
// cookies de auth do usuário); queries com escrita pelo admin podem usar service
// role via getFormacaoAdmin() — mas pra leitura, o cookie do user é suficiente
// (RLS filtra status/curado automaticamente).

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  tagToSlug,
  type Block,
  type CategorySlug,
  type Exercise,
  type FormatoSlug,
} from "@/lib/aprimoramento-dinamicas";

export const APRIMORAMENTO_CACHE_TAG = "aprimoramento_exercicios";

interface ExercicioRow {
  id: string;
  slug: string;
  number: number;
  title: string;
  summary: string;
  category: CategorySlug;
  formato: FormatoSlug[];
  tags: string[];
  recursos: string[];
  blocks: Block[];
  curado: boolean;
  criado_por: string | null;
  status: "publicado" | "rascunho" | "arquivado";
}

function mapRow(row: ExercicioRow): Exercise {
  return {
    slug: row.slug,
    number: row.number,
    title: row.title,
    summary: row.summary,
    category: row.category,
    formato: row.formato ?? [],
    tags: row.tags ?? [],
    recursos: row.recursos?.length ? row.recursos : undefined,
    blocks: row.blocks ?? [],
    curado: row.curado,
    criadoPor: row.criado_por,
    status: row.status,
  };
}

interface ListOpts {
  /** Inclui rascunhos próprios do user (precisa de auth) e do admin. */
  includeRascunho?: boolean;
  /** Inclui arquivados (admin only via RLS). */
  includeArquivado?: boolean;
}

export async function listAprimoramentoExercicios(
  opts: ListOpts = {},
): Promise<Exercise[]> {
  const supabase = await createServerSupabaseClient();
  let q = supabase
    .from("aprimoramento_exercicios")
    .select("*")
    .order("number", { ascending: true });

  const statuses: ("publicado" | "rascunho" | "arquivado")[] = ["publicado"];
  if (opts.includeRascunho) statuses.push("rascunho");
  if (opts.includeArquivado) statuses.push("arquivado");
  q = q.in("status", statuses);

  const { data, error } = await q;
  if (error) {
    console.error("[listAprimoramentoExercicios] error:", error);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as ExercicioRow));
}

export async function getAprimoramentoExercicioBySlug(
  slug: string,
): Promise<Exercise | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("aprimoramento_exercicios")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as ExercicioRow);
}

/** Pra generateStaticParams (build-time) — pega só slugs publicados. */
export async function listPublishedSlugs(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("aprimoramento_exercicios")
    .select("slug")
    .eq("status", "publicado");
  if (error) return [];
  return (data ?? []).map((r: { slug: string }) => r.slug);
}

// ─── Helpers que antes eram constantes derivadas de EXERCISES ──────────────

/**
 * Retorna até `n` exercícios relacionados ao atual, ordenados por relevância:
 * +3 se categoria igual · +1 por tag em comum · +0.5 por formato em comum.
 * Recebe lista de candidatos por param (em vez de ler array global).
 */
export function getRelatedFrom(
  current: Exercise,
  all: Exercise[],
  n: number = 3,
): Exercise[] {
  const tagsCur = new Set(current.tags);
  const formatosCur = new Set(current.formato);

  const scored = all
    .filter((e) => e.slug !== current.slug)
    .map((e) => {
      let score = 0;
      if (e.category === current.category) score += 3;
      for (const t of e.tags) if (tagsCur.has(t)) score += 1;
      for (const f of e.formato) if (formatosCur.has(f)) score += 0.5;
      return { ex: e, score };
    });

  scored.sort((a, b) => b.score - a.score || a.ex.number - b.ex.number);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, n)
    .map((s) => s.ex);
}

/** Lista de tags com count, ordenadas por frequência desc. */
export function listAllTagsFrom(
  all: Exercise[],
): { tag: string; slug: string; count: number }[] {
  const map = new Map<string, number>();
  for (const ex of all) {
    for (const tag of ex.tags) {
      map.set(tag, (map.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(map.entries())
    .map(([tag, count]) => ({ tag, count, slug: tagToSlug(tag) }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag, "pt-BR"));
}

/** Procura tag por slug, retorna tag canônica + exercícios correspondentes. */
export function findTagBySlugIn(
  all: Exercise[],
  slug: string,
): { tag: string; exercises: Exercise[] } | null {
  const target = slug.toLowerCase();
  for (const ex of all) {
    for (const tag of ex.tags) {
      if (tagToSlug(tag) === target) {
        return {
          tag,
          exercises: all.filter((e) => e.tags.includes(tag)),
        };
      }
    }
  }
  return null;
}

