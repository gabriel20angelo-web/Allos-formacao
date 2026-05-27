// Queries client-side de `aprimoramento_sugestoes` pro painel admin.
// RLS já garante que só admin lê tudo / faz UPDATE (criadores só veem
// as próprias).

import { createClient } from "@/lib/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Block, CategorySlug } from "@/lib/aprimoramento-dinamicas";
import {
  createExercicio,
  type AdminExercicioRow,
} from "./aprimoramento-exercicios-admin";

const TABLE = "aprimoramento_sugestoes";
const EXERCICIOS_TABLE = "aprimoramento_exercicios";

export type SugestaoStatus = "pendente" | "desenvolvido" | "descartado";

export interface SugestaoAdminRow {
  id: string;
  titulo: string;
  descricao: string;
  categoriaSugerida: CategorySlug | null;
  criadoPor: string;
  criadoPorNome: string | null;
  criadoPorEmail: string | null;
  status: SugestaoStatus;
  notaAdmin: string;
  exercicioId: string | null;
  exercicioSlug: string | null;
  exercicioTitulo: string | null;
  exercicioStatus: "publicado" | "rascunho" | "arquivado" | null;
  createdAt: string;
  updatedAt: string;
}

interface SugestaoRowRaw {
  id: string;
  titulo: string;
  descricao: string;
  categoria_sugerida: CategorySlug | null;
  criado_por: string;
  status: SugestaoStatus;
  nota_admin: string;
  exercicio_id: string | null;
  created_at: string;
  updated_at: string;
  exercicio?: {
    slug: string;
    title: string;
    status: "publicado" | "rascunho" | "arquivado";
  } | null;
}

export async function listSugestoesForAdmin(): Promise<SugestaoAdminRow[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*, exercicio:aprimoramento_exercicios(slug, title, status)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listSugestoesForAdmin]", error);
    return [];
  }
  const rows = (data ?? []) as SugestaoRowRaw[];

  // Resolve nomes em lote — auth.users não tem FK direta com profiles que
  // PostgREST consiga inferir, então fazemos uma 2ª query simples.
  const userIds = Array.from(new Set(rows.map((r) => r.criado_por)));
  const profileMap = new Map<
    string,
    { name: string | null; email: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    for (const p of (profiles ?? []) as Array<{
      id: string;
      full_name: string | null;
      email: string | null;
    }>) {
      profileMap.set(p.id, { name: p.full_name, email: p.email });
    }
  }

  return rows.map((r) => {
    const prof = profileMap.get(r.criado_por);
    return {
      id: r.id,
      titulo: r.titulo,
      descricao: r.descricao,
      categoriaSugerida: r.categoria_sugerida,
      criadoPor: r.criado_por,
      criadoPorNome: prof?.name ?? null,
      criadoPorEmail: prof?.email ?? null,
      status: r.status,
      notaAdmin: r.nota_admin,
      exercicioId: r.exercicio_id,
      exercicioSlug: r.exercicio?.slug ?? null,
      exercicioTitulo: r.exercicio?.title ?? null,
      exercicioStatus: r.exercicio?.status ?? null,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export async function countSugestoesPendentes(): Promise<number> {
  const sb = createClient();
  const { count } = await sb
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("status", "pendente");
  return count ?? 0;
}

export async function descartarSugestao(id: string, notaAdmin: string) {
  const sb = createClient();
  const { error } = await sb
    .from(TABLE)
    .update({ status: "descartado", nota_admin: notaAdmin })
    .eq("id", id);
  return { error };
}

export async function reabrirSugestao(id: string) {
  const sb = createClient();
  const { error } = await sb
    .from(TABLE)
    .update({ status: "pendente", nota_admin: "", exercicio_id: null })
    .eq("id", id);
  return { error };
}

export async function deleteSugestao(id: string) {
  const sb = createClient();
  const { error } = await sb.from(TABLE).delete().eq("id", id);
  return { error };
}

/**
 * Cria um exercício rascunho a partir da sugestão e vincula via `exercicio_id`.
 * O exercício fica `status=rascunho` + `curado=false`; admin termina de editar
 * em `/admin/associados/aprimoramento/[id]/editar`.
 */
export async function transformarEmRascunho(
  sugestao: SugestaoAdminRow,
  adminUserId: string,
): Promise<{
  exercicio: AdminExercicioRow | null;
  error: { message: string } | null;
}> {
  const sb = createClient();

  const nextNumber = await nextExerciseNumber(sb);
  const slug = await ensureUniqueSlug(sb, slugifyTitle(sugestao.titulo));

  const summary = sugestao.descricao.trim().slice(0, 200);
  const blocks: Block[] = sugestao.descricao.trim()
    ? [{ type: "paragraph", text: sugestao.descricao.trim() }]
    : [];

  const { data: ex, error: createErr } = await createExercicio(
    {
      slug,
      number: nextNumber,
      title: sugestao.titulo,
      summary,
      category: sugestao.categoriaSugerida ?? "tecnica",
      formato: [],
      tags: [],
      blocks,
      curado: false,
      status: "rascunho",
    },
    adminUserId,
  );

  if (createErr || !ex) {
    return {
      exercicio: null,
      error: createErr ?? { message: "Falha ao criar rascunho" },
    };
  }

  const { error: updErr } = await sb
    .from(TABLE)
    .update({ status: "desenvolvido", exercicio_id: ex.id })
    .eq("id", sugestao.id);
  if (updErr) {
    // O exercício foi criado — não dá pra reverter sem complicar. Loga.
    console.error("[transformarEmRascunho] update sugestão falhou:", updErr);
  }

  return { exercicio: ex, error: null };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function slugifyTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function nextExerciseNumber(sb: SupabaseClient): Promise<number> {
  const { data } = await sb
    .from(EXERCICIOS_TABLE)
    .select("number")
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const max = (data?.number as number | undefined) ?? 0;
  return max + 1;
}

async function ensureUniqueSlug(
  sb: SupabaseClient,
  base: string,
): Promise<string> {
  const root = base || "sugestao-sem-titulo";
  let suffix = 0;
  // Loop seguro — em produção raramente passa de 1-2 iterações.
  while (suffix < 100) {
    const candidate = suffix === 0 ? root : `${root}-${suffix}`;
    const { data } = await sb
      .from(EXERCICIOS_TABLE)
      .select("id")
      .eq("slug", candidate)
      .maybeSingle();
    if (!data) return candidate;
    suffix += 1;
  }
  // Fallback se 100 colisões (improvável)
  return `${root}-${Date.now()}`;
}
