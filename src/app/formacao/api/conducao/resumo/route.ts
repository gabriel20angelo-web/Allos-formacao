// Os números da área de condução.
//
// O hub mostra três cartões, e um cartão sem número é só um link com moldura:
// não diz se há trabalho esperando. O que decide se a pessoa abre "Meu grupo"
// hoje é justamente saber que há oito cortes por avaliar lá dentro.
//
// Cada bloco só é calculado para quem tem o cargo correspondente. A consulta
// usa a chave de serviço, que passa por cima das policies, então a divisão
// precisa ser feita aqui — e é a mesma que o catálogo de áreas faz na tela.

import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { quemEsta } from "@/lib/auth-servidor";
import { conjuntoTemAlgum } from "@/lib/cargos";
import { identificarCondutor, salasDoCondutor } from "@/lib/condutor";

export const dynamic = "force-dynamic";

interface Sala {
  dia_semana: number | null;
  hora: string | null;
  atividade_nome: string | null;
}

export async function GET() {
  const quem = await quemEsta();
  if (!quem) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const sb = await createServiceRoleClient();

  const resumo: {
    grupo?: {
      semFicha?: boolean;
      salas: Sala[];
      cortesPorVer: number;
      ultimoEncontro: string | null;
    };
    eventos?: { ativos: number; proximo: { titulo: string; data_inicio: string } | null };
    dinamicas?: { publicados: number };
  } = {};

  if (conjuntoTemAlgum(quem.cargos, ["condutor"])) {
    const eu = await identificarCondutor();

    if (!eu.ok) {
      // Sem ficha ligada à conta o vínculo não existe, e nenhuma sala é dela.
      // O cartão precisa dizer isso em vez de mostrar zero, que se confunde
      // com "ainda não aconteceu nada".
      resumo.grupo = { semFicha: true, salas: [], cortesPorVer: 0, ultimoEncontro: null };
    } else {
      const nomes = await salasDoCondutor(sb, eu.condutorId, eu.ehAdmin);

      let salas: Sala[] = [];
      let cortesPorVer = 0;
      let ultimoEncontro: string | null = null;

      if (nomes.length) {
        const { data: spaces } = await sb
          .from("formacao_meet_spaces")
          .select("slot_id")
          .in("space_name", nomes);

        const slotIds = (spaces || [])
          .map((s: { slot_id: string | null }) => s.slot_id)
          .filter(Boolean) as string[];

        if (slotIds.length) {
          const { data: slots } = await sb
            .from("formacao_slots")
            .select("dia_semana, atividade_nome, formacao_horarios(hora)")
            .in("id", slotIds);

          salas = ((slots || []) as unknown as {
            dia_semana: number | null;
            atividade_nome: string | null;
            formacao_horarios: { hora: string } | null;
          }[]).map((s) => ({
            dia_semana: s.dia_semana,
            hora: s.formacao_horarios?.hora ?? null,
            atividade_nome: s.atividade_nome,
          }));
        }

        const { data: encontros } = await sb
          .from("formacao_meet_encontros")
          .select("id, inicio")
          .in("space_name", nomes)
          .eq("descartado", false)
          .order("data_reuniao", { ascending: false })
          .limit(60);

        ultimoEncontro = encontros?.[0]?.inicio ?? null;

        const encontroIds = (encontros || []).map((e: { id: string }) => e.id);

        if (encontroIds.length) {
          const { data: jobs } = await sb
            .from("formacao_clip_jobs")
            .select("id")
            .in("encontro_id", encontroIds);

          const jobIds = (jobs || []).map((j: { id: string }) => j.id);

          if (jobIds.length) {
            // `avaliacao` nula é o corte que ninguém olhou ainda — é esse o
            // trabalho que o número anuncia.
            const { count } = await sb
              .from("formacao_clips")
              .select("id", { count: "exact", head: true })
              .in("job_id", jobIds)
              .eq("oculto", false)
              .is("avaliacao", null);
            cortesPorVer = count ?? 0;
          }
        }
      }

      resumo.grupo = { salas, cortesPorVer, ultimoEncontro };
    }
  }

  if (conjuntoTemAlgum(quem.cargos, ["eventos"])) {
    const { count } = await sb
      .from("certificado_eventos")
      .select("id", { count: "exact", head: true })
      .eq("ativo", true);

    const { data: proximos } = await sb
      .from("certificado_eventos")
      .select("titulo, data_inicio")
      .eq("ativo", true)
      .gte("data_inicio", new Date().toISOString())
      .order("data_inicio", { ascending: true })
      .limit(1);

    resumo.eventos = { ativos: count ?? 0, proximo: proximos?.[0] ?? null };
  }

  if (conjuntoTemAlgum(quem.cargos, ["associado", "condutor"])) {
    const { count } = await sb
      .from("aprimoramento_exercicios")
      .select("id", { count: "exact", head: true })
      .eq("status", "publicado");

    resumo.dinamicas = { publicados: count ?? 0 };
  }

  return NextResponse.json(resumo);
}
