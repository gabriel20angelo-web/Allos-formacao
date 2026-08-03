// Fila de cortes: envia o que está pendente e recolhe o que ficou pronto.
//
// Roda no agendador, junto do resto. Dois lados:
//   enviar   → pega jobs pendentes e manda para o OpusClip
//   recolher → pergunta pelos que estão processando e guarda os clipes
//
// Um envio por rodada, de propósito. Cada envio custa dinheiro por minuto de
// vídeo, e mandar dez de uma vez transforma um erro de configuração numa conta
// alta antes de alguém perceber.

import { consultarProjeto, criarProjeto, OpusError } from "./opusclip";
import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

const MAX_TENTATIVAS = 3;

export interface ResultadoClipes {
  enviados: number;
  concluidos: number;
  clipes_novos: number;
  erros: string[];
}

export async function processarClipes(sb: Sb, baseUrl: string): Promise<ResultadoClipes> {
  const res: ResultadoClipes = { enviados: 0, concluidos: 0, clipes_novos: 0, erros: [] };

  if (!process.env.OPUSCLIP_API_KEY) return res;

  // ── 1. envia um pendente ──
  const { data: pendentes } = await sb
    .from("formacao_clip_jobs")
    .select("id, titulo, video_url, tentativas")
    .eq("status", "pendente")
    .lt("tentativas", MAX_TENTATIVAS)
    .order("created_at", { ascending: true })
    .limit(1);

  const job = pendentes?.[0];
  if (job) {
    try {
      const projeto = await criarProjeto(
        job.video_url,
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

  // ── 2. recolhe os que ficaram prontos ──
  const { data: processando } = await sb
    .from("formacao_clip_jobs")
    .select("id, external_id, titulo")
    .eq("status", "processando")
    .not("external_id", "is", null)
    .limit(5);

  for (const p of (processando || []) as { id: string; external_id: string; titulo: string }[]) {
    try {
      const { status, clipes } = await consultarProjeto(p.external_id);
      const pronto = ["completed", "done", "finished", "success"].includes(
        status.toLowerCase()
      );
      if (!pronto || !clipes.length) continue;

      // Reescreve a lista inteira: repetir a consulta não pode duplicar clipe.
      await sb.from("formacao_clips").delete().eq("job_id", p.id);

      const linhas = clipes.map((c) => ({
        job_id: p.id,
        external_id: c.id || null,
        titulo: c.title || null,
        url: c.url || c.videoUrl || null,
        thumbnail_url: c.thumbnailUrl || null,
        duracao_seg: c.duration ?? null,
        pontuacao: c.score ?? c.viralScore ?? null,
      }));

      const { error } = await sb.from("formacao_clips").insert(linhas);
      if (error) {
        res.erros.push(`Clipes de ${p.titulo}: ${error.message}`);
        continue;
      }

      await sb
        .from("formacao_clip_jobs")
        .update({ status: "pronto", concluido_em: new Date().toISOString() })
        .eq("id", p.id);

      res.concluidos++;
      res.clipes_novos += linhas.length;
    } catch (e) {
      res.erros.push(
        `${p.titulo}: ${e instanceof OpusError ? e.message : String(e)}`
      );
    }
  }

  return res;
}

/**
 * Enfileira a gravação de um encontro para corte.
 *
 * Prefere o endereço do YouTube quando ele já existe: é público por link, e o
 * OpusClip lê sem depender de permissão do Drive.
 */
export async function enfileirarEncontro(
  sb: Sb,
  encontroId: string,
  criadoPor?: string
): Promise<{ ok: boolean; motivo?: string }> {
  const { data: e } = await sb
    .from("formacao_meet_encontros")
    .select("id, atividade_nome, data_reuniao, gravacao_uri, youtube_video_id, space_name")
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
