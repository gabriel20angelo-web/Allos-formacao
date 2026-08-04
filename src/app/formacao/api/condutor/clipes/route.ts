// A curadoria de quem conduziu o encontro.
//
// Aprovar, reprovar e anotar. Nada mais: apagar, publicar e mandar cortar são
// decisões de quem responde pela plataforma.
//
// Quem conduziu é quem sabe se um corte presta — estava lá, sabe o que veio
// antes da frase, e reconhece quando um trecho bom isolado acaba dizendo o
// contrário do que foi dito. Por isso a opinião dele vale mais que a nota que
// a ferramenta deu.
//
// A checagem de posse do corte saiu junto com o resto do recorte por vínculo:
// ela subia a cadeia inteira (clipe → job → encontro → sala → alocação →
// ficha) para responder "este corte é seu?", e devolvia 403 para o corte que
// nasceu de uma aula de curso, que é a maior parte do acervo. Fica registrado
// quem avaliou, em `avaliado_por`, e é isso que responde por quem decidiu.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { identificarCondutor } from "@/lib/condutor";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const quem = await identificarCondutor();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

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

  // O corte existe? É a única pergunta que sobrou. Sem ela, um id inventado
  // atualizaria zero linhas e a rota responderia "ok".
  const { data: clipe } = await sb
    .from("formacao_clips")
    .select("id")
    .eq("id", body.clip_id)
    .maybeSingle();

  if (!clipe) return NextResponse.json({ error: "Corte não encontrado" }, { status: 404 });

  const campos: Record<string, unknown> = {};
  if (body.avaliacao !== undefined) {
    campos.avaliacao = body.avaliacao;
    campos.avaliado_em = body.avaliacao ? new Date().toISOString() : null;
    campos.avaliado_por = body.avaliacao ? quem.userId : null;
  }
  if (body.anotacao !== undefined) campos.anotacao = body.anotacao.trim() || null;

  if (!Object.keys(campos).length) {
    return NextResponse.json({ error: "Nada para mudar." }, { status: 400 });
  }

  const { error } = await sb.from("formacao_clips").update(campos).eq("id", body.clip_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
