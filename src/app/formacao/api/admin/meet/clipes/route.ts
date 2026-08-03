// Clipes curtos a partir de vídeos que já existem.
//
// GET sem parâmetro lista a fila e os clipes prontos. GET com curso_id lista as
// aulas daquele curso para escolher uma a uma, já dizendo quais foram enviadas
// antes. POST enfileira: um encontro, uma lista de aulas escolhidas, ou o curso
// inteiro.
//
// Enfileira, não envia: quem envia é o agendador, um por vez, porque cada envio
// é cobrado por minuto de vídeo.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enfileirarEncontro, idDoDrive, rotaDoVideo } from "@/lib/meet/clipes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

  // Lista as aulas de um curso para escolher uma a uma. Vem com a duração
  // porque a cobrança é por minuto de vídeo original: sem esse número a escolha
  // é feita às cegas.
  const cursoId = req.nextUrl.searchParams.get("curso_id");
  if (cursoId) {
    const { data: secoes } = await sb
      .from("sections")
      .select("id, title, position")
      .eq("course_id", cursoId)
      .order("position", { ascending: true });

    const secaoIds = (secoes || []).map((s: { id: string }) => s.id);
    if (!secaoIds.length) return NextResponse.json({ aulas: [] });

    const { data: lessons } = await sb
      .from("lessons")
      .select("id, section_id, title, video_url, video_source, duration_minutes, position")
      .in("section_id", secaoIds)
      .not("video_url", "is", null)
      .order("position", { ascending: true });

    const urls = (lessons || []).map((l: { video_url: string }) => l.video_url);
    const { data: jobsDoCurso } = urls.length
      ? await sb
          .from("formacao_clip_jobs")
          .select("id, video_url, status, erro")
          .in("video_url", urls)
      : { data: [] };

    // Casa pelo endereço do vídeo, não pelo id da aula: a trava contra envio
    // repetido é a chave única em video_url, então é ela que responde se este
    // vídeo já foi cobrado — mesmo que tenha entrado por outro caminho.
    const porUrl = new Map(
      ((jobsDoCurso || []) as { video_url: string; status: string; erro: string | null }[]).map(
        (j) => [j.video_url, j]
      )
    );

    const nomeSecao = new Map(
      ((secoes || []) as { id: string; title: string }[]).map((s) => [s.id, s.title])
    );

    return NextResponse.json({
      aulas: (lessons || []).map(
        (l: {
          id: string;
          section_id: string;
          title: string;
          video_url: string;
          video_source: string | null;
          duration_minutes: number | null;
        }) => {
          const job = porUrl.get(l.video_url);
          return {
            id: l.id,
            titulo: l.title,
            secao: nomeSecao.get(l.section_id) || null,
            video_source: l.video_source,
            duracao_min: l.duration_minutes,
            // Vídeo do Drive tem uma etapa a mais antes do corte, e ela demora:
            // é um envio de centenas de megabytes. Dizer isso aqui evita a
            // impressão de que travou.
            passa_pelo_youtube: !!idDoDrive(l.video_url),
            ja_enviada: !!job,
            status: job?.status || null,
            erro: job?.erro || null,
          };
        }
      ),
    });
  }

  const { data: jobs } = await sb
    .from("formacao_clip_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(40);

  const ids = (jobs || []).map((j: { id: string }) => j.id);
  const { data: clips } = ids.length
    ? await sb
        .from("formacao_clips")
        .select("*")
        .in("job_id", ids)
        .order("pontuacao", { ascending: false })
    : { data: [] };

  const porJob = new Map<string, unknown[]>();
  for (const c of (clips || []) as { job_id: string }[]) {
    porJob.set(c.job_id, [...(porJob.get(c.job_id) || []), c]);
  }

  return NextResponse.json({
    configurado: !!process.env.OPUSCLIP_API_KEY,
    jobs: (jobs || []).map((j: { id: string }) => ({
      ...j,
      clipes: porJob.get(j.id) || [],
    })),
  });
}

/**
 * Avaliar ou esconder um clipe.
 *
 * Separado do POST de propósito: aquele gasta dinheiro, este só guarda uma
 * opinião. Misturar os dois num endpoint faria a ação barata carregar o peso
 * da cara.
 */
