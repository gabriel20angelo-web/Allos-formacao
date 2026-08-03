// Tolerância de atraso.
//
// Mora em formacao_cronograma, junto de duracao_minutos, porque é regra do
// encontro e não do módulo do Meet. Vale para a leitura de todo o histórico,
// então mudar aqui muda os números de trás também.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extrairIdDaPasta, verificarPasta } from "@/lib/meet/drive";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();
  const { data } = await sb
    .from("formacao_cronograma")
    .select("id, duracao_minutos, tolerancia_atraso_min, limite_encerramento_min")
    .maybeSingle();

  // A pasta vive em tabela própria porque formacao_cronograma tem leitura
  // pública, e RLS é por linha, não por coluna.
  const { data: cfgMeet } = await sb
    .from("formacao_meet_config")
    .select("pasta_drive_id, pasta_drive_url")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    duracao_minutos: data?.duracao_minutos ?? 90,
    tolerancia_atraso_min: data?.tolerancia_atraso_min ?? 7,
    limite_encerramento_min: data?.limite_encerramento_min ?? 120,
    pasta_drive_id: cfgMeet?.pasta_drive_id ?? null,
    pasta_drive_url: cfgMeet?.pasta_drive_url ?? null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: {
    tolerancia_atraso_min?: number;
    limite_encerramento_min?: number;
    pasta_drive?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const patch: Record<string, number> = {};
  const patchTexto: Record<string, string | null> = {};

  if (body.tolerancia_atraso_min !== undefined) {
    const valor = Number(body.tolerancia_atraso_min);
    if (!Number.isFinite(valor) || valor < 0 || valor > 60) {
      return NextResponse.json(
        { error: "Tolerância deve ser um número entre 0 e 60 minutos." },
        { status: 400 }
      );
    }
    patch.tolerancia_atraso_min = Math.round(valor);
  }

  if (body.limite_encerramento_min !== undefined) {
    const valor = Number(body.limite_encerramento_min);
    // Zero desliga; abaixo de trinta minutos derrubaria encontro em andamento.
    if (!Number.isFinite(valor) || valor < 0 || valor > 600 || (valor > 0 && valor < 30)) {
      return NextResponse.json(
        { error: "Use 0 para desligar, ou um valor entre 30 e 600 minutos." },
        { status: 400 }
      );
    }
    patch.limite_encerramento_min = Math.round(valor);
  }

  // A pasta é verificada contra o Drive antes de salvar: link errado descoberto
  // agora é um aviso; descoberto depois é gravação que não foi para lugar nenhum.
  let pastaNome: string | null = null;
  const patchPasta: Record<string, string | null> = {};
  if (body.pasta_drive !== undefined) {
    if (!body.pasta_drive) {
      patchPasta.pasta_drive_id = null;
      patchPasta.pasta_drive_url = null;
    } else {
      const id = extrairIdDaPasta(body.pasta_drive);
      if (!id) {
        return NextResponse.json(
          { error: "Não reconheci uma pasta nesse link. Cole o endereço da pasta no Drive." },
          { status: 400 }
        );
      }
      try {
        const pasta = await verificarPasta(id);
        pastaNome = pasta.name;
        patchPasta.pasta_drive_id = id;
        patchPasta.pasta_drive_url = body.pasta_drive;
      } catch (e) {
        return NextResponse.json(
          { error: e instanceof Error ? e.message : "Não consegui acessar essa pasta." },
          { status: 400 }
        );
      }
    }
  }

  if (
    !Object.keys(patch).length &&
    !Object.keys(patchTexto).length &&
    !Object.keys(patchPasta).length
  ) {
    return NextResponse.json({ error: "Nada para alterar." }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  if (Object.keys(patchPasta).length) {
    const { error } = await sb
      .from("formacao_meet_config")
      .upsert(
        { id: 1, ...patchPasta, atualizado_em: new Date().toISOString() },
        { onConflict: "id" }
      );
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!Object.keys(patch).length && !Object.keys(patchTexto).length) {
    return NextResponse.json({ ok: true, pasta_nome: pastaNome, ...patchPasta });
  }

  // A tabela é singleton, mas pode nem ter linha ainda em base nova.
  const { data: existente } = await sb
    .from("formacao_cronograma")
    .select("id")
    .maybeSingle();

  const dados = { ...patch, ...patchTexto };

  const { error } = existente
    ? await sb.from("formacao_cronograma").update(dados).eq("id", existente.id)
    : await sb.from("formacao_cronograma").insert(dados);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...dados, pasta_nome: pastaNome });
}
