// Criar um grupo.
//
// Vai por rota de servidor com `exigirAdmin` pelo mesmo motivo do PATCH: a
// policy de `certificado_atividades` compara `role = 'admin'` direto, e desde a
// 078 os cargos são acumuláveis, então quem administra e também conduz um grupo
// era barrado em silêncio pelo caminho do cliente.
//
// O grupo nasce publicado no formulário de certificação, que é o
// comportamento que o default do banco já tinha. Nasce sem posição na grade: pôr
// na semana é decisão separada, e treze dos dezenove grupos de hoje vivem assim.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { nome?: unknown; carga_horaria?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  if (!nome) {
    return NextResponse.json({ error: "O grupo precisa de um nome." }, { status: 400 });
  }

  const carga =
    typeof body.carga_horaria === "number" && body.carga_horaria > 0
      ? Math.round(body.carga_horaria)
      : 2;

  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("certificado_atividades")
    .insert({ nome, carga_horaria: carga })
    .select()
    .single();

  if (error) {
    // O índice único de nome normalizado veio na 093. Antes dela a checagem de
    // duplicata era só no cliente, então duas abas abertas criavam dois grupos
    // com o mesmo nome e nenhum casamento por texto sabia qual era qual.
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "Já existe um grupo com esse nome, mesmo que escrito com outros acentos." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ atividade: data }, { status: 201 });
}
