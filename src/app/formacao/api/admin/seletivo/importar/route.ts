// Importa o CSV do processo seletivo.
//
// Duas passadas pelo mesmo caminho: `previa: true` calcula e devolve o que
// aconteceria sem gravar nada, `previa: false` grava. É o mesmo código nas
// duas, de propósito, senão a prévia promete um número e a gravação faz outro.
//
// O casamento é só por chave forte, e isso é possível porque o export completo
// traz e-mail e WhatsApp de todo mundo. Medido no arquivo de 06/08/2026: 31 dos
// 65 candidatos já existiam como pessoa. Casando pelo nome, que era o que dava
// para fazer com o export anterior, seriam 15 e nenhum deles confiável.
//
// Quem não casa vira pessoa nova, sem fila de confirmação. A fila existiria
// para resolver ambiguidade de nome, e aqui não há nome decidindo nada.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { parseCSV, mapearColunas, type LinhaSeletivo } from "@/lib/seletivo/csv";

export const dynamic = "force-dynamic";

const LIMITE_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  let body: { conteudo?: string; previa?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const conteudo = body.conteudo ?? "";
  if (!conteudo.trim()) {
    return NextResponse.json({ error: "Arquivo vazio." }, { status: 400 });
  }
  if (conteudo.length > LIMITE_BYTES) {
    return NextResponse.json(
      { error: "Arquivo acima de 5 MB. Confira se é o arquivo certo." },
      { status: 413 },
    );
  }

  const previa = body.previa !== false;

  try {
    const linhas = mapearColunas(parseCSV(conteudo));
    if (linhas.length === 0) {
      return NextResponse.json(
        { error: "Não achei nenhuma linha com nome. Confira o cabeçalho do arquivo." },
        { status: 400 },
      );
    }

    const sb = await createServiceRoleClient();

    // Índice de chaves fortes já conhecidas.
    const { data: idents } = await sb
      .from("pessoa_identificadores")
      .select("pessoa_id,tipo,valor")
      .in("tipo", ["email", "telefone"])
      .range(0, 4999);

    const porEmail = new Map<string, string>();
    const porTelefone = new Map<string, string>();
    (idents ?? []).forEach((i) => {
      if (i.tipo === "email") porEmail.set(i.valor, i.pessoa_id);
      else porTelefone.set(i.valor, i.pessoa_id);
    });

    const { data: candExistentes } = await sb
      .from("seletivo_candidaturas")
      .select("id,email,telefone")
      .range(0, 4999);
    const candPorEmail = new Map<string, string>();
    const candPorTelefone = new Map<string, string>();
    (candExistentes ?? []).forEach((c) => {
      if (c.email) candPorEmail.set(c.email, c.id);
      if (c.telefone) candPorTelefone.set(c.telefone, c.id);
    });

    const plano = linhas.map((l) => {
      const pessoaId =
        (l.email ? porEmail.get(l.email) : undefined) ??
        (l.telefone ? porTelefone.get(l.telefone) : undefined) ??
        null;
      const vinculo: "email" | "telefone" | "nova" =
        pessoaId && l.email && porEmail.get(l.email) === pessoaId
          ? "email"
          : pessoaId
            ? "telefone"
            : "nova";
      const candId =
        (l.email ? candPorEmail.get(l.email) : undefined) ??
        (l.telefone ? candPorTelefone.get(l.telefone) : undefined) ??
        null;
      return { linha: l, pessoaId, vinculo, candId };
    });

    const resumo = {
      linhas: linhas.length,
      casamPorEmail: plano.filter((p) => p.vinculo === "email").length,
      casamPorTelefone: plano.filter((p) => p.vinculo === "telefone").length,
      pessoasNovas: plano.filter((p) => p.vinculo === "nova").length,
      jaImportados: plano.filter((p) => p.candId).length,
      semEmail: linhas.filter((l) => !l.email).length,
      semTelefone: linhas.filter((l) => !l.telefone).length,
    };

    if (previa) {
      return NextResponse.json({
        previa: true,
        resumo,
        amostra: plano.slice(0, 12).map((p) => ({
          nome: p.linha.nome,
          email: p.linha.email,
          vinculo: p.vinculo,
          jaImportado: !!p.candId,
          nota: p.linha.nota,
          status: p.linha.status,
        })),
      });
    }

    // ── Gravação ────────────────────────────────────────────
    let pessoasCriadas = 0;
    let tentativasNovas = 0;
    let tentativasRepetidas = 0;

    for (const p of plano) {
      const l = p.linha;
      let pessoaId = p.pessoaId;

      // Pessoa nova: cria e carimba as chaves fortes, para que a próxima
      // importação, o formulário de certificado e o Meet a encontrem.
      if (!pessoaId) {
        const { data: nova, error: errP } = await sb
          .from("pessoas")
          .insert({ nome_canonico: l.nome })
          .select("id")
          .single();
        if (errP || !nova) continue;
        pessoaId = nova.id;
        pessoasCriadas++;

        const chaves: { tipo: string; valor: string; original: string | null }[] = [];
        if (l.email) chaves.push({ tipo: "email", valor: l.email, original: l.emailOriginal });
        if (l.telefone) chaves.push({ tipo: "telefone", valor: l.telefone, original: l.telefoneOriginal });
        chaves.push({ tipo: "nome_digitado", valor: l.nomeNormalizado, original: l.nome });
        for (const c of chaves) {
          await sb.from("pessoa_identificadores").insert({
            pessoa_id: pessoaId,
            tipo: c.tipo,
            valor: c.valor,
            valor_original: c.original,
            origem: "avaliallos",
          });
        }
      }

      let candId = p.candId;
      if (candId) {
        await sb
          .from("seletivo_candidaturas")
          .update({ pessoa_id: pessoaId, atualizada_em: new Date().toISOString() })
          .eq("id", candId);
      } else {
        const { data: cand, error: errC } = await sb
          .from("seletivo_candidaturas")
          .insert({
            pessoa_id: pessoaId,
            nome: l.nome,
            email: l.email,
            telefone: l.telefone,
            faculdade: l.faculdade,
            periodo: l.periodo,
            vinculo: p.vinculo,
          })
          .select("id")
          .single();
        if (errC || !cand) continue;
        candId = cand.id;
      }

      const { error: errT } = await sb.from("seletivo_tentativas").insert({
        candidatura_id: candId,
        caso: l.caso,
        nota: l.nota,
        status: l.status,
        sessoes: l.sessoes,
        duracao_seg: l.duracaoSeg,
        criterios: l.criterios,
        avaliacao: l.avaliacao,
        realizada_em: l.realizadaEm,
        linha_chave: l.linhaChave,
      });
      if (errT) {
        // 23505 é a idempotência funcionando: esta tentativa já estava aqui.
        if (errT.code === "23505") tentativasRepetidas++;
      } else {
        tentativasNovas++;
      }
    }

    return NextResponse.json({
      ok: true,
      resumo: { ...resumo, pessoasCriadas, tentativasNovas, tentativasRepetidas },
    });
  } catch (err) {
    console.error("[admin/seletivo/importar]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erro ao importar" },
      { status: 500 },
    );
  }
}

export type { LinhaSeletivo };
