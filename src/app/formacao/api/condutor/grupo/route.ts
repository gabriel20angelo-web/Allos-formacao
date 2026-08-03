// O grupo de quem conduz.
//
// Rota separada da do admin de propósito. A do admin aceita mudar qualquer
// campo da sala; esta aceita seis, e nenhum deles tem consequência fora do
// encontro. O que fica de fora é o que decide onde o material vai parar —
// publicar no YouTube, qual curso recebe as gravações, qual pasta guarda os
// arquivos — e isso é escolha de quem responde pela plataforma, não de quem
// conduz o encontro daquela semana.
//
// Duplicar a rota em vez de acrescentar um "se for condutor" na outra é
// deliberado: uma lista de permissões dentro de um endpoint que já faz tudo é
// uma linha que alguém apaga sem perceber daqui a seis meses.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { atualizarAcesso, atualizarArtefatos, MeetApiError } from "@/lib/meet/client";
import type { AccessType } from "@/lib/meet/types";

export const dynamic = "force-dynamic";

/** Só o que quem conduz pode mexer. Fora desta lista é do administrador. */
const CAMPOS_DO_CONDUTOR = [
  "gravar",
  "transcrever",
  "notas",
  "access_type",
  "janela_automatica",
  "duracao_min",
] as const;

interface Quem {
  ok: true;
  userId: string;
  condutorId: string | null;
  ehAdmin: boolean;
}
interface Barrado {
  ok: false;
  status: 401 | 403;
  erro: string;
}

/**
 * Quem está pedindo, e a qual ficha de condutor ele corresponde.
 *
 * A ficha é encontrada por `user_id`, nunca por nome: o sistema inteiro casa
 * condutor por semelhança de nome para fins de estatística, e isso não serve
 * para permissão — dois nomes iguais, ou um apelido diferente no Meet, já
 * bastariam para alguém ver o grupo de outra pessoa.
 */
async function identificar(): Promise<Quem | Barrado> {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return { ok: false, status: 401, erro: "Não autenticado" };

  const { data: perfil } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const ehAdmin = perfil?.role === "admin";

  const sb = await createServiceRoleClient();
  const { data: ficha } = await sb
    .from("certificado_condutores")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!ehAdmin && !ficha) {
    return {
      ok: false,
      status: 403,
      erro: "Sua conta ainda não está ligada a uma ficha de condutor. Peça isso ao administrador.",
    };
  }

  return { ok: true, userId: user.id, condutorId: ficha?.id || null, ehAdmin };
}

/**
 * As salas que esta pessoa conduz.
 *
 * Administrador vê todas: é a única forma de conferir o que o condutor está
 * vendo, e sem isso a tela responderia "você não conduz nada" para quem
 * mantém o sistema.
 */
async function salasDele(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  condutorId: string | null,
  ehAdmin = false
): Promise<string[]> {
  if (ehAdmin && !condutorId) {
    const { data } = await sb
      .from("formacao_meet_spaces")
      .select("space_name")
      .eq("ativo", true);
    return (data || []).map((s: { space_name: string }) => s.space_name);
  }

  if (!condutorId) return [];

  const { data: alocacoes } = await sb
    .from("formacao_alocacoes")
    .select("slot_id")
    .eq("condutor_id", condutorId);

  const slotIds = (alocacoes || []).map((a: { slot_id: string }) => a.slot_id);
  if (!slotIds.length) return [];

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name")
    .in("slot_id", slotIds)
    .eq("ativo", true);

  return (spaces || []).map((s: { space_name: string }) => s.space_name);
}

