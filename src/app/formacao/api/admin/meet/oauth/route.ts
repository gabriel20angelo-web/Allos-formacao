// Passo 1 do consentimento: manda o admin para o Google.
//
// access_type=offline + prompt=consent porque é o único jeito de o Google
// devolver refresh token. Sem prompt=consent, uma segunda autorização da mesma
// conta volta só com access token, e o sistema fica sem como se renovar.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin, redirectUri } from "@/lib/meet/auth";
import { MEET_SCOPES } from "@/lib/meet/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GOOGLE_MEET_CLIENT_ID não configurado no servidor." },
      { status: 500 }
    );
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: MEET_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });

  const hint = process.env.GOOGLE_MEET_ORGANIZER_EMAIL;
  if (hint) params.set("login_hint", hint);

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
}
