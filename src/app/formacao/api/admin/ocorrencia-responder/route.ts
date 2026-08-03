// Devolutiva da administração sobre uma resposta de ocorrência (048_ocorrencias.sql).
//
// Duas saídas possíveis. Responder grava o texto que a pessoa lê e carimba
// quem respondeu, porque o registro precisa dizer de quem foi a decisão.
// Arquivar tira o caso da fila sem escrever nada: serve para o que chegou em
// duplicidade, veio vazio ou já foi resolvido por fora.
//
// A escrita usa service role de propósito: a policy da tabela é ampla para
// admin, mas o carimbo de autoria não pode depender do que o client mandar.

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: perfil } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (perfil?.role !== "admin") {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }

  let body: { id?: string; acao?: string; resposta?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const { id, acao } = body;
  const resposta = (body.resposta || "").trim();

  if (!id || (acao !== "responder" && acao !== "arquivar")) {
    return NextResponse.json(
      { error: "id e ação (responder|arquivar) são obrigatórios" },
      { status: 400 }
    );
  }
  if (acao === "responder" && resposta.length < 10) {
    return NextResponse.json(
      { error: "Escreva a devolutiva: é o que a pessoa vai ler." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  const { data: ocorrencia } = await sb
    .from("ocorrencia_respostas")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (!ocorrencia) {
    return NextResponse.json(
      { error: "Ocorrência não encontrada" },
      { status: 404 }
    );
  }

  // Arquivar não escreve resposta nem autoria: o caso saiu da fila, ninguém
  // respondeu nada, e inventar um carimbo aqui mentiria no histórico.
  const patch =
    acao === "responder"
      ? {
          status: "respondida",
          resposta,
          respondido_em: new Date().toISOString(),
          respondido_por: user.id,
        }
      : { status: "arquivada" };

  const { error: updErr } = await sb
    .from("ocorrencia_respostas")
    .update(patch)
    .eq("id", id);

  if (updErr) {
    console.error("[admin/ocorrencia-responder]", updErr);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
