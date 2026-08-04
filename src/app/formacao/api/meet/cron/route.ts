// Batida periódica: aplica as exceções do dia e ingere o que já terminou.
//
// Chamada por agendador externo com um segredo no header. Não usa cookie de
// admin de propósito: cron não tem sessão.
//
// Roda de hora em hora sem problema. A ingestão pula conferência em curso e é
// idempotente, então a única consequência de rodar demais é gastar quota.
//
// Cada etapa roda no próprio try/catch. Antes eram onze chamadas em sequência
// sob um único try, e a primeira que estourasse levava junto todas as
// seguintes: uma falha de permissão do Drive às sete da manhã de segunda
// impedia o fechamento da semana, que só tem chance de acontecer nas batidas de
// segunda, e ninguém ficava sabendo até a semana seguinte. Isolando, uma etapa
// quebrada custa só ela mesma, e a resposta diz qual foi.
//
// Continuar depois de uma falha é seguro porque as etapas não confiam umas nas
// outras para decidir: a marcação de status confere a saúde da captura antes de
// concluir qualquer negativo, e o resto ou é idempotente ou volta na próxima
// batida.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { arquivarGravacoes } from "@/lib/meet/arquivar";
import { sugerirAulasDeGravacoes } from "@/lib/meet/aulas";
import { publicarProximoVideo } from "@/lib/meet/publicar-video";
import { conciliarPendentes } from "@/lib/meet/conciliar";
import { processarClipes } from "@/lib/meet/clipes";
import { encerrarReunioesLongas } from "@/lib/meet/encerramento";
import { sincronizarExcecoes } from "@/lib/meet/excecoes";
import { aplicarJanelaDeAcesso } from "@/lib/meet/janela";
import { ingerir } from "@/lib/meet/ingest";
import { atualizarStatusSlots, fecharSemanaSePreciso } from "@/lib/meet/status-slots";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ClienteServico = Awaited<ReturnType<typeof createServiceRoleClient>>;

interface ResultadoEtapa {
  etapa: string;
  ok: boolean;
  ms: number;
  /** O mesmo resumo que a etapa já devolvia antes, intacto. */
  resumo?: unknown;
  erro?: string;
}

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.MEET_CRON_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  // Só pelo cabeçalho. Aceitar o segredo na própria URL o espalharia por
  // registro de acesso, histórico de navegador e cabeçalho de origem, e ele é a
  // única coisa que protege esta rota.
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!segredoConfere(token)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const inicio = Date.now();

  // Acumuladores da requisição, e não do módulo: o disparo automático e alguém
  // rodando na mão pela aba Actions podem se cruzar, e estado compartilhado
  // misturaria o resultado dos dois.
  const etapas: ResultadoEtapa[] = [];
  const erros: string[] = [];

  // O nome da etapa entra no acumulador junto da mensagem porque "Request had
  // insufficient authentication scopes" sozinho não diz se quem recusou foi o
  // Drive, o YouTube ou o Meet.
  async function executar<T>(nome: string, fn: () => Promise<T>): Promise<T | null> {
    const t0 = Date.now();
    try {
      const resumo = await fn();
      etapas.push({ etapa: nome, ok: true, ms: Date.now() - t0, resumo });
      return resumo;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // O console do servidor continua sendo onde fica o stack; a resposta leva
      // só a mensagem, que é o que aparece no log do agendador.
      console.error(`[meet/cron] ${nome}`, e);
      etapas.push({ etapa: nome, ok: false, ms: Date.now() - t0, erro: msg });
      erros.push(`${nome}: ${msg}`);
      return null;
    }
  }

  let sb: ClienteServico;
  try {
    sb = await createServiceRoleClient();
  } catch (e) {
    // Único erro que continua sendo fatal junto da autenticação: sem cliente
    // nenhuma etapa chega a rodar, não há resultado parcial para reportar, e o
    // job precisa ficar vermelho na aba Actions.
    console.error("[meet/cron] cliente", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    );
  }

  // A ordem abaixo é deliberada. Cada bloco explica por que está onde está.

  // Primeiro de tudo: sala aberta além do teto continua gravando enquanto o
  // resto roda. Encerrar antes também faz a captura logo abaixo já pegar o
  // encontro fechado, em vez de esperar a próxima batida.
  await executar("encerramento", () => encerrarReunioesLongas(sb));

  // Depois de encerrar: fechar a porta antes disso deixaria quem está dentro
  // preso numa sala que não aceita mais ninguém, sem encerrar a reunião.
  await executar("janela", () => aplicarJanelaDeAcesso(sb));

  await executar("excecoes", () => sincronizarExcecoes(sb));
  await executar("ingestao", () => ingerir({ origem: "cron", diasAtras: 15 }));

  // Fechar a semana ANTES de marcar a semana corrente, porque o fechamento
  // zera todos os status: na ordem inversa ele apagaria a marcação recém-feita.
  // O fechamento cuida sozinho de marcar a semana que terminou antes de
  // arquivá-la.
  await executar("semana", () => fecharSemanaSePreciso(sb));
  await executar("status", () => atualizarStatusSlots(sb));

  // Por último: mover arquivo pode falhar por permissão do Google, e essa
  // falha não pode derrubar a captura de presença, que é o que importa.
  await executar("arquivos", () => arquivarGravacoes(sb));

  // Vídeo grande sobe ao longo de várias batidas: cada rodada empurra o que
  // couber no prazo e guarda onde parou.
  await executar("youtube", () => publicarProximoVideo(sb, inicio + 150_000));

  // Volta nos nomes que ficaram na fila: aluno novo pode ter se cadastrado
  // desde a última tentativa, e o que era ambíguo ontem pode não ser mais.
  await executar("nomes", () => conciliarPendentes(sb));

  // Sugere, não publica. A aula só existe quando alguém aprovar.
  await executar("aulas", () => sugerirAulasDeGravacoes(sb));

  // Por último porque é a etapa que come tempo: vídeo do Drive sobe ao
  // YouTube aqui dentro, em pedaços, e leva o que sobrou da rodada. Deixar o
  // prazo explícito é o que garante que a resposta ainda saia dentro do
  // tempo da requisição.
  await executar("clipes", () =>
    processarClipes(sb, "https://allos.org.br", inicio + 240_000)
  );

  // 200 mesmo com etapa quebrada, de propósito: o agendador trata 4xx e 5xx
  // como job falho e pararia de distinguir "o pipeline rodou e uma etapa
  // reclamou" de "a rota não respondeu". A distinção fica no corpo, em `ok` e
  // em `erros`, que é onde o próprio workflow já procura por falha parcial.
  return NextResponse.json({
    ok: erros.length === 0,
    duracao_ms: Date.now() - inicio,
    etapas,
    erros,
  });
}
