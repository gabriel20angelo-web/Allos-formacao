// Bloqueio e desbloqueio de acesso à plataforma (Termos de Uso, 10.1).
//
// Duas decisões que importam:
//
// 1. Bloquear encerra as sessões ativas. Sem isso a pessoa continuaria dentro
//    até o token expirar, e um bloqueio que só vale amanhã não é bloqueio.
// 2. O motivo é obrigatório. Ele aparece para a pessoa na tela de acesso
//    suspenso e fica no histórico: decisão sem justificativa registrada é
//    indefensável quando alguém contesta.

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

  let body: { user_id?: string; bloquear?: boolean; motivo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const alvo = body.user_id;
  const bloquear = body.bloquear === true;
  const motivo = (body.motivo || "").trim();

  if (!alvo || typeof alvo !== "string") {
    return NextResponse.json({ error: "user_id obrigatório" }, { status: 400 });
  }
  if (alvo === user.id) {
    return NextResponse.json(
      { error: "Você não pode bloquear a própria conta." },
      { status: 400 }
    );
  }
  if (bloquear && motivo.length < 10) {
    return NextResponse.json(
      { error: "Descreva o motivo do bloqueio: a pessoa vai ler esse texto." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  // Nunca bloquear outro admin sem que ele perca o papel antes: evita que uma
  // conta administrativa seja derrubada por engano em um clique.
  const { data: alvoPerfil } = await sb
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", alvo)
    .maybeSingle();
  if (!alvoPerfil) {
    return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
  }
  if (bloquear && alvoPerfil.role === "admin") {
    return NextResponse.json(
      { error: "Remova o papel de administrador antes de bloquear esta conta." },
      { status: 400 }
    );
  }

  const { error: updErr } = await sb
    .from("profiles")
    .update({
      bloqueado: bloquear,
      bloqueado_em: bloquear ? new Date().toISOString() : null,
      bloqueado_motivo: bloquear ? motivo : null,
      bloqueado_por: bloquear ? user.id : null,
    })
    .eq("id", alvo);

  if (updErr) {
    console.error("[admin/bloqueio]", updErr);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }

  await sb.from("bloqueio_eventos").insert({
    user_id: alvo,
    acao: bloquear ? "bloqueio" : "desbloqueio",
    motivo: motivo || null,
    feito_por: user.id,
  });

  // Derruba as sessões abertas. Se a API de admin falhar (versão do SDK, por
  // exemplo), o bloqueio continua valendo pelo middleware na próxima navegação.
  let sessoesEncerradas = true;
  if (bloquear) {
    try {
      const { error } = await sb.auth.admin.signOut(alvo, "global");
      if (error) sessoesEncerradas = false;
    } catch {
      sessoesEncerradas = false;
    }
  }

  return NextResponse.json({
    ok: true,
    bloqueado: bloquear,
    sessoes_encerradas: bloquear ? sessoesEncerradas : null,
  });
}
