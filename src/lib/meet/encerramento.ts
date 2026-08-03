// Fecha reunião que ficou aberta além do razoável.
//
// A sala é permanente: o link não expira, e uma reunião esquecida aberta segue
// de pé gravando. O caso que preocupa não é o encontro que passou vinte minutos
// do horário, é a sala que fica ligada de madrugada com uma pessoa dentro, ou
// vazia, produzindo horas de gravação no Drive da associação.
//
// Encerrar derruba quem estiver dentro, então o limite é generoso de propósito
// e configurável: melhor cortar tarde do que cortar um grupo que se estendeu.

import { encerrarConferencia, listarConferencias, MeetApiError } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ResultadoEncerramento {
  salas_verificadas: number;
  encerradas: number;
  detalhes: string[];
  erros: string[];
}

export async function encerrarReunioesLongas(sb: Sb): Promise<ResultadoEncerramento> {
  const res: ResultadoEncerramento = {
    salas_verificadas: 0,
    encerradas: 0,
    detalhes: [],
    erros: [],
  };

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("limite_encerramento_min")
    .maybeSingle();

  const limiteMin = cronograma?.limite_encerramento_min ?? 120;
  if (!limiteMin || limiteMin <= 0) return res; // desligado de propósito

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, rotulo, slot_id")
    .eq("ativo", true);

  if (!spaces?.length) return res;

  // Vinte e quatro horas para trás cobre qualquer reunião que ainda esteja de
  // pé sem trazer histórico irrelevante.
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000);

  for (const space of spaces as { space_name: string; rotulo: string | null }[]) {
    res.salas_verificadas++;
    try {
      const conferencias = await listarConferencias(space.space_name, desde);

      // Sem hora de fim significa em andamento agora.
      const ativa = conferencias.find((c) => !c.endTime);
      if (!ativa) continue;

      const minutos = (Date.now() - new Date(ativa.startTime).getTime()) / 60_000;
      if (minutos < limiteMin) continue;

      await encerrarConferencia(space.space_name);
      res.encerradas++;
      res.detalhes.push(
        `${space.rotulo || space.space_name}: encerrada após ${Math.round(minutos)} minutos.`
      );
    } catch (e) {
      // Sala vazia entre a checagem e o encerramento devolve erro do Google, e
      // isso não é falha: alguém fechou antes.
      if (e instanceof MeetApiError && (e.status === 404 || e.status === 400)) continue;
      res.erros.push(
        `${space.space_name}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  return res;
}
