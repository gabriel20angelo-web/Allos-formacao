// A avaliação clínica, e a ponte dela com a base da formação.
//
// Rota separada da de Pessoas, e carregada em segundo plano, de propósito. O
// dado vive num Postgres da Neon, em outro servidor: pendurar essa leitura no
// `Promise.all` de `montarRetrato` faria a tela inteira deixar de abrir sempre
// que aquele banco estivesse frio ou fora, e isso por causa de um bloco que
// hoje casa três pessoas.
//
// A ponte é por TELEFONE, que é a única chave forte que os dois lados têm em
// comum: o AvaliAllos não guarda e-mail em lugar nenhum. Medido em 06/08:
// `pessoa_identificadores` tem 1268 linhas e ZERO do tipo telefone, então a
// ponte hoje casa ninguém. Importar o CSV do processo seletivo pela tela de
// Pessoas grava 65 telefones e passa a casar três das avaliadas.
//
// Por isso o bloco não depende da ponte para servir: a lista das avaliadas vem
// do próprio AvaliAllos, com nome e nota. Quem casa ganha um link para a ficha
// na formação; quem não casa aparece do mesmo jeito, só sem link.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { lerTudo } from "@/lib/supabase/paginar";
import {
  montarRetratoClinica,
  chaveTelefone,
  CORTE_DESTAQUE,
} from "@/lib/clinica/avaliallos";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  try {
    const retrato = await montarRetratoClinica();

    if (!retrato.configurado) {
      return NextResponse.json({
        configurado: false,
        motivo:
          "A leitura da avaliação clínica não está ligada neste ambiente: falta a variável NEON_DATABASE_URL.",
      });
    }

    // A ponte. Só identificador do tipo telefone, que é chave forte pela 089.
    // Nome não casa sozinho, e aqui nem sugere: numa base com três Ana Paula, a
    // sugestão por nome é um convite a atribuir parecer clínico à pessoa errada.
    const sb = await createServiceRoleClient();
    const idents = await lerTudo<{ pessoa_id: string; tipo: string; valor: string }>(
      sb,
      "pessoa_identificadores",
      "pessoa_id,tipo,valor",
      "id",
    );
    const pessoaPorTelefone = new Map<string, string>();
    for (const i of idents) {
      if (i.tipo !== "telefone") continue;
      const k = chaveTelefone(i.valor);
      if (k) pessoaPorTelefone.set(k, i.pessoa_id);
    }

    const avaliadas = retrato.avaliadas.map((a) => ({
      ...a,
      pessoaId: a.chaveTelefone
        ? (pessoaPorTelefone.get(a.chaveTelefone) ?? null)
        : null,
      // O telefone normalizado não sai daqui: ele serve à junção, não à tela.
      chaveTelefone: undefined,
    }));

    const casaram = avaliadas.filter((a) => a.pessoaId).length;
    const comTelefone = retrato.avaliadas.filter((a) => a.chaveTelefone).length;

    return NextResponse.json({
      configurado: true,
      corte: CORTE_DESTAQUE,
      avaliadas,
      totalAvaliacoes: retrato.totalAvaliacoes,
      primeira: retrato.primeira,
      ultima: retrato.ultima,
      // A procedência do próprio bloco: quantas pessoas ele alcança, e por quê.
      ponte: {
        avaliadas: avaliadas.length,
        comTelefoneUtilizavel: comTelefone,
        telefonesNaFormacao: pessoaPorTelefone.size,
        casaram,
      },
      acimaDoCorte: avaliadas.filter((a) => a.melhorNota >= CORTE_DESTAQUE).length,
      maisDeUmaVez: avaliadas.filter((a) => a.vezes > 1).length,
    });
  } catch (err) {
    console.error("[admin/pessoas/clinica]", err);
    return NextResponse.json(
      {
        configurado: true,
        error:
          err instanceof Error
            ? `Não consegui ler a avaliação clínica: ${err.message}`
            : "Não consegui ler a avaliação clínica.",
      },
      { status: 500 },
    );
  }
}
