// Prévia e envio do e-mail de atividade atípica.
//
// GET  → monta o e-mail e devolve para a prévia, sem enviar nada
// POST → monta de novo e envia
//
// Os sinais são recalculados aqui, a partir do banco, e nunca recebidos do
// navegador: um e-mail que acusa alguém não pode ter o conteúdo definido por
// quem abriu o DevTools. Como a montagem é a mesma nos dois verbos, o que a
// pessoa recebe é exatamente o que apareceu na prévia.

import { NextRequest, NextResponse } from "next/server";
import {
  createServerSupabaseClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { detectarSinais } from "@/lib/utils/suspeita";
import type { TimelineEvent } from "@/lib/utils/activity";
import {
  montarEmailSuspeita,
  type DadosPessoa,
  type NivelEmail,
} from "@/lib/email/templates/atividade-suspeita";
import { sendMail, workspaceConfigurado } from "@/lib/email/googleWorkspace";

export const dynamic = "force-dynamic";

/** Versão HTML de um texto editado à mão, preservando os parágrafos. */
function textoParaHtml(texto: string): string {
  const escapar = (t: string) =>
    t
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  const paragrafos = texto
    .split(/\n{2,}/)
    .map(
      (bloco) =>
        `<p style="margin:0 0 14px;font-size:14px;line-height:1.65;color:#2f2f2f">${escapar(
          bloco
        ).replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="pt-BR"><body style="margin:0;padding:24px;background:#f5f4f2;font-family:Georgia,'Times New Roman',serif">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #e6e2dc;border-radius:10px;padding:32px">
    <p style="margin:0 0 16px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#a33d27">Associação Allos</p>
    ${paragrafos}
  </div>
</body></html>`;
}

interface SupabaseLike {
  from: (t: string) => {
    select: (c: string, o?: unknown) => Record<string, unknown>;
  };
}

async function exigirAdmin() {
  const userClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return { erro: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) };

  const { data: perfil } = await userClient
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (perfil?.role !== "admin") {
    return { erro: NextResponse.json({ error: "Sem permissão" }, { status: 403 }) };
  }
  return { user };
}

/** Reconstrói a atividade da pessoa a partir do e-mail (a chave real dela). */
async function montar(email: string, nivel: NivelEmail) {
  const sb = (await createServiceRoleClient()) as unknown as SupabaseLike & {
    from: ReturnType<typeof createServiceRoleClient> extends Promise<infer T>
      ? T extends { from: infer F }
        ? F
        : never
      : never;
  };
  const db = sb as unknown as Awaited<ReturnType<typeof createServiceRoleClient>>;

  const { data: perfil } = await db
    .from("profiles")
    .select("id, full_name, email")
    .eq("email", email)
    .maybeSingle();

  const userId = perfil?.id as string | undefined;

  const [subsRes, enrollRes, lessonsRes, certsRes, usoRes, atividadesRes] =
    await Promise.all([
      db
        .from("certificado_submissions")
        .select("id, nome_completo, email, atividade_nome, created_at")
        .eq("email", email),
      userId
        ? db
            .from("enrollments")
            .select("id, enrolled_at, completed_at, status, course:courses!course_id(title)")
            .eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId
        ? db
            .from("lesson_progress")
            .select("id, completed_at, lesson:lessons!lesson_id(title, section:sections!section_id(course:courses!course_id(title)))")
            .eq("user_id", userId)
            .eq("completed", true)
            .not("completed_at", "is", null)
        : Promise.resolve({ data: [] }),
      userId
        ? db.from("certificates").select("id").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      userId
        ? db.from("usage_sessions").select("seconds").eq("user_id", userId)
        : Promise.resolve({ data: [] }),
      db.from("certificado_atividades").select("nome, carga_horaria"),
    ]);

  type Sub = {
    id: string;
    nome_completo: string | null;
    email: string | null;
    atividade_nome: string | null;
    created_at: string;
  };
  const subs = (subsRes.data ?? []) as Sub[];
  if (subs.length === 0 && !userId) return null;

  const horas = new Map<string, number>();
  ((atividadesRes.data ?? []) as { nome: string; carga_horaria: number }[]).forEach(
    (a) => horas.set(a.nome.toLowerCase(), a.carga_horaria)
  );

  const nome =
    (perfil?.full_name as string | undefined) ||
    subs
      .map((s) => (s.nome_completo || "").trim())
      .reduce((maior, n) => (n.length > maior.length ? n : maior), "") ||
    "Aluno";

  const eventos: TimelineEvent[] = [];

  subs.forEach((s) => {
    eventos.push({
      id: `sub-${s.id}`,
      type: "feedback",
      timestamp: s.created_at,
      person: (s.nome_completo || nome).trim(),
      personEmail: s.email || email,
      title: s.atividade_nome || "atividade",
    });
  });

  type Enroll = {
    id: string;
    enrolled_at: string;
    completed_at: string | null;
    status: string;
    course?: { title: string | null } | null;
  };
  const enrolls = (enrollRes.data ?? []) as unknown as Enroll[];
  enrolls.forEach((e) => {
    eventos.push({
      id: `enr-${e.id}`,
      type: "enrollment",
      timestamp: e.enrolled_at,
      person: nome,
      personEmail: email,
      title: e.course?.title || "Curso",
    });
    if (e.status === "completed" && e.completed_at) {
      eventos.push({
        id: `cmp-${e.id}`,
        type: "completion",
        timestamp: e.completed_at,
        person: nome,
        personEmail: email,
        title: e.course?.title || "Curso",
      });
    }
  });

  type Aula = {
    id: string;
    completed_at: string;
    lesson?: {
      title: string | null;
      section?: { course?: { title: string | null } | null } | null;
    } | null;
  };
  const aulas = (lessonsRes.data ?? []) as unknown as Aula[];
  aulas.forEach((l) => {
    eventos.push({
      id: `les-${l.id}`,
      type: "lesson",
      timestamp: l.completed_at,
      person: nome,
      personEmail: email,
      title: l.lesson?.title?.trim() || "aula",
      detail: l.lesson?.section?.course?.title || undefined,
    });
  });

  const sinais = detectarSinais(eventos);

  const aliases = Array.from(
    new Set(
      subs
        .map((s) => (s.nome_completo || "").trim())
        .filter((n) => n && n.toLowerCase() !== nome.toLowerCase())
    )
  );

  const dados: DadosPessoa = {
    nome,
    email,
    aliases,
    feedbacks: subs.length,
    horasSincronas: subs.reduce(
      (soma, s) => soma + (horas.get((s.atividade_nome || "").toLowerCase()) ?? 2),
      0
    ),
    cursosConcluidos: enrolls.filter((e) => e.status === "completed").length,
    certificados: ((certsRes.data ?? []) as { id: string }[]).length,
    aulasConcluidas: aulas.length,
    tempoUsoSegundos: ((usoRes.data ?? []) as { seconds: number }[]).reduce(
      (soma, s) => soma + (s.seconds ?? 0),
      0
    ),
  };

  return { dados, sinais, email: montarEmailSuspeita(dados, sinais, nivel) };
}

export async function GET(req: NextRequest) {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;

  const alvo = req.nextUrl.searchParams.get("email");
  const nivel = (req.nextUrl.searchParams.get("nivel") || "aviso") as NivelEmail;
  if (!alvo) {
    return NextResponse.json({ error: "email obrigatório" }, { status: 400 });
  }

  const montado = await montar(alvo, nivel);
  if (!montado) {
    return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
  }

  return NextResponse.json({
    configurado: workspaceConfigurado(),
    sinais: montado.sinais.length,
    assunto: montado.email.assunto,
    texto: montado.email.texto,
  });
}

export async function POST(req: NextRequest) {
  const guarda = await exigirAdmin();
  if (guarda.erro) return guarda.erro;

  let body: {
    email?: string;
    nivel?: NivelEmail;
    assunto?: string;
    texto?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const alvo = body.email;
  const nivel: NivelEmail = body.nivel === "notificacao" ? "notificacao" : "aviso";
  if (!alvo) {
    return NextResponse.json({ error: "email obrigatório" }, { status: 400 });
  }

  if (!workspaceConfigurado()) {
    return NextResponse.json(
      {
        error:
          "Envio de e-mail não configurado: faltam GOOGLE_SA_CLIENT_EMAIL, GOOGLE_SA_PRIVATE_KEY e GOOGLE_IMPERSONATED_USER.",
      },
      { status: 503 }
    );
  }

  const montado = await montar(alvo, nivel);
  if (!montado) {
    return NextResponse.json({ error: "Pessoa não encontrada" }, { status: 404 });
  }
  if (montado.sinais.length === 0) {
    return NextResponse.json(
      { error: "Sem sinais para relatar: nada a enviar." },
      { status: 400 }
    );
  }

  // O administrador pode ajustar o texto na prévia. Quando ajusta, o HTML é
  // regerado a partir do que ele escreveu: mandar o texto editado junto com o
  // HTML original faria as duas versões do e-mail dizerem coisas diferentes,
  // e o cliente de e-mail escolhe qual mostrar.
  const assuntoEditado = (body.assunto || "").trim();
  const textoEditado = (body.texto || "").trim();
  const foiEditado =
    (!!assuntoEditado && assuntoEditado !== montado.email.assunto) ||
    (!!textoEditado && textoEditado !== montado.email.texto);

  const assuntoFinal = assuntoEditado || montado.email.assunto;
  const textoFinal = textoEditado || montado.email.texto;
  const htmlFinal = foiEditado
    ? textoParaHtml(textoFinal)
    : montado.email.html;

  try {
    await sendMail({
      para: alvo,
      nomeDestinatario: montado.dados.nome,
      assunto: assuntoFinal,
      html: htmlFinal,
      texto: textoFinal,
    });
  } catch (err) {
    console.error("[email-suspeita]", err);
    return NextResponse.json(
      { error: "Falha no envio pelo Gmail. Verifique as credenciais." },
      { status: 502 }
    );
  }

  const db = await createServiceRoleClient();
  await db.from("email_envios").insert({
    destinatario: alvo,
    tipo: `atividade-suspeita:${nivel}${foiEditado ? ":editado" : ""}`,
    assunto: assuntoFinal,
    corpo: textoFinal,
    enviado_por: guarda.user?.id ?? null,
  });

  return NextResponse.json({ ok: true, sinais: montado.sinais.length });
}
