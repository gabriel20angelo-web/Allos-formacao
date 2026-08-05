// Registro dos certificados que não nascem de curso.
//
// A plataforma emite três documentos com o mesmo rosto. O de curso passa por
// issue-certificate, ganha código e pode ser conferido por quem recebe. O de
// formação e a declaração avulsa saíam do painel como PDF e não deixavam
// rastro: sem código, sem consulta pública, sem anulação possível. Quem recebia
// não tinha como provar autenticidade, e a Allos não tinha como desfazer.
//
// Esta rota é o registro que faltava, e é deliberadamente separada da de curso.
// O fluxo de curso já quebrou antes, tem validação de matrícula, de prova e de
// auditoria de carga horária, e nada disso se aplica aqui: quem decide que o
// documento é devido é o admin, olhando as horas na tela. Misturar os dois
// caminhos seria colocar em risco o que funciona para servir o que não existe.
//
// Três cuidados que moram no código abaixo:
//
// 1. O nome vai gravado. A maior parte de quem participa dos grupos não tem
//    conta na plataforma, então o titular não pode ser lido do perfil na hora
//    da verificação. O que a pessoa escreveu no formulário é o que se imprime e
//    é o que fica.
// 2. Emitir duas vezes o mesmo documento é erro, não recurso. Quem clica duas
//    vezes no botão espera o mesmo certificado, e não dois códigos válidos para
//    a mesma participação. Por isso a chave de idempotência.
// 3. Quem emitiu fica em detalhes. Meses depois, a pergunta que chega é de onde
//    saíram aquelas horas, e a resposta precisa estar no registro.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { generateCertificateCode } from "@/lib/utils/certificate";

export const dynamic = "force-dynamic";

const TIPOS = ["formacao", "avulso"] as const;
type TipoRegistravel = (typeof TIPOS)[number];

interface Corpo {
  tipo?: string;
  nome?: string;
  horas?: number | string | null;
  user_id?: string | null;
  email?: string | null;
  detalhes?: Record<string, unknown> | null;
  chave?: string | null;
}

export async function POST(req: NextRequest) {
  const admin = await exigirAdmin();
  if (!admin.ok) {
    return NextResponse.json({ error: admin.erro }, { status: admin.status });
  }

  let corpo: Corpo;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const tipo = corpo.tipo as TipoRegistravel;
  if (!TIPOS.includes(tipo)) {
    return NextResponse.json(
      { error: "tipo precisa ser formacao ou avulso" },
      { status: 400 }
    );
  }

  const nome = (corpo.nome || "").trim();
  if (!nome) {
    return NextResponse.json({ error: "nome obrigatório" }, { status: 400 });
  }

  // Horas chega como texto do input em uma das telas e como número na outra.
  // Vazio é legítimo: certificado de organização não declara carga horária.
  const horasCru =
    corpo.horas === null || corpo.horas === undefined || corpo.horas === ""
      ? null
      : Number(corpo.horas);
  const horas =
    horasCru !== null && Number.isFinite(horasCru) && horasCru >= 0
      ? horasCru
      : null;

  const sb = await createServiceRoleClient();

  // ── Idempotência ──
  // O botão de certificado individual vive numa lista, e clicar duas vezes na
  // mesma linha é o gesto mais natural do mundo quando o PDF demora a aparecer.
  // Sem esta consulta, a mesma participação sairia com dois códigos válidos, e
  // anular um deixaria o outro de pé.
  const chave = (corpo.chave || "").trim() || null;
  if (chave) {
    const { data: jaExiste } = await sb
      .from("certificates")
      .select("id, certificate_code, anulado")
      .eq("detalhes->>chave", chave)
      .maybeSingle();

    if (jaExiste) {
      return NextResponse.json({
        code: jaExiste.certificate_code,
        id: jaExiste.id,
        anulado: jaExiste.anulado ?? false,
        reaproveitado: true,
      });
    }
  }

  // ── Titular ──
  // Ligar à conta quando ela existe é o que faz o certificado aparecer no
  // histórico da pessoa. A busca é por igualdade exata do e-mail em minúsculas,
  // nunca por semelhança de nome: aproximar aqui funde duas pessoas num
  // documento oficial, que é o pior lugar possível para um palpite.
  let userId = corpo.user_id || null;
  const email = (corpo.email || "").trim().toLowerCase();
  if (!userId && email) {
    const { data: perfil } = await sb
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (perfil) userId = perfil.id;
  }

  const detalhes = {
    ...(corpo.detalhes || {}),
    ...(chave ? { chave } : {}),
    emitido_por: admin.userId,
    emitido_em: new Date().toISOString(),
    ...(email ? { email } : {}),
  };

  // Colisão de código é raríssima (36^8), mas o insert é a única barreira real:
  // a coluna é UNIQUE, então uma colisão vira erro de constraint e não registro
  // duplicado. Três tentativas resolvem qualquer azar plausível.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const code = generateCertificateCode();
    const { data, error } = await sb
      .from("certificates")
      .insert({
        user_id: userId,
        course_id: null,
        certificate_code: code,
        tipo,
        horas,
        nome_certificado: nome,
        detalhes,
        issued_at: new Date().toISOString(),
      })
      .select("id, certificate_code")
      .single();

    if (!error && data) {
      return NextResponse.json({
        code: data.certificate_code,
        id: data.id,
        reaproveitado: false,
      });
    }

    if (error && !error.message.toLowerCase().includes("unique")) {
      console.error("[certificado-registrar]", error);
      return NextResponse.json(
        { error: "Não foi possível registrar o certificado." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: "Não foi possível gerar um código único." },
    { status: 500 }
  );
}
