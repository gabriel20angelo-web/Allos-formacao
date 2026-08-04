// O vigia da captura.
//
// Existe por um motivo simples: quem parou não consegue reclamar de si mesmo.
// A rota do cron sabe avisar quando uma etapa quebra, mas se ela deixar de ser
// chamada (agendamento removido, serviço apagado, segredo trocado, aplicação
// fora do ar) nada dentro dela roda, e o silêncio é exatamente igual ao de uma
// noite tranquila.
//
// Então este endereço tem agendamento próprio, separado do outro, e faz uma
// coisa só: olha há quanto tempo a captura registrou a última rodada e manda
// e-mail se esse tempo passou do que a operação normal explica. É de propósito
// que ele não capture nada nem toque no Google: quanto menos ele faz, menos
// chance tem de morrer junto com o que vigia.
//
// Mesmo segredo do cron, porque é a mesma classe de chamador e não faz sentido
// gerenciar dois.

import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { avisarSeCapturaSumiu, avisarDeMentira } from "@/lib/avisos";

export const dynamic = "force-dynamic";

function segredoConfere(recebido: string | null): boolean {
  const esperado = process.env.MEET_CRON_SECRET;
  if (!esperado || !recebido) return false;
  const a = Buffer.from(recebido);
  const b = Buffer.from(esperado);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!segredoConfere(token)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  // `?teste=1` manda um e-mail de mentira e não olha nada. Serve para
  // conferir, a qualquer momento, que o canal do alarme continua de pé, em vez
  // de descobrir isso no dia em que a captura cair.
  if (req.nextUrl.searchParams.get("teste") === "1") {
    return NextResponse.json(await avisarDeMentira());
  }

  try {
    const sb = await createServiceRoleClient();
    const resultado = await avisarSeCapturaSumiu(sb as never);

    // 200 sempre que o vigia conseguiu olhar, inclusive quando o veredito é
    // ruim: o alarme é o e-mail, não o código de resposta. Quem chama só
    // precisa saber que o vigia está de pé.
    return NextResponse.json(resultado);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro interno" },
      { status: 500 }
    );
  }
}
