// Manifestação de ocorrência vinda da página pública (tabela da migration 048).
//
// A rota é aberta de propósito: quem está com o acesso bloqueado não consegue
// entrar na plataforma para se explicar, e exigir sessão aqui fecharia a única
// porta que a pessoa tem. O preço de ser pública é o de sempre, e está todo
// nesta rota: honeypot, teto por e-mail em 24h e registro de ip/user-agent
// para quem for analisar depois.
//
// A escrita usa service role porque a tabela não tem policy de INSERT: nenhum
// client escreve direto nela, só este handler, depois de validar.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const ORIGENS = ["aviso", "bloqueio", "certificado", "outro"] as const;

const MIN_NOME = 3;
const MIN_RELATO = 20;
const LIMITE_RELATO = 6000;
const LIMITE_USER_AGENT = 500;
const MAX_POR_EMAIL_24H = 3;

// Regex propositalmente frouxa: pega erro de digitação óbvio sem recusar
// endereço válido e incomum. Quem confirma de verdade é a resposta que a
// pessoa recebe nesse e-mail.
const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function ipDoCliente(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  // Primeiro da cadeia é o cliente; o resto são os proxies do caminho.
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip");
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }

  // Honeypot: campo escondido que só um preenchedor automático toca.
  // Responde 200 fingindo sucesso porque devolver erro ensinaria o bot qual
  // campo é a armadilha; assim ele vai embora achando que gravou.
  if (texto(body.website)) {
    return NextResponse.json({ ok: true });
  }

  const nome = texto(body.nome);
  const email = texto(body.email).toLowerCase();
  const relato = texto(body.relato);
  const origem = texto(body.origem) || "aviso";
  // Só dígitos: o campo é para ligar de volta, não para guardar a formatação
  // que a pessoa digitou.
  const whatsapp = texto(body.whatsapp).replace(/\D/g, "");

  if (nome.length < MIN_NOME) {
    return NextResponse.json(
      { error: "Informe seu nome completo." },
      { status: 400 }
    );
  }
  if (!RE_EMAIL.test(email) || email.length > 200) {
    return NextResponse.json(
      { error: "Informe um e-mail válido: a resposta vai para ele." },
      { status: 400 }
    );
  }
  if (relato.length < MIN_RELATO) {
    return NextResponse.json(
      { error: "Conte com um pouco mais de detalhe o que aconteceu." },
      { status: 400 }
    );
  }
  if (!(ORIGENS as readonly string[]).includes(origem)) {
    return NextResponse.json({ error: "Origem inválida." }, { status: 400 });
  }
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 15)) {
    return NextResponse.json(
      { error: "O WhatsApp informado não parece um número válido." },
      { status: 400 }
    );
  }

  const sb = await createServiceRoleClient();

  // Teto por e-mail, e não por IP: o caso é individual, e várias pessoas da
  // mesma instituição saem pelo mesmo IP. Três envios em 24h já cobrem quem
  // se lembrou de um detalhe depois, sem virar canal de spam.
  const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error: erroContagem } = await sb
    .from("ocorrencia_respostas")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", desde);

  if (erroContagem) {
    console.error("[ocorrencia] contagem", erroContagem);
    return NextResponse.json(
      { error: "Erro interno ao registrar. Tente novamente em instantes." },
      { status: 500 }
    );
  }

  if ((count ?? 0) >= MAX_POR_EMAIL_24H) {
    return NextResponse.json(
      {
        error:
          "Já recebemos suas manifestações de hoje e todas estão na fila de análise. Se precisar acrescentar algo, aguarde 24 horas ou responda o e-mail que enviarmos.",
      },
      { status: 429 }
    );
  }

  // Vincula ao cadastro quando o e-mail bate: é o que faz a manifestação cair
  // no dossiê da pessoa no painel em vez de ficar solta. Não achar o perfil não
  // é erro: pode ser um e-mail alternativo, e a análise humana resolve.
  let userId: string | null = null;
  const { data: perfis } = await sb
    .from("profiles")
    .select("id")
    // eq e não ilike: o Supabase Auth já grava o e-mail em minúsculas, e o
    // curinga "_" do LIKE casaria joao_silva@x.com com joaoXsilva@x.com,
    // vinculando a manifestação ao dossiê da pessoa errada.
    .eq("email", email)
    .limit(1);
  if (perfis && perfis.length > 0) userId = perfis[0].id as string;

  const { error: erroInsert } = await sb.from("ocorrencia_respostas").insert({
    nome,
    email,
    whatsapp: whatsapp || null,
    relato: relato.slice(0, LIMITE_RELATO),
    origem,
    user_id: userId,
    ip: ipDoCliente(req),
    user_agent: (req.headers.get("user-agent") || "").slice(
      0,
      LIMITE_USER_AGENT
    ),
  });

  if (erroInsert) {
    console.error("[ocorrencia] insert", erroInsert);
    return NextResponse.json(
      { error: "Erro interno ao registrar. Tente novamente em instantes." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
