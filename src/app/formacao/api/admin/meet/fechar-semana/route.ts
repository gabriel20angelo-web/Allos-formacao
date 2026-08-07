// Fechar a semana à mão, pelo MESMO caminho que o cron usa.
//
// ⛔ Existia um segundo caminho, escrito dentro do calendário e rodando no
// navegador. Ele nomeava a semana de um jeito diferente do cron (segunda
// corrente contra segunda anterior), o que fazia o cron da semana seguinte
// encontrar o snapshot já criado, sair sem fazer nada, e a semana passar sem
// fechamento nenhum, com os status vazando para a semana nova. Ele ainda tinha
// bug de fuso, não rodava a marcação de status antes de congelar, não filtrava
// slots criados depois da semana e não registrava o reset no log.
//
// Duas verdades sobre a mesma coisa não é redundância, é divergência com o
// tempo. Aqui existe uma só.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { fecharSemanaSePreciso, semanaQueEstaFechando } from "@/lib/meet/status-slots";
import { dataLocal } from "@/lib/meet/nomes";

export const dynamic = "force-dynamic";

/** Qual semana o botão vai fechar, para a tela poder dizer isso ANTES de fechar. */
export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  const alvo = semanaQueEstaFechando(new Date());
  const sexta = new Date(alvo);
  sexta.setDate(alvo.getDate() + 4);

  const sb = await createServiceRoleClient();
  const { data: existente } = await sb
    .from("formacao_snapshots")
    .select("id, created_at, origem")
    .eq("semana_inicio", dataLocal(alvo))
    .maybeSingle();

  return NextResponse.json({
    semanaInicio: dataLocal(alvo),
    semanaFim: dataLocal(sexta),
    jaFechada: Boolean(existente),
    fechadaEm: existente?.created_at ?? null,
    origem: existente?.origem ?? null,
  });
}

export async function POST() {
  const auth = await exigirAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.erro }, { status: auth.status });

  const sb = await createServiceRoleClient();
  const r = await fecharSemanaSePreciso(sb, { forcar: true });
  // Não fechar não é erro: "já foi fechada" é resposta legítima e a tela precisa
  // saber a diferença entre isso e uma falha.
  return NextResponse.json(r, { status: 200 });
}
