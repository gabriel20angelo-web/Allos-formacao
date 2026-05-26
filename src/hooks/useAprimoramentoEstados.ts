"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listAprimoramentoEstados,
  upsertAprimoramentoEstado,
  deleteAprimoramentoEstado,
  type AprimoramentoEstado,
  type StatusValue,
} from "@/lib/queries/aprimoramento";

export type StateMap = Map<string, AprimoramentoEstado>;

interface UseAprimoramentoEstadosResult {
  states: StateMap;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  /** Aplica/desaplica favorito ou "fazer-depois" (toggle). */
  toggleStatus: (slug: string, status: StatusValue) => Promise<void>;
  /** Marca "feito" + incrementa done_count + atualiza last_done_at. */
  markDone: (slug: string) => Promise<void>;
  /** Limpa status (mantém notas/done_count). */
  clearStatus: (slug: string) => Promise<void>;
  /** Atualiza notas privadas. Debounce/throttle é responsabilidade do caller. */
  setNotas: (slug: string, notas: string) => Promise<void>;
}

function emptyEstado(userId: string, slug: string): AprimoramentoEstado {
  return {
    user_id: userId,
    exercise_slug: slug,
    status: null,
    notas: "",
    done_count: 0,
    last_done_at: null,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Hook do estado pessoal de Aprimoramento de Dinâmicas (favorito/feito/depois +
 * notas privadas). `userId` null desativa o fetch — útil enquanto `useAuth`
 * ainda carrega. Implementa optimistic update em todas as actions.
 */
export function useAprimoramentoEstados(
  userId: string | null | undefined,
): UseAprimoramentoEstadosResult {
  const [states, setStates] = useState<StateMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!userId) {
      setStates(new Map());
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await listAprimoramentoEstados(userId);
    const map: StateMap = new Map();
    for (const row of res.data) map.set(row.exercise_slug, row);
    setStates(map);
    setError(res.error ? new Error(res.error.message) : null);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Helper interno: aplica optimistic, dispara request, sincroniza com retorno.
  const applyOptimistic = useCallback(
    async (
      slug: string,
      optimistic: AprimoramentoEstado,
      run: () => Promise<{
        data: AprimoramentoEstado | null;
        error: { message: string } | null;
      }>,
    ) => {
      setStates((prev) => {
        const next = new Map(prev);
        next.set(slug, optimistic);
        return next;
      });
      const res = await run();
      if (res.error) {
        // Rollback: refetch garante consistência.
        await refetch();
        return;
      }
      if (res.data) {
        setStates((prev) => {
          const next = new Map(prev);
          next.set(slug, res.data!);
          return next;
        });
      }
    },
    [refetch],
  );

  const toggleStatus = useCallback(
    async (slug: string, status: StatusValue) => {
      if (!userId) return;
      const cur = states.get(slug) ?? emptyEstado(userId, slug);
      const nextStatus: StatusValue | null = cur.status === status ? null : status;

      // Se vai virar null e a row tá "vazia" (sem notas/done_count), apaga.
      if (nextStatus === null && cur.notas === "" && cur.done_count === 0) {
        setStates((prev) => {
          const next = new Map(prev);
          next.delete(slug);
          return next;
        });
        const { error: delErr } = await deleteAprimoramentoEstado(userId, slug);
        if (delErr) await refetch();
        return;
      }

      const optimistic: AprimoramentoEstado = {
        ...cur,
        status: nextStatus,
        updated_at: new Date().toISOString(),
      };
      await applyOptimistic(slug, optimistic, () =>
        upsertAprimoramentoEstado(userId, slug, { status: nextStatus }),
      );
    },
    [userId, states, applyOptimistic, refetch],
  );

  const markDone = useCallback(
    async (slug: string) => {
      if (!userId) return;
      const cur = states.get(slug) ?? emptyEstado(userId, slug);
      const now = new Date().toISOString();
      const optimistic: AprimoramentoEstado = {
        ...cur,
        status: "feito",
        done_count: cur.done_count + 1,
        last_done_at: now,
        updated_at: now,
      };
      await applyOptimistic(slug, optimistic, () =>
        upsertAprimoramentoEstado(userId, slug, {
          status: "feito",
          done_count: optimistic.done_count,
          last_done_at: now,
        }),
      );
    },
    [userId, states, applyOptimistic],
  );

  const clearStatus = useCallback(
    async (slug: string) => {
      if (!userId) return;
      const cur = states.get(slug);
      if (!cur) return;

      if (cur.notas === "" && cur.done_count === 0) {
        setStates((prev) => {
          const next = new Map(prev);
          next.delete(slug);
          return next;
        });
        const { error: delErr } = await deleteAprimoramentoEstado(userId, slug);
        if (delErr) await refetch();
        return;
      }

      const optimistic: AprimoramentoEstado = {
        ...cur,
        status: null,
        updated_at: new Date().toISOString(),
      };
      await applyOptimistic(slug, optimistic, () =>
        upsertAprimoramentoEstado(userId, slug, { status: null }),
      );
    },
    [userId, states, applyOptimistic, refetch],
  );

  const setNotas = useCallback(
    async (slug: string, notas: string) => {
      if (!userId) return;
      const cur = states.get(slug) ?? emptyEstado(userId, slug);

      // Se notas viraram vazia E row já tá tudo zerado, apaga.
      if (
        notas === "" &&
        cur.status === null &&
        cur.done_count === 0
      ) {
        setStates((prev) => {
          const next = new Map(prev);
          next.delete(slug);
          return next;
        });
        const { error: delErr } = await deleteAprimoramentoEstado(userId, slug);
        if (delErr) await refetch();
        return;
      }

      const optimistic: AprimoramentoEstado = {
        ...cur,
        notas,
        updated_at: new Date().toISOString(),
      };
      await applyOptimistic(slug, optimistic, () =>
        upsertAprimoramentoEstado(userId, slug, { notas }),
      );
    },
    [userId, states, applyOptimistic, refetch],
  );

  return {
    states,
    loading,
    error,
    refetch,
    toggleStatus,
    markDone,
    clearStatus,
    setNotas,
  };
}
