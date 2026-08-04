// Status do calendário preenchido pelo sistema.
//
// A regra é simples: existe registro de conferência na sala daquele grupo
// dentro da semana corrente? Então o encontro aconteceu.
//
// O que não é simples é o contrário. Ausência de registro pode ser feriado,
// cancelamento combinado, condutor que abriu outra sala, ou a integração com o
// Google quebrada. Como esse histórico alimenta o ranking de condutores, marcar
// "não conduzido" por engano deixa marca no histórico de uma pessoa real. Daí
// as três proteções abaixo, que são o que torna o automático aceitável:
//
// 1. TEMPO. A captura só fecha horas depois do encontro. Marcar negativo no
//    mesmo dia é marcar antes de saber. Só marca no dia seguinte, e corrige
//    sozinho se um registro atrasado chegar depois.
// 2. SAÚDE. Se a última ingestão falhou ou não há credencial, não marca nada.
//    Falha técnica não pode virar falta de ninguém.
// 3. RASTRO. Toda marcação automática fica etiquetada, e decisão humana nunca
//    é sobrescrita.

import type { SupabaseClient } from "@supabase/supabase-js";
import { dataLocal, diaSemanaLocal } from "./nomes";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface ResultadoStatus {
  conduzidos: number;
  nao_conduzidos: number;
  corrigidos: number;
  ignorados_por_decisao_humana: number;
  pulado_por_saude: boolean;
  motivo_pulo?: string;
}

/**
 * Segunda-feira da semana de uma data, no fuso de quem participa.
 *
 * Usar `getDay()` cru mede no fuso do servidor, que é UTC: às 21h de domingo em
 * São Paulo o servidor já acha que é segunda, e o fechamento da semana
 * dispararia três horas antes, arquivando um retrato incompleto.
 */
function segundaDaSemana(d: Date): Date {
  const diaLocal = diaSemanaLocal(d); // 0 = segunda, no fuso certo
  const segunda = new Date(d.getTime() - diaLocal * 24 * 3_600_000);
  // Meia-noite de Brasília, e não do servidor.
  const [ano, mes, dia] = dataLocal(segunda).split("-").map(Number);
  return new Date(Date.UTC(ano, mes - 1, dia, 3, 0, 0)); // 00h BRT = 03h UTC
}

/**
 * A integração está saudável o suficiente para concluir que um encontro NÃO
 * aconteceu?
 *
 * Só conclusão negativa depende disso. Marcar "conduzido" a partir de um
 * registro que existe é seguro em qualquer cenário.
 */
async function capturaSaudavel(sb: Sb): Promise<{ ok: boolean; motivo?: string }> {
  const { data: cred } = await sb
    .from("formacao_meet_credenciais")
    .select("id")
    .eq("id", 1)
    .maybeSingle();
  if (!cred) return { ok: false, motivo: "Nenhuma conta do Google autorizada." };

  const { data: log } = await sb
    .from("formacao_meet_ingest_logs")
    .select("executado_em, erro")
    .order("executado_em", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!log) return { ok: false, motivo: "A captura ainda não rodou nenhuma vez." };
  if (log.erro) return { ok: false, motivo: `Última captura terminou com erro: ${log.erro}` };

  const horas = (Date.now() - new Date(log.executado_em).getTime()) / 3_600_000;
  if (horas > 30) {
    return { ok: false, motivo: "A captura não roda há mais de um dia." };
  }
  return { ok: true };
}

async function registrarLog(
  sb: Sb,
  slotId: string,
  anterior: string | null,
  novo: string,
  atividade: string | null,
  origem: "automatico" | "correcao",
  motivo: string
) {
  const { data: alocs } = await sb
    .from("formacao_alocacoes")
    .select("condutor_id")
    .eq("slot_id", slotId);

  await sb.from("formacao_slot_logs").insert({
    slot_id: slotId,
    status_anterior: anterior,
    status_novo: novo,
    atividade_nome: atividade,
    condutor_ids: (alocs || []).map((a: { condutor_id: string }) => a.condutor_id),
    origem,
    motivo,
  });
}

