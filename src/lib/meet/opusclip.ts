// Corta a gravação em clipes curtos, pelo OpusClip.
//
// A API aceita URL de vídeo em vez de arquivo, e a lista de origens suportadas
// inclui Google Drive e YouTube. Isso importa: significa que o servidor não
// precisa baixar nem reenviar nada, ao contrário do envio ao YouTube. Manda-se
// o endereço e espera-se o retorno.
//
// Cada envio é cobrado por minuto do vídeo ORIGINAL, não por clipe gerado. É
// por isso que nada aqui é automático por padrão: quem gera clipe é o grupo
// marcado, e o mesmo vídeo nunca é enviado duas vezes.

const API = "https://api.opus.pro/api";

export class OpusError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string
  ) {
    super(message);
    this.name = "OpusError";
  }
}

function chave(): string {
  const k = process.env.OPUSCLIP_API_KEY;
  if (!k) {
    throw new OpusError(
      "A chave do OpusClip não está configurada no servidor.",
      500
    );
  }
  return k;
}

/**
 * O vídeo existe mas ainda não está pronto do outro lado.
 *
 * Acontece com vídeo grande recém-enviado ao YouTube: o envio fechou, o
 * processamento não. Não é erro, é cedo — e a diferença importa, porque erro
 * gasta tentativa e cedo só pede paciência.
 */
export function ehCedoDemais(erro: unknown): boolean {
  if (!(erro instanceof OpusError)) return false;
  const t = `${erro.body || ""} ${erro.message}`.toLowerCase();
  return (
    t.includes("still ongoing") ||
    t.includes("processing youtube") ||
    t.includes("try again after")
  );
}

function traduzir(status: number, corpo: string): string {
  const t = corpo.toLowerCase();
  if (status === 401 || status === 403) {
    return "O OpusClip recusou a chave. Confira se ela continua válida na conta.";
  }
  if (t.includes("still ongoing") || t.includes("processing youtube")) {
    return "O YouTube ainda está processando o vídeo. O corte começa sozinho quando terminar.";
  }
  if (t.includes("unsupported video link")) {
    return "O OpusClip não aceita essa origem de vídeo. Ele lê YouTube, Vimeo, Zoom, Rumble, Twitch, Facebook, LinkedIn, Twitter e StreamYard.";
  }
  if (t.includes("credit") || t.includes("quota") || status === 402) {
    return "Os créditos do OpusClip acabaram. O corte volta a funcionar quando a conta for recarregada.";
  }
  if (t.includes("unsupported") || t.includes("invalid url") || t.includes("videourl")) {
    return "O OpusClip não conseguiu ler esse vídeo. Confira se o link está acessível para quem tem o endereço.";
  }
  if (status === 429) {
    return "Muitos envios em pouco tempo. Espere alguns minutos.";
  }
  return `O OpusClip recusou (código ${status}).`;
}

export interface ProjetoCriado {
  id: string;
  status?: string;
}

/**
 * Manda um vídeo para ser cortado.
 *
 * `sourceLang: pt` importa: sem isso a transcrição interna sai em inglês e os
 * cortes ficam sem sentido, porque a ferramenta escolhe os trechos pelo que
 * entende do que foi dito.
 */
