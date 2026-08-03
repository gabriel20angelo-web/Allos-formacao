// Envio de email pelo Google Workspace da Allos.
//
// Copiado do allos-site (src/lib/googleWorkspace.ts), onde ja roda em producao
// no processo seletivo: mesma service account, mesmas credenciais. O que muda
// aqui e so o remetente, configuravel por FORMACAO_MAIL_FROM.
//
// Original:
// via service account com delegação em todo o domínio.
//
// Só faz uma coisa: mandar email pela Gmail API, saindo de um endereço
// @allos.org.br — SPF/DKIM alinhados, 2.000 envios/dia. Os dados dos inscritos
// ficam no Postgres do Neon (`processo-seletivo-db.ts`), não aqui.
//
// Sem dependência nova: o JWT é assinado com o `crypto` do Node e todo o
// resto é fetch. Setup do lado do Google em
// setup/processo-seletivo-google-workspace.md.

import { createSign } from "crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export const SCOPE_GMAIL_SEND = "https://www.googleapis.com/auth/gmail.send";

type TokenCache = { token: string; expiraEm: number };

// Cache em memória por conjunto de escopos. Vale só para o lifetime da
// instância serverless, que é exatamente o que queremos: evita um round-trip
// de OAuth a cada operação dentro da mesma requisição/instância quente.
const cacheDeTokens = new Map<string, TokenCache>();

function credenciais() {
  const clientEmail = process.env.GOOGLE_SA_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GOOGLE_SA_PRIVATE_KEY;
  const subject = process.env.GOOGLE_IMPERSONATED_USER;

  if (!clientEmail || !privateKeyRaw || !subject) {
    throw new Error(
      "Google Workspace não configurado: defina GOOGLE_SA_CLIENT_EMAIL, GOOGLE_SA_PRIVATE_KEY e GOOGLE_IMPERSONATED_USER.",
    );
  }

  // A chave vem do JSON da service account com "\n" literais quando colada
  // num painel de env vars — normaliza para quebras de linha de verdade.
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");
  return { clientEmail, privateKey, subject };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Troca um JWT assinado pela service account por um access token, já
 * personificando o usuário do domínio (delegação em todo o domínio).
 */
async function getAccessToken(scopes: string[]): Promise<string> {
  const chave = scopes.slice().sort().join(" ");
  const agora = Math.floor(Date.now() / 1000);

  const cacheado = cacheDeTokens.get(chave);
  if (cacheado && cacheado.expiraEm > agora + 60) return cacheado.token;

  const { clientEmail, privateKey, subject } = credenciais();

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      sub: subject,
      scope: chave,
      aud: TOKEN_URL,
      iat: agora,
      exp: agora + 3600,
    }),
  );

  const assinatura = createSign("RSA-SHA256")
    .update(`${header}.${claim}`)
    .sign(privateKey)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claim}.${assinatura}`,
    }),
  });

  if (!res.ok) {
    const detalhe = await res.text();
    throw new Error(`Falha ao autenticar no Google (${res.status}): ${detalhe}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cacheDeTokens.set(chave, {
    token: json.access_token,
    expiraEm: agora + json.expires_in,
  });
  return json.access_token;
}

// ---------------------------------------------------------------------------
// Gmail
// ---------------------------------------------------------------------------

// Assunto com acento precisa de encoded-word (RFC 2047) — sem isso o Gmail
// mostra o assunto corrompido em alguns clientes.
function encodarAssunto(assunto: string): string {
  return `=?UTF-8?B?${Buffer.from(assunto, "utf8").toString("base64")}?=`;
}

// RFC 2045 pede linhas de no máximo 76 caracteres no corpo base64.
function base64Quebrado(texto: string): string {
  return (Buffer.from(texto, "utf8").toString("base64").match(/.{1,76}/g) || []).join("\r\n");
}

export type Email = {
  para: string;
  /** Nome de exibição do destinatário (opcional, melhora a apresentação). */
  nomeDestinatario?: string;
  assunto: string;
  html: string;
  /** Alternativa em texto puro — melhora entregabilidade e acessibilidade. */
  texto: string;
};

/**
 * Envia um email pela Gmail API, saindo do endereço configurado em
 * GOOGLE_IMPERSONATED_USER (ou de FORMACAO_MAIL_FROM, se definido).
 * Lança em caso de falha — quem chama decide o que fazer.
 */
export async function sendMail({ para, nomeDestinatario, assunto, html, texto }: Email): Promise<void> {
  const token = await getAccessToken([SCOPE_GMAIL_SEND]);
  const { subject } = credenciais();

  const remetente = process.env.FORMACAO_MAIL_FROM || `Allos <${subject}>`;
  const replyTo = process.env.FORMACAO_REPLY_TO || subject;
  const destinatario = nomeDestinatario
    ? `${encodarAssunto(nomeDestinatario)} <${para}>`
    : para;

  const boundary = `allos-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

  const mime = [
    `From: ${remetente}`,
    `To: ${destinatario}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodarAssunto(assunto)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Quebrado(texto),
    "",
    `--${boundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    base64Quebrado(html),
    "",
    `--${boundary}--`,
  ].join("\r\n");

  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: base64url(mime) }),
  });

  if (!res.ok) {
    const detalhe = await res.text();
    throw new Error(`Gmail recusou o envio (${res.status}): ${detalhe}`);
  }
}

/** True se as env vars mínimas para enviar email estiverem presentes. */
export function workspaceConfigurado(): boolean {
  return Boolean(
    process.env.GOOGLE_SA_CLIENT_EMAIL &&
      process.env.GOOGLE_SA_PRIVATE_KEY &&
      process.env.GOOGLE_IMPERSONATED_USER,
  );
}
