// Orquestra a subida da gravação para o YouTube, um pedaço por rodada.
//
// Roda no agendador, a cada quinze minutos. Cada rodada empurra alguns
// megabytes e guarda onde parou, então um vídeo grande sobe ao longo de várias
// batidas sem ninguém acompanhar e sem estourar o tempo da requisição.
//
// Uma gravação por rodada, de propósito: duas em paralelo competiriam pela
// mesma banda e as duas ficariam lentas.

import { MeetApiError } from "./client";
import {
  abrirSessaoUpload,
  consultarProgresso,
  enviarAte,
  tamanhoDoArquivo,
} from "./youtube";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

const MAX_TENTATIVAS = 5;

export interface ResultadoPublicacao {
  trabalhou: boolean;
  encontro?: string;
  progresso_pct?: number;
  concluido?: boolean;
  erro?: string;
}

/**
 * O minuto em que o encontro de fato começou.
 *
 * A sala abre quinze minutos antes e a gravação pega esse vazio. Como sabemos a
 * hora de entrada de cada pessoa, o começo real é quando a segunda pessoa
 * chega: uma pessoa sozinha na sala ainda é espera.
 */
async function calcularInicioEfetivo(
  sb: Sb,
  encontroId: string,
  inicioGravacao: string
): Promise<number> {
  const { data: parts } = await sb
    .from("formacao_meet_participacoes")
    .select("primeira_entrada")
    .eq("encontro_id", encontroId)
    .not("primeira_entrada", "is", null)
    .order("primeira_entrada", { ascending: true })
    .limit(2);

  if (!parts || parts.length < 2) return 0;

  const segunda = new Date(parts[1].primeira_entrada as string).getTime();
  const inicio = new Date(inicioGravacao).getTime();
  const seg = Math.floor((segunda - inicio) / 1000);

  // Margem de dez segundos para trás, para não cortar a primeira fala.
  return Math.max(0, seg - 10);
}

export async function publicarProximoVideo(
  sb: Sb,
  deadline = Date.now() + 120_000
): Promise<ResultadoPublicacao> {
  // Marca os candidatos: gravação pronta, sala que publica, ainda sem vídeo.
  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name")
    .eq("subir_youtube", true)
    .eq("ativo", true);

  const nomes = (spaces || []).map((s: { space_name: string }) => s.space_name);
  if (!nomes.length) return { trabalhou: false };

  const { data: candidatos } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, space_name, atividade_nome, data_reuniao, inicio, gravacao_file_id, youtube_status, youtube_upload_url, youtube_bytes_enviados, youtube_bytes_total, youtube_tentativas"
    )
    .in("space_name", nomes)
    .eq("descartado", false)
    .not("gravacao_file_id", "is", null)
    .is("youtube_video_id", null)
    .or("youtube_status.is.null,youtube_status.in.(pendente,enviando)")
    .lt("youtube_tentativas", MAX_TENTATIVAS)
    .order("data_reuniao", { ascending: true })
    .limit(1);

  const e = candidatos?.[0];
  if (!e) return { trabalhou: false };

  const rotulo = `${e.data_reuniao} ${e.atividade_nome || ""}`.trim();

  try {
    let uploadUrl: string = e.youtube_upload_url;
    let total: number = e.youtube_bytes_total || 0;
    let proximo: number = e.youtube_bytes_enviados || 0;

    if (!uploadUrl) {
      total = await tamanhoDoArquivo(e.gravacao_file_id);
      const titulo = `${e.atividade_nome || "Encontro"} · ${e.data_reuniao}`;
      uploadUrl = await abrirSessaoUpload(
        titulo,
        `Gravação do encontro de ${e.data_reuniao}. Vídeo não listado: só quem tem o link assiste.`,
        total
      );
      proximo = 0;

      await sb
        .from("formacao_meet_encontros")
        .update({
          youtube_status: "enviando",
          youtube_upload_url: uploadUrl,
          youtube_bytes_total: total,
          youtube_bytes_enviados: 0,
        })
        .eq("id", e.id);
    } else if (proximo === 0) {
      // Sessão aberta numa rodada anterior que morreu antes de mandar nada:
      // perguntar ao YouTube onde ele está evita reenviar o que já foi.
      const estado = await consultarProgresso(uploadUrl, total);
      proximo = estado.proximoByte;
    }

    const r = await enviarAte(uploadUrl, e.gravacao_file_id, proximo, total, deadline);

    if (!r.concluido) {
      await sb
        .from("formacao_meet_encontros")
        .update({ youtube_bytes_enviados: r.proximoByte, youtube_erro: null })
        .eq("id", e.id);

      return {
        trabalhou: true,
        encontro: rotulo,
        progresso_pct: Math.round((r.proximoByte / total) * 100),
        concluido: false,
      };
    }

    const inicioEfetivo = await calcularInicioEfetivo(sb, e.id, e.inicio);

    await sb
      .from("formacao_meet_encontros")
      .update({
        youtube_video_id: r.videoId,
        youtube_status: "pronto",
        youtube_bytes_enviados: total,
        youtube_erro: null,
        inicio_efetivo_seg: inicioEfetivo,
      })
      .eq("id", e.id);

    return { trabalhou: true, encontro: rotulo, progresso_pct: 100, concluido: true };
  } catch (err) {
    const msg = err instanceof MeetApiError ? err.message : String(err);

    // Sessão expirada zera o progresso para recomeçar; o resto só conta a
    // tentativa, e depois de cinco o encontro para de ser tentado para não
    // consumir o agendador para sempre.
    const expirou = msg.includes("expirou");

    await sb
      .from("formacao_meet_encontros")
      .update({
        youtube_status: e.youtube_tentativas + 1 >= MAX_TENTATIVAS ? "erro" : "pendente",
        youtube_erro: msg.slice(0, 400),
        youtube_tentativas: e.youtube_tentativas + 1,
        ...(expirou ? { youtube_upload_url: null, youtube_bytes_enviados: 0 } : {}),
      })
      .eq("id", e.id);

    return { trabalhou: true, encontro: rotulo, erro: msg };
  }
}