export async function criarProjeto(
  videoUrl: string,
  titulo: string,
  webhookUrl?: string,
  customPrompt?: string
): Promise<ProjetoCriado> {
  const corpo: Record<string, unknown> = {
    videoUrl,
    uploadedVideoAttr: { title: titulo.slice(0, 120) },
    // `importPref`, não `importPreference`. O nome errado é ignorado em
    // silêncio: o vídeo voltou com idioma nulo e as sugestões dele vieram em
    // inglês, apesar de o encontro ser todo em português.
    importPref: { sourceLang: "pt" },
    curationPref: {
      model: "ClipAnything",
      // As quatro faixas que a documentação lista. Todas, porque encontro de
      // formação rende trecho bom de dezessete segundos e de dois minutos: o
      // primeiro corte do encontro da Alice provou isso, e travar num tamanho
      // só descartaria metade do que presta.
      clipDurations: [
        [0, 30],
        [30, 60],
        [60, 90],
        [90, 180],
      ],
      genre: "Auto",
      // Dirige o que procurar, não como editar. Só existe no ClipAnything.
      ...(customPrompt ? { customPrompt: customPrompt.slice(0, 2000) } : {}),
    },
  };

  if (webhookUrl) {
    corpo.conclusionActions = [{ type: "WEBHOOK", notifyFailure: true, url: webhookUrl }];
  }

  const resp = await fetch(`${API}/clip-projects`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });

  const texto = await resp.text();
  if (!resp.ok) {
    console.error("[opusclip] criar", resp.status, texto.slice(0, 400));
    throw new OpusError(traduzir(resp.status, texto), resp.status, texto.slice(0, 400));
  }

  const json = JSON.parse(texto) as { id?: string; projectId?: string; status?: string };
  const id = json.id || json.projectId;
  if (!id) {
    throw new OpusError("O OpusClip não devolveu o identificador do projeto.", 500, texto.slice(0, 300));
  }
  return { id, status: json.status };
}

export interface ClipeRetornado {
  id?: string;
  title?: string;
  description?: string;
  /** O que é falado no clipe. Serve de legenda pronta. */
  text?: string;
  /** Chega como texto único ("#a #b #c"), apesar do nome no plural. */
  hashtags?: string[] | string;
  uriForExport?: string;
  uriForPreview?: string;
  uriForThumbnail?: string;
  durationMs?: number;
  score?: number;
  /** Trechos do vídeo original, em milissegundos. Um clipe pode ser costurado. */
  timeRanges?: number[][];
}

export interface EstadoProjeto {
  status: string;
  clipes: ClipeRetornado[];
  /** Transcrição do vídeo inteiro, feita pelo próprio OpusClip. */
  transcricaoUrl: string | null;
  transcricaoSrtUrl: string | null;
}

/**
 * Estado do projeto e clipes prontos.
 *
 * São duas chamadas porque são dois recursos: o projeto diz em que pé está, e
 * os clipes moram em `exportable-clips`, que é recurso de topo e não
 * sub-recurso do projeto. Procurá-los dentro do projeto devolve 404 — foi o
 * que fez 41 clipes prontos parecerem zero por horas.
 */
export async function consultarProjeto(projetoId: string): Promise<EstadoProjeto> {
  const resp = await fetch(`${API}/clip-projects/${projetoId}`, {
    headers: { Authorization: `Bearer ${chave()}` },
    cache: "no-store",
  });

  const texto = await resp.text();
  if (!resp.ok) {
    throw new OpusError(traduzir(resp.status, texto), resp.status, texto.slice(0, 300));
  }

  const projeto = JSON.parse(texto) as {
    stage?: string;
    status?: string;
    transcriptTxtUrl?: string;
    transcriptSrtUrl?: string;
  };

  const status = projeto.stage || projeto.status || "unknown";

  const respClipes = await fetch(
    `${API}/exportable-clips?q=findByProjectId&projectId=${encodeURIComponent(projetoId)}&pageSize=100`,
    { headers: { Authorization: `Bearer ${chave()}` }, cache: "no-store" }
  );

  let clipes: ClipeRetornado[] = [];
  if (respClipes.ok) {
    const corpo = JSON.parse(await respClipes.text()) as {
      list?: ClipeRetornado[];
      data?: ClipeRetornado[];
    };
    clipes = corpo.list || corpo.data || [];
  } else {
    console.error("[opusclip] clipes", respClipes.status, (await respClipes.text()).slice(0, 200));
  }

  return {
    status,
    clipes,
    transcricaoUrl: projeto.transcriptTxtUrl || null,
    transcricaoSrtUrl: projeto.transcriptSrtUrl || null,
  };
}

/**
 * Baixa a transcrição que o OpusClip fez do vídeo.
 *
 * Vale para vídeo que nunca passou pelo Meet: os encontros antigos, que só
 * existiam como arquivo no Drive, ganham transcrição por terem passado por
 * aqui. É o único caminho que o sistema tem para transcrever esses.
 */
export async function baixarTranscricao(url: string): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) return null;
    const t = await r.text();
    return t.trim() || null;
  } catch {
    return null;
  }
}