export async function GET() {
  const quem = await identificar();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  const sb = await createServiceRoleClient();
  const nomes = await salasDele(sb, quem.condutorId, quem.ehAdmin);

  if (!nomes.length) {
    return NextResponse.json({
      salas: [],
      aviso:
        "Você ainda não está alocado em nenhum horário com sala criada. Fale com o administrador.",
    });
  }

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select(
      "space_name, slot_id, rotulo, meeting_uri, meeting_code, gravar, transcrever, notas, access_type, janela_automatica, duracao_min"
    )
    .in("space_name", nomes);

  const slotIds = (spaces || [])
    .map((s: { slot_id: string | null }) => s.slot_id)
    .filter(Boolean) as string[];

  const { data: slots } = slotIds.length
    ? await sb
        .from("formacao_slots")
        .select("id, dia_semana, atividade_nome, horario_id, formacao_horarios(hora)")
        .in("id", slotIds)
    : { data: [] };

  const slotPorId = new Map(
    ((slots || []) as unknown as {
      id: string;
      dia_semana: number;
      atividade_nome: string | null;
      formacao_horarios: { hora: string } | null;
    }[]).map((s) => [s.id, s])
  );

  // Encontros e cortes de cada sala, para a tela não precisar de outra volta.
  const { data: encontros } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, space_name, data_reuniao, inicio, duracao_min, total_participantes, youtube_video_id, gravacao_uri"
    )
    .in("space_name", nomes)
    .eq("descartado", false)
    .order("data_reuniao", { ascending: false })
    .limit(60);

  const encontroIds = (encontros || []).map((e: { id: string }) => e.id);

  const { data: jobs } = encontroIds.length
    ? await sb
        .from("formacao_clip_jobs")
        .select("id, encontro_id, titulo, status")
        .in("encontro_id", encontroIds)
    : { data: [] };

  const jobIds = (jobs || []).map((j: { id: string }) => j.id);

  const { data: clipes } = jobIds.length
    ? await sb
        .from("formacao_clips")
        .select(
          "id, job_id, titulo, descricao, hashtags, url, preview_url, thumbnail_url, duracao_seg, pontuacao, avaliacao, anotacao, oculto"
        )
        .in("job_id", jobIds)
        .eq("oculto", false)
        .order("pontuacao", { ascending: false })
    : { data: [] };

  const clipesPorEncontro = new Map<string, unknown[]>();
  const encontroDoJob = new Map(
    ((jobs || []) as { id: string; encontro_id: string }[]).map((j) => [j.id, j.encontro_id])
  );
  for (const c of (clipes || []) as { job_id: string }[]) {
    const enc = encontroDoJob.get(c.job_id);
    if (!enc) continue;
    clipesPorEncontro.set(enc, [...(clipesPorEncontro.get(enc) || []), c]);
  }

  const encontrosPorSala = new Map<string, unknown[]>();
  for (const e of (encontros || []) as { id: string; space_name: string }[]) {
    encontrosPorSala.set(e.space_name, [
      ...(encontrosPorSala.get(e.space_name) || []),
      { ...e, clipes: clipesPorEncontro.get(e.id) || [] },
    ]);
  }

  return NextResponse.json({
    salas: (spaces || []).map((s: { space_name: string; slot_id: string | null }) => {
      const slot = s.slot_id ? slotPorId.get(s.slot_id) : null;
      return {
        ...s,
        dia_semana: slot?.dia_semana ?? null,
        hora: slot?.formacao_horarios?.hora ?? null,
        atividade_nome: slot?.atividade_nome ?? null,
        encontros: encontrosPorSala.get(s.space_name) || [],
      };
    }),
  });
}

export async function PATCH(req: NextRequest) {
  const quem = await identificar();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const spaceName = body.space_name as string;
  if (!spaceName) {
    return NextResponse.json({ error: "space_name obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // A sala é dele? Sem esta checagem, saber o nome de uma sala qualquer
  // bastaria para reconfigurá-la.
  const nomes = await salasDele(sb, quem.condutorId, quem.ehAdmin);
  if (!quem.ehAdmin && !nomes.includes(spaceName)) {
    return NextResponse.json({ error: "Esta sala não é sua." }, { status: 403 });
  }

  const mudancas: Record<string, unknown> = {};
  for (const campo of CAMPOS_DO_CONDUTOR) {
    if (body[campo] !== undefined) mudancas[campo] = body[campo];
  }

  if (!Object.keys(mudancas).length) {
    return NextResponse.json(
      { error: "Nada que você possa mudar foi informado." },
      { status: 400 }
    );
  }

  if (mudancas.duracao_min !== undefined && mudancas.duracao_min !== null) {
    const d = Number(mudancas.duracao_min);
    if (!Number.isFinite(d) || d < 30 || d > 600) {
      return NextResponse.json(
        { error: "A duração precisa ficar entre 30 e 600 minutos." },
        { status: 400 }
      );
    }
  }

  // Abrir ou fechar a sala à mão desliga a janela automática: senão a rotina
  // reverteria a escolha no minuto seguinte, e ninguém entenderia por quê.
  if (mudancas.access_type !== undefined) mudancas.janela_automatica = false;

  const { error } = await sb
    .from("formacao_meet_spaces")
    .update(mudancas)
    .eq("space_name", spaceName);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // O Google precisa saber: guardar só aqui faria a tela mentir.
  try {
    if (
      mudancas.gravar !== undefined ||
      mudancas.transcrever !== undefined ||
      mudancas.notas !== undefined
    ) {
      const { data: atual } = await sb
        .from("formacao_meet_spaces")
        .select("gravar, transcrever, notas")
        .eq("space_name", spaceName)
        .single();
      await atualizarArtefatos(spaceName, {
        gravar: !!atual?.gravar,
        transcrever: !!atual?.transcrever,
        notas: !!atual?.notas,
      });
    }
    if (mudancas.access_type !== undefined) {
      await atualizarAcesso(spaceName, mudancas.access_type as AccessType);
    }
  } catch (e) {
    const msg = e instanceof MeetApiError ? e.message : String(e);
    return NextResponse.json(
      { error: `Salvo aqui, mas o Google recusou: ${msg}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
