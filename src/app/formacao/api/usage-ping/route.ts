import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * POST /formacao/api/usage-ping
 *
 * Recebe o sinal de presença do UsageTracker e costura os sinais em sessões
 * na tabela usage_sessions (ver supabase/migrations/042_usage_sessions.sql).
 *
 * O player é um iframe de terceiro, então tempo real de reprodução não é
 * legível. O que se mede aqui é permanência ativa: cada sinal soma o intervalo
 * desde o sinal anterior da mesma sessão.
 *
 * A escrita é sempre por service role. A tabela não tem policy de INSERT de
 * propósito, justamente para que ninguém consiga forjar tempo direto pelo
 * client; todo número que entra passa pelos limites definidos abaixo.
 */

// Janela de costura da migration: sinal que chega até 3 minutos depois do
// anterior continua a mesma sessão, passou disso abre outra.
const JANELA_COSTURA_MS = 3 * 60 * 1000;

// Teto do que um único sinal pode somar. O cliente pinga a cada 60s, então
// qualquer delta acima disso veio de aba dormindo (throttle do navegador,
// notebook fechado) ou de ping forjado. Somar o delta real limitado a 90s
// cobre atraso de rede sem deixar duas horas de tela apagada virarem estudo.
const DELTA_MAXIMO_S = 90;

// Se a pessoa já pingou há menos disso, não há tempo relevante a somar e a
// escrita é descartada. Serve de rate limit barato contra ping em loop.
const INTERVALO_MINIMO_MS = 30 * 1000;

const CONTEXTOS_VALIDOS = ["aula", "curso", "meus-cursos", "admin", "formacao"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Devolve o valor só quando ele é um uuid de verdade; qualquer outra coisa vira null. */
function comoUuid(valor: unknown): string | null {
  return typeof valor === "string" && UUID_RE.test(valor) ? valor : null;
}

interface SessaoAberta {
  id: string;
  ended_at: string;
  seconds: number;
}

export async function POST(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const bruto = (body ?? {}) as Record<string, unknown>;

  const contexto =
    typeof bruto.contexto === "string" && CONTEXTOS_VALIDOS.includes(bruto.contexto)
      ? bruto.contexto
      : "formacao";
  const lessonId = comoUuid(bruto.lessonId);
  let courseId = comoUuid(bruto.courseId);

  const sb = await createServiceRoleClient();
  const agora = new Date();

  // Rate limit: olha o último sinal desta pessoa em qualquer contexto.
  const { data: ultimo } = await sb
    .from("usage_sessions")
    .select("ended_at")
    .eq("user_id", user.id)
    .order("ended_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ultimo?.ended_at) {
    const desdeUltimo = agora.getTime() - new Date(ultimo.ended_at).getTime();
    if (desdeUltimo < INTERVALO_MINIMO_MS) {
      return NextResponse.json({ ok: true, ignorado: "muito-cedo" });
    }
  }

  // Sessão a costurar: a mais recente desta pessoa na MESMA aula (inclusive
  // quando "mesma aula" quer dizer nenhuma aula) com o último sinal dentro da
  // janela. Trocar de aula abre sessão nova para o tempo não se misturar.
  const inicioJanela = new Date(agora.getTime() - JANELA_COSTURA_MS).toISOString();
  let busca = sb
    .from("usage_sessions")
    .select("id, ended_at, seconds")
    .eq("user_id", user.id)
    .gte("ended_at", inicioJanela)
    .order("ended_at", { ascending: false })
    .limit(1);
  // .eq(coluna, null) não filtra nada no PostgREST; null exige .is().
  busca = lessonId ? busca.eq("lesson_id", lessonId) : busca.is("lesson_id", null);

  const { data: aberta } = await busca.maybeSingle();
  const sessao = aberta as SessaoAberta | null;

  if (sessao) {
    const deltaReal = Math.floor(
      (agora.getTime() - new Date(sessao.ended_at).getTime()) / 1000,
    );
    const delta = Math.max(0, Math.min(deltaReal, DELTA_MAXIMO_S));

    const { error } = await sb
      .from("usage_sessions")
      .update({
        seconds: (sessao.seconds ?? 0) + delta,
        ended_at: agora.toISOString(),
      })
      .eq("id", sessao.id);

    if (error) {
      console.error("[usage-ping] update", error);
      return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      sessao: sessao.id,
      seconds: (sessao.seconds ?? 0) + delta,
    });
  }

  // Sessão nova. O curso só é resolvido aqui porque a consulta custa duas
  // idas ao banco e, dentro de uma sessão já aberta, o valor não muda.
  if (!courseId && lessonId) {
    const { data: lesson } = await sb
      .from("lessons")
      .select("section_id")
      .eq("id", lessonId)
      .maybeSingle();
    const sectionId = comoUuid(lesson?.section_id);
    if (sectionId) {
      const { data: section } = await sb
        .from("sections")
        .select("course_id")
        .eq("id", sectionId)
        .maybeSingle();
      courseId = comoUuid(section?.course_id);
    }
  }

  const { data: nova, error } = await sb
    .from("usage_sessions")
    .insert({
      user_id: user.id,
      course_id: courseId,
      lesson_id: lessonId,
      contexto,
      started_at: agora.toISOString(),
      ended_at: agora.toISOString(),
      // Sessão nova nasce zerada: o tempo só existe entre dois sinais, então
      // o primeiro deles ainda não comprova permanência nenhuma.
      seconds: 0,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[usage-ping] insert", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, sessao: nova?.id ?? null, seconds: 0 });
}
