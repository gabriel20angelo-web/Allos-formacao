import { createClient } from "@/lib/supabase/client";

const TABLE = "aprimoramento_estados";

export type StatusValue = "favorito" | "feito" | "fazer-depois";

export interface AprimoramentoEstado {
  user_id: string;
  exercise_slug: string;
  status: StatusValue | null;
  notas: string;
  done_count: number;
  last_done_at: string | null;
  updated_at: string;
}

export async function listAprimoramentoEstados(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId);
  return { data: (data ?? []) as AprimoramentoEstado[], error };
}

type EstadoPatch = Partial<
  Pick<AprimoramentoEstado, "status" | "notas" | "done_count" | "last_done_at">
>;

export async function upsertAprimoramentoEstado(
  userId: string,
  slug: string,
  patch: EstadoPatch,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(
      { user_id: userId, exercise_slug: slug, ...patch },
      { onConflict: "user_id,exercise_slug" },
    )
    .select("*")
    .single();
  return { data: data as AprimoramentoEstado | null, error };
}

export async function deleteAprimoramentoEstado(userId: string, slug: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .eq("exercise_slug", slug);
  return { error };
}
