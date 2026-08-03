// Indicadores agregados do quórum automático.
//
// É rota de servidor e não consulta client-side porque retenção por coorte
// precisa de todas as participações do período: puxar isso para o browser a
// cada abertura do dashboard seria caro e lento.
//
// Duas escolhas que definem o significado dos números:
//
// 1. Quórum aqui exclui o condutor. Contar quem conduz junto com quem participa
//    infla todo grupo em uma pessoa e faz grupo vazio parecer grupo de um.
// 2. "Vozes ativas" só considera encontros com transcrição. Misturar encontro
//    sem transcrição na média puxaria o indicador para baixo por ausência de
//    dado, não por silêncio real.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface EncontroRow {
  id: string;
  slot_id: string | null;
  atividade_nome: string | null;
  condutor_nome: string | null;
  data_reuniao: string;
  dia_semana: number;
  duracao_min: number | null;
  total_participantes: number;
  identificados: number;
  media_permanencia_pct: number | null;
  vozes_ativas_pct: number | null;
  fala_condutor_pct: number | null;
}

interface ParticipacaoRow {
  encontro_id: string;
  aluno_id: string | null;
  display_name: string;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  eh_condutor: boolean;
}

function media(ns: number[]): number | null {
  const validos = ns.filter((n) => Number.isFinite(n));
  if (!validos.length) return null;
  return Math.round((validos.reduce((a, b) => a + b, 0) / validos.length) * 10) / 10;
}

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const dias = Math.min(Math.max(Number(req.nextUrl.searchParams.get("dias")) || 90, 7), 730);
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const sb = await createServiceRoleClient();

  const { data: encontros, error: errEnc } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, slot_id, atividade_nome, condutor_nome, data_reuniao, dia_semana, duracao_min, total_participantes, identificados, media_permanencia_pct, vozes_ativas_pct, fala_condutor_pct"
    )
    .gte("data_reuniao", desde)
    .order("data_reuniao", { ascending: true });

  if (errEnc) {
    return NextResponse.json({ error: errEnc.message }, { status: 500 });
  }

  const lista = (encontros || []) as EncontroRow[];
  if (!lista.length) {
    return NextResponse.json({ vazio: true, dias, encontros: 0 });
  }

  const ids = lista.map((e) => e.id);
  const { data: parts } = await sb
    .from("formacao_meet_participacoes")
    .select(
      "encontro_id, aluno_id, display_name, minutos_presentes, permanencia_pct, atraso_min, minutos_fala, eh_condutor"
    )
    .in("encontro_id", ids);

  const participacoes = ((parts || []) as ParticipacaoRow[]).filter((p) => !p.eh_condutor);

  // ── visão geral ──
  const porEncontro = new Map<string, ParticipacaoRow[]>();
  for (const p of participacoes) {
    porEncontro.set(p.encontro_id, [...(porEncontro.get(p.encontro_id) || []), p]);
  }

  const quoruns = lista.map((e) => (porEncontro.get(e.id) || []).length);
  const comTranscricao = lista.filter((e) => e.vozes_ativas_pct !== null);

  const geral = {
    encontros: lista.length,
    quorum_medio: media(quoruns),
    quorum_maximo: Math.max(...quoruns, 0),
    minutos_medios_por_pessoa: media(participacoes.map((p) => p.minutos_presentes)),
    permanencia_media_pct: media(participacoes.map((p) => p.permanencia_pct ?? NaN)),
    atraso_medio_min: media(participacoes.map((p) => p.atraso_min ?? NaN)),
    vozes_ativas_pct: media(comTranscricao.map((e) => e.vozes_ativas_pct ?? NaN)),
    fala_condutor_pct: media(comTranscricao.map((e) => e.fala_condutor_pct ?? NaN)),
    encontros_com_transcricao: comTranscricao.length,
    identificacao_pct:
      participacoes.length > 0
        ? Math.round(
            (participacoes.filter((p) => p.aluno_id).length / participacoes.length) * 1000
          ) / 10
        : null,
  };

  // ── por dia da semana: separa efeito de horário de efeito de condução ──
  const porDia = new Map<number, number[]>();
  for (const e of lista) {
    const n = (porEncontro.get(e.id) || []).length;
    porDia.set(e.dia_semana, [...(porDia.get(e.dia_semana) || []), n]);
  }
  const dia_semana = Array.from(porDia.entries())
    .map(([dia, ns]) => ({ dia, encontros: ns.length, quorum_medio: media(ns) }))
    .sort((a, b) => a.dia - b.dia);

  // ── por grupo, com tendência: metade recente contra metade antiga ──
  const porSlot = new Map<string, EncontroRow[]>();
  for (const e of lista) {
    const chave = e.slot_id || `sem-slot:${e.atividade_nome || "?"}`;
    porSlot.set(chave, [...(porSlot.get(chave) || []), e]);
  }

  const grupos = Array.from(porSlot.entries())
    .map(([chave, encs]) => {
      const ns = encs.map((e) => (porEncontro.get(e.id) || []).length);
      const meio = Math.floor(ns.length / 2);
      const antigos = ns.slice(0, meio);
      const recentes = ns.slice(meio);
      const mA = media(antigos);
      const mR = media(recentes);
      return {
        chave,
        atividade: encs[0]?.atividade_nome || null,
        condutor: encs[0]?.condutor_nome || null,
        encontros: encs.length,
        quorum_medio: media(ns),
        tendencia:
          mA !== null && mR !== null && ns.length >= 4
            ? Math.round((mR - mA) * 10) / 10
            : null,
        vozes_ativas_pct: media(encs.map((e) => e.vozes_ativas_pct ?? NaN)),
        fala_condutor_pct: media(encs.map((e) => e.fala_condutor_pct ?? NaN)),
      };
    })
    .sort((a, b) => (b.quorum_medio ?? 0) - (a.quorum_medio ?? 0));

  // ── pessoas ──
  const porPessoa = new Map<
    string,
    { nome: string; aluno_id: string | null; encontros: number; minutos: number; fala: number; ultima: string }
  >();
  const dataDoEncontro = new Map(lista.map((e) => [e.id, e.data_reuniao]));

  for (const p of participacoes) {
    const chave = p.aluno_id || `nome:${p.display_name}`;
    const atual = porPessoa.get(chave);
    const dataEnc = dataDoEncontro.get(p.encontro_id) || "";
    porPessoa.set(chave, {
      nome: p.display_name,
      aluno_id: p.aluno_id,
      encontros: (atual?.encontros || 0) + 1,
      minutos: (atual?.minutos || 0) + p.minutos_presentes,
      fala: (atual?.fala || 0) + (p.minutos_fala || 0),
      ultima: atual && atual.ultima > dataEnc ? atual.ultima : dataEnc,
    });
  }

  const pessoas = Array.from(porPessoa.values());
  const mais_presentes = [...pessoas]
    .sort((a, b) => b.encontros - a.encontros || b.minutos - a.minutos)
    .slice(0, 10);

  // Quem participava e parou. O corte é o último encontro em que a pessoa
  // apareceu comparado com a data do encontro mais recente do período.
  const ultimaData = lista[lista.length - 1].data_reuniao;
  const limite = new Date(new Date(ultimaData).getTime() - 21 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const sumindo = pessoas
    .filter((p) => p.encontros >= 3 && p.ultima < limite)
    .sort((a, b) => (a.ultima < b.ultima ? -1 : 1))
    .slice(0, 15);

  // Presente e mudo: só faz sentido onde houve transcrição.
  const idsComTranscricao = new Set(comTranscricao.map((e) => e.id));
  const mudosPorPessoa = new Map<string, { nome: string; encontros: number }>();
  for (const p of participacoes) {
    if (!idsComTranscricao.has(p.encontro_id)) continue;
    if ((p.minutos_fala || 0) > 0) continue;
    const chave = p.aluno_id || `nome:${p.display_name}`;
    const atual = mudosPorPessoa.get(chave);
    mudosPorPessoa.set(chave, {
      nome: p.display_name,
      encontros: (atual?.encontros || 0) + 1,
    });
  }
  const calados = Array.from(mudosPorPessoa.values())
    .filter((m) => m.encontros >= 3)
    .sort((a, b) => b.encontros - a.encontros)
    .slice(0, 15);

  // ── série semanal, para a curva do grupo ──
  const porSemana = new Map<string, Set<string>>();
  for (const e of lista) {
    const d = new Date(e.data_reuniao + "T12:00:00");
    const diff = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const segunda = new Date(d);
    segunda.setDate(d.getDate() - diff);
    const chave = segunda.toISOString().slice(0, 10);
    const set = porSemana.get(chave) || new Set<string>();
    for (const p of porEncontro.get(e.id) || []) {
      set.add(p.aluno_id || `nome:${p.display_name}`);
    }
    porSemana.set(chave, set);
  }
  const semanas = Array.from(porSemana.entries())
    .map(([semana, set]) => ({ semana, pessoas: set.size }))
    .sort((a, b) => a.semana.localeCompare(b.semana));

  return NextResponse.json({
    vazio: false,
    dias,
    geral,
    dia_semana,
    grupos,
    mais_presentes,
    sumindo,
    calados,
    semanas,
  });
}
