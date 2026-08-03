// Aviso do OpusClip de que os cortes ficaram prontos.
//
// É atalho, não a fonte da verdade: o agendador também pergunta pelos projetos
// em processamento. Se este aviso nunca chegar (rede, assinatura, mudança de
// formato), os clipes aparecem do mesmo jeito na rodada seguinte, só mais
// devagar. Por isso ele pode falhar sem quebrar nada.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { consultarProjeto } from "@/lib/meet/opusclip";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { projectId?: string; id?: string; status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const projetoId = body.projectId || body.id;
  if (!projetoId) return NextResponse.json({ ok: false }, { status: 400 });

  const sb = await createServiceRoleClient();

  // Só aceita projeto que ESTE sistema criou. Um aviso sobre um identificador
  // desconhecido é ignorado, o que evita que uma chamada de fora escreva
  // qualquer coisa no banco.
  const { data: job } = await sb
    .from("formacao_clip_jobs")
    .select("id")
    .eq("external_id", projetoId)
    .maybeSingle();

  if (!job) return NextResponse.json({ ok: true, ignorado: true });

  // Não confia no conteúdo do aviso: pergunta à API o que ela tem. Assim um
  // payload forjado não vira clipe no banco, porque a resposta vem da fonte.
  try {
    const { clipes } = await consultarProjeto(projetoId);
    if (!clipes.length) return NextResponse.json({ ok: true, sem_clipes: true });

    await sb.from("formacao_clips").delete().eq("job_id", job.id);
    await sb.from("formacao_clips").insert(
      clipes.map((c) => ({
        job_id: job.id,
        external_id: c.id || null,
        titulo: c.title || null,
        url: c.url || c.videoUrl || null,
        thumbnail_url: c.thumbnailUrl || null,
        duracao_seg: c.duration ?? null,
        pontuacao: c.score ?? c.viralScore ?? null,
      }))
    );
    await sb
      .from("formacao_clip_jobs")
      .update({ status: "pronto", concluido_em: new Date().toISOString() })
      .eq("id", job.id);

    return NextResponse.json({ ok: true, clipes: clipes.length });
  } catch (e) {
    console.error("[clipes-webhook]", e);
    // Devolve 200 mesmo assim: o agendador recolhe depois, e erro aqui só faria
    // o OpusClip reenviar o aviso sem necessidade.
    return NextResponse.json({ ok: true, adiado: true });
  }
}
