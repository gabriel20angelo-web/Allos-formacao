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
  webhookUrl?: string
): Promise<ProjetoCriado> {
  const corpo: Record<string, unknown> = {
    videoUrl,
    uploadedVideoAttr: { title: titulo.slice(0, 120) },
    importPreference: { sourceLang: "pt" },
    curationPref: {
      model: "ClipAnything",
      // Faixa larga: encontro de formação tem trecho bom de trinta segundos e
      // de dois minutos, e travar num tamanho só descarta metade do que presta.
      clipDurations: [[15, 120]],
      genre: "Auto",
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
  url?: string;
  videoUrl?: string;
  thumbnailUrl?: string;
  duration?: number;
  score?: number;
  viralScore?: number;
}

/**
 * Estado do projeto e clipes prontos.
 *
 * Serve de rede para quando o aviso de conclusão não chega: o agendador
 * pergunta de tempos em tempos em vez de esperar para sempre.
 */
export async function consultarProjeto(
  projetoId: string
): Promise<{ status: string; clipes: ClipeRetornado[] }> {
  const resp = await fetch(`${API}/clip-projects/${projetoId}`, {
    headers: { Authorization: `Bearer ${chave()}` },
    cache: "no-store",
  });

  const texto = await resp.text();
  if (!resp.ok) {
    throw new OpusError(traduzir(resp.status, texto), resp.status, texto.slice(0, 300));
  }

  const json = JSON.parse(texto) as {
    status?: string;
    clips?: ClipeRetornado[];
    data?: { status?: string; clips?: ClipeRetornado[] };
  };

  // O formato da resposta não está documentado em detalhe; aceitar as duas
  // formas evita quebrar por causa de um envelope a mais.
  const raiz = json.data || json;
  return {
    status: raiz.status || "unknown",
    clipes: raiz.clips || [],
  };
}
