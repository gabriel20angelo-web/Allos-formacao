// Pasta de um grupo específico.
//
// POST cria (ou reaproveita) a pasta daquele grupo dentro da raiz configurada.
// Existe como ação própria para o admin poder consertar na hora um grupo que
// ficou sem pasta, sem esperar a próxima gravação.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { garantirPastaDoGrupo } from "@/lib/meet/pastas";
import { extrairIdDaPasta, urlDaPasta, verificarPasta } from "@/lib/meet/drive";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { space_name?: string; pasta_drive?: string | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.space_name) {
    return NextResponse.json({ error: "space_name obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // Pasta indicada à mão: sobrepõe a automática para este grupo.
  if (body.pasta_drive !== undefined) {
    if (!body.pasta_drive) {
      await sb
        .from("formacao_meet_spaces")
        .update({ pasta_drive_id: null, pasta_drive_url: null })
        .eq("space_name", body.space_name);
      return NextResponse.json({ ok: true, pasta_url: null });
    }

    const id = extrairIdDaPasta(body.pasta_drive);
    if (!id) {
      return NextResponse.json(
        { error: "Não reconheci uma pasta nesse link." },
        { status: 400 }
      );
    }
    try {
      const pasta = await verificarPasta(id);
      await sb
        .from("formacao_meet_spaces")
        .update({ pasta_drive_id: id, pasta_drive_url: urlDaPasta(id) })
        .eq("space_name", body.space_name);
      return NextResponse.json({ ok: true, pasta_url: urlDaPasta(id), pasta_nome: pasta.name });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Não consegui acessar essa pasta." },
        { status: 400 }
      );
    }
  }

  try {
    const pasta = await garantirPastaDoGrupo(sb, body.space_name);
    if (!pasta) {
      return NextResponse.json(
        {
          error:
            "Defina antes a pasta raiz das gravações, na aba Diagnóstico. É dentro dela que a pasta de cada grupo é criada.",
        },
        { status: 400 }
      );
    }
    return NextResponse.json({ ok: true, pasta_url: pasta.url, criada: pasta.criada });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar a pasta." },
      { status: 400 }
    );
  }
}
