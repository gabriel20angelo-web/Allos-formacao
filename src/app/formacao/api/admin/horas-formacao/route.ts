// Horas de formação: a lista inteira de quem participou, e a emissão.
//
// A tela antiga perguntava um nome ao banco e mostrava o que voltasse. Isso
// tinha dois defeitos que só aparecem quando alguém reclama: quem tinha as
// participações marcadas pelo resgate antigo sumia da busca — a Paula, com
// onze encontros, aparecia com duas horas — e quem mudou a grafia do nome
// virava duas pessoas com metade das horas cada.
//
// Aqui o servidor agrega tudo de uma vez, por e-mail, e devolve pronto: a tela
// passa a ter a lista de gente para procurar dentro, em vez de depender de
// adivinhar o nome certo. São ~900 submissões, uma leitura só.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarPessoas, emitirCertificadosDe } from "@/lib/certificados/horas";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await exigirAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.erro }, { status: admin.status });
  }

  const sb = await createServiceRoleClient();
  const pessoas = await carregarPessoas(sb);

  return NextResponse.json({ pessoas });
}

export async function POST(req: NextRequest) {
  const admin = await exigirAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.erro }, { status: admin.status });
  }

  let corpo: { identificador?: string };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const identificador = (corpo.identificador || "").trim();
  if (!identificador) {
    return NextResponse.json({ error: "identificador obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();
  const pessoas = await carregarPessoas(sb);
  const pessoa = pessoas.find((p) => p.identificador === identificador);

  if (!pessoa) {
    return NextResponse.json({ error: "Pessoa não encontrada." }, { status: 404 });
  }

  const emitidos = await emitirCertificadosDe(sb, pessoa, admin.userId);
  return NextResponse.json({ emitidos, pessoa });
}