/**
 * Preenche o status dos slots da semana corrente.
 *
 * Roda junto do cron de captura, quantas vezes ele rodar: é idempotente, e a
 * repetição é justamente o que permite corrigir um "não conduzido" quando o
 * registro chega atrasado.
 */
export async function atualizarStatusSlots(
  sb: Sb,
  /**
   * Semana a considerar. Omitir significa a semana corrente.
   *
   * O fechamento de segunda passa a semana ANTERIOR aqui antes de arquivar:
   * na segunda-feira a "semana corrente" já é a nova, e sem isso os encontros
   * de sexta ficariam fora da janela e o snapshot seria salvo com slots ainda
   * pendentes, congelando para sempre um retrato incompleto.
   */
  semanaRef?: Date
): Promise<ResultadoStatus> {
  const res: ResultadoStatus = {
    conduzidos: 0,
    nao_conduzidos: 0,
    corrigidos: 0,
    ignorados_por_decisao_humana: 0,
    pulado_por_saude: false,
  };

  const agora = new Date();
  const segunda = segundaDaSemana(semanaRef || agora);
  const inicioSemana = dataLocal(segunda);
  const fimSemana = dataLocal(new Date(segunda.getTime() + 6 * 24 * 3_600_000));

  const { data: slots } = await sb
    .from("formacao_slots")
    .select("id, dia_semana, status, atividade_nome, status_automatico_em, horario_id")
    .eq("ativo", true);

  if (!slots?.length) return res;

  const { data: horarios } = await sb.from("formacao_horarios").select("id, hora");
  const horaPorId = new Map(
    (horarios || []).map((h: { id: string; hora: string }) => [h.id, h.hora])
  );

  // Encontros capturados desta semana, agrupados por slot.
  const { data: encontros, error: errEncontros } = await sb
    .from("formacao_meet_encontros")
    .select("slot_id, data_reuniao, total_participantes")
    .gte("data_reuniao", inicioSemana)
    .lte("data_reuniao", fimSemana)
    .eq("descartado", false) // alguém testando o link não prova que houve encontro
    .not("slot_id", "is", null);

  // Uma falha aqui devolve lista vazia, que é indistinguível de "não houve
  // encontro nenhum" — e como a ausência de encontro agora DESFAZ o status
  // conduzido, um erro de rede zeraria a semana inteira. Melhor não decidir
  // nada nesta rodada.
  if (errEncontros) {
    res.motivo_pulo = `Não consegui ler os encontros da semana: ${errEncontros.message}`;
    res.pulado_por_saude = true;
    return res;
  }

  const encontroPorSlot = new Map<string, { data_reuniao: string; total_participantes: number }>();
  for (const e of (encontros || []) as {
    slot_id: string;
    data_reuniao: string;
    total_participantes: number;
  }[]) {
    const atual = encontroPorSlot.get(e.slot_id);
    if (!atual || e.data_reuniao > atual.data_reuniao) encontroPorSlot.set(e.slot_id, e);
  }

  const saude = await capturaSaudavel(sb);

  for (const slot of slots as {
    id: string;
    dia_semana: number;
    status: string;
    atividade_nome: string | null;
    status_automatico_em: string | null;
    horario_id: string;
  }[]) {
    const teveEncontro = encontroPorSlot.has(slot.id);
    const marcadoPorPessoa = slot.status !== "pendente" && !slot.status_automatico_em;

    // Decisão humana é soberana: quem marcou "cancelado" sabe de algo que o
    // sistema não sabe.
    if (marcadoPorPessoa) {
      if (teveEncontro) res.ignorados_por_decisao_humana++;
      continue;
    }

    if (teveEncontro) {
      if (slot.status === "conduzido") continue;
      const correcao = slot.status === "nao_conduzido";
      await sb
        .from("formacao_slots")
        .update({ status: "conduzido", status_automatico_em: new Date().toISOString() })
        .eq("id", slot.id);
      await registrarLog(
        sb,
        slot.id,
        slot.status,
        "conduzido",
        slot.atividade_nome,
        correcao ? "correcao" : "automatico",
        correcao
          ? "Registro do encontro chegou depois da marcação; status corrigido."
          : `Encontro capturado com ${encontroPorSlot.get(slot.id)?.total_participantes ?? 0} participantes.`
      );
      if (correcao) res.corrigidos++;
      else res.conduzidos++;
      continue;
    }

    // ── daqui para baixo: sem registro do encontro ──

    // O que o sistema concluiu, o sistema desfaz.
    //
    // "Conduzido" automático era um caminho de mão única: marcava e nunca mais
    // revisitava. Quando o encontro que sustentava a marcação era descartado,
    // por ser teste ou por decisão do administrador, o slot continuava
    // conduzido para sempre, e o fechamento de segunda congelava esse número
    // no histórico, onde não há como corrigir. Foi assim que a tela de
    // Estatísticas passou a mostrar dois encontros conduzidos e dois
    // condutores com 100% de aproveitamento, sem que existisse um único
    // encontro válido no banco.
    //
    // Decisão de gente não entra aqui: `marcadoPorPessoa` já saiu no topo do
    // laço, então o que sobra com status diferente de pendente foi este código
    // que escreveu.
    if (slot.status === "conduzido") {
      await sb
        .from("formacao_slots")
        .update({ status: "pendente", status_automatico_em: null })
        .eq("id", slot.id);
      await registrarLog(
        sb,
        slot.id,
        slot.status,
        "pendente",
        slot.atividade_nome,
        "correcao",
        "O encontro que marcou este horário como conduzido foi descartado."
      );
      res.corrigidos++;
      continue;
    }

    if (slot.status === "nao_conduzido") continue;
    if (slot.status !== "pendente") continue;

    if (!saude.ok) {
      res.pulado_por_saude = true;
      res.motivo_pulo = saude.motivo;
      continue;
    }

    // Só no dia seguinte: a captura fecha horas depois do encontro, e concluir
    // no mesmo dia é concluir antes de saber.
    const diaDoSlot = new Date(segunda);
    diaDoSlot.setDate(segunda.getDate() + slot.dia_semana);
    const hora = horaPorId.get(slot.horario_id) || "23:59";
    const [hh, mm] = hora.split(":").map((n: string) => parseInt(n, 10));
    diaDoSlot.setHours(Number.isFinite(hh) ? hh : 23, Number.isFinite(mm) ? mm : 59, 0, 0);

    const horasDesde = (agora.getTime() - diaDoSlot.getTime()) / 3_600_000;
    if (horasDesde < 14) continue; // ainda cedo para concluir ausência

    await sb
      .from("formacao_slots")
      .update({ status: "nao_conduzido", status_automatico_em: new Date().toISOString() })
      .eq("id", slot.id);
    await registrarLog(
      sb,
      slot.id,
      slot.status,
      "nao_conduzido",
      slot.atividade_nome,
      "automatico",
      "Nenhum encontro capturado nesta sala durante a semana."
    );
    res.nao_conduzidos++;
  }

  return res;
}

