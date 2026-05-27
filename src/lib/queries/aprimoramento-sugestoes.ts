// Queries de aprimoramento_sugestoes pro associado (criar nova / listar
// próprias). Distinto do `*-admin.ts` que cuida da fila pro admin.
// RLS permite INSERT só com criado_por=self+status=pendente, e SELECT
// só dono/admin — não precisamos filtrar manualmente.

import { createClient } from "@/lib/supabase/client";
import type { CategorySlug } from "@/lib/aprimoramento-dinamicas";

const TABLE = "aprimoramento_sugestoes";

export type SugestaoStatus = "pendente" | "desenvolvido" | "descartado";

export interface MinhaSugestao {
  id: string;
  titulo: string;
  descricao: string;
  categoriaSugerida: CategorySlug | null;
  status: SugestaoStatus;
  notaAdmin: string;
  exercicioId: string | null;
  exercicioSlug: string | null;
  exercicioTitulo: string | null;
  exercicioStatus: "publicado" | "rascunho" | "arquivado" | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSugestaoInput {
  titulo: string;
  descricao: string;
  categoriaSugerida: CategorySlug | null;
}

export async function createSugestao(
  input: CreateSugestaoInput,
  userId: string,
) {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .insert({
      titulo: input.titulo.trim(),
      descricao: input.descricao.trim(),
      categoria_sugerida: input.categoriaSugerida,
      criado_por: userId,
      status: "pendente",
    })
    .select("*")
    .single();
  return { data, error };
}

interface SugestaoRowRaw {
  id: string;
  titulo: string;
  descricao: string;
  categoria_sugerida: CategorySlug | null;
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

export async function listMySugestoes(): Promise<MinhaSugestao[]> {
  const sb = createClient();
  const { data, error } = await sb
    .from(TABLE)
    .select("*, exercicio:aprimoramento_exercicios(slug, title, status)")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[listMySugestoes]", error);
    return [];
  }
  return ((data ?? []) as SugestaoRowRaw[]).map((r) => ({
    id: r.id,
    titulo: r.titulo,
    descricao: r.descricao,
    categoriaSugerida: r.categoria_sugerida,
    status: r.status,
    notaAdmin: r.nota_admin,
    exercicioId: r.exercicio_id,
    exercicioSlug: r.exercicio?.slug ?? null,
    exercicioTitulo: r.exercicio?.title ?? null,
    exercicioStatus: r.exercicio?.status ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}
