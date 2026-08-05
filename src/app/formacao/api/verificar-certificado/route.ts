// Verificação pública de autenticidade de certificado (Termos de Uso, 8.3 e 8.7).
//
// A cláusula 8.3 promete que qualquer pessoa consegue conferir, pelo código, se
// o documento é autêntico, se está válido e se foi anulado. Esta rota é a única
// implementação dessa promessa, então ela é pública de propósito: quem verifica
// é o empregador, a instituição ou o órgão de classe, gente que não tem e nem
// deveria ter conta na plataforma.
//
// Ser pública define tudo o que vem abaixo:
//
// 1. Devolve o mínimo. Nome do titular, curso, data de emissão e situação. Nada
//    de e-mail, id de usuário, progresso ou histórico. Um verificador que vaza
//    dado pessoal é pior do que não ter verificador nenhum: transforma um código
//    de certificado, que circula em currículo e em anexo de e-mail, em chave de
//    consulta ao cadastro de quem estudou aqui.
// 2. Usa service role porque a consulta não tem sessão. A policy pública de
//    SELECT já existiria, mas o service role deixa o controle do que sai daqui
//    num lugar só: a lista de colunas do select abaixo.
// 3. Código inexistente responde 200 com situacao "nao_encontrado", não 404. O
//    404 do fetch se confunde com rota fora do ar; e o front trata os três
//    desfechos pelo mesmo caminho, sem ramificar entre status HTTP e corpo.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const LIMITE_CODIGO = 64;
const JANELA_MS = 60_000;
const MAX_POR_JANELA = 20;

// Rate limit em memória, por instância do processo.
//
// É defesa contra varredura de códigos, não contra ataque sério: quem quiser
// insistir troca de IP, e cada instância nova começa com o mapa vazio. O que
// isto impede é o caso real e barato, o script que enumera "ALLOS-2026-AAAAAAAA"
// em diante para descobrir nomes de titulares. Vinte consultas por minuto é
// folgado para gente conferindo certificado à mão e estreito para robô.
const consultas = new Map<string, { contagem: number; expiraEm: number }>();

function ipDoCliente(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  // Primeiro da cadeia é o cliente; o resto são os proxies do caminho.
  if (forwarded) return forwarded.split(",")[0].trim() || null;
  return req.headers.get("x-real-ip");
}

function excedeuLimite(ip: string | null): boolean {
  // Sem IP não dá para separar um visitante do outro, e um balde único puniria
  // todo mundo junto pelo excesso de um. Nesse caso o limite não se aplica.
  if (!ip) return false;

  const agora = Date.now();

  // Poda preguiçosa: sem isto o mapa cresceria com um registro por IP visto
  // desde que o processo subiu. forEach em vez de for...of porque o tsconfig
  // não fixa target e a iteração direta de Map exigiria downlevelIteration.
  if (consultas.size > 1000) {
    const vencidos: string[] = [];
    consultas.forEach((janela, chave) => {
      if (janela.expiraEm <= agora) vencidos.push(chave);
    });
    vencidos.forEach((chave) => consultas.delete(chave));
  }

  const janela = consultas.get(ip);
  if (!janela || janela.expiraEm <= agora) {
    consultas.set(ip, { contagem: 1, expiraEm: agora + JANELA_MS });
    return false;
  }
  janela.contagem += 1;
  return janela.contagem > MAX_POR_JANELA;
}

interface RegistroCertificado {
  certificate_code: string;
  issued_at: string;
  anulado: boolean | null;
  anulado_em: string | null;
  anulado_motivo: string | null;
  tipo: string | null;
  horas: number | null;
  nome_certificado: string | null;
  user: { full_name: string | null } | null;
  course: { title: string | null; certificate_hours: number | null } | null;
}

/**
 * O que o documento certifica, em uma linha, para quem está conferindo.
 *
 * O certificado de curso aponta para um curso e diz o título dele. Os outros
 * dois não têm curso por trás: o de formação atesta participação nas
 * atividades, e a declaração avulsa é escrita caso a caso. Devolver "Curso não
 * identificado" para esses dois, como acontecia quando o join vinha vazio,
 * faria a verificação parecer defeituosa justamente no documento legítimo.
 */
function objetoDoCertificado(r: RegistroCertificado): string {
  if (r.course?.title) return r.course.title;
  if (r.tipo === "formacao") return "Participação nas atividades da Formação Allos";
  if (r.tipo === "avulso") return "Declaração emitida pela Associação Allos";
  return "Curso não identificado";
}