/**
 * Fecha a semana: guarda o retrato e zera os status.
 *
 * Roda na madrugada de segunda. O índice único por semana_inicio é o que
 * garante que rodar de hora em hora não crie vários snapshots nem apague o que
 * a semana acumulou.
 */
export async function fecharSemanaSePreciso(
  sb: Sb
): Promise<{ fechou: boolean; motivo?: string; slots?: number }> {
  const agora = new Date();
  // Segunda no fuso de Brasília, não no do servidor.
  if (diaSemanaLocal(agora) !== 0) return { fechou: false, motivo: "Hoje não é segunda." };

  const segundaAtual = segundaDaSemana(agora);
  const segundaAnterior = new Date(segundaAtual);
  segundaAnterior.setDate(segundaAtual.getDate() - 7);
  const sextaAnterior = new Date(segundaAnterior);
  sextaAnterior.setDate(segundaAnterior.getDate() + 4);

  const inicio = dataLocal(segundaAnterior);

  const { data: existente } = await sb
    .from("formacao_snapshots")
    .select("id")
    .eq("semana_inicio", inicio)
    .maybeSingle();
  if (existente) return { fechou: false, motivo: "Semana já foi fechada." };

  // Marca o que a captura sabe sobre a semana que terminou ANTES de congelar o
  // retrato: depois do snapshot não há como corrigir, o histórico já foi.
  await atualizarStatusSlots(sb, segundaAnterior);

  const { data: slots } = await sb
    .from("formacao_slots")
    .select("id, dia_semana, horario_id, atividade_nome, status, meet_link")
    .eq("ativo", true);
  if (!slots?.length) return { fechou: false, motivo: "Nenhum slot ativo." };

  const { data: horarios } = await sb.from("formacao_horarios").select("id, hora");
  const horaPorId = new Map(
    (horarios || []).map((h: { id: string; hora: string }) => [h.id, h.hora])
  );

  const { data: alocacoes } = await sb
    .from("formacao_alocacoes")
    .select("slot_id, condutor_id, certificado_condutores(nome)");

  const condutoresPorSlot = new Map<string, { id: string; nome: string }[]>();
  for (const a of (alocacoes || []) as unknown as {
    slot_id: string;
    condutor_id: string;
    certificado_condutores: { nome: string } | { nome: string }[] | null;
  }[]) {
    const bruto = a.certificado_condutores;
    const nome = Array.isArray(bruto) ? bruto[0]?.nome : bruto?.nome;
    const atual = condutoresPorSlot.get(a.slot_id) || [];
    condutoresPorSlot.set(a.slot_id, [...atual, { id: a.condutor_id, nome: nome || "" }]);
  }

  const { data: snapshot, error: errSnap } = await sb
    .from("formacao_snapshots")
    .insert({
      semana_inicio: inicio,
      semana_fim: dataLocal(sextaAnterior),
      origem: "automatico",
    })
    .select("id")
    .single();

  if (errSnap || !snapshot) {
    // Corrida com outro processo cai aqui pelo índice único, e não fechar é o
    // comportamento certo: quem chegou primeiro já fechou.
    return { fechou: false, motivo: errSnap?.message || "Snapshot não criado." };
  }

  const linhas = (slots as {
    id: string;
    dia_semana: number;
    horario_id: string;
    atividade_nome: string | null;
    status: string;
    meet_link: string | null;
  }[]).map((s) => ({
    snapshot_id: snapshot.id,
    slot_id: s.id,
    dia_semana: s.dia_semana,
    horario_hora: horaPorId.get(s.horario_id) || "",
    atividade_nome: s.atividade_nome,
    status: s.status,
    meet_link: s.meet_link,
    condutores: condutoresPorSlot.get(s.id) || [],
  }));

  const { error: errLinhas } = await sb.from("formacao_snapshot_slots").insert(linhas);
  if (errLinhas) {
    // Sem as linhas o snapshot é uma casca vazia; melhor apagar e tentar na
    // próxima batida do que zerar a semana e perder o retrato dela.
    await sb.from("formacao_snapshots").delete().eq("id", snapshot.id);
    return { fechou: false, motivo: errLinhas.message };
  }

  await sb
    .from("formacao_slots")
    .update({ status: "pendente", status_automatico_em: null })
    .in(
      "id",
      (slots as { id: string }[]).map((s) => s.id)
    );

  return { fechou: true, slots: linhas.length };
}
