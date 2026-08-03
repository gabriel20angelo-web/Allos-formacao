// Move gravação e transcrição para a pasta escolhida.
//
// O Meet joga os arquivos numa pasta que ele mesmo cria, no Drive de quem
// organiza. Funciona, mas em três meses ninguém acha nada. Aqui os arquivos vão
// para a pasta que o admin indicou, com nome legível.
//
// Isso exige um escopo que o Google classifica como restrito, porque estamos
// mexendo em arquivo que o app não criou (quem criou foi o Meet). Se a
// organização barrar, a captura continua funcionando igual: só os arquivos
// ficam onde o Google os colocou, e o erro aparece no painel em vez de sumir.

import { getAccessToken, MeetApiError } from "./client";

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/**
 * Extrai o identificador de uma pasta a partir do que a pessoa colou.
 *
 * Aceita a URL inteira do Drive, com ou sem parâmetros, e também o ID cru:
 * ninguém deveria precisar saber a diferença.
 */
export function extrairIdDaPasta(entrada: string): string | null {
  const texto = entrada.trim();
  if (!texto) return null;

  const porUrl = texto.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (porUrl) return porUrl[1];

  const porParametro = texto.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (porParametro) return porParametro[1];

  // ID colado direto.
  if (/^[a-zA-Z0-9_-]{10,}$/.test(texto)) return texto;

  return null;
}

async function driveFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const resp = await fetch(`${DRIVE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!resp.ok) {
    const body = await resp.text();
    const amigavel =
      resp.status === 403
        ? "O Google recusou o acesso ao Drive. A conta autorizada provavelmente não concedeu a permissão de arquivos: autorize de novo pelo painel."
        : resp.status === 404
          ? "Pasta ou arquivo não encontrado. Confira se o link da pasta está certo e se a conta organizadora tem acesso a ela."
          : `Drive respondeu ${resp.status}.`;
    throw new MeetApiError(amigavel, resp.status, body.slice(0, 300));
  }

  if (resp.status === 204) return {} as T;
  return (await resp.json()) as T;
}

/** Confere se a pasta existe e devolve o nome, para o painel confirmar visualmente. */
export async function verificarPasta(pastaId: string): Promise<{ id: string; name: string }> {
  return driveFetch<{ id: string; name: string }>(
    `/files/${pastaId}?fields=id,name,mimeType&supportsAllDrives=true`
  );
}

/**
 * Move um arquivo para a pasta indicada, renomeando.
 *
 * O Drive v3 não aceita trocar `parents` pelo corpo: a troca é por parâmetro,
 * removendo o pai atual e acrescentando o novo. Por isso o get antes.
 */
export async function moverArquivo(
  fileId: string,
  pastaDestino: string,
  novoNome?: string
): Promise<void> {
  const atual = await driveFetch<{ parents?: string[] }>(
    `/files/${fileId}?fields=id,parents&supportsAllDrives=true`
  );

  const paiAtual = (atual.parents || []).join(",");
  if (paiAtual === pastaDestino) {
    // Já está no lugar certo: só renomeia, se for o caso.
    if (novoNome) {
      await driveFetch(`/files/${fileId}?supportsAllDrives=true`, {
        method: "PATCH",
        body: JSON.stringify({ name: novoNome }),
      });
    }
    return;
  }

  const params = new URLSearchParams({
    addParents: pastaDestino,
    supportsAllDrives: "true",
    fields: "id,parents",
  });
  if (paiAtual) params.set("removeParents", paiAtual);

  await driveFetch(`/files/${fileId}?${params.toString()}`, {
    method: "PATCH",
    body: JSON.stringify(novoNome ? { name: novoNome } : {}),
  });
}

const MIME_PASTA = "application/vnd.google-apps.folder";

/**
 * Procura uma subpasta pelo nome exato dentro de um pai.
 *
 * Serve para não criar "Terça 19h" três vezes: se alguém já criou a pasta à
 * mão, ou se uma rodada anterior criou e falhou ao salvar o identificador, a
 * próxima reaproveita em vez de duplicar.
 */
export async function acharSubpasta(
  nome: string,
  paiId: string
): Promise<{ id: string; name: string } | null> {
  // Aspas simples delimitam o valor na consulta do Drive, então aspas dentro do
  // nome precisam ser escapadas ou a consulta inteira quebra.
  const seguro = nome.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
  const q = `mimeType='${MIME_PASTA}' and name='${seguro}' and '${paiId}' in parents and trashed=false`;

  const resp = await driveFetch<{ files?: { id: string; name: string }[] }>(
    `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=5` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true`
  );
  return resp.files?.[0] || null;
}

export async function criarSubpasta(
  nome: string,
  paiId: string
): Promise<{ id: string; name: string }> {
  return driveFetch<{ id: string; name: string }>(`/files?supportsAllDrives=true&fields=id,name`, {
    method: "POST",
    body: JSON.stringify({ name: nome, mimeType: MIME_PASTA, parents: [paiId] }),
  });
}

/** Acha ou cria, nessa ordem. Duas rodadas do cron não podem gerar duas pastas. */
export async function garantirSubpasta(
  nome: string,
  paiId: string
): Promise<{ id: string; name: string }> {
  const existente = await acharSubpasta(nome, paiId);
  if (existente) return existente;
  return criarSubpasta(nome, paiId);
}

export function urlDaPasta(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

/**
 * Nome da pasta de um grupo.
 *
 * Dia e hora primeiro porque é o que identifica o grupo de forma estável: a
 * atividade pode ser renomeada, o horário não muda sem virar outro grupo.
 */
export function nomeDaPastaDoGrupo(
  diaSemana: number | null,
  hora: string | null,
  atividade: string | null,
  rotulo: string | null
): string {
  const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
  const limpa = (s: string) => s.replace(/[\\/:*?"<>|]/g, "-").trim();

  if (diaSemana === null) return limpa(rotulo || "Sala avulsa").slice(0, 80);

  const partes = [DIAS[diaSemana] || `Dia ${diaSemana}`];
  if (hora) partes.push(hora);
  if (atividade) partes.push(limpa(atividade));
  return partes.join(" ").slice(0, 80);
}

/** Nome que se entende olhando a pasta seis meses depois. */
export function nomeDoArquivo(
  data: string,
  grupo: string | null,
  tipo: "gravacao" | "transcricao"
): string {
  const rotulo = tipo === "gravacao" ? "gravação" : "transcrição";
  const nomeGrupo = (grupo || "Encontro").replace(/[\\/:*?"<>|]/g, "-").slice(0, 60);
  return `${data} ${nomeGrupo} (${rotulo})`;
}
