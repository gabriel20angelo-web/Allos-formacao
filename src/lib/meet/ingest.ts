// Ingestão dos encontros já ocorridos.
//
// Roda depois que a conferência termina, não durante: a API só fecha os dados
// de um conference record quando ele acaba. Conferência em curso é pulada e
// entra na rodada seguinte.
//
// Idempotente por conference_record_id. Rodar duas vezes no mesmo dia não
// duplica nada; no máximo completa o que faltava, que é o caso comum quando a
// transcrição ainda estava sendo gerada na primeira passada.

import {
  listarConferencias,
  listarEntradasTranscricao,
  listarGravacoes,
  listarParticipantes,
  listarSessoes,
  listarTranscricoes,
} from "./client";
import { dataLocal, diaSemanaLocal, normalizarNome, sugerirAluno } from "./nomes";
import type { CandidatoAluno } from "./nomes";
import type { MeetParticipant, MeetParticipantSession } from "./types";

export interface ResultadoIngestao {
  spaces_varridos: number;
  encontros_novos: number;
  encontros_atualizados: number;
  participacoes_gravadas: number;
  nomes_nao_reconhecidos: number;
  erros: string[];
}

interface SpaceRow {
  id: string;
  slot_id: string | null;
  space_name: string;
  meeting_uri: string | null;
}

interface ParticipacaoCalculada {
  participant_api_id: string;
  display_name: string;
  display_name_norm: string;
  tipo: "signed_in" | "anonymous" | "phone";
  google_user_id: string | null;
  aluno_id: string | null;
  eh_condutor: boolean;
  primeira_entrada: string | null;
  ultima_saida: string | null;
  minutos_presentes: number;
  n_sessoes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  saida_antecipada_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
}

const MS_MIN = 60_000;

/** Executa em lotes pequenos: a API do Meet não gosta de rajada. */
async function emLotes<T, R>(
  itens: T[],
  tamanho: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += tamanho) {
    const lote = itens.slice(i, i + tamanho);
    saida.push(...(await Promise.all(lote.map(fn))));
  }
  return saida;
}

function nomeDoParticipante(p: MeetParticipant): {
  nome: string;
  tipo: "signed_in" | "anonymous" | "phone";
  userId: string | null;
} {
  if (p.signedinUser) {
    return {
      nome: p.signedinUser.displayName || "Sem nome",
      tipo: "signed_in",
      userId: p.signedinUser.user || null,
    };
  }
  if (p.phoneUser) {
    return { nome: p.phoneUser.displayName || "Telefone", tipo: "phone", userId: null };
  }
  return {
    nome: p.anonymousUser?.displayName || "Anônimo",
    tipo: "anonymous",
    userId: null,
  };
}

/**
 * Minutos somando todas as sessões da pessoa.
 *
 * Sessão sem endTime é sessão que ficou aberta quando a conferência fechou:
 * conta até o fim do encontro, senão quem ficou até o final apareceria com
 * zero minuto, que é o oposto da verdade.
 */
function medirSessoes(
  sessoes: MeetParticipantSession[],
  fimEncontro: Date
): { minutos: number; entrada: Date | null; saida: Date | null; n: number } {
  let minutos = 0;
  let entrada: Date | null = null;
  let saida: Date | null = null;

  for (const s of sessoes) {
    if (!s.startTime) continue;
    const ini = new Date(s.startTime);
    const fim = s.endTime ? new Date(s.endTime) : fimEncontro;
    if (fim > ini) minutos += (fim.getTime() - ini.getTime()) / MS_MIN;
    if (!entrada || ini < entrada) entrada = ini;
    if (!saida || fim > saida) saida = fim;
  }

  return { minutos: Math.round(minutos), entrada, saida, n: sessoes.length };
}

/** Maior número de pessoas simultâneas, por varredura de entradas e saídas. */
function calcularPico(
  todasSessoes: { inicio: Date; fim: Date }[]
): number {
  const eventos: { t: number; delta: number }[] = [];
  for (const s of todasSessoes) {
    eventos.push({ t: s.inicio.getTime(), delta: 1 });
    eventos.push({ t: s.fim.getTime(), delta: -1 });
  }
  eventos.sort((a, b) => a.t - b.t || a.delta - b.delta);

  let atual = 0;
  let pico = 0;
  for (const e of eventos) {
    atual += e.delta;
    if (atual > pico) pico = atual;
  }
  return pico;
}

