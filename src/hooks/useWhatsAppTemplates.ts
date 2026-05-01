"use client";

import { useEffect, useState, useCallback } from "react";
import { listWhatsAppTemplates } from "@/lib/queries";
import type { WhatsAppTemplate } from "@/types";

interface UseWhatsAppTemplatesResult {
  data: WhatsAppTemplate[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<WhatsAppTemplate[]>>;
}

/**
 * Hook das mensagens salvas do usuário. `userId` null/undefined desativa o
 * fetch — útil enquanto o useAuth ainda está carregando.
 */
export function useWhatsAppTemplates(
  userId: string | null | undefined
): UseWhatsAppTemplatesResult {
  const [data, setData] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const res = await listWhatsAppTemplates(userId);
    setData(res.data);
    setError(res.error ? new Error(res.error.message) : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    refetch();
  }, [refetch, userId]);

  return { data, loading, error, refetch, setData };
}
