"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook reutilizável para obter o client Supabase no browser.
 *
 * O `createClient()` por baixo já é singleton (ver supabase/client.ts:70-91),
 * então o hook serve mais como convenção de uso (deixa explícito que é
 * client-side e memoiza a referência) do que ganho funcional. Use ele em
 * componentes novos; refatorar todas as ocorrências de `createClient()`
 * existentes é opcional.
 */
export function useSupabase() {
  return useMemo(() => createClient(), []);
}
