// A sala só existe na hora do grupo.
//
// O link do Meet é permanente e não expira: encerrar a reunião fecha aquela
// conferência, mas quem tem o link abre outra em seguida. Para a sala ficar
// indisponível fora do horário, o que muda é o TIPO DE ACESSO.
//
//   OPEN        quem tem o link entra direto, ninguém precisa admitir
//   RESTRICTED  quem tenta entrar bate à porta, e sem ninguém dentro para
//               abrir, não entra
//
// Trocar entre os dois no horário certo dá o efeito de sala que abre e fecha,
// sem trocar link e sem ninguém de porteiro.

import { atualizarAcesso, MeetApiError } from "./client";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

/** Antecedência da abertura. Gente chega antes, e sala fechada na hora marcada irrita. */
const ABRE_ANTES_MIN = 15;

export interface ResultadoJanela {
  abertas: number;
  fechadas: number;
  ignoradas_manuais: number;
  erros: string[];
}

interface SpaceRow {
  space_name: string;
  slot_id: string | null;
  rotulo: string | null;
  access_type: string;
  janela_automatica: boolean;
}

export async function aplicarJanelaDeAcesso(sb: Sb): Promise<ResultadoJanela> {
  const res: ResultadoJanela = { abertas: 0, fechadas: 0, ignoradas_manuais: 0, erros: [] };

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, slot_id, rotulo, access_type, janela_automatica")
    .eq("ativo", true);

  if (!spaces?.length) return res;

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("limite_encerramento_min, duracao_minutos")
    .maybeSingle();

  // A sala fecha quando a reunião mais longa possível já teria acabado.
  const duracaoJanela =
    cronograma?.limite_encerramento_min || cronograma?.duracao_minutos || 120;

  const { data: slots } = await sb
    .from("formacao_slots")
    .select("id, dia_semana, horario_id")
    .eq("ativo", true);

  const { data: horarios } = await sb.from("formacao_horarios").select("id, hora");
  const horaPorId = new Map(
    (horarios || []).map((h: { id: string; hora: string }) => [h.id, h.hora])
  );

  const slotPorId = new Map(
    (slots || []).map((s: { id: string; dia_semana: number; horario_id: string }) => [s.id, s])
  );

  // Momento presente no fuso de quem participa, não no do servidor.
  const agora = new Date();
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(agora);

  const diaTexto = partes.find((p) => p.type === "weekday")?.value || "Mon";
  const horaAtual = parseInt(partes.find((p) => p.type === "hour")?.value || "0", 10);
  const minAtual = parseInt(partes.find((p) => p.type === "minute")?.value || "0", 10);
  const mapaDia: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const diaHoje = mapaDia[diaTexto] ?? 0;
  const minutosAgora = horaAtual * 60 + minAtual;

  for (const space of spaces as SpaceRow[]) {
    // Sala avulsa não tem horário na grade: fica sempre disponível, porque o
    // uso dela é justamente o imprevisto.
    if (!space.slot_id) continue;

    if (!space.janela_automatica) {
      res.ignoradas_manuais++;
      continue;
    }

    const slot = slotPorId.get(space.slot_id);
    if (!slot) continue;

    const hora = horaPorId.get(slot.horario_id);
    if (!hora) continue;

    const [hh, mm] = hora.split(":").map((n: string) => parseInt(n, 10));
    if (!Number.isFinite(hh)) continue;

    const inicioMin = hh * 60 + (Number.isFinite(mm) ? mm : 0);
    const abreMin = inicioMin - ABRE_ANTES_MIN;
    const fechaMin = inicioMin + duracaoJanela;

    const dentro =
      slot.dia_semana === diaHoje && minutosAgora >= abreMin && minutosAgora <= fechaMin;

    const desejado = dentro ? "OPEN" : "RESTRICTED";
    if (space.access_type === desejado) continue;

    try {
      await atualizarAcesso(space.space_name, desejado);
      await sb
        .from("formacao_meet_spaces")
        .update({ access_type: desejado })
        .eq("space_name", space.space_name);
      if (desejado === "OPEN") res.abertas++;
      else res.fechadas++;
    } catch (e) {
      const msg = e instanceof MeetApiError ? e.message : String(e);
      res.erros.push(`${space.rotulo || space.space_name}: ${msg}`);
    }
  }

  return res;
}
