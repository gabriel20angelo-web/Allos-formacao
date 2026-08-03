// A curadoria de quem conduziu o encontro.
//
// Aprovar, reprovar e anotar. Nada mais: apagar, publicar e mandar cortar são
// decisões de quem responde pela plataforma.
//
// Quem conduziu é quem sabe se um corte presta — estava lá, sabe o que veio
// antes da frase, e reconhece quando um trecho bom isolado acaba dizendo o
// contrário do que foi dito. Por isso a opinião dele vale mais que a nota que
// a ferramenta deu.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  let body: {
    clip_id?: string;
    avaliacao?: "gostei" | "rejeitado" | null;
    anotacao?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.clip_id) {
    return NextResponse.json({ error: "clip_id obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  const { data: perfil } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const ehAdmin = perfil?.role === "admin";

  // O corte pertence a um encontro de uma sala que esta pessoa conduz?
  //
  // A pergunta é feita aqui mesmo, e não confiada à tela, porque a tela só
  // mostra o que é dele — mas quem chama a rota direto pode mandar qualquer
  // identificador.
  if (!ehAdmin) {
    const { data: clipe } = await sb
      .from("formacao_clips")
      .select("id, job_id")
      .eq("id", body.clip_id)
      .maybeSingle();

    if (!clipe) return NextResponse.json({ error: "Corte não encontrado" }, { status: 404 });

    const { data: job } = await sb
      .from("formacao_clip_jobs")
      .select("encontro_id")
      .eq("id", clipe.job_id)
      .maybeSingle();

    if (!job?.encontro_id) {
      return NextResponse.json({ error: "Este corte não é seu." }, { status: 403 });
    }

    const { data: encontro } = await sb
      .from("formacao_meet_encontros")
      .select("space_name")
      .eq("id", job.encontro_id)
      .maybeSingle();

    const { data: ficha } = await sb
      .from("certificado_condutores")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!encontro || !ficha) {
      return NextResponse.json({ error: "Este corte não é seu." }, { status: 403 });
    }

    const { data: alocacoes } = await sb
      .from("formacao_alocacoes")
      .select("slot_id")
      .eq("condutor_id", ficha.id);

    const slotIds = (alocacoes || []).map((a: { slot_id: string }) => a.slot_id);

    const { data: minhaSala } = slotIds.length
      ? await sb
          .from("formacao_meet_spaces")
          .select("space_name")
          .eq("space_name", encontro.space_name)
          .in("slot_id", slotIds)
          .maybeSingle()
      : { data: null };

    if (!minhaSala) {
      return NextResponse.json({ error: "Este corte não é seu." }, { status: 403 });
    }
  }

  const campos: Record<string, unknown> = {};
  if (body.avaliacao !== undefined) {
    campos.avaliacao = body.avaliacao;
    campos.avaliado_em = body.avaliacao ? new Date().toISOString() : null;
    campos.avaliado_por = body.avaliacao ? user.id : null;
  }
  if (body.anotacao !== undefined) campos.anotacao = body.anotacao.trim() || null;

  if (!Object.keys(campos).length) {
    return NextResponse.json({ error: "Nada para mudar." }, { status: 400 });
  }

  const { error } = await sb.from("formacao_clips").update(campos).eq("id", body.clip_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
