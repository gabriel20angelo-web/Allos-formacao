// Marcar e desmarcar uma pessoa na lista do painel.
//
// O gesto que esta rota serve é pequeno e frequente: o admin passa os olhos nas
// 511 pessoas, reconhece alguém que precisa de uma conversa (monitoria,
// condução, retomar contato) e marca com uma cor e uma frase. Por ser
// frequente, ele não pode custar um formulário nem uma confirmação: um POST
// grava tudo, um DELETE desfaz, e a tela nunca precisa saber se já existia
// linha para aquela pessoa.
//
// Daí o upsert em vez de INSERT ou UPDATE. A chave primária de
// `pessoa_destaques` é a própria `pessoa_id` (migration 092), então marcar duas
// vezes troca a cor em vez de criar uma segunda marca, e a tela pode mandar o
// mesmo POST tanto para criar quanto para editar.
//
// Service role depois do porteiro, pelo motivo de sempre neste diretório:
// `pessoa_destaques` guarda juízo administrativo sobre gente que na maioria dos
// casos nem tem conta, e a policy dela é `is_admin()`. Se `exigirAdmin` falhar,
// o service role vira porta aberta.

import { NextResponse, type NextRequest } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// A mesma paleta fechada do CHECK da 092. Repetida aqui de propósito: o banco
// recusaria uma cor inventada de qualquer jeito, mas o erro chegaria como uma
// violação de constraint em inglês, com 500 e sem dizer o que se esperava.
// Validar antes transforma isso num 400 que a tela consegue mostrar.
const CORES = ["dourado", "terracota", "teal", "roxo"] as const;

/** Teto da nota. Ver o comentário do POST sobre por que truncar em vez de recusar. */
const LIMITE_NOTA = 500;

// A `pessoa_id` é chave estrangeira, então um valor que não seja UUID volta do
// Postgres como erro de sintaxe (22P02) e viraria 500. Conferir o formato aqui
// separa "a tela mandou lixo" de "o banco está com problema", que são duas
// respostas diferentes para quem está olhando.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CorpoMarcar {
  pessoaId?: string;
  cor?: string;
  nota?: string;
}

/**
 * Marca uma pessoa, ou reescreve a marca que já existia.
 *
 * Corpo: { pessoaId, cor?, nota? }. Sem `cor` a linha nasce dourada, que é o
 * default da tabela e o caso mais comum: marcar primeiro, decidir o motivo
 * depois.
 */
export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: CorpoMarcar;
  try {
    body = (await req.json()) as CorpoMarcar;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const pessoaId = (body.pessoaId || "").trim();
  if (!pessoaId) {
    return NextResponse.json({ error: "pessoaId é obrigatório." }, { status: 400 });
  }
  if (!UUID_RE.test(pessoaId)) {
    return NextResponse.json(
      { error: "pessoaId precisa ser o UUID de uma pessoa." },
      { status: 400 },
    );
  }

  // Cor ausente cai no default da tabela; cor presente e desconhecida é erro,
  // porque escolher uma cor qualquer no lugar da pedida esconderia o bug da
  // tela e deixaria a lista com um motivo que ninguém quis registrar.
  const cor = body.cor?.trim();
  if (cor && !(CORES as readonly string[]).includes(cor)) {
    return NextResponse.json(
      { error: `Cor desconhecida. Use uma destas: ${CORES.join(", ")}.` },
      { status: 400 },
    );
  }

  // Nota longa é truncada, não recusada. O texto aqui é digitado de improviso
  // enquanto o admin olha a lista, e devolver 400 por excesso de caracteres
  // perderia a frase inteira por causa do fim dela. Quinhentos caracteres já
  // são mais do que qualquer lembrete precisa.
  const notaCrua = body.nota?.trim();
  const nota = notaCrua ? notaCrua.slice(0, LIMITE_NOTA) : null;

  const sb = await createServiceRoleClient();

  // `atualizada_em` só tem default na inserção, então o upsert precisa gravá-la
  // à mão: sem isso, reescrever a nota de um destaque antigo deixaria o
  // carimbo parado no dia em que ele foi criado.
  //
  // `marcada_por` vem do porteiro (`auth.userId`, o id do usuário da sessão),
  // nunca do corpo do request: assinatura que o cliente escolhe não é rastro.
  const registro: Record<string, unknown> = {
    pessoa_id: pessoaId,
    nota,
    marcada_por: auth.userId,
    atualizada_em: new Date().toISOString(),
  };
  // Só entra no upsert quando veio: mandar `cor: undefined` viraria null no
  // JSON e bateria no NOT NULL, e mandar 'dourado' apagaria a cor de quem já
  // estava marcado de terracota e só quis editar a nota.
  if (cor) registro.cor = cor;

  const { data, error } = await sb
    .from("pessoa_destaques")
    .upsert(registro, { onConflict: "pessoa_id" })
    .select("pessoa_id, cor, nota, marcada_por, criada_em, atualizada_em")
    .single();

  if (error) {
    console.error("[admin/pessoas/marcar] POST", error);
    return NextResponse.json(
      { error: `Não consegui salvar o destaque: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, destaque: data });
}

/**
 * Desmarca uma pessoa.
 *
 * Query: ?pessoaId=<uuid>. Responde ok mesmo quando não havia linha, porque
 * desmarcar o que já estava desmarcado não é erro: dois cliques seguidos, ou
 * duas abas do painel abertas, chegariam aqui com a segunda chamada sem nada
 * para apagar, e um 404 só faria a tela mostrar falha para um estado que é
 * exatamente o desejado.
 */
export async function DELETE(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const pessoaId = (req.nextUrl.searchParams.get("pessoaId") || "").trim();
  if (!pessoaId) {
    return NextResponse.json({ error: "pessoaId é obrigatório." }, { status: 400 });
  }
  if (!UUID_RE.test(pessoaId)) {
    return NextResponse.json(
      { error: "pessoaId precisa ser o UUID de uma pessoa." },
      { status: 400 },
    );
  }

  const sb = await createServiceRoleClient();

  const { error } = await sb.from("pessoa_destaques").delete().eq("pessoa_id", pessoaId);

  if (error) {
    console.error("[admin/pessoas/marcar] DELETE", error);
    return NextResponse.json(
      { error: `Não consegui remover o destaque: ${error.message}` },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
