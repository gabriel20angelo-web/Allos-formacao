// Fila de cortes: leva o vídeo até uma origem que o OpusClip aceita, manda, e
// recolhe o que ficou pronto.
//
// Roda no agendador, junto do resto. Três etapas, uma por rodada:
//   subir    → vídeo que mora no Drive vai ao YouTube como não listado
//   enviar   → manda o endereço para o OpusClip
//   recolher → pergunta pelos que estão cortando e guarda os clipes
//
// A primeira etapa existe porque o OpusClip não lê Google Drive: ele aceita
// YouTube, Vimeo, Zoom, Rumble, Twitch, Facebook, LinkedIn, Twitter e
// StreamYard. Vídeo não listado do YouTube funciona, o que foi verificado antes
// de escrever isto — é o formato em que este sistema publica.
//
// Um envio por rodada, de propósito. Cada envio custa dinheiro por minuto de
// vídeo, e mandar dez de uma vez transforma um erro de configuração numa conta
// alta antes de alguém perceber.

import {
  baixarTranscricao,
  consultarProjeto,
  criarProjeto,
  ehCedoDemais,
  OpusError,
} from "./opusclip";
import { abrirSessaoUpload, consultarProgresso, enviarAte, tamanhoDoArquivo } from "./youtube";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

const MAX_TENTATIVAS = 3;
const MAX_TENTATIVAS_YT = 5;

/** Quanto esperar quando o YouTube ainda está processando o vídeo. */
const ESPERA_MIN = 15;

/**
 * Teto da paciência: doze horas de espera em fatias de quinze minutos.
 *
 * Vídeo de uma hora e meia leva um bom tempo processando, mas se passar disso
 * é outra coisa acontecendo, e ficar tentando para sempre esconderia o
 * problema.
 */
const MAX_ESPERAS = 48;

/** Quinze minutos sem tocar no trabalho: quem estava com ele morreu no meio. */
const LOCK_MIN = 15;

const ORIGENS_ACEITAS =
  /(youtube\.com|youtu\.be|vimeo\.com|zoom\.us|rumble\.com|twitch\.tv|facebook\.com|fb\.watch|linkedin\.com|twitter\.com|x\.com|streamyard\.com)/i;

/** O identificador do arquivo dentro de um endereço do Drive, nas três formas. */
export function idDoDrive(url: string): string | null {
  if (!/drive\.google\.com/i.test(url)) return null;
  return (
    url.match(/\/d\/([a-zA-Z0-9_-]{10,})/)?.[1] ||
    url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)?.[1] ||
    null
  );
}

export interface ResultadoClipes {
  subindo?: { titulo: string; pct: number; concluido: boolean };
  /** Vídeos que o YouTube ainda está processando. Volta sozinho. */
  aguardando?: number;
  enviados: number;
  concluidos: number;
  clipes_novos: number;
  erros: string[];
}

interface JobLinha {
  id: string;
  titulo: string;
  video_url: string;
  video_url_envio: string | null;
  drive_file_id: string | null;
  lesson_id: string | null;
  gerar_clipes: boolean;
  trocar_fonte_da_aula: boolean;
  tentativas: number;
  youtube_upload_url: string | null;
  youtube_bytes_enviados: number;
  youtube_bytes_total: number | null;
  youtube_tentativas: number;
}

/**
 * Empurra para o YouTube o vídeo que ainda não tem endereço aceito.
 *
 * Devolve `null` quando não havia o que subir. O tempo é orçamento, não meta:
 * a rodada leva o que couber e a seguinte continua de onde parou.
 */
