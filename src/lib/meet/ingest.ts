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
import { dataLocal, diaSemanaLocal, ehContaDaCasa, normalizarNome, sugerirAluno } from "./nomes";
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
  rotulo: string | null;
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
    .select("id, slot_id, rotulo, space_name, meeting_uri")
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
          .select(
            "id, transcricao_ingerida, gravacao_uri, gravacao_file_id, transcricao_uri, transcricao_file_id"
          )
          .eq("conference_record_id", conf.name)
          .maybeSingle();

        // Encontro capturado antes de existir a organização no Drive tem o link
        // do arquivo mas não o identificador dele, e sem identificador não há
        // como mover. Vale reprocessar uma vez para preencher, senão só as
        // gravações futuras seriam organizadas e o histórico ficaria de fora.
        const faltaIdentificador =
          (!!existente?.gravacao_uri && !existente?.gravacao_file_id) ||
          (!!existente?.transcricao_uri && !existente?.transcricao_file_id);

        // A gravação fica pronta DEPOIS da captura: o Google encerra a
        // conferência e só então processa o vídeo, o que leva de minutos a
        // horas. Sem esta janela, o encontro é marcado como concluído na
        // primeira passada e ninguém volta nele quando o vídeo aparece.
        const inicio = new Date(conf.startTime);
        const fim = new Date(conf.endTime);

        const horasDesdeOFim = (Date.now() - fim.getTime()) / 3_600_000;
        const gravacaoAindaPodeChegar = !existente?.gravacao_uri && horasDesdeOFim < 48;

        if (existente?.transcricao_ingerida && !faltaIdentificador && !gravacaoAindaPodeChegar) {
          continue;
        }

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
        let transcricaoFileId: string | null = null;
        let transcricaoPronta = false;
        const falasParaGravar: {
          participant_api_id: string | null;
          display_name: string;
          texto: string;
          inicio: string | null;
          fim: string | null;
          segundos: number | null;
          ordem: number;
        }[] = [];

        try {
          const transcricoes = await listarTranscricoes(conf.name);
          const pronta = transcricoes.find((t) => t.docsDestination?.exportUri);
          if (pronta) {
            transcricaoUri = pronta.docsDestination?.exportUri || null;
            // documentId do Docs é o mesmo fileId do Drive.
            transcricaoFileId = pronta.docsDestination?.document || null;
            const entradas = await listarEntradasTranscricao(pronta.name);
            let ordem = 0;
            for (const e of entradas) {
              if (!e.participant || !e.startTime || !e.endTime) continue;
              const dur =
                (new Date(e.endTime).getTime() - new Date(e.startTime).getTime()) /
                MS_MIN;
              const atual = falaPorParticipante.get(e.participant) || {
                minutos: 0,
                turnos: 0,
              };
              falaPorParticipante.set(e.participant, {
                minutos: atual.minutos + Math.max(0, dur),
                turnos: atual.turnos + 1,
              });

              // O nome real entra depois, quando as participações estiverem
              // calculadas; aqui só guardamos o ponteiro do participante.
              if (e.text) {
                falasParaGravar.push({
                  participant_api_id: e.participant,
                  display_name: "",
                  texto: e.text,
                  inicio: e.startTime,
                  fim: e.endTime,
                  segundos: Math.round(dur * 60 * 100) / 100,
                  ordem: ordem++,
                });
              }
            }
            transcricaoPronta = true;
          } else if (transcricoes.length === 0) {
            // Lista vazia é ambígua: ou a sala não transcreve, ou o Google
            // ainda não gerou. Tratar como "não vem" fecha o encontro cedo
            // demais e o tempo de fala nunca é capturado, que é exatamente o
            // que aconteceu. Só desiste depois de dois dias.
            transcricaoPronta = horasDesdeOFim >= 48;
          } else {
            // Existe transcrição, mas ainda sem arquivo: está sendo processada.
            transcricaoPronta = false;
          }
        } catch (e) {
          res.erros.push(
            `Transcrição de ${conf.name}: ${e instanceof Error ? e.message : String(e)}`
          );
        }

        let gravacaoUri: string | null = null;
        let gravacaoFileId: string | null = null;
        try {
          const gravacoes = await listarGravacoes(conf.name);
          const pronta = gravacoes.find((g) => g.driveDestination?.exportUri);
          gravacaoUri = pronta?.driveDestination?.exportUri || null;
          // O identificador do arquivo é o que permite movê-lo depois; o link
          // de exportação não serve para isso.
          gravacaoFileId = pronta?.driveDestination?.file || null;
        } catch {
          // Gravação desligada devolve lista vazia; erro aqui não invalida o resto.
        }

        // ── cálculo por pessoa ──
        const nomesCondutores = space.slot_id
          ? condutoresPorSlot.get(space.slot_id) || []
          : [];
        const condutoresNorm = nomesCondutores.map(normalizarNome);

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

          // A conta da associação hospeda os encontros e nunca é aluno. Sai da
          // conciliação e não entra na contagem de participantes.
          const daCasa = ehContaDaCasa(nome);

          let alunoId = daCasa ? null : aliases.get(norm) || null;
          if (!alunoId && !daCasa) {
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
            eh_condutor: daCasa || condutoresNorm.includes(norm),
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

        // Duas formas do mesmo dado, de propósito.
        //
        // /admin/condutores e condutores/[id] casam quórum com condutor por
        // NOME EXATO em texto (`.eq("condutor_nome", nome)`), então a ponte
        // precisa gravar um nome que exista em certificado_condutores. Um slot
        // com dois condutores gravado como "Ana, João" não casaria com
        // ninguém e o card ficaria vazio em silêncio. A convenção de usar o
        // primeiro alocado vem do registro manual do calendário.
        const condutorPrincipal = nomesCondutores[0] || null;
        const condutorTodos = nomesCondutores.join(", ");

        // Um participante sozinho por poucos minutos não é um encontro: é
        // alguém testando o link. Marcar na entrada evita que a média de
        // quórum do grupo nasça estragada e que alguém precise limpar depois.
        const pareceTeste = total <= 1 && duracaoMin <= 5;

        const encontroRow = {
          conference_record_id: conf.name,
          descartado: pareceTeste,
          descartado_motivo: pareceTeste
            ? "Descartado automaticamente: no máximo uma pessoa, por até cinco minutos."
            : null,
          space_name: space.space_name,
          slot_id: space.slot_id,
          atividade_nome: slot?.atividade_nome || space.rotulo || null,
          condutor_nome: condutorTodos || null,
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
          gravacao_file_id: gravacaoFileId,
          transcricao_uri: transcricaoUri,
          transcricao_file_id: transcricaoFileId,
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

        // O Google às vezes devolve o mesmo participante mais de uma vez na
        // listagem, e o banco recusa a segunda linha por chave duplicada,
        // derrubando a gravação do encontro inteiro. Ficar com a primeira
        // ocorrência é seguro: os minutos vêm das sessões, que já foram
        // somadas por participante antes daqui.
        const unicas = Array.from(
          new Map(calculadas.map((c) => [c.participant_api_id, c])).values()
        );

        if (unicas.length) {
          const { error: errPart } = await sb
            .from("formacao_meet_participacoes")
            .insert(unicas.map((c) => ({ ...c, encontro_id: encontroSalvo.id })));
          if (errPart) {
            res.erros.push(`Participações de ${conf.name}: ${errPart.message}`);
          } else {
            res.participacoes_gravadas += unicas.length;
          }
        }

        // ── texto da transcrição ──
        // Só depois das participações, para cada fala já sair com o nome e a
        // pessoa resolvidos. Reescreve tudo do encontro pelo mesmo motivo das
        // participações: reconciliar linha a linha não vale o risco.
        if (falasParaGravar.length) {
          const nomePorParticipante = new Map(
            calculadas.map((c) => [c.participant_api_id, c])
          );

          await sb.from("formacao_meet_falas").delete().eq("encontro_id", encontroSalvo.id);

          const linhas = falasParaGravar.map((f) => {
            const dono = f.participant_api_id
              ? nomePorParticipante.get(f.participant_api_id)
              : undefined;
            return {
              encontro_id: encontroSalvo.id,
              participant_api_id: f.participant_api_id,
              display_name: dono?.display_name || "Desconhecido",
              aluno_id: dono?.aluno_id || null,
              texto: f.texto,
              inicio: f.inicio,
              fim: f.fim,
              segundos: f.segundos,
              ordem: f.ordem,
            };
          });

          // Em lotes: um encontro de noventa minutos passa de mil falas, e
          // mandar tudo de uma vez estoura o limite de payload.
          let gravadas = 0;
          for (let i = 0; i < linhas.length; i += 400) {
            const { error: errFala } = await sb
              .from("formacao_meet_falas")
              .insert(linhas.slice(i, i + 400));
            if (errFala) {
              res.erros.push(`Falas de ${conf.name}: ${errFala.message}`);
              break;
            }
            gravadas += Math.min(400, linhas.length - i);
          }

          if (gravadas) {
            await sb
              .from("formacao_meet_encontros")
              .update({ falas_gravadas: gravadas })
              .eq("id", encontroSalvo.id);
          }
        }

        // ── ponte com a tabela antiga ──
        // Encontro descartado não atravessa a ponte: as telas antigas não têm
        // como saber que ele é lixo, e o quórum delas ficaria errado.
        if (pareceTeste) {
          await sb
            .from("formacao_meet_presencas")
            .delete()
            .eq("conference_record_id", conf.name);
          if (existente) res.encontros_atualizados++;
          else res.encontros_novos++;
          continue;
        }

        const pico = calcularPico(janelas);
        await sb.from("formacao_meet_presencas").upsert(
          {
            conference_record_id: conf.name,
            slot_id: space.slot_id,
            meet_link: space.meeting_uri || space.space_name,
            condutor_nome: condutorPrincipal || "Sem condutor",
            atividade_nome: slot?.atividade_nome || space.rotulo || null,
            data_reuniao: dataLocal(inicio),
            dia_semana: diaSemanaLocal(inicio),
            hora_inicio: inicio.toISOString(),
            hora_fim: fim.toISOString(),
            duracao_minutos: duracaoMin,
            // Formato herdado da extensão: as telas antigas leem nome,
            // primeira_entrada, ultima_saida e snapshots_presente. Mantemos os
            // quatro e acrescentamos os campos novos, senão /admin/quorum
            // renderiza undefined onde havia horário.
            participantes: calculadas.map((c) => ({
              nome: c.display_name,
              primeira_entrada: c.primeira_entrada,
              ultima_saida: c.ultima_saida,
              snapshots_presente: c.minutos_presentes,
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
