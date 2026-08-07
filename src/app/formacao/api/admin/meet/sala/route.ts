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

  const grupos = Array.from(porAtividade(encontros).entries())
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
    })
    .sort((a, b) => (b.quorumMedio ?? 0) - (a.quorumMedio ?? 0));

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
  const limite = new Date(Date.now() - 21 * 86400000).toISOString().slice(0, 10);

  const sumindo = pessoas
    .filter((p) => p.encontros >= 3 && p.ultima < limite)
    .sort((a, b) => a.ultima.localeCompare(b.ultima))
    .slice(0, 20);

  const calados = pessoas
    .filter((p) => p.caladaEm >= 3 && p.caladaEm === p.comTranscricao)
    .sort((a, b) => b.caladaEm - a.caladaEm)
    .slice(0, 20);

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