export async function PATCH(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { clip_id?: string; avaliacao?: "gostei" | "rejeitado" | null; oculto?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.clip_id) {
    return NextResponse.json({ error: "clip_id obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  const campos: Record<string, unknown> = {};
  if (body.avaliacao !== undefined) {
    campos.avaliacao = body.avaliacao;
    campos.avaliado_em = body.avaliacao ? new Date().toISOString() : null;
    campos.avaliado_por = body.avaliacao ? auth.userId : null;
  }
  if (body.oculto !== undefined) campos.oculto = body.oculto;

  if (!Object.keys(campos).length) {
    return NextResponse.json({ error: "Nada para mudar." }, { status: 400 });
  }

  const { error } = await sb.from("formacao_clips").update(campos).eq("id", body.clip_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: {
    encontro_id?: string;
    curso_id?: string;
    lesson_ids?: string[];
    /** "publicar" leva ao YouTube e para por aí; "cortar" segue para o OpusClip. */
    acao?: "publicar" | "cortar" | "publicar_e_cortar";
    /** Depois de publicar, a aula passa a tocar pelo YouTube em vez do Drive. */
    trocar_fonte?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  if (body.encontro_id) {
    const r = await enfileirarEncontro(sb, body.encontro_id, auth.userId);
    return r.ok
      ? NextResponse.json({ ok: true, enfileirados: 1 })
      : NextResponse.json({ error: r.motivo }, { status: 400 });
  }

  // Aulas escolhidas uma a uma, ou o curso inteiro. O caminho é o mesmo: o que
  // muda é de onde sai a lista.
  if (body.lesson_ids?.length || body.curso_id) {
    let aulaIds = body.lesson_ids;

    if (!aulaIds?.length) {
      const { data: secoes } = await sb
        .from("sections")
        .select("id")
        .eq("course_id", body.curso_id!);

      const secaoIds = (secoes || []).map((s: { id: string }) => s.id);
      if (!secaoIds.length) {
        return NextResponse.json({ error: "Este curso não tem aulas." }, { status: 400 });
      }

      const { data: todas } = await sb
        .from("lessons")
        .select("id")
        .in("section_id", secaoIds)
        .not("video_url", "is", null)
        .order("position", { ascending: true });

      aulaIds = (todas || []).map((l: { id: string }) => l.id);
    }

    if (!aulaIds.length) {
      return NextResponse.json({ error: "Nenhuma aula com vídeo." }, { status: 400 });
    }

    // Teto por chamada. Não é limitação técnica: é para que um clique
    // distraído não vire uma conta de centenas de horas de processamento.
    if (aulaIds.length > 40) {
      return NextResponse.json(
        { error: "São mais de 40 vídeos de uma vez. Envie em partes." },
        { status: 400 }
      );
    }

    const { data: aulas } = await sb
      .from("lessons")
      .select("id, title, video_url, section_id")
      .in("id", aulaIds)
      .not("video_url", "is", null)
      .order("position", { ascending: true });

    if (!aulas?.length) {
      return NextResponse.json(
        { error: "Nenhuma das aulas escolhidas tem vídeo." },
        { status: 400 }
      );
    }

    // O curso vem da própria aula, não do corpo do pedido: assim uma lista de
    // ids solta continua sendo gravada com o curso certo.
    const secaoIds = Array.from(
      new Set((aulas as { section_id: string }[]).map((a) => a.section_id))
    );
    const { data: secoes } = await sb
      .from("sections")
      .select("id, course_id, courses(title)")
      .in("id", secaoIds);

    const cursoDaSecao = new Map(
      ((secoes || []) as { id: string; course_id: string; courses?: { title?: string } }[]).map(
        (s) => [s.id, { id: s.course_id, titulo: s.courses?.title || "Curso" }]
      )
    );

    const acao = body.acao || "cortar";
    const vaiCortar = acao !== "publicar";

    let enfileirados = 0;
    let jaNoYoutube = 0;
    const repetidos: string[] = [];

    for (const a of aulas as {
      id: string;
      title: string;
      video_url: string;
      section_id: string;
    }[]) {
      const rota = rotaDoVideo(a.video_url);

      // Publicar o que já é do YouTube não faz sentido: não há para onde subir.
      if (acao === "publicar" && !rota.drive_file_id) {
        jaNoYoutube++;
        continue;
      }

      const curso = cursoDaSecao.get(a.section_id);
      const { error } = await sb.from("formacao_clip_jobs").insert({
        lesson_id: a.id,
        curso_id: curso?.id || body.curso_id || null,
        titulo: `${curso?.titulo || "Curso"} · ${a.title}`,
        video_url: a.video_url,
        // Vídeo que mora no Drive não pode ir direto ao corte: o OpusClip não
        // lê Drive. Guardar o file id aqui é o que permite ao agendador
        // levá-lo ao YouTube antes.
        ...rota,
        gerar_clipes: vaiCortar,
        trocar_fonte_da_aula: !!body.trocar_fonte,
        criado_por: auth.userId,
      });
      if (error) repetidos.push(a.title);
      else enfileirados++;
    }

    const oQueVaiAcontecer = vaiCortar
      ? "Cada um é cobrado por minuto de vídeo."
      : "Sobem como não listados, um por vez. Não há custo: só o corte é cobrado.";

    return NextResponse.json({
      ok: true,
      enfileirados,
      ja_estavam: repetidos.length,
      ja_no_youtube: jaNoYoutube,
      aviso:
        enfileirados > 0
          ? `${enfileirados} ${enfileirados === 1 ? "vídeo" : "vídeos"} na fila. O envio acontece um por vez, a cada rodada do agendador. ${oQueVaiAcontecer}`
          : jaNoYoutube > 0
            ? `${jaNoYoutube} ${jaNoYoutube === 1 ? "vídeo já está" : "vídeos já estão"} no YouTube.`
            : "Esses vídeos já tinham sido enviados antes.",
    });
  }

  return NextResponse.json(
    { error: "Informe encontro_id, lesson_ids ou curso_id." },
    { status: 400 }
  );
}
