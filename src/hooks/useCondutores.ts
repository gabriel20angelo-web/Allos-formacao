"use client";

import { useEffect, useState, useCallback } from "react";
import { listCondutores, listCondutoresAtivos } from "@/lib/queries";
import type { CertificadoCondutor } from "@/types";

interface UseCondutoresOptions {
  /**
   * Se true, traz só ativos (default false — admin geralmente quer tudo).
   */
  onlyAtivos?: boolean;
}

interface UseCondutoresResult {
  data: CertificadoCondutor[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<CertificadoCondutor[]>>;
}

export function useCondutores({
  onlyAtivos = false,
}: UseCondutoresOptions = {}): UseCondutoresResult {
  const [data, setData] = useState<CertificadoCondutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    const fn = onlyAtivos ? listCondutoresAtivos : listCondutores;
    const res = await fn();
    setData(res.data);
    setError(res.error ? new Error(res.error.message) : null);
    setLoading(false);
  }, [onlyAtivos]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { data, loading, error, refetch, setData };
}
