// Clipes curtos a partir de vídeos que já existem.
//
// GET lista a fila e os clipes prontos. POST enfileira: ou um encontro
// capturado, ou as aulas de um curso inteiro (que é o caso de um curso que já
// tem os encontros gravados de antes).
//
// Enfileira, não envia: quem envia é o agendador, um por vez, porque cada envio
// é cobrado por minuto de vídeo.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { enfileirarEncontro } from "@/lib/meet/clipes";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

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

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { encontro_id?: string; curso_id?: string };
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

  // Curso inteiro: pega as aulas que já têm vídeo e enfileira cada uma. Serve
  // para o caso de um curso cujos encontros foram gravados antes deste sistema
  // existir.
  if (body.curso_id) {
    const { data: curso } = await sb
      .from("courses")
      .select("id, title")
      .eq("id", body.curso_id)
      .maybeSingle();
    if (!curso) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

    const { data: secoes } = await sb
      .from("sections")
      .select("id")
      .eq("course_id", body.curso_id);

    const secaoIds = (secoes || []).map((s: { id: string }) => s.id);
    if (!secaoIds.length) {
      return NextResponse.json({ error: "Este curso não tem aulas." }, { status: 400 });
    }

    const { data: aulas } = await sb
      .from("lessons")
      .select("id, title, video_url")
      .in("section_id", secaoIds)
      .not("video_url", "is", null)
      .order("position", { ascending: true });

    if (!aulas?.length) {
      return NextResponse.json(
        { error: "Nenhuma aula deste curso tem vídeo." },
        { status: 400 }
      );
    }

    let enfileirados = 0;
    const repetidos: string[] = [];

    for (const a of aulas as { id: string; title: string; video_url: string }[]) {
      const { error } = await sb.from("formacao_clip_jobs").insert({
        lesson_id: a.id,
        curso_id: body.curso_id,
        titulo: `${curso.title} · ${a.title}`,
        video_url: a.video_url,
        criado_por: auth.userId,
      });
      if (error) repetidos.push(a.title);
      else enfileirados++;
    }

    return NextResponse.json({
      ok: true,
      enfileirados,
      ja_estavam: repetidos.length,
      aviso:
        enfileirados > 0
          ? `${enfileirados} vídeos na fila. O envio acontece um por vez, a cada rodada do agendador, porque cada um é cobrado por minuto de vídeo.`
          : "Todos esses vídeos já tinham sido enviados antes.",
    });
  }

  return NextResponse.json(
    { error: "Informe encontro_id ou curso_id." },
    { status: 400 }
  );
}
