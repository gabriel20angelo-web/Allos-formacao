// O dossiê de uma pessoa, numa chamada.
//
// Existe porque pessoa era a única das três entidades comparáveis sem página
// própria: grupo tem, condutor tem, e pessoa vivia dentro de um modal que
// consulta do navegador, chaveia por e-mail e já mostra dez números. "Entrar no
// histórico dela" e "comparar a mesma pessoa entre grupos" não cabem ali.
//
// ⚠️ A identidade da pessoa é `pessoas.id`, e uma pessoa pode ter MAIS DE UMA
// chave na sala. Medido em 06/08/2026: existe alguém com um `aluno_id` e duas
// contas Google, em três grupos. Por isso esta rota resolve a pessoa para um
// conjunto de chaves e soma todas, em vez de procurar uma só.
//
// ⛔ E o contrário também: 59% das participações não têm `aluno_id`. Quem chega
// aqui por uma pessoa do cadastro pode simplesmente não ter linha na sala, e a
// resposta certa nesse caso é dizer isso, não devolver zeros.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { lerTudo } from "@/lib/supabase/paginar";
import {
  lerSala,
  mediana,
  pessoaEntreGrupos,
  chaveTexto,
  type MetricaNoGrupo,
} from "@/lib/meet/quorum";

export const dynamic = "force-dynamic";

interface IdentRow {
  tipo: string;
  valor: string;
  forca: string | null;
  origem: string | null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id inválido" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  const { data: pessoa } = await sb
    .from("pessoas")
    .select("id,nome_canonico,nome_social,observacao,criada_em")
    .eq("id", id)
    .maybeSingle();

  if (!pessoa) {
    return NextResponse.json({ error: "pessoa não encontrada" }, { status: 404 });
  }

  const { data: identsRaw } = await sb
    .from("pessoa_identificadores")
    .select("tipo,valor,forca,origem")
    .eq("pessoa_id", id);
  const idents: IdentRow[] = identsRaw ?? [];

  const perfis = idents.filter((i) => i.tipo === "profile_id").map((i) => i.valor);
  const emails = idents.filter((i) => i.tipo === "email").map((i) => i.valor);
  const nomesMeet = idents.filter((i) => i.tipo === "nome_exibicao").map((i) => i.valor);
  const contasGoogle = idents
    .filter((i) => i.tipo === "google_user_id")
    .map((i) => i.valor);

  // As chaves com que esta pessoa pode aparecer na sala, na mesma ordem de força
  // de `chavePessoa`. Uma pessoa fragmentada aparece com várias, e todas somam.
  const chavesDaSala = new Set<string>([
    ...perfis,
    ...contasGoogle.map((g) => `google:${g}`),
    ...nomesMeet.map((n) => `nome:${n}`),
  ]);

  const [sala, subs] = await Promise.all([
    lerSala(sb),
    emails.length
      ? lerTudo<{
          id: string;
          created_at: string;
          atividade_nome: string | null;
          nota_grupo: number | null;
          nota_condutor: number | null;
          relato: string | null;
          condutores: string[] | null;
          email: string;
        }>(
          sb,
          "certificado_submissions",
          "id,created_at,atividade_nome,nota_grupo,nota_condutor,relato,condutores,email",
          "id",
        )
      : Promise.resolve([]),
  ]);

  const emailSet = new Set(emails.map((e) => e.toLowerCase().trim()));
  const formularios = subs
    .filter((s) => emailSet.has((s.email ?? "").toLowerCase().trim()))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  // ── a sala, somando todas as chaves desta pessoa ──
  const minhas = Array.from(chavesDaSala).filter((k) => sala.pessoaPorGrupo.has(k));
  const porGrupo = new Map<string, MetricaNoGrupo>();
  for (const k of minhas) {
    const mapa = sala.pessoaPorGrupo.get(k);
    if (!mapa) continue;
    mapa.forEach((m, grupo) => {
      const atual = porGrupo.get(grupo);
      if (!atual) {
        porGrupo.set(grupo, { ...m, permanencias: [...m.permanencias] });
        return;
      }
      porGrupo.set(grupo, {
        grupo,
        nome: atual.nome,
        encontros: atual.encontros + m.encontros,
        minutos: atual.minutos + m.minutos,
        minutosFala: Math.round((atual.minutosFala + m.minutosFala) * 100) / 100,
        segmentosFala: atual.segmentosFala + m.segmentosFala,
        caladaEm: atual.caladaEm + m.caladaEm,
        comTranscricao: atual.comTranscricao + m.comTranscricao,
        permanencias: [...atual.permanencias, ...m.permanencias],
        primeira: atual.primeira < m.primeira ? atual.primeira : m.primeira,
        ultima: atual.ultima > m.ultima ? atual.ultima : m.ultima,
      });
    });
  }

