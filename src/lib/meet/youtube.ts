// Envia a gravação do Drive para o YouTube, como não listada.
//
// Não existe "copiar do Drive para o YouTube": o vídeo precisa passar por aqui.
// E vídeo de duas horas passa de um gigabyte, enquanto a requisição tem alguns
// minutos de vida. Por isso o envio é retomável: o YouTube devolve um endereço
// de sessão, a gente manda um pedaço, guarda onde parou, e a batida seguinte do
// agendador continua dali.
//
// Nada é carregado inteiro na memória: cada pedaço é baixado do Drive e
// repassado adiante. Um vídeo de dois gigabytes não pode virar dois gigabytes
// de RAM num contêiner pequeno.

import { getAccessToken, MeetApiError } from "./client";

// Múltiplo de 256 KB, exigência do envio retomável do Google. 8 MB por rodada é
// o equilíbrio entre poucas idas e vindas e caber no tempo da requisição.
const PEDACO = 8 * 1024 * 1024;

/**
 * Diz o que fazer, não o que aconteceu.
 *
 * "O YouTube recusou o acesso" mandou o Gabriel autorizar de novo três vezes
 * sem resolver, porque a causa era outra. Cada recusa aqui tem uma ação
 * diferente, e a resposta do Google diz qual.
 */
function traduzir(status: number, corpo: string): string {
  const texto = corpo.toLowerCase();

  if (texto.includes("has not been used in project") || texto.includes("is disabled")) {
    const projeto = corpo.match(/project (\d+)/)?.[1];
    return projeto
      ? `A YouTube Data API não está ativada no projeto ${projeto}. Ative em console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=${projeto} e tente de novo em um minuto.`
      : "A YouTube Data API não está ativada neste projeto do Google Cloud.";
  }
  if (texto.includes("youtubesignuprequired")) {
    return "A conta da Allos ainda não tem canal no YouTube. Crie o canal e tente de novo.";
  }
  if (texto.includes("quotaexceeded") || status === 429) {
    return "A cota diária de envios do YouTube acabou. Volta a funcionar amanhã, sem precisar fazer nada.";
  }
  if (texto.includes("insufficientpermissions") || texto.includes("insufficient")) {
    return "A autorização não inclui permissão de envio ao YouTube. Autorize de novo pelo painel e confira se o pedido sobre enviar vídeos aparece.";
  }
  if (status === 401) {
    return "O acesso ao Google expirou. Autorize de novo pelo painel.";
  }
  if (status === 403) {
    return "O YouTube recusou (403). Pode ser API desativada, conta sem canal, ou envio bloqueado no canal.";
  }
  return `O YouTube recusou a abertura do envio (código ${status}).`;
}

export interface SessaoUpload {
  url: string;
  tamanho: number;
}

/**
 * Abre a sessão de envio e devolve o endereço para onde mandar os pedaços.
 *
 * `privacyStatus: unlisted` é o "não listado": não aparece em busca nem no
 * canal, e quem tem o link assiste.
 */
export async function abrirSessaoUpload(
  titulo: string,
  descricao: string,
  tamanhoBytes: number
): Promise<string> {
  const token = await getAccessToken();

  const metadados = {
    snippet: {
      title: titulo.slice(0, 100), // limite do YouTube
      description: descricao.slice(0, 5000),
      categoryId: "27", // Educação
    },
    status: {
      privacyStatus: "unlisted",
      selfDeclaredMadeForKids: false,
    },
  };

  const resp = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": String(tamanhoBytes),
        "X-Upload-Content-Type": "video/*",
      },
      body: JSON.stringify(metadados),
    }
  );

  if (!resp.ok) {
    const corpo = await resp.text();
    console.error("[youtube] abrir sessão", resp.status, corpo.slice(0, 600));
    throw new MeetApiError(traduzir(resp.status, corpo), resp.status, corpo.slice(0, 400));
  }

  const location = resp.headers.get("location");
  if (!location) {
    throw new MeetApiError("O YouTube não devolveu o endereço de envio.", 500);
  }
  return location;
}

/** Tamanho do arquivo no Drive, necessário antes de abrir a sessão. */
export async function tamanhoDoArquivo(fileId: string): Promise<number> {
  const token = await getAccessToken();
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?fields=size,name&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }
  );
  if (!resp.ok) {
    throw new MeetApiError(
      "Não consegui ler o arquivo da gravação no Drive.",
      resp.status,
      (await resp.text()).slice(0, 300)
    );
  }
  const json = (await resp.json()) as { size?: string };
  const tamanho = Number(json.size || 0);
  if (!tamanho) {
    throw new MeetApiError("A gravação ainda não tem tamanho: pode estar sendo processada.", 409);
  }
  return tamanho;
}

