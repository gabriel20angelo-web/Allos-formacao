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
//
// O que mudou: quem tem o cargo alcança TODAS as salas ativas, e não só as do
// próprio vínculo. A lista curta de campos acima continua sendo o limite real
// desta rota — o condutor mexe no que acontece dentro do encontro, de qualquer
// grupo, e nada do que decide onde o material vai parar.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
// Quem entra na área é pergunta de mais de uma rota, então mora num lugar só.
import {
  identificarCondutor as identificar,
  salasDoCondutor as salasDele,
  salasDaFicha,
} from "@/lib/condutor";
import {
  atualizarAcesso,
  atualizarArtefatos,
  encerrarConferencia,
  MeetApiError,
} from "@/lib/meet/client";
import type { AccessType } from "@/lib/meet/types";
import { renovarEnderecos, type ClipeComEndereco } from "@/lib/meet/clipes-enderecos";

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

/** Os dois tipos de acesso que o Meet conhece. */
const ACESSOS: AccessType[] = ["OPEN", "TRUSTED", "RESTRICTED"];

export async function GET() {
  const quem = await identificar();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  const sb = await createServiceRoleClient();
  const nomes = await salasDele(sb);
  // Não filtra nada: só diz qual delas é a da pessoa, para a tela marcar.
  const minhas = new Set(await salasDaFicha(sb, quem.condutorId));

  if (!nomes.length) {
    return NextResponse.json({
      salas: [],
      aviso:
        "Nenhuma sala de encontro foi criada ainda. Fale com o administrador.",
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

  const { data: clipesCrus } = jobIds.length
    ? await sb
        .from("formacao_clips")
        .select(
          "id, job_id, external_id, titulo, descricao, hashtags, url, preview_url, thumbnail_url, duracao_seg, pontuacao, avaliacao, anotacao, oculto"
        )
        .in("job_id", jobIds)
        .eq("oculto", false)
        .order("pontuacao", { ascending: false })
    : { data: [] };

  // Endereço assinado vale 24 horas; sem renovar na leitura, a curadoria abre
  // cega no dia seguinte ao corte.
  const { clipes } = await renovarEnderecos(
    sb,
    (clipesCrus || []) as ClipeComEndereco[]
  );

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

  const lista = (spaces || []).map((s: { space_name: string; slot_id: string | null }) => {
    const slot = s.slot_id ? slotPorId.get(s.slot_id) : null;
    return {
      ...s,
      dia_semana: slot?.dia_semana ?? null,
      hora: slot?.formacao_horarios?.hora ?? null,
      atividade_nome: slot?.atividade_nome ?? null,
      minha: minhas.has(s.space_name),
      encontros: encontrosPorSala.get(s.space_name) || [],
    };
  });

  // O grupo da pessoa primeiro, o resto na ordem da semana. Com seis salas na
  // tela, procurar a sua toda semana numa lista ordenada por outro critério é
  // um pedágio pequeno cobrado sempre.
  lista.sort((a, b) => {
    if (a.minha !== b.minha) return a.minha ? -1 : 1;
    const dia = (a.dia_semana ?? 9) - (b.dia_semana ?? 9);
    if (dia !== 0) return dia;
    return (a.hora || "").localeCompare(b.hora || "");
  });

  return NextResponse.json({ salas: lista });
}

/**
 * Encerrar a reunião em andamento.
 *
 * A conferência que sobrou é a de que a sala existe e está ativa: encerrar tira
 * todo mundo de dentro, e um nome digitado errado não pode virar uma reunião
 * derrubada em outro canto do sistema. Quem conduz encerra a de qualquer grupo,
 * que é o combinado desde que a área virou acesso por cargo.
 */
export async function POST(req: NextRequest) {
  const quem = await identificar();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  let body: { space_name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.space_name) {
    return NextResponse.json({ error: "space_name obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const nomes = await salasDele(sb);
  if (!nomes.includes(body.space_name)) {
    return NextResponse.json({ error: "Esta sala não existe ou está inativa." }, { status: 404 });
  }

  try {
    await encerrarConferencia(body.space_name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const status = e instanceof MeetApiError ? e.status : 500;
    if (status === 404 || status === 400) {
      return NextResponse.json(
        { error: "Não há reunião acontecendo nesta sala agora." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: e instanceof MeetApiError ? e.message : "Não consegui encerrar." },
      { status: 400 }
    );
  }
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

  // A sala existe? A posse deixou de ser conferida aqui, mas o nome continua
  // vindo do cliente, e gravar num `space_name` inventado escreveria zero
  // linhas e responderia "ok" — a tela mostraria o interruptor mexido e nada
  // teria acontecido.
  const nomes = await salasDele(sb);
  if (!quem.ehAdmin && !nomes.includes(spaceName)) {
    return NextResponse.json({ error: "Esta sala não existe ou está inativa." }, { status: 404 });
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

  // O tipo de acesso entrava sem conferência nenhuma. Um valor que o Meet não
  // conhece era gravado aqui e recusado lá, e como a gravação vem antes da
  // chamada ao Google, a sala ficava com um estado que não existe do outro
  // lado — com a janela automática desligada na linha seguinte, ninguém
  // corrigiria depois.
  if (
    mudancas.access_type !== undefined &&
    !ACESSOS.includes(mudancas.access_type as AccessType)
  ) {
    return NextResponse.json(
      { error: `Tipo de acesso inválido. Use ${ACESSOS.join(", ")}.` },
      { status: 400 }
    );
  }

  // Abrir ou fechar a sala à mão desliga a janela automática: senão a rotina
  // reverteria a escolha no minuto seguinte, e ninguém entenderia por quê.
  if (mudancas.access_type !== undefined) mudancas.janela_automatica = false;

  // O estado de antes, para poder voltar atrás. Sem isto, uma recusa do Google
  // deixava o banco adiantado em relação à sala: a tela mostrava "gravando" e
  // o Meet não estava gravando, que é a diferença mais cara de perceber, porque
  // só aparece quando alguém procura o vídeo do encontro e ele não existe.
  const { data: antes } = await sb
    .from("formacao_meet_spaces")
    .select("gravar, transcrever, notas, access_type, janela_automatica, duracao_min")
    .eq("space_name", spaceName)
    .single();

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

    // Volta ao que era. A alternativa é deixar a tela dizendo uma coisa e a
    // sala fazendo outra, e quem conduz não tem como desconfiar: o interruptor
    // aparece ligado.
    if (antes) {
      await sb.from("formacao_meet_spaces").update(antes).eq("space_name", spaceName);
    }

    return NextResponse.json(
      { error: `O Google recusou a mudança, então nada foi alterado: ${msg}` },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
