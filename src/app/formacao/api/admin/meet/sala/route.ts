// A sala medida, agregada de um jeito só.
//
// Substitui o papel que `formacao_meet_presencas` fazia mal: aquela tabela
// nunca recebeu uma linha derivada da ingestão (o upsert aponta para um índice
// único parcial e o erro é engolido), então as telas que liam dela mostravam
// números de abril como se fossem de hoje. Medido em 06/08: a tela dizia que o
// grupo da Laura reuniu 20 pessoas; reuniu 76.
//
// Três decisões que definem o significado de tudo aqui, e que estão no
// `lib/meet/quorum.ts` para não se perderem:
//
// 1. Quórum exclui o condutor.
// 2. `condutor_nome` guarda a dupla inteira e é separado por vírgula, o que
//    recupera o segundo condutor, invisível em toda tela até agora.
// 3. `fala_condutor_pct = 0` vira `null`, porque zero ali quer dizer "não
//    reconheci o condutor" e não "ele ficou calado".
//
// Diferente da rota `metricas`, esta pagina as duas leituras. A instância corta
// em mil linhas sem avisar, e hoje isso não dói só porque a captura começou em
// agosto.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  lerSala,
  resumir,
  porAtividade,
  porCondutor,
  porDiaSemana,
  serieSemanal,
  fluxoDeEncontros,
  interacaoDoGrupo,
  pessoaEntreGrupos,
  chaveTexto,
  type EncontroMedido,
} from "@/lib/meet/quorum";
import { lerTudo } from "@/lib/supabase/paginar";
import {
  REGUA,
  atende,
  porQueNaoDaParaLer,
  DIAS_ESFRIANDO,
} from "@/lib/meet/regua";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  // Piso 1 porque o painel oferece a janela "hoje"; teto de dez anos porque
  // "tudo" também é opção e cortar em dois anos esconderia o começo da base.
  const dias = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get("dias")) || 90, 1),
    3650,
  );
  const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

  const sb = await createServiceRoleClient();

  let sala;
  try {
    sala = await lerSala(sb, { desde });
  } catch (e) {
    // Ao contrário da rota antiga, falha de leitura não vira 200 com quórum
    // zero. Uma formação vazia e uma consulta quebrada não podem ter a mesma
    // aparência na tela.
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Falha ao ler a sala" },
      { status: 500 },
    );
  }

  const { encontros, pessoas, pessoasPorEncontro, pessoaPorGrupo } = sala;

  if (!encontros.length) {
    return NextResponse.json({ vazio: true, dias, encontros: [] });
  }

  // O id do catálogo, para a linha da lista virar link para a página do grupo.
  // A junção é por nome normalizado porque é a única que alcança tanto o
  // encontro quanto o formulário; ver o cabeçalho de `api/admin/grupos/[id]`.
  const catalogo = await lerTudo<{
    id: string;
    nome: string;
    carga_horaria: number | null;
    ativo: boolean;
    arquivado: boolean;
  }>(sb, "certificado_atividades", "id,nome,carga_horaria,ativo,arquivado", "nome");
  const idPorChave = new Map(catalogo.map((a) => [chaveTexto(a.nome), a.id]));

  const gruposCrus = Array.from(porAtividade(encontros).entries())
    .map(([chave, g]) => {
      // Os condutores que passaram pelo grupo na janela, não só o do primeiro
      // encontro. A rota antiga usava `encs[0].condutor_nome`, que atribui todo
      // o histórico a quem já saiu quando a condução muda no meio do período.
      const nomes = new Set<string>();
      g.encontros.forEach((e) => e.condutores.forEach((n) => nomes.add(n)));
      return {
        chave,
        // `null` quando o grupo existe na sala e não está no catálogo. Acontece
        // com sala avulsa e com atividade digitada fora do cadastro.
        atividadeId: idPorChave.get(chave) ?? null,
        nome: g.nome,
        slots: g.slots.size,
        condutores: Array.from(nomes),
        ...resumir(g.encontros),
        // A mesma coisa medida por pessoa, e não por encontro. As duas convivem
        // porque respondem perguntas diferentes: `resumir` diz como foram os
        // encontros, isto diz quanto as pessoas deste grupo falam e ficam.
        interacao: interacaoDoGrupo(pessoaPorGrupo, chave),
      };
    });

  // ── ⛔ a recusa de ranquear ──
  //
  // Isto mora aqui, e não na tela, de propósito. Ordenar é o que transforma
  // medição em juízo, e uma lista já ordenada convida a ler o topo como "o
  // melhor" por mais ressalva que a legenda carregue. Enquanto a base for fina,
  // a rota devolve os grupos em ordem alfabética e diz por quê.
  //
  // O precedente é a remoção do ranking de condutor por nota: 21 condutores
  // entre 9,14 e 10, com o primeiro lugar decidido por ruído. A lista "Grupo a
  // grupo" repetia o mesmo erro em outro eixo, ordenando por quórum médio com
  // um encontro por grupo e nenhuma régua.
  const comparaveis = gruposCrus.filter((g) =>
    atende(g.encontrosComTranscricao, REGUA.comparacaoEntreGrupos),
  ).length;
  const podeRanquear = atende(comparaveis, REGUA.ranking);

  const grupos = gruposCrus
    .map((g) => ({
      ...g,
      /** Este grupo sozinho tem base para entrar numa comparação. */
      comparavel: atende(g.encontrosComTranscricao, REGUA.comparacaoEntreGrupos),
      faltaParaComparar: porQueNaoDaParaLer(
        g.encontrosComTranscricao,
        REGUA.comparacaoEntreGrupos,
      ),
    }))
    .sort((a, b) =>
      podeRanquear
        ? (b.quorumMedio ?? 0) - (a.quorumMedio ?? 0)
        : a.nome.localeCompare(b.nome, "pt-BR"),
    );

  const condutores = Array.from(porCondutor(encontros).entries())
    .map(([chave, c]) => {
      const atividades = new Set<string>();
      c.encontros.forEach((e) => atividades.add(e.atividade ?? "Sem atividade"));
      return {
        chave,
        nome: c.nome,
        atividades: Array.from(atividades),
        ...resumir(c.encontros),
      };
    })
    .sort((a, b) => b.encontros - a.encontros);

  // ── quem sumiu e quem não fala ──
  // O relógio é HOJE, não o último encontro capturado. Ancorar na captura faz
  // a ingestão parada virar boa notícia: ninguém "some" porque o tempo parou.
  const hoje = new Date().toISOString().slice(0, 10);
  const limite = new Date(Date.now() - DIAS_ESFRIANDO * 86400000)
    .toISOString()
    .slice(0, 10);

  const sumindo = pessoas
    .filter((p) => atende(p.encontros, REGUA.sumico) && p.ultima < limite)
    .sort((a, b) => a.ultima.localeCompare(b.ultima))
    .slice(0, 20);

  // ⛔ Sem histórico suficiente, "ninguém sumiu" NÃO é boa notícia, é ausência
  // de base: a captura pela API do Meet começou em 03/08/2026, e ninguém pode
  // ter 21 dias de ausência num histórico mais novo que 21 dias. A lista vazia
  // lia como tranquilidade e era cegueira. A tela precisa saber a diferença.
  const primeiroDia = encontros.reduce(
    (a, e) => (a && a < e.data ? a : e.data),
    "",
  );
  const diasDeHistorico = primeiroDia
    ? Math.floor(
        (Date.parse(hoje + "T12:00:00") - Date.parse(primeiroDia + "T12:00:00")) /
          86400000,
      )
    : 0;
  const sumicoMensuravel = diasDeHistorico >= DIAS_ESFRIANDO;

  const calados = pessoas
    .filter(
      (p) => atende(p.caladaEm, REGUA.sumico) && p.caladaEm === p.comTranscricao,
    )
    .sort((a, b) => b.caladaEm - a.caladaEm)
    .slice(0, 20);

  // ⛔ "Por dia da semana" promete separar efeito de horário de efeito de
  // condução. Com um grupo por dia, as duas coisas são literalmente a mesma
  // coluna, e o card entrega o contrário do que promete. Só vale mostrar quando
  // algum dia tiver mais de um grupo distinto.
  const gruposPorDia = new Map<number, Set<string>>();
  for (const e of encontros) {
    const s = gruposPorDia.get(e.diaSemana) ?? new Set<string>();
    s.add(e.atividadeChave);
    gruposPorDia.set(e.diaSemana, s);
  }
  const diaSemanaSeparaEfeito = Array.from(gruposPorDia.values()).some(
    (s) => s.size > 1,
  );

  const maisPresentes = [...pessoas]
    .sort((a, b) => b.encontros - a.encontros || b.minutos - a.minutos)
    .slice(0, 20);

  // ── ⭐ a mesma pessoa entre grupos ──
  //
  // É a única família de métricas legível hoje, porque não depende de série
  // temporal: já são 39 pessoas em mais de um grupo com um encontro capturado
  // por grupo. Medido em 06/08, 15 delas falam num grupo e ficam completamente
  // mudas em outro, com permanência parecida nos dois. Isso mede o grupo.
  const entreGrupos = pessoas
    .map((p) => {
      const c = pessoaEntreGrupos(pessoaPorGrupo, p.chave);
      if (!c || c.grupos.length < 2) return null;
      return { nome: p.nome, alunoId: p.alunoId, ...c };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort(
      (a, b) =>
        Number(b.falaEmUmCalaEmOutro) - Number(a.falaEmUmCalaEmOutro) ||
        b.amplitudeFalaMin - a.amplitudeFalaMin ||
        b.amplitudePermanenciaPct - a.amplitudePermanenciaPct,
    );

  return NextResponse.json({
    vazio: false,
    dias,
    hoje,
    geral: resumir(encontros),
    encontros: encontros.sort((a: EncontroMedido, b: EncontroMedido) =>
      b.data.localeCompare(a.data),
    ),
    grupos,
    condutores,
    // ⛔ A régua, junto do que ela libera. A tela não decide isso sozinha.
    regua: {
      podeRanquear,
      gruposComparaveis: comparaveis,
      minimoParaComparar: REGUA.comparacaoEntreGrupos.minimo,
      porqueNaoRanqueia: podeRanquear
        ? null
        : REGUA.comparacaoEntreGrupos.porque,
      sumicoMensuravel,
      diasDeHistorico,
      diaSemanaSeparaEfeito,
    },
    diaSemana: porDiaSemana(encontros),
    semanas: serieSemanal(encontros, pessoasPorEncontro),
    fluxo: fluxoDeEncontros(encontros, pessoasPorEncontro),
    entreGrupos,
    /** Quantas das pessoas em mais de um grupo têm chave forte. É a ressalva da tela. */
    entreGruposIdentificadas: entreGrupos.filter((p) => p.alunoId).length,
    maisPresentes,
    sumindo,
    calados,
    totalPessoas: pessoas.length,
    // O catálogo inteiro, e não só quem teve encontro medido. Treze das
    // dezenove atividades não têm posição na grade, e elas carregam 185
    // feedbacks: uma lista de grupos que só mostrasse a sala esconderia dois
    // terços do que existe.
    catalogo,
  });
}
