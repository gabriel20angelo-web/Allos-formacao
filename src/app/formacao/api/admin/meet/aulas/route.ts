// Fila de gravações esperando virar aula.
//
// GET lista o que está pendente. POST decide: aprovar cria a aula de verdade no
// curso e libera o vídeo para quem tiver o link; descartar só fecha o item.
//
// A liberação do vídeo acontece SÓ aqui, no clique de uma pessoa, nunca na
// captura automática: a partir dela, quem tiver o endereço assiste, e isso é
// decisão de gente, não de rotina.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { extrairIdDaPasta, liberarPorLink } from "@/lib/meet/drive";
import { detectVideoSource } from "@/lib/utils/video";

export const dynamic = "force-dynamic";

interface Sugestao {
  id: string;
  curso_id: string;
  secao_id: string | null;
  titulo: string;
  video_url: string;
  duracao_min: number | null;
  data_reuniao: string;
}

export async function GET() {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const sb = await createServiceRoleClient();

  const { data: fila } = await sb
    .from("formacao_meet_aulas_sugeridas")
    .select("*")
    .eq("status", "pendente")
    .order("data_reuniao", { ascending: false })
    .limit(50);

  // As publicadas também voltam, com link para o curso. Sem isso, aprovar faz o
  // item sumir da tela e ninguém sabe para onde ele foi: o curso é outro lugar,
  // e a aula pode estar numa seção que a pessoa não pensou em abrir.
  const { data: publicadas } = await sb
    .from("formacao_meet_aulas_sugeridas")
    .select("*")
    .eq("status", "aprovada")
    .order("decidido_em", { ascending: false })
    .limit(10);

  const cursoIds = Array.from(
    new Set(
      [...(fila || []), ...(publicadas || [])].map((f: { curso_id: string }) => f.curso_id)
    )
  );
  const { data: cursos } = cursoIds.length
    ? await sb.from("courses").select("id, title, slug, status").in("id", cursoIds)
    : { data: [] };

  const porCurso = new Map(
    (cursos || []).map((c: { id: string; title: string; slug: string; status: string }) => [
      c.id,
      c,
    ])
  );

  const enriquecer = (f: Sugestao & { curso_id: string }) => {
    const curso = porCurso.get(f.curso_id);
    return {
      ...f,
      curso_titulo: curso?.title || "curso removido",
      curso_slug: curso?.slug || null,
      // Curso em rascunho não aparece para o aluno por mais publicada que a
      // aula esteja, e isso precisa estar escrito na tela.
      curso_publicado: curso?.status === "published",
    };
  };

  return NextResponse.json({
    fila: (fila || []).map(enriquecer),
    publicadas: (publicadas || []).map(enriquecer),
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: { id?: string; acao?: "aprovar" | "descartar"; titulo?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  if (!body.id || !body.acao) {
    return NextResponse.json({ error: "id e acao obrigatórios" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  const { data: sug } = await sb
    .from("formacao_meet_aulas_sugeridas")
    .select("*")
    .eq("id", body.id)
    .maybeSingle();

  if (!sug) return NextResponse.json({ error: "Sugestão não encontrada" }, { status: 404 });
  if (sug.status !== "pendente") {
    return NextResponse.json({ error: "Esta sugestão já foi decidida." }, { status: 409 });
  }

  if (body.acao === "descartar") {
    await sb
      .from("formacao_meet_aulas_sugeridas")
      .update({
        status: "descartada",
        decidido_por: auth.userId,
        decidido_em: new Date().toISOString(),
      })
      .eq("id", body.id);
    return NextResponse.json({ ok: true, descartada: true });
  }

  const titulo = (body.titulo || sug.titulo).trim();
  if (!titulo) {
    return NextResponse.json({ error: "A aula precisa de um título." }, { status: 400 });
  }

  // A seção: a escolhida no vínculo, ou a última do curso. Sem seção não há
  // onde pendurar a aula, então criamos uma.
  let secaoId: string | null = sug.secao_id;
  if (!secaoId) {
    const { data: secoes } = await sb
      .from("sections")
      .select("id, position")
      .eq("course_id", sug.curso_id)
      .order("position", { ascending: false })
      .limit(1);

    if (secoes?.length) {
      secaoId = secoes[0].id;
    } else {
      const { data: nova } = await sb
        .from("sections")
        .insert({ course_id: sug.curso_id, title: "Encontros gravados", position: 0 })
        .select("id")
        .single();
      secaoId = nova?.id || null;
    }
  }

  if (!secaoId) {
    return NextResponse.json(
      { error: "Não consegui encontrar nem criar uma seção neste curso." },
      { status: 500 }
    );
  }

  // Vídeo no YouTube já é não listado e não precisa de nada: quem tem o link
  // assiste. Só o do Drive precisa ser liberado, e sem isso o aluno abre a aula
  // e vê "solicitar acesso" no lugar do vídeo.
  const fonte = detectVideoSource(sug.video_url);
  let avisoDrive: string | null = null;

  if (fonte === "google_drive") {
    const fileId = extrairIdDaPasta(sug.video_url);
    if (fileId) {
      try {
        await liberarPorLink(fileId);
      } catch (e) {
        avisoDrive =
          "A aula foi criada, mas não consegui liberar o vídeo no Drive. Abra o arquivo e compartilhe como 'qualquer pessoa com o link', senão o aluno não consegue assistir.";
        console.error("[meet/aulas] liberar", e);
      }
    }
  }

  const { data: ultima } = await sb
    .from("lessons")
    .select("position")
    .eq("section_id", secaoId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: aula, error: errAula } = await sb
    .from("lessons")
    .insert({
      section_id: secaoId,
      title: titulo,
      video_url: sug.video_url,
      // O player decide o embed por esta coluna, e a mesma função que o admin
      // usa ao cadastrar aula à mão decide aqui.
      video_source: fonte,
      duration_minutes: sug.duracao_min,
      position: (ultima?.position ?? -1) + 1,
    })
    .select("id")
    .single();

  if (errAula || !aula) {
    return NextResponse.json(
      { error: `Não consegui criar a aula: ${errAula?.message || "sem retorno"}` },
      { status: 500 }
    );
  }

  await sb
    .from("formacao_meet_aulas_sugeridas")
    .update({
      status: "aprovada",
      titulo,
      lesson_id: aula.id,
      decidido_por: auth.userId,
      decidido_em: new Date().toISOString(),
      erro: avisoDrive,
    })
    .eq("id", body.id);

  return NextResponse.json({ ok: true, lesson_id: aula.id, aviso: avisoDrive });
}