export async function ingerir(opts?: {
  diasAtras?: number;
  spaceName?: string;
  origem?: string;
}): Promise<ResultadoIngestao> {
  const inicioRodada = Date.now();
  const diasAtras = opts?.diasAtras ?? 30;
  const res: ResultadoIngestao = {
    spaces_varridos: 0,
    encontros_novos: 0,
    encontros_atualizados: 0,
    participacoes_gravadas: 0,
    nomes_nao_reconhecidos: 0,
    erros: [],
  };

  const { createServiceRoleClient } = await import("@/lib/supabase/server");
  const sb = await createServiceRoleClient();

  // ── contexto que vale para todos os encontros ──
  let q = sb
    .from("formacao_meet_spaces")
    .select("id, slot_id, space_name, meeting_uri")
    .eq("ativo", true);
  if (opts?.spaceName) q = q.eq("space_name", opts.spaceName);
  const { data: spaces, error: errSpaces } = await q;

  if (errSpaces) {
    res.erros.push(`Erro lendo spaces: ${errSpaces.message}`);
    return res;
  }
  if (!spaces?.length) return res;

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("duracao_minutos")
    .maybeSingle();
  const duracaoPrevista = cronograma?.duracao_minutos ?? 90;

  const { data: slots } = await sb
    .from("formacao_slots")
    .select("id, atividade_nome, dia_semana");
  const slotPorId = new Map(
    (slots || []).map((s: { id: string; atividade_nome: string | null }) => [s.id, s])
  );

  const { data: alocacoes } = await sb
    .from("formacao_alocacoes")
    .select("slot_id, certificado_condutores(nome)");
  const condutoresPorSlot = new Map<string, string[]>();
  for (const a of (alocacoes || []) as unknown as {
    slot_id: string;
    certificado_condutores: { nome: string } | { nome: string }[] | null;
  }[]) {
    const bruto = a.certificado_condutores;
    const nomes = Array.isArray(bruto) ? bruto.map((c) => c.nome) : bruto ? [bruto.nome] : [];
    const atual = condutoresPorSlot.get(a.slot_id) || [];
    condutoresPorSlot.set(a.slot_id, [...atual, ...nomes]);
  }

  const { data: perfis } = await sb.from("profiles").select("id, full_name");
  const candidatos: CandidatoAluno[] = (perfis || []).map(
    (p: { id: string; full_name: string }) => ({
      id: p.id,
      full_name: p.full_name,
      nomeNorm: normalizarNome(p.full_name || ""),
    })
  );

  const { data: aliasRows } = await sb
    .from("formacao_meet_aliases")
    .select("display_name_norm, aluno_id");
  const aliases = new Map(
    (aliasRows || []).map((a: { display_name_norm: string; aluno_id: string }) => [
      a.display_name_norm,
      a.aluno_id,
    ])
  );

  // ── varredura ──
  for (const space of spaces as SpaceRow[]) {
    res.spaces_varridos++;
    try {
      const { data: ultimo } = await sb
        .from("formacao_meet_encontros")
        .select("inicio")
        .eq("space_name", space.space_name)
        .order("inicio", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Duas horas de sobreposição: encontro ingerido sem transcrição pronta
      // precisa ser reencontrado na rodada seguinte.
      const desde = ultimo?.inicio
        ? new Date(new Date(ultimo.inicio).getTime() - 2 * 60 * MS_MIN)
        : new Date(Date.now() - diasAtras * 24 * 60 * MS_MIN);

      const conferencias = await listarConferencias(space.space_name, desde);

      for (const conf of conferencias) {
        if (!conf.endTime) continue; // ainda em curso

        const { data: existente } = await sb
          .from("formacao_meet_encontros")
          .select("id, transcricao_ingerida")
          .eq("conference_record_id", conf.name)
          .maybeSingle();

        if (existente?.transcricao_ingerida) continue;

        const inicio = new Date(conf.startTime);
        const fim = new Date(conf.endTime);
        const duracaoMin = Math.max(
          1,
          Math.round((fim.getTime() - inicio.getTime()) / MS_MIN)
        );

        const participantes = await listarParticipantes(conf.name);
        const sessoesPorParticipante = await emLotes(participantes, 5, async (p) => ({
          participante: p,
          sessoes: await listarSessoes(p.name),
        }));

        // ── fala, quando houve transcrição ──
        const falaPorParticipante = new Map<
          string,
          { minutos: number; turnos: number }
        >();
        let transcricaoUri: string | null = null;
        let transcricaoPronta = false;

        try {
          const transcricoes = await listarTranscricoes(conf.name);
          const pronta = transcricoes.find((t) => t.docsDestination?.exportUri);
          if (pronta) {
            transcricaoUri = pronta.docsDestination?.exportUri || null;
            const entradas = await listarEntradasTranscricao(pronta.name);
            for (const e of entradas) {
              if (!e.participant || !e.startTime || !e.endTime) continue;
              const dur =
                (new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) /
                MS_MIN;
              const atual = falaPorParticipante.get(e.participant) || {
                minutos: 0,
                turnos: 0,
              };
              // O texto da fala fica fora daqui de propósito.
              falaPorParticipante.set(e.participant, {
                minutos: atual.minutos + Math.max(0, dur),
                turnos: atual.turnos + 1,
              });
            }
            transcricaoPronta = true;
          } else if (transcricoes.length === 0) {
            // Encontro sem transcrição ligada: não há o que esperar.
            transcricaoPronta = true;
          }
        } catch (e) {
          res.erros.push(
            `Transcrição de ${conf.name}: ${e instanceof Error ? e.message : String(e)}`
          );
        }

        let gravacaoUri: string | null = null;
        try {
          const gravacoes = await listarGravacoes(conf.name);
          gravacaoUri = gravacoes.find((g) => g.driveDestination?.exportUri)
            ?.driveDestination?.exportUri || null;
        } catch {
          // Gravação desligada devolve lista vazia; erro aqui não invalida o resto.
        }

        // ── cálculo por pessoa ──
        const nomesCondutores = (
          space.slot_id ? condutoresPorSlot.get(space.slot_id) || [] : []
        ).map(normalizarNome);

        const calculadas: ParticipacaoCalculada[] = [];
        const janelas: { inicio: Date; fim: Date }[] = [];

        for (const { participante, sessoes } of sessoesPorParticipante) {
          const { nome, tipo, userId } = nomeDoParticipante(participante);
          const norm = normalizarNome(nome);
          const m = medirSessoes(sessoes, fim);

          for (const s of sessoes) {
            if (!s.startTime) continue;
            janelas.push({
              inicio: new Date(s.startTime),
              fim: s.endTime ? new Date(s.endTime) : fim,
            });
          }

          let alunoId = aliases.get(norm) || null;
          if (!alunoId) {
            const { automatico } = sugerirAluno(nome, candidatos);
            alunoId = automatico;
            if (automatico) {
              // Casamento forte vira alias, pra não recalcular toda semana.
              await sb.from("formacao_meet_aliases").upsert(
                {
                  display_name_norm: norm,
                  display_name: nome,
                  aluno_id: automatico,
                  google_user_id: userId,
                },
                { onConflict: "display_name_norm" }
              );
              aliases.set(norm, automatico);
            } else {
              res.nomes_nao_reconhecidos++;
            }
          }

          const fala = falaPorParticipante.get(participante.name);

          calculadas.push({
            participant_api_id: participante.name,
            display_name: nome,
            display_name_norm: norm,
            tipo,
            google_user_id: userId,
            aluno_id: alunoId,
            eh_condutor: nomesCondutores.includes(norm),
            primeira_entrada: m.entrada?.toISOString() || null,
            ultima_saida: m.saida?.toISOString() || null,
            minutos_presentes: m.minutos,
            n_sessoes: m.n || 1,
            permanencia_pct: Math.min(
              100,
              Math.round((m.minutos / duracaoMin) * 1000) / 10
            ),
            atraso_min: m.entrada
              ? Math.max(0, Math.round((m.entrada.getTime() - inicio.getTime()) / MS_MIN))
              : null,
            saida_antecipada_min: m.saida
              ? Math.max(0, Math.round((fim.getTime() - m.saida.getTime()) / MS_MIN))
              : null,
            minutos_fala: fala ? Math.round(fala.minutos * 100) / 100 : null,
            n_turnos_fala: fala ? fala.turnos : null,
          });
        }

        // ── agregados do encontro ──
        const total = calculadas.length;
        const minutosSomados = calculadas.reduce((a, c) => a + c.minutos_presentes, 0);
        const identificados = calculadas.filter((c) => c.aluno_id).length;
        const mediaPermanencia = total
          ? Math.round(
              (calculadas.reduce((a, c) => a + (c.permanencia_pct || 0), 0) / total) * 10
            ) / 10
          : null;

        const houveFala = calculadas.some((c) => (c.minutos_fala || 0) > 0);
        const vozesAtivas = houveFala && total
          ? Math.round(
              (calculadas.filter((c) => (c.minutos_fala || 0) > 0).length / total) * 1000
            ) / 10
          : null;
        const falaTotal = calculadas.reduce((a, c) => a + (c.minutos_fala || 0), 0);
        const falaCondutor = calculadas
          .filter((c) => c.eh_condutor)
          .reduce((a, c) => a + (c.minutos_fala || 0), 0);
        const falaCondutorPct =
          houveFala && falaTotal > 0
            ? Math.round((falaCondutor / falaTotal) * 1000) / 10
            : null;

        const slot = space.slot_id ? slotPorId.get(space.slot_id) : null;
        const condutorNome = space.slot_id
          ? (condutoresPorSlot.get(space.slot_id) || []).join(", ")
          : "";

        const encontroRow = {
          conference_record_id: conf.name,
          space_name: space.space_name,
          slot_id: space.slot_id,
          atividade_nome: slot?.atividade_nome || null,
          condutor_nome: condutorNome || null,
          data_reuniao: dataLocal(inicio),
          dia_semana: diaSemanaLocal(inicio),
          inicio: inicio.toISOString(),
          fim: fim.toISOString(),
          duracao_min: duracaoMin,
          duracao_prevista_min: duracaoPrevista,
          total_participantes: total,
          identificados,
          minutos_somados: minutosSomados,
          media_permanencia_pct: mediaPermanencia,
          vozes_ativas_pct: vozesAtivas,
          fala_condutor_pct: falaCondutorPct,
          gravacao_uri: gravacaoUri,
          transcricao_uri: transcricaoUri,
          transcricao_ingerida: transcricaoPronta,
          ingerido_em: new Date().toISOString(),
        };

        const { data: encontroSalvo, error: errEnc } = await sb
          .from("formacao_meet_encontros")
          .upsert(encontroRow, { onConflict: "conference_record_id" })
          .select("id")
          .single();

        if (errEnc || !encontroSalvo) {
          res.erros.push(`Encontro ${conf.name}: ${errEnc?.message || "sem retorno"}`);
          continue;
        }

        // Reescreve as participações inteiras: é mais simples e mais seguro do
        // que reconciliar linha a linha, e o volume é de dezenas.
        await sb
          .from("formacao_meet_participacoes")
          .delete()
          .eq("encontro_id", encontroSalvo.id);

        if (calculadas.length) {
          const { error: errPart } = await sb
            .from("formacao_meet_participacoes")
            .insert(
              calculadas.map((c) => ({ ...c, encontro_id: encontroSalvo.id }))
            );
          if (errPart) {
            res.erros.push(`Participações de ${conf.name}: ${errPart.message}`);
          } else {
            res.participacoes_gravadas += calculadas.length;
          }
        }

        // ── ponte com a tabela antiga ──
        const pico = calcularPico(janelas);
        await sb.from("formacao_meet_presencas").upsert(
          {
            conference_record_id: conf.name,
            slot_id: space.slot_id,
            meet_link: space.meeting_uri || space.space_name,
            condutor_nome: condutorNome || "Sem condutor",
            atividade_nome: slot?.atividade_nome || null,
            data_reuniao: dataLocal(inicio),
            dia_semana: diaSemanaLocal(inicio),
            hora_inicio: inicio.toISOString(),
            hora_fim: fim.toISOString(),
            duracao_minutos: duracaoMin,
            participantes: calculadas.map((c) => ({
              nome: c.display_name,
              minutos: c.minutos_presentes,
              aluno_id: c.aluno_id,
            })),
            total_participantes: total,
            media_participantes: duracaoMin
              ? Math.round((minutosSomados / duracaoMin) * 100) / 100
              : total,
            pico_participantes: pico,
          },
          { onConflict: "conference_record_id" }
        );

        if (existente) res.encontros_atualizados++;
        else res.encontros_novos++;
      }
    } catch (e) {
      res.erros.push(
        `Space ${space.space_name}: ${e instanceof Error ? e.message : String(e)}`
      );
    }
  }

  await sb.from("formacao_meet_ingest_logs").insert({
    origem: opts?.origem || "cron",
    spaces_varridos: res.spaces_varridos,
    encontros_novos: res.encontros_novos,
    encontros_atualizados: res.encontros_atualizados,
    participacoes_gravadas: res.participacoes_gravadas,
    nomes_nao_reconhecidos: res.nomes_nao_reconhecidos,
    duracao_ms: Date.now() - inicioRodada,
    erro: res.erros.length ? res.erros.slice(0, 10).join(" | ") : null,
  });

  return res;
}
