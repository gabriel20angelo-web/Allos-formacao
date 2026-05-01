import { createClient } from "@/lib/supabase/client";
import type { WhatsAppTemplate } from "@/types";

const TABLE = "whatsapp_templates";

export async function listWhatsAppTemplates(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return { data: (data ?? []) as WhatsAppTemplate[], error };
}

export async function createWhatsAppTemplate(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ user_id: userId, titulo: "", mensagem: "" })
    .select("*")
    .single();
  return { data: data as WhatsAppTemplate | null, error };
}

export async function updateWhatsAppTemplate(
  id: string,
  fields: Partial<Pick<WhatsAppTemplate, "titulo" | "mensagem">>
) {
  const supabase = createClient();
  const { error } = await supabase
    .from(TABLE)
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id);
  return { error };
}

export async function deleteWhatsAppTemplate(id: string) {
  const supabase = createClient();
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  return { error };
}