export interface ResultadoPedaco {
  concluido: boolean;
  videoId?: string;
  proximoByte: number;
}

/**
 * Manda um pedaço e diz onde parou.
 *
 * O YouTube responde 308 enquanto quer mais, com o intervalo já recebido no
 * cabeçalho Range; responde 200 ou 201 quando terminou, com o vídeo criado.
 */
export async function enviarPedaco(
  uploadUrl: string,
  driveFileId: string,
  inicio: number,
  total: number
): Promise<ResultadoPedaco> {
  const token = await getAccessToken();
  const fim = Math.min(inicio + PEDACO, total) - 1;

  // Baixa só a faixa necessária: o arquivo inteiro não cabe na memória.
  const respDrive = await fetch(
    `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}`, Range: `bytes=${inicio}-${fim}` },
      cache: "no-store",
    }
  );

  if (!respDrive.ok && respDrive.status !== 206) {
    throw new MeetApiError(
      "Não consegui baixar o trecho da gravação no Drive.",
      respDrive.status,
      (await respDrive.text()).slice(0, 300)
    );
  }

  const buffer = Buffer.from(await respDrive.arrayBuffer());

  const respYt = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(buffer.length),
      "Content-Range": `bytes ${inicio}-${inicio + buffer.length - 1}/${total}`,
    },
    body: buffer,
  });

  // 308 = quer mais. O cabeçalho Range diz até onde ele já tem.
  if (respYt.status === 308) {
    const range = respYt.headers.get("range");
    const ate = range?.match(/bytes=0-(\d+)/)?.[1];
    return { concluido: false, proximoByte: ate ? Number(ate) + 1 : inicio + buffer.length };
  }

  if (respYt.status === 200 || respYt.status === 201) {
    const json = (await respYt.json()) as { id?: string };
    return { concluido: true, videoId: json.id, proximoByte: total };
  }

  throw new MeetApiError(
    `O YouTube recusou o pedaço (código ${respYt.status}).`,
    respYt.status,
    (await respYt.text()).slice(0, 300)
  );
}

/**
 * Manda pedaço atrás de pedaço até acabar o vídeo ou o tempo.
 *
 * Um pedaço por rodada não serve para arquivo grande: 900 MB em fatias de 8 MB
 * são 113 rodadas, e a cada quinze minutos isso é mais de um dia por vídeo. Com
 * o laço aqui dentro, cada rodada empurra o quanto couber no tempo que sobrou.
 *
 * `deadline` é instante absoluto, não duração: quem chama já gastou parte do
 * tempo da requisição, e só ele sabe quanto.
 */
export async function enviarAte(
  uploadUrl: string,
  driveFileId: string,
  inicio: number,
  total: number,
  deadline: number
): Promise<ResultadoPedaco> {
  let pos = inicio;

  while (pos < total) {
    // Margem para gravar o progresso e devolver a resposta antes do corte.
    if (Date.now() > deadline - 15_000) break;

    const r = await enviarPedaco(uploadUrl, driveFileId, pos, total);
    if (r.concluido) return r;

    // Sem avanço é sinal de problema do outro lado. Parar e tentar na rodada
    // seguinte é melhor que girar aqui até o tempo acabar.
    if (r.proximoByte <= pos) break;
    pos = r.proximoByte;
  }

  return { concluido: false, proximoByte: pos };
}

/** Onde o YouTube parou, quando não sabemos (retomada após falha). */
export async function consultarProgresso(
  uploadUrl: string,
  total: number
): Promise<{ concluido: boolean; videoId?: string; proximoByte: number }> {
  const resp = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Length": "0", "Content-Range": `bytes */${total}` },
  });

  if (resp.status === 308) {
    const range = resp.headers.get("range");
    const ate = range?.match(/bytes=0-(\d+)/)?.[1];
    return { concluido: false, proximoByte: ate ? Number(ate) + 1 : 0 };
  }
  if (resp.status === 200 || resp.status === 201) {
    const json = (await resp.json()) as { id?: string };
    return { concluido: true, videoId: json.id, proximoByte: total };
  }
  // Sessão expirada (o Google guarda por uma semana): recomeça do zero.
  throw new MeetApiError("A sessão de envio expirou.", resp.status);
}
