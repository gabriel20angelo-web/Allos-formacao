// Baixar um corte.
//
// Não serve guardar o endereço e reusar: o que o OpusClip devolve é assinado e
// expira em horas. Um botão de baixar apontando para o endereço gravado
// funciona no dia em que o clipe chega e falha calado depois — que é justamente
// quando alguém vai querer publicar.
//
// Então o endereço é pedido de novo na hora do clique, e o navegador é mandado
// para o atual.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { consultarProjeto } from "@/lib/meet/opusclip";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const clipId = req.nextUrl.searchParams.get("clip_id");
  if (!clipId) return NextResponse.json({ error: "clip_id obrigatório" }, { status: 400 });

  const sb = await createServiceRoleClient();

  const { data: clipe } = await sb
    .from("formacao_clips")
    .select("id, external_id, url, preview_url, job_id")
    .eq("id", clipId)
    .maybeSingle();

  if (!clipe) return NextResponse.json({ error: "Clipe não encontrado" }, { status: 404 });

  const { data: job } = await sb
    .from("formacao_clip_jobs")
    .select("external_id")
    .eq("id", clipe.job_id)
    .maybeSingle();

  // Pede a lista atual e acha este clipe nela. O identificador do clipe é
  // estável; o endereço não.
  if (job?.external_id) {
    try {
      const { clipes } = await consultarProjeto(job.external_id);
      const atual = clipes.find((c) => c.id === clipe.external_id);
      const endereco = atual?.uriForExport || atual?.uriForPreview;

      if (endereco) {
        // Guarda o endereço novo: a miniatura e o player da tela usam o mesmo,
        // e sem isto eles continuariam quebrados até a próxima rodada.
        await sb
          .from("formacao_clips")
          .update({ url: atual?.uriForExport || null, preview_url: atual?.uriForPreview || null })
          .eq("id", clipId);

        return NextResponse.redirect(endereco);
      }
    } catch (e) {
      console.error("[clipes/baixar]", e);
    }
  }

  // Sem conseguir renovar, o endereço guardado ainda é a melhor tentativa.
  const guardado = clipe.url || clipe.preview_url;
  if (guardado) return NextResponse.redirect(guardado);

  return NextResponse.json(
    { error: "Não consegui obter o arquivo deste corte. Ele pode ter expirado no OpusClip." },
    { status: 404 }
  );
}
