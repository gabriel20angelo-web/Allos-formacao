// A mesma ficha de pessoa do painel, recortada ao grupo de quem pergunta.
//
// O recorte não é enfeite de permissão: quem conduz a terça não tem por que
// saber como a mesma pessoa se comporta na quinta de outro grupo, e o retrato
// inteiro entregaria isso sem que ninguém tivesse decidido entregar. Passar as
// salas do condutor para `retratoDaPessoa` faz o resumo inteiro — médias,
// contagens, primeira e última vez — ser calculado só sobre os encontros dele.
//
// Administrador vê tudo, porque `salasDoCondutor` já devolve todas as salas
// para quem administra.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { identificarCondutor, salasDoCondutor } from "@/lib/condutor";
import { retratoDaPessoa } from "@/lib/meet/pessoa";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const quem = await identificarCondutor();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  const norm = req.nextUrl.searchParams.get("norm");
  const alunoId = req.nextUrl.searchParams.get("aluno_id");
  if (!norm && !alunoId) {
    return NextResponse.json({ error: "Informe norm ou aluno_id." }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const minhas = await salasDoCondutor(sb, quem.condutorId, quem.ehAdmin);
  if (!minhas.length) {
    return NextResponse.json({ error: "Você não conduz nenhuma sala." }, { status: 403 });
  }

  const retrato = await retratoDaPessoa(sb, { norm, aluno_id: alunoId }, minhas);
  if (!retrato || !retrato.encontros.length) {
    return NextResponse.json(
      { error: "Essa pessoa não aparece em nenhum encontro do seu grupo." },
      { status: 404 }
    );
  }

  // O e-mail e o relato do certificado ficam com a coordenação. Quem conduz
  // precisa das notas — que são sobre o próprio grupo — e não do endereço de
  // cada participante.
  return NextResponse.json({
    ...retrato,
    pessoa: { ...retrato.pessoa, email: null },
    feedback: retrato.feedback.map((f) => ({ ...f, relato: null })),
  });
}
