"use client";

// Sinais arquivados (migration 047).
//
// Resolver um sinal não apaga nada: os sinais são recalculados a cada abertura
// do painel, então o que se guarda é a marca "isto já foi olhado", junto com o
// peso que a ocorrência tinha na hora.
//
// É esse peso que faz o caso voltar. Arquivado com 4 feedbacks, some da lista;
// se a pessoa mandar mais três, o peso recalculado passa do arquivado e a
// ocorrência reaparece sozinha. Arquivar é dar por resolvido o que aconteceu
// até ali, não abrir crédito para o que vier depois.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Sinal } from "@/lib/utils/suspeita";

export interface SinalResolvido {
  id: string;
  sinal_id: string;
  pessoa: string;
  pessoa_email: string | null;
  tipo: string;
  dia: string;
  titulo: string;
  peso_resolvido: number;
  observacao: string | null;
  resolvido_em: string;
}

export interface SinaisResolvidosApi {
  resolvidos: SinalResolvido[];
  /** sinal_id → peso arquivado, para o filtro não varrer a lista. */
  porSinal: Map<string, number>;
  loading: boolean;
  /** false quando a migration 047 ainda não rodou: a UI some em vez de errar. */
  available: boolean;
  resolver: (sinal: Sinal, observacao?: string) => Promise<boolean>;
  reabrir: (sinalId: string) => Promise<void>;
}

export function useSinaisResolvidos(enabled: boolean): SinaisResolvidosApi {
  const [resolvidos, setResolvidos] = useState<SinalResolvido[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  const carregar = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const sb = createClient();
    const { data, error } = await sb
      .from("sinais_resolvidos")
      .select("*")
      .order("resolvido_em", { ascending: false });

    if (error) {
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        setAvailable(false);
      }
      setLoading(false);
      return;
    }
    setResolvidos((data ?? []) as SinalResolvido[]);
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const resolver = useCallback(async (sinal: Sinal, observacao?: string) => {
    const sb = createClient();
    const registro = {
      sinal_id: sinal.id,
      pessoa: sinal.pessoa,
      pessoa_email: sinal.email ?? null,
      tipo: sinal.tipo,
      dia: sinal.dia,
      titulo: sinal.titulo,
      peso_resolvido: sinal.peso,
      observacao: observacao?.trim() || null,
    };

    // upsert: resolver de novo um caso que voltou atualiza o peso arquivado
    const { data, error } = await sb
      .from("sinais_resolvidos")
      .upsert(registro, { onConflict: "sinal_id" })
      .select("*")
      .single();

    if (error || !data) {
      toast.error(
        error?.code === "42P01"
          ? "Falta rodar a migration 047 (sinais resolvidos) no Supabase."
          : "Não foi possível arquivar."
      );
      return false;
    }

    setResolvidos((prev) => [
      data as SinalResolvido,
      ...prev.filter((r) => r.sinal_id !== sinal.id),
    ]);
    toast.success("Ocorrência arquivada.");
    return true;
  }, []);

  const reabrir = useCallback(async (sinalId: string) => {
    const sb = createClient();
    const { error } = await sb
      .from("sinais_resolvidos")
      .delete()
      .eq("sinal_id", sinalId);
    if (error) {
      toast.error("Não foi possível reabrir.");
      return;
    }
    setResolvidos((prev) => prev.filter((r) => r.sinal_id !== sinalId));
    toast.success("Ocorrência reaberta.");
  }, []);

  const porSinal = new Map<string, number>();
  resolvidos.forEach((r) => porSinal.set(r.sinal_id, r.peso_resolvido));

  return { resolvidos, porSinal, loading, available, resolver, reabrir };
}

/**
 * Separa o que ainda pede atenção do que já foi arquivado.
 *
 * Um sinal arquivado volta para a lista aberta quando o peso atual supera o que
 * foi resolvido: é a assinatura de que aconteceu coisa nova depois do
 * arquivamento.
 */
export function separarSinais(
  sinais: Sinal[],
  porSinal: Map<string, number>
): { abertos: Sinal[]; arquivados: Sinal[] } {
  const abertos: Sinal[] = [];
  const arquivados: Sinal[] = [];
  sinais.forEach((s) => {
    const pesoArquivado = porSinal.get(s.id);
    if (pesoArquivado !== undefined && s.peso <= pesoArquivado) arquivados.push(s);
    else abertos.push(s);
  });
  return { abertos, arquivados };
}
