// Mutações client-side de aprimoramento_exercicios usadas pelo painel admin.
// Cliente browser via createClient — RLS controla acesso (só admin tem
// UPDATE/DELETE, exceto dono em rascunho não-curado).

import { createClient } from "@/lib/supabase/client";
import type { Exercise, Block, CategorySlug, FormatoSlug } from "@/lib/aprimoramento-dinamicas";

const TABLE = "aprimoramento_exercicios";

export interface AdminExercicioRow extends Exercise {
  id: string;
  createdAt: string;
  updatedAt: string;
}

interface AdminRowRaw {
  id: string;
  slug: string;
  number: number;
  title: string;
  summary: string;
  category: CategorySlug;
  formato: FormatoSlug[] | null;
  tags: string[] | null;
  recursos: string[] | null;
  blocks: Block[] | null;
  curado: boolean;
  criado_por: string | null;
  status: "publicado" | "rascunho" | "arquivado";
  created_at: string;
  updated_at: string;
}

function mapRow(row: AdminRowRaw): AdminExercicioRow {
  return {
    id: row.id,
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lista todos os exercícios pro admin (publicado + rascunho + arquivado).
 * RLS já garante que só admin (ou dono em rascunho) vê tudo.
 */
export async function getByIdForAdmin(
  id: string,
): Promise<AdminExercicioRow | null> {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return mapRow(data as AdminRowRaw);
}

export async function listAllForAdmin(): Promise<AdminExercicioRow[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*")
    .order("number", { ascending: true });
  if (error) {
    console.error("[listAllForAdmin]", error);
    return [];
  }
  return (data ?? []).map((r) => mapRow(r as AdminRowRaw));
}

export async function setCurado(id: string, curado: boolean) {
  const sb = createClient();
  const { error } = await sb.from(TABLE).update({ curado }).eq("id", id);
  return { error };
}

export async function setStatus(
  id: string,
  status: "publicado" | "rascunho" | "arquivado",
) {
  const sb = createClient();
  const { error } = await sb.from(TABLE).update({ status }).eq("id", id);
  return { error };
}

export async function deleteExercicio(id: string) {
  const sb = createClient();
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  return { error };
}

interface CreateInput {
  slug: string;
  number: number;
  title: string;
  summary: string;
  category: CategorySlug;
  formato: FormatoSlug[];
  tags: string[];
  recursos?: string[];
  blocks: Block[];
  curado?: boolean;
  status?: "publicado" | "rascunho" | "arquivado";
}

export async function createExercicio(input: CreateInput, userId: string) {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      slug: input.slug,
      number: input.number,
      title: input.title,
      summary: input.summary,
      category: input.category,
      formato: input.formato,
      tags: input.tags,
      recursos: input.recursos ?? [],
      blocks: input.blocks,
      curado: input.curado ?? false,
      criado_por: userId,
      status: input.status ?? "publicado",
    })
    .select("*")
    .single();
  return { data: data ? mapRow(data as AdminRowRaw) : null, error };
}

interface UpdateInput {
  slug?: string;
  number?: number;
  title?: string;
  summary?: string;
  category?: CategorySlug;
  formato?: FormatoSlug[];
  tags?: string[];
  recursos?: string[];
  blocks?: Block[];
  curado?: boolean;
  status?: "publicado" | "rascunho" | "arquivado";
}

export async function updateExercicio(id: string, patch: UpdateInput) {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  return { data: data ? mapRow(data as AdminRowRaw) : null, error };
}

/** Próximo número disponível pra novo exercício (max + 1). */
export async function nextExerciseNumber(): Promise<number> {
  const sb = createClient();
  const { data } = await sb
    .from(TABLE)
    .select("number")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = (data?.number as number | undefined) ?? 0;
  return max + 1;
}

/** Verifica se slug está disponível (case-insensitive). */
export async function isSlugAvailable(
  slug: string,
  excludingId?: string,
): Promise<boolean> {
  const sb = createClient();
  let q = sb.from(TABLE).select("id").eq("slug", slug.toLowerCase());
  if (excludingId) q = q.neq("id", excludingId);
  const { data } = await q.maybeSingle();
  return data === null;
}