/** Rótulo do tipo de documento, para o texto público não chamar tudo de curso. */
function rotuloDoTipo(tipo: string | null): string {
  if (tipo === "formacao") return "Certificado de participação (Formação)";
  if (tipo === "avulso") return "Declaração avulsa";
  return "Certificado de curso";
}

// Resposta sem cache em lugar nenhum: uma anulação precisa aparecer na consulta
// seguinte. Certificado anulado que continua saindo como válido por causa de um
// intermediário é exatamente o dano que a cláusula 8.7 tenta evitar.
function semCache(payload: unknown, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(req: NextRequest) {
  if (excedeuLimite(ipDoCliente(req))) {
    return semCache(
      {
        error:
          "Muitas consultas seguidas deste endereço. Aguarde um minuto e tente de novo.",
      },
      429
    );
  }

  // Normaliza antes de consultar: o código é gerado sempre em maiúsculas
  // (ALLOS-2026-XXXXXXXX), e quem digita copiando de um PDF traz espaço no fim
  // ou digita em minúsculas. Sem isto a busca exata falharia por formatação.
  const codigo = (req.nextUrl.searchParams.get("codigo") || "")
    .trim()
    .toUpperCase();

  if (!codigo) {
    return semCache({ error: "Informe o código do certificado." }, 400);
  }
  // Teto de tamanho: nenhum código legítimo chega perto disso, e recusar cedo
  // evita mandar string enorme para o banco a cada requisição.
  if (codigo.length > LIMITE_CODIGO) {
    return semCache({ error: "Código inválido." }, 400);
  }

  const sb = await createServiceRoleClient();

  // A lista de colunas é o contrato de privacidade desta rota. profiles traz só
  // full_name, nunca email nem id; courses traz título e carga horária. Ao mexer
  // aqui, lembre que tudo o que entrar no select pode acabar no corpo da
  // resposta pública.
  // nome_certificado entra na lista porque o titular de um certificado de
  // formação frequentemente não tem conta na plataforma: o nome que vale é o
  // que a própria pessoa escreveu no formulário, gravado no ato da emissão.
  const { data, error } = await sb
    .from("certificates")
    .select(
      "certificate_code, issued_at, anulado, anulado_em, anulado_motivo, tipo, horas, nome_certificado, user:profiles!user_id(full_name), course:courses!course_id(title, certificate_hours)"
    )
    .eq("certificate_code", codigo)
    .maybeSingle();

  if (error) {
    console.error("[verificar-certificado]", error);
    return semCache(
      { error: "Não foi possível consultar agora. Tente novamente em instantes." },
      500
    );
  }

  const registro = data as unknown as RegistroCertificado | null;

  if (!registro) {
    return semCache({ situacao: "nao_encontrado", codigo });
  }

  // A conta ligada vence o nome gravado quando existe, porque o perfil é
  // corrigido pela própria pessoa e o nome do formulário é uma foto do dia da
  // emissão.
  const titular =
    registro.user?.full_name ||
    registro.nome_certificado ||
    "Titular não identificado";
  const curso = objetoDoCertificado(registro);
  const tipo_documento = rotuloDoTipo(registro.tipo);

  if (registro.anulado) {
    // O certificado anulado devolve titular e curso para que quem consultou
    // saiba que está olhando o documento certo, mas não devolve a carga horária:
    // ela é justamente a declaração que deixou de valer. Repeti-la aqui daria
    // ao número uma sobrevida que a anulação existe para cortar.
    return semCache({
      situacao: "anulado",
      codigo: registro.certificate_code,
      titular,
      curso,
      tipo: registro.tipo || "curso",
      tipo_documento,
      emitido_em: registro.issued_at,
      anulado_em: registro.anulado_em,
      anulado_motivo: registro.anulado_motivo,
    });
  }

  return semCache({
    situacao: "valido",
    codigo: registro.certificate_code,
    titular,
    curso,
    tipo: registro.tipo || "curso",
    tipo_documento,
    // A carga horária do certificado de curso vive no curso; a dos outros dois
    // é decidida na emissão e fica no próprio registro.
    carga_horaria: registro.course?.certificate_hours ?? registro.horas ?? null,
    emitido_em: registro.issued_at,
  });
}
