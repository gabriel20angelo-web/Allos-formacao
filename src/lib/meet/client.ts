// Acesso à Google Meet REST API v2.
//
// Sem biblioteca do Google: a API é REST simples e o refresh de token é um
// POST. Adicionar googleapis traria dezenas de megabytes de tipos para usar
// oito endpoints.
//
// O refresh token mora em formacao_meet_credenciais (linha única, RLS fechada),
// não em env var, pra poder refazer o consentimento sem redeploy. O access
// token fica em memória enquanto o processo vive, com folga de 5 minutos antes
// do vencimento.

import type {
  AccessType,
  ArtefatosDesejados,
  MeetArtifactConfig,
  MeetConferenceRecord,
  MeetParticipant,
  MeetParticipantSession,
  MeetRecording,
  MeetSpace,
  MeetSpaceConfig,
  MeetTranscript,
  MeetTranscriptEntry,
} from "./types";

const MEET_API = "https://meet.googleapis.com/v2";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const MEET_SCOPES = [
  "https://www.googleapis.com/auth/meetings.space.created",
  "https://www.googleapis.com/auth/meetings.space.settings",
  "https://www.googleapis.com/auth/meetings.space.readonly",
  // Sem estes dois o Google não diz de quem é o acesso, e o painel exibiria
  // "conta desconhecido". Saber qual conta autorizou não é enfeite: é ela que
  // vira dona das salas e do Drive onde as gravações vão parar.
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

/** E-mail da conta que autorizou, para o painel mostrar de quem é o acesso. */
export async function emailDoToken(accessToken: string): Promise<string | null> {
  try {
    const resp = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    });
    if (!resp.ok) return null;
    const json = (await resp.json()) as { email?: string };
    return json.email || null;
  } catch {
    return null;
  }
}

export class MeetApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "MeetApiError";
  }
}

/**
 * Converte a recusa do Google em instrução acionável.
 *
 * "Meet API 403" não diz a ninguém o que fazer. As três recusas abaixo são as
 * que aparecem de verdade ao ligar o módulo, e todas se resolvem com um clique
 * em algum lugar específico do console ou do admin do Workspace.
 */
function traduzirErro(status: number, body: string): string {
  const texto = body.toLowerCase();

  if (status === 403 && texto.includes("has not been used in project")) {
    const projeto = body.match(/project (\d+)/)?.[1];
    return projeto
      ? `A Google Meet API não está ativada no projeto ${projeto}. Ative em console.developers.google.com/apis/api/meet.googleapis.com/overview?project=${projeto} e tente de novo em um minuto.`
      : "A Google Meet API não está ativada neste projeto do Google Cloud.";
  }
  if (status === 403 && texto.includes("insufficient")) {
    return "A conta autorizada não tem permissão suficiente. Autorize de novo em Autorizar conta do Google, conferindo se é a conta do Workspace da Allos.";
  }
  if (status === 401) {
    return "O acesso ao Google expirou ou foi revogado. Clique em Autorizar conta do Google de novo.";
  }
  if (status === 429) {
    return "O Google recusou por excesso de chamadas. Espere alguns minutos e tente de novo.";
  }
  return `O Google recusou a operação (código ${status}).`;
}

let tokenCache: { token: string; expiraEm: number } | null = null;

interface CredenciaisRow {
  organizer_email: string;
  refresh_token: string;
}

async function lerCredenciais(): Promise<CredenciaisRow> {
  const { createServiceRoleClient } = await import("@/lib/supabase/server");
  const sb = await createServiceRoleClient();
  const { data, error } = await sb
    .from("formacao_meet_credenciais")
    .select("organizer_email, refresh_token")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    throw new MeetApiError(`Erro lendo credenciais: ${error.message}`, 500);
  }
  if (!data?.refresh_token) {
    throw new MeetApiError(
      "Conta organizadora ainda não autorizou o acesso ao Meet. Rode o consentimento em /formacao/admin/meet.",
      401
    );
  }
  return data as CredenciaisRow;
}