  // Reusa a mesma função que a sala usa, com o mapa já fundido, para que a tela
  // da pessoa e a tela da sala nunca discordem sobre a mesma pessoa.
  const fundido = new Map([["eu", porGrupo]]);
  const comparacao = pessoaEntreGrupos(fundido, "eu");

  const grupos = (comparacao?.grupos ?? []).map((g) => ({
    ...g,
    permanenciaMediaPct: g.permanencias.length
      ? Math.round(
          (g.permanencias.reduce((a, b) => a + b, 0) / g.permanencias.length) * 10,
        ) / 10
      : null,
  }));

  // ── o denominador: a formação inteira ──
  const naFormacao = {
    encontros: grupos.reduce((a, g) => a + g.encontros, 0),
    grupos: grupos.length,
    minutos: grupos.reduce((a, g) => a + g.minutos, 0),
    minutosFala: Math.round(grupos.reduce((a, g) => a + g.minutosFala, 0) * 10) / 10,
    permanenciaMedianaPct: mediana(grupos.flatMap((g) => g.permanencias)),
    comTranscricao: grupos.reduce((a, g) => a + g.comTranscricao, 0),
    caladaEm: grupos.reduce((a, g) => a + g.caladaEm, 0),
    primeira: grupos.map((g) => g.primeira).sort()[0] ?? null,
    ultima: grupos.map((g) => g.ultima).sort().reverse()[0] ?? null,
  };

  // ── a linha do tempo dos encontros dela ──
  const encontrosDela = sala.encontros
    .filter((e) => {
      const set = sala.pessoasPorEncontro.get(e.id);
      return set ? minhas.some((k) => set.has(k)) : false;
    })
    .map((e) => ({
      id: e.id,
      data: e.data,
      grupo: e.atividade,
      grupoChave: e.atividadeChave,
      quorum: e.quorum,
      temTranscricao: e.temTranscricao,
      condutores: e.condutores,
    }))
    .sort((a, b) => b.data.localeCompare(a.data));

  // Os grupos que ela NÃO frequenta, para a comparação ter o outro lado. Só os
  // que têm sala medida: oferecer grupo sem encontro capturado seria ruído.
  const chavesDela = new Set(grupos.map((g) => g.grupo));
  const outrosGrupos = Array.from(
    new Set(sala.encontros.map((e) => e.atividadeChave)),
  )
    .filter((c) => !chavesDela.has(c))
    .map((c) => ({
      chave: c,
      nome: sala.encontros.find((e) => e.atividadeChave === c)?.atividade ?? c,
    }));

  const nome =
    pessoa.nome_social ||
    pessoa.nome_canonico ||
    grupos[0]?.nome ||
    "Sem nome";

  return NextResponse.json({
    pessoa: {
      id: pessoa.id,
      nome,
      nomeCanonico: pessoa.nome_canonico,
      criadaEm: pessoa.criada_em,
      observacao: pessoa.observacao,
      emails,
      temConta: perfis.length > 0,
      // ⚠️ A tela precisa disto: uma pessoa sem chave forte na sala foi casada
      // por nome, e nome é a chave que a casa proíbe para fundir histórico.
      chaveForteNaSala: perfis.length > 0 || contasGoogle.length > 0,
      identificadores: idents.map((i) => ({
        tipo: i.tipo,
        forca: i.forca,
        origem: i.origem,
      })),
      /** Quantas chaves distintas ela tem na sala. Acima de 1 é fragmentação. */
      chavesNaSala: minhas.length,
    },
    naFormacao,
    grupos,
    outrosGrupos,
    comparacao: comparacao
      ? {
          amplitudeFalaMin: comparacao.amplitudeFalaMin,
          amplitudePermanenciaPct: comparacao.amplitudePermanenciaPct,
          falaEmUmCalaEmOutro: comparacao.falaEmUmCalaEmOutro,
        }
      : null,
    encontros: encontrosDela,
    formularios: formularios.map((f) => ({
      id: f.id,
      data: f.created_at,
      grupo: f.atividade_nome,
      grupoChave: chaveTexto(f.atividade_nome),
      notaGrupo: f.nota_grupo,
      // ⚠️ Nota 5 com `condutores` vazio é ausência de pergunta, não avaliação.
      notaCondutor: (f.condutores ?? []).filter(Boolean).length ? f.nota_condutor : null,
      relato: f.relato,
      condutores: f.condutores ?? [],
    })),
  });
}
