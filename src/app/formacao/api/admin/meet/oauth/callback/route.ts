// Passo 2 do consentimento: troca o código por refresh token e guarda.
//
// O refresh token vai para o banco (linha única, RLS sem policy nenhuma), não
// para env var, pra que reautorizar não exija redeploy. É o segredo mais
// sensível do módulo: com ele se cria reunião e se lê gravação da organização.

import { NextRequest, NextResponse } from "next/server";
import { baseUrlPublica, exigirAdmin, redirectUri } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { emailDoToken, MEET_SCOPES } from "@/lib/meet/client";

export const dynamic = "force-dynamic";

function voltar(req: NextRequest, params: Record<string, string>) {
  // Volta pelo domínio público, não pelo host do Railway: é lá que o admin
  // está logado.
  const url = new URL("/formacao/admin/meet", baseUrlPublica(req));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const resposta = NextResponse.redirect(url);
  // O segredo de ida e volta serve uma vez só.
  resposta.cookies.delete("meet_oauth_state");
  return resposta;
}

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const code = req.nextUrl.searchParams.get("code");
  const erroGoogle = req.nextUrl.searchParams.get("error");

  if (erroGoogle) return voltar(req, { erro: `Google recusou: ${erroGoogle}` });
  if (!code) return voltar(req, { erro: "Google não devolveu o código." });

  // O código só vale se for resposta a um pedido feito por este app. Sem esta
  // conferência, um link montado por outra pessoa poderia fazer um admin logado
  // gravar a conta dela como dona de tudo, com um clique.
  const stateRecebido = req.nextUrl.searchParams.get("state");
  const stateEsperado = req.cookies.get("meet_oauth_state")?.value;

  if (!stateEsperado || !stateRecebido || stateRecebido !== stateEsperado) {
    return voltar(req, {
      erro: "A autorização não confere com o pedido feito aqui. Comece de novo pelo botão do painel.",
    });
  }

  const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return voltar(req, { erro: "Credenciais do app não configuradas." });
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri(req),
      grant_type: "authorization_code",
    }),
  });

  const texto = await resp.text();
  if (!resp.ok) {
    console.error("[meet/oauth/callback]", texto.slice(0, 300));
    return voltar(req, { erro: "Falha ao trocar o código por token." });
  }

  const json = JSON.parse(texto) as {
    refresh_token?: string;
    access_token?: string;
    id_token?: string;
  };

  if (!json.refresh_token) {
    // Acontece quando a conta já autorizou antes e o Google reaproveita a
    // concessão. Revogar em myaccount.google.com/permissions resolve.
    return voltar(req, {
      erro: "O Google não devolveu refresh token. Remova o acesso do app em myaccount.google.com/permissions e autorize de novo.",
    });
  }

  // Descobrir de quem é a conta, em três tentativas do mais confiável para o
  // menos: o id_token assinado pelo Google, o endpoint userinfo, e por último
  // o que estiver configurado à mão.
  let email: string | null = null;

  if (json.id_token) {
    try {
      const payload = JSON.parse(
        Buffer.from(json.id_token.split(".")[1], "base64").toString("utf8")
      ) as { email?: string };
      email = payload.email || null;
    } catch {
      // id_token malformado não impede o resto: o token de acesso é o que importa.
    }
  }

  if (!email && json.access_token) {
    email = await emailDoToken(json.access_token);
  }

  if (!email) {
    email = process.env.GOOGLE_MEET_ORGANIZER_EMAIL || "desconhecido";
  }

  const sb = await createServiceRoleClient();
  const { error } = await sb.from("formacao_meet_credenciais").upsert(
    {
      id: 1,
      organizer_email: email,
      refresh_token: json.refresh_token,
      scopes: MEET_SCOPES.join(" "),
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("[meet/oauth/callback] salvar", error);
    return voltar(req, { erro: "Token obtido, mas falhou ao salvar." });
  }

  return voltar(req, { ok: `Conta ${email} autorizada.` });
}
