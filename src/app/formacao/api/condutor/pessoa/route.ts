// A mesma ficha de pessoa do painel, para quem conduz.
//
// O retrato era recortado às salas do vínculo de quem perguntava. Com a área
// aberta por cargo, o recorte perdeu o sentido: quem abre a ficha de alguém
// pela tela de um grupo qualquer veria um resumo calculado sobre outro
// conjunto de encontros, e as médias não bateriam com a lista à vista.
//
// O que continua recortado é outra coisa, e essa é de privacidade: o e-mail e
// o relato do certificado ficam com a coordenação.

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
  const salas = await salasDoCondutor(sb);
  if (!salas.length) {
    return NextResponse.json({ error: "Nenhuma sala de encontro foi criada ainda." }, { status: 404 });
  }

  const retrato = await retratoDaPessoa(sb, { norm, aluno_id: alunoId }, salas);
  if (!retrato || !retrato.encontros.length) {
    return NextResponse.json(
      { error: "Essa pessoa não aparece em nenhum encontro." },
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
