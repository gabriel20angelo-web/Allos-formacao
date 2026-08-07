// Desmatricular alguém de um curso.
//
// A ação já existia, na tela de Alunos, e estava quebrada de três jeitos ao
// mesmo tempo. Medido em 06/08/2026:
//
// 1. A policy de `enrollments` compara `role = 'admin'` direto, e desde a 078 os
//    cargos são acumuláveis. Quem administra e também conduz um grupo era
//    barrado.
// 2. A aba de Alunos é liberada para instrutor, e o instrutor só tem SELECT. Um
//    DELETE barrado por RLS **não é erro**: apaga zero linhas e devolve
//    `error === null`. A tela testava `if (error)`, caía no caminho feliz, tirava
//    a linha e anunciava "Aluno desmatriculado com sucesso". Nada acontecia, e
//    ao recarregar o aluno voltava.
// 3. `FOR ALL USING (user_id = auth.uid())` inclui DELETE, então o próprio aluno
//    podia se desmatricular.
//
// Service role depois de `exigirAdmin` resolve os três de uma vez.
//
// ⛔ E o DELETE era temporário mesmo quando funcionava: os 38 cursos são
// gratuitos, e a tela de assistir rematricula sozinha quem abre um curso
// gratuito sem matrícula. Por isso aqui é `status = 'cancelled'`, valor que já
// existe no enum desde a 000 e nunca foi usado: a linha continua existindo, o
// insert automático não dispara, e `meus-cursos` já filtra por status.
//
// ⚠️ Desmatricular NÃO é anular certificado. A consulta pública de certificado
// olha só `certificates.anulado` e não sabe da matrícula, então o documento
// continua válido. Anular é outra ferramenta, e a rota avisa quando o caso
// aparece em vez de deixar o admin descobrir depois.

import { NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f-]{36}$/i;

export async function POST(req: Request) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { pessoa_id?: unknown; course_id?: unknown; acao?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "corpo inválido" }, { status: 400 });
  }

  const pessoaId = typeof body.pessoa_id === "string" ? body.pessoa_id : "";
  const cursoId = typeof body.course_id === "string" ? body.course_id : "";
  const acao = body.acao === "rematricular" ? "rematricular" : "cancelar";

  if (!UUID.test(pessoaId) || !UUID.test(cursoId)) {
    return NextResponse.json({ error: "identificador inválido" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // A ação fala a língua da 089: recebe `pessoa_id` e resolve a conta a partir
  // dela. Receber `user_id` da tela faria a ação depender de a tela saber a
  // ligação, que é justamente o que a 089 centralizou.
  const { data: ident } = await sb
    .from("pessoa_identificadores")
    .select("valor")
    .eq("pessoa_id", pessoaId)
    .eq("tipo", "profile_id")
    .maybeSingle();

  if (!ident?.valor) {
    return NextResponse.json(
      { error: "Esta pessoa não tem conta na plataforma, então não tem matrícula." },
      { status: 400 },
    );
  }
  const userId = ident.valor;

  const { data: matricula } = await sb
    .from("enrollments")
    .select("id,status")
    .eq("user_id", userId)
    .eq("course_id", cursoId)
    .maybeSingle();

  if (!matricula) {
    return NextResponse.json({ error: "Matrícula não encontrada." }, { status: 404 });
  }

  const novo = acao === "rematricular" ? "active" : "cancelled";
  const { error } = await sb
    .from("enrollments")
    .update({ status: novo })
    .eq("id", matricula.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // O certificado emitido continua valendo, e é preciso dizer isso. Sem este
  // aviso o admin acredita que desmatricular invalidou o documento.
  const { data: cert } = await sb
    .from("certificates")
    .select("certificate_code,anulado")
    .eq("user_id", userId)
    .eq("course_id", cursoId)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    status: novo,
    certificado:
      cert && !cert.anulado
        ? {
            codigo: cert.certificate_code,
            aviso:
              "Esta pessoa tem certificado emitido, e ele continua válido na consulta pública. Desmatricular não anula documento: para isso existe a anulação, em Certificados.",
          }
        : null,
  });
}