/** Access token válido, renovado a partir do refresh token guardado. */
export async function getAccessToken(forcar = false): Promise<string> {
  if (!forcar && tokenCache && tokenCache.expiraEm > Date.now()) {
    return tokenCache.token;
  }

  const clientId = process.env.GOOGLE_MEET_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_MEET_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new MeetApiError(
      "GOOGLE_MEET_CLIENT_ID e GOOGLE_MEET_CLIENT_SECRET não configurados.",
      500
    );
  }

  const { refresh_token } = await lerCredenciais();

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token,
      grant_type: "refresh_token",
    }),
  });

  const texto = await resp.text();
  if (!resp.ok) {
    // Refresh token revogado ou consentimento removido: o admin precisa
    // reautorizar, e a mensagem tem que dizer isso em vez de "400".
    tokenCache = null;
    throw new MeetApiError(
      "Falha ao renovar o acesso ao Google. A conta organizadora provavelmente precisa autorizar de novo.",
      resp.status,
      texto
    );
  }

  const json = JSON.parse(texto) as { access_token: string; expires_in: number };
  tokenCache = {
    token: json.access_token,
    expiraEm: Date.now() + (json.expires_in - 300) * 1000,
  };
  return tokenCache.token;
}

async function meetFetch<T>(
  path: string,
  init: RequestInit = {},
  tentativa = 0
): Promise<T> {
  const token = await getAccessToken();
  const resp = await fetch(`${MEET_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (resp.status === 401 && tentativa === 0) {
    // Token expirou antes da hora prevista. Uma segunda chance basta.
    await getAccessToken(true);
    return meetFetch<T>(path, init, 1);
  }

  if (!resp.ok) {
    const body = await resp.text();
    throw new MeetApiError(traduzirErro(resp.status, body), resp.status, body.slice(0, 500));
  }

  if (resp.status === 204) return {} as T;
  return (await resp.json()) as T;
}

/** Percorre todas as páginas de um endpoint de listagem. */
async function listarTudo<T>(
  path: string,
  chave: string,
  limitePaginas = 20
): Promise<T[]> {
  const itens: T[] = [];
  let pageToken: string | undefined;
  let paginas = 0;

  do {
    const sep = path.includes("?") ? "&" : "?";
    const url = `${path}${sep}pageSize=100${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const resp = await meetFetch<Record<string, unknown>>(url);
    const lote = (resp[chave] as T[] | undefined) || [];
    itens.push(...lote);
    pageToken = resp.nextPageToken as string | undefined;
    paginas++;
  } while (pageToken && paginas < limitePaginas);

  return itens;
}

// ── Spaces ───────────────────────────────────────────────────

function montarArtifactConfig(a: ArtefatosDesejados): MeetSpaceConfig {
  return {
    artifactConfig: {
      recordingConfig: { autoRecordingGeneration: a.gravar ? "ON" : "OFF" },
      transcriptionConfig: {
        autoTranscriptionGeneration: a.transcrever ? "ON" : "OFF",
      },
      smartNotesConfig: { autoSmartNotesGeneration: a.notas ? "ON" : "OFF" },
    },
  };
}

/** Caminho de cada chave até a folha, que é o que o updateMask aceita. */
const CAMINHO_ARTEFATO = {
  gravar: "config.artifactConfig.recordingConfig.autoRecordingGeneration",
  transcrever: "config.artifactConfig.transcriptionConfig.autoTranscriptionGeneration",
  notas: "config.artifactConfig.smartNotesConfig.autoSmartNotesGeneration",
} as const;

/**
 * Cria a sala permanente de um slot.
 *
 * accessType OPEN porque os alunos entram com conta pessoal, fora do domínio:
 * sem isso cada um bate à porta e alguém precisa admitir um por um.
 */
export async function criarSpace(a: ArtefatosDesejados): Promise<MeetSpace> {
  return meetFetch<MeetSpace>("/spaces", {
    method: "POST",
    body: JSON.stringify({
      config: {
        accessType: "OPEN",
        entryPointAccess: "ALL",
        ...montarArtifactConfig(a),
      },
    }),
  });
}

export async function lerSpace(spaceName: string): Promise<MeetSpace> {
  return meetFetch<MeetSpace>(`/${spaceName}`);
}

/**
 * Troca o que é gravado numa sala existente.
 *
 * A máscara aponta para a folha de cada chave, e não para `config.artifactConfig`
 * inteiro: o exemplo oficial usa `config.accessType`, que também é folha, e o nó
 * intermediário é recusado com 400.
 *
 * Recebe parcial de propósito. Mexer só no campo que o admin clicou evita
 * esbarrar em recurso que a licença não cobre (notas de IA, por exemplo) ao
 * alterar algo que não tem nada a ver.
 */
export async function atualizarArtefatos(
  spaceName: string,
  a: Partial<ArtefatosDesejados>
): Promise<MeetSpace> {
  const artifactConfig: MeetArtifactConfig = {};
  const campos: string[] = [];

  if (a.gravar !== undefined) {
    artifactConfig.recordingConfig = { autoRecordingGeneration: a.gravar ? "ON" : "OFF" };
    campos.push(CAMINHO_ARTEFATO.gravar);
  }
  if (a.transcrever !== undefined) {
    artifactConfig.transcriptionConfig = {
      autoTranscriptionGeneration: a.transcrever ? "ON" : "OFF",
    };
    campos.push(CAMINHO_ARTEFATO.transcrever);
  }
  if (a.notas !== undefined) {
    artifactConfig.smartNotesConfig = {
      autoSmartNotesGeneration: a.notas ? "ON" : "OFF",
    };
    campos.push(CAMINHO_ARTEFATO.notas);
  }

  if (!campos.length) return lerSpace(spaceName);

  const mask = encodeURIComponent(campos.join(","));
  return meetFetch<MeetSpace>(`/${spaceName}?updateMask=${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ config: { artifactConfig } }),
  });
}

/**
 * Reabre (ou fecha) a porta da sala.
 *
 * OPEN é o que o Google chama de entrar sem knocking: quem tem o link entra
 * direto, sem ninguém admitir. Existe como operação própria porque o condutor
 * pode fechar a sala sem querer pelos controles de anfitrião dentro da
 * reunião, e aí alguém precisa reabrir de fora.
 */
export async function atualizarAcesso(
  spaceName: string,
  accessType: AccessType
): Promise<MeetSpace> {
  const mask = encodeURIComponent("config.accessType");
  return meetFetch<MeetSpace>(`/${spaceName}?updateMask=${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ config: { accessType } }),
  });
}

