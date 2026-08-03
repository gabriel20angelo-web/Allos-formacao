// Os cortes por curso, para quem conduz.
//
// A outra rota entrega os cortes que nasceram de encontros capturados. Esta
// entrega os que nasceram de AULAS — que é como estão os cursos gravados antes
// de o sistema existir, e é a maior parte do acervo hoje.
//
// São dois caminhos porque o corte guarda ou `encontro_id` ou `lesson_id`,
// nunca os dois. Tentar unificar numa consulta só produziria um `or` que
// esconde a diferença e some com metade do resultado quando um dos lados
// estiver vazio.
//
// Sem `curso_id` do job: ele é congelado no momento do envio, então vincular a
// sala ao curso depois não conserta as linhas antigas. O caminho pela aula
// sempre reflete o presente.

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { temCargo } from "@/lib/cargos";

export const dynamic = "force-dynamic";

type Sb = Awaited<ReturnType<typeof createServiceRoleClient>>;

async function identificar() {
  const client = await createServerSupabaseClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await client
    .from("profiles")
    .select("role, cargos")
    .eq("id", user.id)
    .single();

  const sb = await createServiceRoleClient();
  const { data: ficha } = await sb
    .from("certificado_condutores")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  // Cargo, não papel principal: o administrador que também conduz carrega
  // "admin" na lista de extras, e sem isso perderia a lista completa de cursos.
  return { userId: user.id, ehAdmin: temCargo(perfil, "admin"), condutorId: ficha?.id || null };
}

/** Os cursos vinculados às salas desta pessoa. Admin sem ficha vê todos. */
async function cursosDele(sb: Sb, condutorId: string | null, ehAdmin: boolean): Promise<string[] | null> {
  if (ehAdmin && !condutorId) return null; // null = sem restrição

  if (!condutorId) return [];

  const { data: alocacoes } = await sb
    .from("formacao_alocacoes")
    .select("slot_id")
    .eq("condutor_id", condutorId);

  const slotIds = (alocacoes || []).map((a: { slot_id: string }) => a.slot_id);
  if (!slotIds.length) return [];

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("curso_id")
    .in("slot_id", slotIds)
    .not("curso_id", "is", null);

  return Array.from(
    new Set((spaces || []).map((s: { curso_id: string }) => s.curso_id))
  );
}

export async function GET(req: NextRequest) {
  const quem = await identificar();
  if (!quem) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const sb = await createServiceRoleClient();
  const permitidos = await cursosDele(sb, quem.condutorId, quem.ehAdmin);
  const cursoPedido = req.nextUrl.searchParams.get("curso_id");

  // ── sem curso escolhido: a lista de quais têm corte ──
  if (!cursoPedido) {
    let q = sb
      .from("formacao_clip_jobs")
      .select("curso_id, lesson_id")
      .not("curso_id", "is", null)
      .not("lesson_id", "is", null);

    if (permitidos) {
      if (!permitidos.length) return NextResponse.json({ cursos: [] });
      q = q.in("curso_id", permitidos);
    }

    const { data: jobs } = await q;
    const contagem = new Map<string, number>();
    for (const j of (jobs || []) as { curso_id: string }[]) {
      contagem.set(j.curso_id, (contagem.get(j.curso_id) || 0) + 1);
    }

    const ids = Array.from(contagem.keys());
    if (!ids.length) return NextResponse.json({ cursos: [] });

    const { data: cursos } = await sb
      .from("courses")
      .select("id, title, slug")
      .in("id", ids)
      .order("title", { ascending: true });

    return NextResponse.json({
      cursos: (cursos || []).map((c: { id: string }) => ({
        ...c,
        videos: contagem.get(c.id) || 0,
      })),
    });
  }

  // ── curso escolhido: os cortes, agrupados por aula ──
  if (permitidos && !permitidos.includes(cursoPedido)) {
    return NextResponse.json({ error: "Este curso não é seu." }, { status: 403 });
  }

  const { data: curso } = await sb
    .from("courses")
    .select("id, title")
    .eq("id", cursoPedido)
    .maybeSingle();

  if (!curso) return NextResponse.json({ error: "Curso não encontrado" }, { status: 404 });

  const { data: jobs } = await sb
    .from("formacao_clip_jobs")
    .select("id, lesson_id, titulo, status")
    .eq("curso_id", cursoPedido)
    .not("lesson_id", "is", null);

  if (!jobs?.length) {
    return NextResponse.json({ curso: curso.title, encontros: [] });
  }

  const lessonIds = (jobs as { lesson_id: string }[]).map((j) => j.lesson_id);

  // A ordem certa é a da seção e depois a da aula: `position` é relativo à
  // seção, então ordenar só por ele intercala aulas de seções diferentes.
  const { data: aulas } = await sb
    .from("lessons")
    .select("id, title, position, section_id, sections(position)")
    .in("id", lessonIds);

  const ordemDaAula = new Map(
    ((aulas || []) as unknown as {
      id: string;
      title: string;
      position: number;
      sections: { position: number } | null;
    }[]).map((a) => [a.id, { titulo: a.title, ordem: (a.sections?.position ?? 0) * 1000 + a.position }])
  );

  const jobIds = (jobs as { id: string }[]).map((j) => j.id);

  const { data: clipes } = await sb
    .from("formacao_clips")
    .select(
      "id, job_id, titulo, descricao, hashtags, url, preview_url, thumbnail_url, duracao_seg, pontuacao, avaliacao, anotacao"
    )
    .in("job_id", jobIds)
    .eq("oculto", false)
    .order("pontuacao", { ascending: false });

  const porJob = new Map<string, unknown[]>();
  for (const c of (clipes || []) as { job_id: string }[]) {
    porJob.set(c.job_id, [...(porJob.get(c.job_id) || []), c]);
  }

  const encontros = (jobs as { id: string; lesson_id: string; titulo: string; status: string }[])
    .map((j) => {
      const info = ordemDaAula.get(j.lesson_id);
      return {
        job_id: j.id,
        lesson_id: j.lesson_id,
        // O título da aula é o que a pessoa reconhece; o do job carrega o nome
        // do curso repetido na frente.
        titulo: info?.titulo || j.titulo,
        ordem: info?.ordem ?? 0,
        status: j.status,
        clipes: porJob.get(j.id) || [],
      };
    })
    .sort((a, b) => a.ordem - b.ordem);

  return NextResponse.json({ curso: curso.title, encontros });
}
