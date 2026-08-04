// Quem esteve num encontro, para quem conduz.
//
// Rota separada da do administrador porque ela entrega mais do que quem conduz
// precisa. Vem sob demanda, ao abrir um encontro, e não junto da lista de
// salas — sessenta encontros de setenta e sete pessoas seriam quatro mil
// linhas para mostrar as trinta que alguém quer ver.
//
// O encontro precisava ser de uma sala do próprio vínculo; agora basta ser de
// uma sala ativa, que é o mesmo alcance da tela.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { identificarCondutor, salasDoCondutor } from "@/lib/condutor";

export const dynamic = "force-dynamic";

interface ParticipacaoRow {
  display_name: string;
  display_name_norm: string;
  aluno_id: string | null;
  minutos_presentes: number;
  permanencia_pct: number | null;
  atraso_min: number | null;
  minutos_fala: number | null;
  n_turnos_fala: number | null;
  n_sessoes: number;
  eh_condutor: boolean;
}

export async function GET(req: NextRequest) {
  const quem = await identificarCondutor();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  const encontroId = req.nextUrl.searchParams.get("encontro_id");
  if (!encontroId) {
    return NextResponse.json({ error: "encontro_id obrigatório" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  const { data: encontro } = await sb
    .from("formacao_meet_encontros")
    .select("id, space_name, atividade_nome, data_reuniao, duracao_min, vozes_ativas_pct")
    .eq("id", encontroId)
    .maybeSingle();

  if (!encontro) {
    return NextResponse.json({ error: "Encontro não encontrado." }, { status: 404 });
  }

  const salas = await salasDoCondutor(sb);
  if (!salas.includes((encontro as { space_name: string }).space_name)) {
    return NextResponse.json({ error: "Este encontro é de uma sala inativa." }, { status: 404 });
  }

  const { data: parts } = await sb
    .from("formacao_meet_participacoes")
    .select(
      "display_name, display_name_norm, aluno_id, minutos_presentes, permanencia_pct, atraso_min, minutos_fala, n_turnos_fala, n_sessoes, eh_condutor"
    )
    .eq("encontro_id", encontroId)
    .order("minutos_fala", { ascending: false, nullsFirst: false })
    .order("minutos_presentes", { ascending: false });

  const participacoes = (parts || []) as ParticipacaoRow[];

  const alunoIds = Array.from(
    new Set(participacoes.map((p) => p.aluno_id).filter(Boolean) as string[])
  );
  const norms = Array.from(new Set(participacoes.map((p) => p.display_name_norm)));

  const [{ data: perfis }, { data: aliases }] = await Promise.all([
    alunoIds.length
      ? sb.from("profiles").select("id, full_name, email").in("id", alunoIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string | null }[] }),
    // `*` porque os campos de identidade nascem na migration 083: pedi-los
    // pelo nome antes de ela rodar faz o PostgREST recusar a consulta inteira,
    // e a lista de presença some por causa de uma coluna que ainda não existe.
    norms.length
      ? sb.from("formacao_meet_aliases").select("*").in("display_name_norm", norms)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const perfilPorId = new Map(
    ((perfis || []) as { id: string; full_name: string; email: string | null }[]).map((p) => [p.id, p])
  );
  const aliasPorNorm = new Map(
    ((aliases || []) as {
      display_name_norm: string;
      pessoa_nome: string | null;
      pessoa_email: string | null;
      origem: string | null;
    }[]).map((a) => [a.display_name_norm, a])
  );

  const { data: cronograma } = await sb
    .from("formacao_cronograma")
    .select("tolerancia_atraso_min")
    .maybeSingle();

  return NextResponse.json({
    tolerancia: (cronograma as { tolerancia_atraso_min: number } | null)?.tolerancia_atraso_min ?? 7,
    encontro,
    participacoes: participacoes.map((p) => {
      const perfil = p.aluno_id ? perfilPorId.get(p.aluno_id) : null;
      const alias = aliasPorNorm.get(p.display_name_norm);
      return {
        ...p,
        identificada: !!(p.aluno_id || alias?.pessoa_email || alias?.pessoa_nome),
        pessoa_nome: perfil?.full_name || alias?.pessoa_nome || null,
        // O e-mail não sai daqui: quem conduz precisa saber quem é a pessoa,
        // não precisa da lista de contatos do grupo.
        tem_conta: !!p.aluno_id,
        origem_identidade: alias?.origem || (p.aluno_id ? "automatico" : null),
      };
    }),
  });
}
