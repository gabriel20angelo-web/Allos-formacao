// Ficha de uma pessoa nos encontros, para o painel.
//
// Chamada quando alguém clica num nome da lista de presença. Aceita as três
// chaves que a tela pode ter em mãos — o nome de tela normalizado, o id da
// conta ou o e-mail declarado no certificado —, porque nem toda pessoa
// identificada tem conta, e nem toda conta apareceu com o mesmo nome de tela.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { retratoDaPessoa } from "@/lib/meet/pessoa";
import { fichaDaPlataforma } from "@/lib/plataforma/ficha-aluno";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const norm = req.nextUrl.searchParams.get("norm");
  const alunoId = req.nextUrl.searchParams.get("aluno_id");
  const email = req.nextUrl.searchParams.get("email");

  if (!norm && !alunoId && !email) {
    return NextResponse.json(
      { error: "Informe norm, aluno_id ou email." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();
  const retrato = await retratoDaPessoa(sb, { norm, aluno_id: alunoId, email });

  if (!retrato) {
    return NextResponse.json({ error: "Não achei essa pessoa." }, { status: 404 });
  }

  // Quem tem conta tem uma história bem maior do que a presença nos encontros:
  // matrícula, aulas, prova, certificado, tempo de permanência, o que avaliou e
  // o que reclamou. Só faz sentido buscar quando há conta, e por isso a segunda
  // parte da ficha é condicional em vez de vir sempre vazia.
  const plataforma = retrato.pessoa.aluno_id
    ? await fichaDaPlataforma(sb, retrato.pessoa.aluno_id, retrato.pessoa.email)
    : null;

  return NextResponse.json({ ...retrato, plataforma });
}
