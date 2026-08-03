"use client";

// Sinais que saíram da lista aberta (migrations 047 e 049).
//
// Resolver ou avisar não apaga nada: os sinais são recalculados a cada abertura
// do painel, então o que se guarda é a marca do que já foi feito, junto com o
// peso que a ocorrência tinha na hora.
//
// Dois destinos, porque são situações diferentes:
//   email_enviado — a pessoa foi avisada, esperando manifestação
//   arquivado     — caso conferido e encerrado
//
// O peso é o que faz a ocorrência voltar. Avisada com 4 feedbacks, sai da
// lista; se a pessoa mandar mais três, o peso recalculado passa do gravado e o
// caso reaparece sozinho em aberto. Avisar ou arquivar vale para o que
// aconteceu até ali, não para o que vier depois.

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Sinal } from "@/lib/utils/suspeita";

export type EstadoSinal = "email_enviado" | "arquivado";

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
  estado: EstadoSinal;
  resolvido_em: string;
}

export interface MarcaSinal {
  peso: number;
  estado: EstadoSinal;
  quando: string;
}

export interface SinaisResolvidosApi {
  resolvidos: SinalResolvido[];
  /** sinal_id → o que já foi feito com ele, para o filtro não varrer a lista. */
  porSinal: Map<string, MarcaSinal>;
  loading: boolean;
  /** false quando a migration 047 ainda não rodou: a UI some em vez de errar. */
  available: boolean;
  resolver: (sinal: Sinal, observacao?: string) => Promise<boolean>;
  /** Depois do envio do e-mail, tira os casos avisados da lista aberta. */
  marcarEmailEnviado: (sinais: Sinal[]) => Promise<void>;
  reabrir: (sinalId: string) => Promise<void>;
  recarregar: () => Promise<void>;
}

function registroDe(sinal: Sinal, estado: EstadoSinal, observacao?: string) {
  return {
    sinal_id: sinal.id,
    pessoa: sinal.pessoa,
    pessoa_email: sinal.email ?? null,
    tipo: sinal.tipo,
    dia: sinal.dia,
    titulo: sinal.titulo,
    peso_resolvido: sinal.peso,
    observacao: observacao?.trim() || null,
    estado,
  };
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
    // upsert: um caso que voltou e foi resolvido de novo atualiza o peso
    const { data, error } = await sb
      .from("sinais_resolvidos")
      .upsert(registroDe(sinal, "arquivado", observacao), {
        onConflict: "sinal_id",
      })
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

  const marcarEmailEnviado = useCallback(async (sinais: Sinal[]) => {
    if (sinais.length === 0) return;
    const sb = createClient();
    const { data, error } = await sb
      .from("sinais_resolvidos")
      .upsert(
        sinais.map((s) => registroDe(s, "email_enviado")),
        { onConflict: "sinal_id" }
      )
      .select("*");

    // Falhar aqui não é crítico: o e-mail já saiu. O caso só continua na lista
    // aberta, e o histórico de envios em email_envios registra o que foi feito.
    if (error || !data) return;

    const ids = new Set(sinais.map((s) => s.id));
    setResolvidos((prev) => [
      ...(data as SinalResolvido[]),
      ...prev.filter((r) => !ids.has(r.sinal_id)),
    ]);
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

  const porSinal = new Map<string, MarcaSinal>();
  resolvidos.forEach((r) =>
    porSinal.set(r.sinal_id, {
      peso: r.peso_resolvido,
      // registros gravados antes da 049 não têm estado: valem como arquivados
      estado: r.estado ?? "arquivado",
      quando: r.resolvido_em,
    })
  );

  return {
    resolvidos,
    porSinal,
    loading,
    available,
    resolver,
    marcarEmailEnviado,
    reabrir,
    recarregar: carregar,
  };
}

export interface SinaisSeparados {
  abertos: Sinal[];
  avisados: Sinal[];
  arquivados: Sinal[];
}

/**
 * Divide os sinais entre os três destinos.
 *
 * Um sinal que já saiu da lista volta para "abertos" quando o peso atual supera
 * o gravado: é a assinatura de que aconteceu coisa nova depois da última ação.
 */
export function separarSinais(
  sinais: Sinal[],
  porSinal: Map<string, MarcaSinal>
): SinaisSeparados {
  const abertos: Sinal[] = [];
  const avisados: Sinal[] = [];
  const arquivados: Sinal[] = [];

  sinais.forEach((s) => {
    const marca = porSinal.get(s.id);
    if (!marca || s.peso > marca.peso) {
      abertos.push(s);
      return;
    }
    if (marca.estado === "email_enviado") avisados.push(s);
    else arquivados.push(s);
  });

  return { abertos, avisados, arquivados };
}