async function subirParaYoutube(
  sb: Sb,
  deadline: number
): Promise<ResultadoClipes["subindo"] | null> {
  const limite = new Date(Date.now() - LOCK_MIN * 60_000).toISOString();

  const { data: fila } = await sb
    .from("formacao_clip_jobs")
    .select(
      "id, titulo, video_url, video_url_envio, drive_file_id, tentativas, youtube_upload_url, youtube_bytes_enviados, youtube_bytes_total, youtube_tentativas"
    )
    .in("status", ["pendente", "subindo"])
    .is("video_url_envio", null)
    .not("drive_file_id", "is", null)
    .lt("youtube_tentativas", MAX_TENTATIVAS_YT)
    .or(`trabalhando_desde.is.null,trabalhando_desde.lt.${limite}`)
    .order("created_at", { ascending: true })
    .limit(1);

  const job = fila?.[0] as JobLinha | undefined;
  if (!job?.drive_file_id) return null;

  await sb
    .from("formacao_clip_jobs")
    .update({ status: "subindo", trabalhando_desde: new Date().toISOString() })
    .eq("id", job.id);

  try {
    let uploadUrl = job.youtube_upload_url;
    let total = job.youtube_bytes_total || 0;
    let pos = job.youtube_bytes_enviados || 0;

    if (!uploadUrl) {
      total = await tamanhoDoArquivo(job.drive_file_id);
      uploadUrl = await abrirSessaoUpload(
        job.titulo,
        `${job.titulo}\n\nVídeo não listado: só quem tem o link assiste.`,
        total
      );
      pos = 0;
      await sb
        .from("formacao_clip_jobs")
        .update({
          youtube_upload_url: uploadUrl,
          youtube_bytes_total: total,
          youtube_bytes_enviados: 0,
        })
        .eq("id", job.id);
    } else if (pos === 0) {
      // Sessão aberta numa rodada que morreu antes de mandar nada: perguntar
      // onde ele está evita reenviar o que já foi.
      pos = (await consultarProgresso(uploadUrl, total)).proximoByte;
    }

    const r = await enviarAte(uploadUrl, job.drive_file_id, pos, total, deadline);

    if (!r.concluido) {
      await sb
        .from("formacao_clip_jobs")
        .update({
          youtube_bytes_enviados: r.proximoByte,
          youtube_erro: null,
          trabalhando_desde: null,
        })
        .eq("id", job.id);

      return {
        titulo: job.titulo,
        pct: total ? Math.round((r.proximoByte / total) * 100) : 0,
        concluido: false,
      };
    }

    const linkYoutube = `https://www.youtube.com/watch?v=${r.videoId}`;

    // Pedido de trocar a fonte da aula: o aluno passa a assistir pelo YouTube.
    // Só acontece quando foi pedido, porque muda o que ele vê.
    if (job.trocar_fonte_da_aula && job.lesson_id) {
      await sb
        .from("lessons")
        .update({ video_url: linkYoutube, video_source: "youtube" })
        .eq("id", job.lesson_id);
      await sb
        .from("formacao_clip_jobs")
        .update({ fonte_trocada_em: new Date().toISOString() })
        .eq("id", job.id);
    }

    // Quem só queria publicar acabou aqui. Quem quer corte volta para a fila —
    // mas não já: terminar de enviar não é estar disponível. O YouTube ainda
    // processa o arquivo, e nessa janela o OpusClip recusa. Sair batendo na
    // porta só gastaria tentativa.
    await sb
      .from("formacao_clip_jobs")
      .update({
        youtube_video_id: r.videoId,
        video_url_envio: linkYoutube,
        youtube_bytes_enviados: total,
        youtube_erro: null,
        status: job.gerar_clipes ? "pendente" : "publicado",
        ...(job.gerar_clipes
          ? { tentar_apos: new Date(Date.now() + ESPERA_MIN * 60_000).toISOString() }
          : { concluido_em: new Date().toISOString() }),
        trabalhando_desde: null,
      })
      .eq("id", job.id);

    return { titulo: job.titulo, pct: 100, concluido: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const expirou = msg.includes("expirou");
    const tentativas = job.youtube_tentativas + 1;

    await sb
      .from("formacao_clip_jobs")
      .update({
        youtube_tentativas: tentativas,
        youtube_erro: msg.slice(0, 400),
        status: tentativas >= MAX_TENTATIVAS_YT ? "erro" : "pendente",
        erro: tentativas >= MAX_TENTATIVAS_YT ? msg.slice(0, 400) : null,
        trabalhando_desde: null,
        ...(expirou ? { youtube_upload_url: null, youtube_bytes_enviados: 0 } : {}),
      })
      .eq("id", job.id);

    throw new Error(`${job.titulo}: ${msg}`);
  }
}

export async function processarClipes(
  sb: Sb,
  baseUrl: string,
  deadline = Date.now() + 200_000
): Promise<ResultadoClipes> {
  const res: ResultadoClipes = { enviados: 0, concluidos: 0, clipes_novos: 0, erros: [] };

  if (!process.env.OPUSCLIP_API_KEY) return res;

  // ── 1. leva um vídeo do Drive até o YouTube ──
  try {
    const s = await subirParaYoutube(sb, deadline);
    if (s) res.subindo = s;
  } catch (e) {
    res.erros.push(e instanceof Error ? e.message : String(e));
  }

  // ── 2. manda um que já tem endereço aceito ──
  const agora = new Date().toISOString();
  const { data: pendentes } = await sb
    .from("formacao_clip_jobs")
    .select("id, titulo, video_url, video_url_envio, tentativas, esperas")
    .eq("status", "pendente")
    .not("video_url_envio", "is", null)
    .lt("tentativas", MAX_TENTATIVAS)
    .or(`tentar_apos.is.null,tentar_apos.lte.${agora}`)
    .order("created_at", { ascending: true })
    .limit(1);

  const job = pendentes?.[0];
  if (job) {
    const endereco: string = job.video_url_envio || job.video_url;
    try {
      const projeto = await criarProjeto(
        endereco,
        job.titulo,
        `${baseUrl}/formacao/api/meet/clipes-webhook`
      );
      await sb
        .from("formacao_clip_jobs")
        .update({
          external_id: projeto.id,
          status: "processando",
          enviado_em: new Date().toISOString(),
          erro: null,
        })
        .eq("id", job.id);
      res.enviados++;
    } catch (e) {
      const msg = e instanceof OpusError ? e.message : String(e);

      // Cedo demais não é falha: o vídeo está lá, o YouTube é que ainda não
      // terminou de processá-lo. Adia sem gastar tentativa, senão três rodadas
      // matam um vídeo que só precisava de meia hora.
      if (ehCedoDemais(e) && job.esperas < MAX_ESPERAS) {
        await sb
          .from("formacao_clip_jobs")
          .update({
            esperas: job.esperas + 1,
            tentar_apos: new Date(Date.now() + ESPERA_MIN * 60_000).toISOString(),
            erro: null,
          })
          .eq("id", job.id);
        res.aguardando = (res.aguardando || 0) + 1;
      } else {
        await sb
          .from("formacao_clip_jobs")
          .update({
            tentativas: job.tentativas + 1,
            erro: msg.slice(0, 400),
            status: job.tentativas + 1 >= MAX_TENTATIVAS ? "erro" : "pendente",
          })
          .eq("id", job.id);
        res.erros.push(`${job.titulo}: ${msg}`);
      }
    }
  }

  // ── 3. recolhe os que ficaram prontos ──
  const { data: processando } = await sb
    .from("formacao_clip_jobs")
    .select("id, external_id, titulo")
    .eq("status", "processando")
    .not("external_id", "is", null)
    .limit(5);

  for (const p of (processando || []) as { id: string; external_id: string; titulo: string }[]) {
    try {
      const n = await recolherProjeto(sb, p.id, p.external_id);
      if (n === null) continue;
      res.concluidos++;
      res.clipes_novos += n;
    } catch (e) {
      res.erros.push(
        `${p.titulo}: ${e instanceof OpusError ? e.message : String(e)}`
      );
    }
  }

  return res;
}

/** Termos que a API usa para dizer que acabou. */
const TERMINOU = ["complete", "completed", "done", "finished", "success"];

/**
 * Guarda o que o corte produziu: os clipes e a transcrição do vídeo inteiro.
 *
 * Devolve quantos clipes entraram, ou `null` se ainda não terminou. Usado tanto
 * pelo agendador quanto pelo aviso de conclusão, para que os dois caminhos
 * gravem exatamente a mesma coisa.
 */
export async function recolherProjeto(
  sb: Sb,
  jobId: string,
  externalId: string
): Promise<number | null> {
  const { status, clipes, transcricaoUrl } = await consultarProjeto(externalId);
  if (!TERMINOU.includes(status.toLowerCase())) return null;

  // A transcrição vale por si, mesmo que o corte não tenha rendido clipe
  // nenhum: é o único jeito de ter texto de um vídeo que nunca passou pelo Meet.
  if (transcricaoUrl) {
    const texto = await baixarTranscricao(transcricaoUrl);
    if (texto) {
      await sb
        .from("formacao_clip_jobs")
        .update({ transcricao_texto: texto, transcricao_em: new Date().toISOString() })
        .eq("id", jobId);
    }
  }

  if (!clipes.length) return null;

  // Reescreve a lista inteira: repetir a consulta não pode duplicar clipe.
  await sb.from("formacao_clips").delete().eq("job_id", jobId);

  const linhas = clipes.map((c) => ({
    job_id: jobId,
    external_id: c.id || null,
    titulo: c.title || null,
    descricao: c.description || null,
    texto: c.text || null,
    hashtags: c.hashtags?.length ? c.hashtags : null,
    url: c.uriForExport || c.uriForPreview || null,
    preview_url: c.uriForPreview || null,
    thumbnail_url: c.uriForThumbnail || null,
    duracao_seg: c.durationMs ? Math.round(c.durationMs / 100) / 10 : null,
    pontuacao: c.score ?? null,
    trechos: c.timeRanges?.length ? c.timeRanges : null,
  }));

  const { error } = await sb.from("formacao_clips").insert(linhas);
  if (error) throw new Error(error.message);

  await sb
    .from("formacao_clip_jobs")
    .update({ status: "pronto", concluido_em: new Date().toISOString() })
    .eq("id", jobId);

  return linhas.length;
}

/**
 * Enfileira a gravação de um encontro para corte.
 *
 * Prefere o endereço do YouTube quando ele já existe: é o formato que o
 * OpusClip lê. Se só houver o arquivo no Drive, o job guarda o file id e o
 * agendador cuida de levá-lo ao YouTube antes.
 */
export async function enfileirarEncontro(
  sb: Sb,
  encontroId: string,
  criadoPor?: string
): Promise<{ ok: boolean; motivo?: string }> {
  const { data: e } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, atividade_nome, data_reuniao, gravacao_uri, gravacao_file_id, youtube_video_id, space_name"
    )
    .eq("id", encontroId)
    .maybeSingle();

  if (!e) return { ok: false, motivo: "Encontro não encontrado." };

  const url = e.youtube_video_id
    ? `https://www.youtube.com/watch?v=${e.youtube_video_id}`
    : e.gravacao_uri;
  if (!url) return { ok: false, motivo: "Este encontro ainda não tem gravação pronta." };

  const { data: space } = await sb
    .from("formacao_meet_spaces")
    .select("curso_id")
    .eq("space_name", e.space_name)
    .maybeSingle();

  const { error } = await sb.from("formacao_clip_jobs").insert({
    encontro_id: e.id,
    curso_id: space?.curso_id || null,
    titulo: `${e.atividade_nome || "Encontro"} ${e.data_reuniao}`,
    video_url: url,
    video_url_envio: ORIGENS_ACEITAS.test(url) ? url : null,
    drive_file_id: e.gravacao_file_id || idDoDrive(url),
    youtube_video_id: e.youtube_video_id || null,
    criado_por: criadoPor || null,
  });

  // Chave única no endereço do vídeo: o mesmo vídeo não vai duas vezes, e cada
  // envio é cobrado.
  if (error) {
    return {
      ok: false,
      motivo: error.message.includes("duplicate")
        ? "Este vídeo já foi enviado para corte."
        : error.message,
    };
  }
  return { ok: true };
}

/** Os dois campos que decidem por onde o vídeo entra na fila. */
export function rotaDoVideo(url: string): {
  video_url_envio: string | null;
  drive_file_id: string | null;
} {
  return {
    video_url_envio: ORIGENS_ACEITAS.test(url) ? url : null,
    drive_file_id: idDoDrive(url),
  };
}

export { ORIGENS_ACEITAS };
