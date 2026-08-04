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
export function medirSessoes(
  sessoes: MeetParticipantSession[],
  fimEncontro: Date
): { minutos: number; entrada: Date | null; saida: Date | null; n: number } {
  let entrada: Date | null = null;
  let saida: Date | null = null;

  const janelas: { ini: number; fim: number }[] = [];

  for (const s of sessoes) {
    if (!s.startTime) continue;
    const ini = new Date(s.startTime);
    const fim = s.endTime ? new Date(s.endTime) : fimEncontro;
    if (fim > ini) janelas.push({ ini: ini.getTime(), fim: fim.getTime() });
    if (!entrada || ini < entrada) entrada = ini;
    if (!saida || fim > saida) saida = fim;
  }

  // Une o que se sobrepõe antes de somar. Duas sessões da mesma pessoa deviam
  // ser sucessivas, mas não são: quem entra pelo computador e pelo celular ao
  // mesmo tempo, ou fica com uma aba pendurada, produz janelas paralelas. Somar
  // as durações cruas dava 167 minutos de presença num encontro de 85, e o
  // número passava despercebido porque a permanência é capada em 100%.
  janelas.sort((a, b) => a.ini - b.ini);
  let minutos = 0;
  let atualIni = 0;
  let atualFim = 0;
  for (const j of janelas) {
    if (!atualFim) {
      atualIni = j.ini;
      atualFim = j.fim;
      continue;
    }
    if (j.ini <= atualFim) {
      atualFim = Math.max(atualFim, j.fim);
    } else {
      minutos += (atualFim - atualIni) / MS_MIN;
      atualIni = j.ini;
      atualFim = j.fim;
    }
  }
  if (atualFim) minutos += (atualFim - atualIni) / MS_MIN;

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

  // Com limite explícito: sem ele o PostgREST corta em mil linhas em silêncio,
  // e a partir do aluno de número mil o casamento de nomes passaria a comparar
  // contra um subconjunto arbitrário, sem erro nenhum.
  const { data: perfis } = await sb.from("profiles").select("id, full_name").limit(5000);
  const candidatos: CandidatoAluno[] = (perfis || []).map(
    (p: { id: string; full_name: string }) => ({
      id: p.id,
      full_name: p.full_name,
      nomeNorm: normalizarNome(p.full_name || ""),
    })
  );

  // O que foi apagado de propósito e não pode voltar.
  const { data: apagadosRows } = await sb
    .from("formacao_meet_apagados")
    .select("conference_record_id");
  const apagados = new Set(
    (apagadosRows || []).map((a: { conference_record_id: string }) => a.conference_record_id)
  );

  const { data: aliasRows } = await sb
    .from("formacao_meet_aliases")
    .select("display_name_norm, aluno_id");
  const aliases = new Map(
    (aliasRows || []).map((a: { display_name_norm: string; aluno_id: string | null }) => [
      a.display_name_norm,
      a.aluno_id,
    ])
  );

  // Nome já resolvido, inclusive quando a resolução não aponta para conta
  // nenhuma: desde a identificação pelo formulário de certificado, um alias
  // pode dizer quem a pessoa é sem que ela tenha perfil. O `Map` acima não
  // serve para essa pergunta, porque o valor nesses casos é nulo.
  const nomesResolvidos = new Set(
    (aliasRows || []).map((a: { display_name_norm: string }) => a.display_name_norm)
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

      // O encontro mais antigo que ainda não fechou.
      //
      // Sem ele, a janela começa no ÚLTIMO encontro da sala, e basta alguém
      // abrir o link depois para que o encontro pendente saia do alcance: a
      // varredura passa a procurar a partir de um instante posterior ao dele, e
      // ninguém volta ali nunca mais. Aconteceu com o encontro de 04/08/2026,
      // que ficou sem ser reprocessado porque três testes de link e uma sala
      // aberta por engano empurraram a janela duas horas para frente.
      //
      // É o modo de falha mais silencioso possível: o encontro fica marcado
      // como não concluído para sempre, sem erro, sem log, e a transcrição que
      // chegaria dez minutos depois nunca é buscada.
      const { data: pendentes } = await sb
        .from("formacao_meet_encontros")
        .select("conference_record_id, inicio")
        .eq("space_name", space.space_name)
        .eq("transcricao_ingerida", false)
        .order("inicio", { ascending: true });

      const listaPendente = (pendentes || []) as {
        conference_record_id: string;
        inicio: string;
      }[];
      const idsPendentes = new Set(listaPendente.map((p) => p.conference_record_id));
      const maisAntigoPendente = listaPendente[0]?.inicio;

      const referencia =
        maisAntigoPendente && (!ultimo?.inicio || maisAntigoPendente < ultimo.inicio)
          ? maisAntigoPendente
          : ultimo?.inicio;

      // Duas horas de sobreposição: encontro ingerido sem transcrição pronta
      // precisa ser reencontrado na rodada seguinte.
      const desde = referencia
        ? new Date(new Date(referencia).getTime() - 2 * 60 * MS_MIN)
        : new Date(Date.now() - diasAtras * 24 * 60 * MS_MIN);

      // Teto por rodada: uma sala que ficou semanas sem captura devolve todas as
      // conferências pendentes de uma vez, e processar todas na mesma requisição
      // pode passar de vários minutos. O que sobrar entra na rodada seguinte.
      //
      // O que fica no teto, porém, não é indiferente. O Google devolve da mais
      // recente para a mais antiga, e o corte cru deixaria de fora justamente o
      // encontro pendente, que é o único que não tem outra chance: os novos
      // voltam sozinhos na próxima rodada, o pendente é o que está esperando
      // ser terminado. Por isso ele vai na frente da fila.
      const todas = await listarConferencias(space.space_name, desde);
      const conferencias = [...todas]
        .sort((a, b) => {
          const pa = idsPendentes.has(a.name) ? 0 : 1;
          const pb = idsPendentes.has(b.name) ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return new Date(b.startTime).getTime() - new Date(a.startTime).getTime();
        })
        .slice(0, 8);

      for (const conf of conferencias) {
        if (!conf.endTime) continue; // ainda em curso

        // Apagado é para sempre. O registro continua existindo do lado do
        // Google, então sem esta checagem a varredura o traz de volta na
        // rodada seguinte — e apagar viraria esconder por quinze minutos.
        if (apagados.has(conf.name)) continue;

        const { data: existente } = await sb
          .from("formacao_meet_encontros")
          .select(
            "id, transcricao_ingerida, gravacao_uri, gravacao_file_id, transcricao_uri, transcricao_file_id, descartado, descartado_manual"
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
            // Também desiste em dois dias, senão um export que falhou do lado do
            // Google faz este encontro ser reprocessado inteiro a cada rodada,
            // para sempre, sem nunca fechar nem dar erro.
            transcricaoPronta = horasDesdeOFim >= 48;
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
        // Por participante, e não numa lista só: quando o Google repete a mesma
        // pessoa, a lista corrida entra duplicada no cálculo do pico. A chave
        // aqui é a mesma que deduplica as participações logo abaixo, então as
        // duas contas passam a enxergar o mesmo conjunto de gente.
        const janelasPorParticipante = new Map<string, { inicio: Date; fim: Date }[]>();

        for (const { participante, sessoes } of sessoesPorParticipante) {
          const { nome, tipo, userId } = nomeDoParticipante(participante);
          const norm = normalizarNome(nome);
          const m = medirSessoes(sessoes, fim);

          janelasPorParticipante.set(
            participante.name,
            sessoes.flatMap((s) =>
              s.startTime
                ? [
                    {
                      inicio: new Date(s.startTime),
                      fim: s.endTime ? new Date(s.endTime) : fim,
                    },
                  ]
                : []
            )
          );

          // A conta da associação hospeda os encontros e nunca é aluno. Sai da
          // conciliação e não entra na contagem de participantes.
          const daCasa = ehContaDaCasa(nome);

          let alunoId = daCasa ? null : aliases.get(norm) || null;
          if (!alunoId && !daCasa && !nomesResolvidos.has(norm)) {
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
                  origem: "automatico",
                  evidencia: "Nome de tela muito parecido com o de uma pessoa cadastrada.",
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

        // O Google às vezes devolve o mesmo participante mais de uma vez. A
        // deduplicação precisa vir ANTES dos agregados, senão o quórum, os
        // minutos somados, o pico e a lista de presença saem inflados enquanto
        // as linhas por pessoa saem certas: número errado sem nenhum erro.
        const unicas = Array.from(
          new Map(calculadas.map((c) => [c.participant_api_id, c])).values()
        );

        // O pico sai daqui, e não da varredura acima, pelo mesmo motivo: contar
        // as sessões antes de deduplicar dobrava a lotação de quem o Google
        // devolveu duas vezes, e o número saía inflado sem nenhum erro.
        const janelas = unicas.flatMap(
          (c) => janelasPorParticipante.get(c.participant_api_id) || []
        );

        // ── agregados do encontro ──
        const total = unicas.length;
        const minutosSomados = unicas.reduce((a, c) => a + c.minutos_presentes, 0);
        const identificados = unicas.filter((c) => c.aluno_id).length;
        const mediaPermanencia = total
          ? Math.round(
              (unicas.reduce((a, c) => a + (c.permanencia_pct || 0), 0) / total) * 10
            ) / 10
          : null;

        const houveFala = unicas.some((c) => (c.minutos_fala || 0) > 0);
        const vozesAtivas = houveFala && total
          ? Math.round(
              (unicas.filter((c) => (c.minutos_fala || 0) > 0).length / total) * 1000
            ) / 10
          : null;
        const falaTotal = unicas.reduce((a, c) => a + (c.minutos_fala || 0), 0);
        const falaCondutor = unicas
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
        // Zero participante é lixo por definição: uma sala que ficou aberta
        // sozinha por sete minutos escapava da regra antiga (que exigia UMA
        // pessoa por até cinco minutos) e entrava nas médias.
        const pareceTeste = total === 0 || (total <= 1 && duracaoMin <= 5);

        // Decisão de gente não é desfeita por rotina.
        //
        // Este upsert roda de novo em toda rodada enquanto a transcrição não
        // fica pronta, e antes ele reescrevia `descartado` pela heurística. O
        // efeito era invisível e chato: o administrador descartava um encontro
        // real, e quinze minutos depois ele voltava para as médias como se nada
        // tivesse acontecido, com o motivo apagado junto.
        const decidiuNaMao = !!existente?.descartado_manual;

        const encontroRow = {
          conference_record_id: conf.name,
          ...(decidiuNaMao
            ? {}
            : {
                descartado: pareceTeste,
                descartado_motivo: pareceTeste
                  ? "Descartado automaticamente: no máximo uma pessoa, por até cinco minutos."
                  : null,
              }),
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
          // Falso agora, de propósito. Este é o carimbo de "não precisa voltar
          // aqui", e ele só pode ser dado depois que participações e falas
          // estiverem gravadas. Marcá-lo neste primeiro write fazia uma falha de
          // rede no passo seguinte deixar o encontro concluído e vazio para
          // sempre, sem erro e sem nova tentativa.
          transcricao_ingerida: false,
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
            unicas.map((c) => [c.participant_api_id, c])
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
        //
        // Vale para o descarte automático e para o manual. Antes só o
        // automático segurava, então o encontro que o administrador jogou fora
        // voltava para as telas de estatística por este caminho, mesmo depois
        // de a linha ter sido apagada no descarte.
        const foiDescartado = decidiuNaMao ? !!existente?.descartado : pareceTeste;

        if (foiDescartado) {
          await sb
            .from("formacao_meet_presencas")
            .delete()
            .eq("conference_record_id", conf.name);

          // O carimbo também vale para o lixo. Sem ele, o encontro descartado
          // nunca ficava "pronto" e voltava para a varredura a cada quinze
          // minutos, para sempre: participantes, sessões e transcrição pedidos
          // de novo ao Google a cada rodada, para no fim ser jogado fora outra
          // vez. Hoje são doze dos catorze encontros do banco.
          if (transcricaoPronta) {
            await sb
              .from("formacao_meet_encontros")
              .update({ transcricao_ingerida: true })
              .eq("id", encontroSalvo.id);
          }

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
            // quatro e acrescentamos os campos novos, senão as telas de estatística
            // renderiza undefined onde havia horário.
            participantes: unicas.map((c) => ({
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

        // Só agora o encontro pode ser dado como concluído: tudo o que precisava
        // ser gravado já está gravado. Se qualquer passo acima tivesse falhado,
        // o carimbo não viria e a próxima rodada tentaria de novo, em vez de
        // deixar um encontro vazio marcado como pronto.
        if (transcricaoPronta) {
          await sb
            .from("formacao_meet_encontros")
            .update({ transcricao_ingerida: true })
            .eq("id", encontroSalvo.id);
        }

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