/**
 * Encerra a reunião que estiver acontecendo na sala, para todo mundo.
 *
 * Equivale ao "encerrar a chamada para todos" que o anfitrião tem dentro do
 * Meet, só que acionável de fora, sem precisar entrar na reunião.
 */
export async function encerrarConferencia(spaceName: string): Promise<void> {
  await meetFetch<Record<string, never>>(`/${spaceName}:endActiveConference`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

// ── Conference records ───────────────────────────────────────

/**
 * Conferências de uma sala. `desde` corta o histórico já ingerido.
 *
 * O filtro da API aceita space.name e start_time, e o valor vai entre aspas
 * duplas dentro da própria expressão.
 */
export async function listarConferencias(
  spaceName: string,
  desde?: Date
): Promise<MeetConferenceRecord[]> {
  const partes = [`space.name="${spaceName}"`];
  if (desde) partes.push(`start_time>="${desde.toISOString()}"`);
  const filtro = encodeURIComponent(partes.join(" AND "));
  return listarTudo<MeetConferenceRecord>(
    `/conferenceRecords?filter=${filtro}`,
    "conferenceRecords"
  );
}

export async function listarParticipantes(
  conferenceRecord: string
): Promise<MeetParticipant[]> {
  return listarTudo<MeetParticipant>(
    `/${conferenceRecord}/participants`,
    "participants"
  );
}

export async function listarSessoes(
  participantName: string
): Promise<MeetParticipantSession[]> {
  return listarTudo<MeetParticipantSession>(
    `/${participantName}/participantSessions`,
    "participantSessions"
  );
}

export async function listarTranscricoes(
  conferenceRecord: string
): Promise<MeetTranscript[]> {
  return listarTudo<MeetTranscript>(
    `/${conferenceRecord}/transcripts`,
    "transcripts"
  );
}

/**
 * Entradas de transcrição.
 *
 * O texto vem no payload e é usado só para contar turno; nada dele é
 * persistido. Encontro de formação toca em material clínico.
 */
export async function listarEntradasTranscricao(
  transcriptName: string
): Promise<MeetTranscriptEntry[]> {
  return listarTudo<MeetTranscriptEntry>(
    `/${transcriptName}/entries`,
    "transcriptEntries",
    60
  );
}

export async function listarGravacoes(
  conferenceRecord: string
): Promise<MeetRecording[]> {
  return listarTudo<MeetRecording>(
    `/${conferenceRecord}/recordings`,
    "recordings"
  );
}

/** Só para a tela de diagnóstico: confirma que o token funciona. */
export async function testarAcesso(): Promise<{ ok: boolean; email: string }> {
  const { organizer_email } = await lerCredenciais();
  await getAccessToken(true);
  return { ok: true, email: organizer_email };
}
