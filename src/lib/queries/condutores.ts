import { createClient } from "@/lib/supabase/client";
import type { CertificadoCondutor } from "@/types";

const TABLE = "certificado_condutores";

export async function listCondutores() {
  const supabase = createClient();
  const { data, error } = await supabase.from(TABLE).select("*").order("nome");
  return { data: (data ?? []) as CertificadoCondutor[], error };
}

export async function listCondutoresAtivos() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("ativo", true)
    .order("nome");
  // arquivar já desativa, mas o filtro protege registros mexidos direto no banco
  const rows = ((data ?? []) as CertificadoCondutor[]).filter((c) => !c.arquivado);
  return { data: rows, error };
}

export async function getCondutorById(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .single();
  return { data: data as CertificadoCondutor | null, error };
}
