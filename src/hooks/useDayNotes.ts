"use client";

// Anotações de dia (migration 040). Compartilhadas pelas duas abas do
// dashboard: uma divulgação move cursos e grupos ao mesmo tempo, então a nota
// pertence ao dia, não à aba.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface DayNote {
  id: string;
  /** yyyy-mm-dd — mesma chave que a timeline usa para agrupar. */
  data: string;
  texto: string;
  created_at: string;
}

export interface DayNotesApi {
  notes: DayNote[];
  /** Índice por dia, para o gráfico e os cabeçalhos não varrerem a lista. */
  byDay: Map<string, DayNote[]>;
  loading: boolean;
  /** false quando a migration 040 ainda não rodou — a UI some em vez de errar. */
  available: boolean;
  save: (data: string, texto: string, id?: string) => Promise<boolean>;
  remove: (id: string) => Promise<void>;
}

export function useDayNotes(enabled: boolean): DayNotesApi {
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const fetchNotes = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    const { data, error } = await supabase
      .from("formacao_notas_dia")
      .select("id, data, texto, created_at")
      .order("data", { ascending: false });

    if (error) {
      // 42P01 = relação inexistente: migration 040 pendente
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setAvailable(false);
      }
      setLoading(false);
      return;
    }
    setNotes((data ?? []) as DayNote[]);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const save = useCallback(
    async (data: string, texto: string, id?: string) => {
      const limpo = texto.trim();
      if (!limpo) return false;
      const supabase = createClient();

      if (id) {
        const { error } = await supabase
          .from("formacao_notas_dia")
          .update({ texto: limpo, data, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) {
          toast.error("Erro ao salvar anotação.");
          return false;
        }
        setNotes((prev) =>
          prev.map((n) => (n.id === id ? { ...n, texto: limpo, data } : n))
        );
        toast.success("Anotação salva.");
        return true;
      }

      const { data: inserted, error } = await supabase
        .from("formacao_notas_dia")
        .insert({ data, texto: limpo })
        .select("id, data, texto, created_at")
        .single();
      if (error || !inserted) {
        toast.error(
          error?.code === "42P01"
            ? "Falta rodar a migration 040 (anotações) no Supabase."
            : "Erro ao criar anotação."
        );
        return false;
      }
      setNotes((prev) =>
        [inserted as DayNote, ...prev].sort((a, b) => b.data.localeCompare(a.data))
      );
      toast.success("Anotação criada.");
      return true;
    },
    []
  );

  const remove = useCallback(async (id: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("formacao_notas_dia")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao remover anotação.");
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    toast.success("Anotação removida.");
  }, []);

  const byDay = new Map<string, DayNote[]>();
  notes.forEach((n) => {
    const list = byDay.get(n.data);
    if (list) list.push(n);
    else byDay.set(n.data, [n]);
  });

  return { notes, byDay, loading, available, save, remove };
}
