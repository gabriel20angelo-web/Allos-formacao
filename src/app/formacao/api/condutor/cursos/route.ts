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
//
// O recorte por curso saiu. Ele filtrava pelos cursos vinculados às salas da
// pessoa (`formacao_meet_spaces.curso_id`), e nenhuma das seis salas tinha esse
// campo preenchido: a aba abria vazia para os nove condutores, com o texto
// "nenhum curso seu tem cortes ainda", que soava como "ainda não cortamos" e
// era na verdade "falta um vínculo que ninguém sabia que existia". Quem tem o
// cargo vê os cortes de todos os cursos.

import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { identificarCondutor } from "@/lib/condutor";
import { renovarEnderecos, type ClipeComEndereco } from "@/lib/meet/clipes-enderecos";
import { pedidosDeFormato } from "@/lib/meet/formato";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const quem = await identificarCondutor();
  if (!quem.ok) return NextResponse.json({ error: quem.erro }, { status: quem.status });

  const sb = await createServiceRoleClient();
  const cursoPedido = req.nextUrl.searchParams.get("curso_id");

  // ── sem curso escolhido: a lista de quais têm corte ──
  if (!cursoPedido) {
    const { data: jobs } = await sb
      .from("formacao_clip_jobs")
      .select("curso_id, lesson_id")
      .not("curso_id", "is", null)
      .not("lesson_id", "is", null);
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

    // A proporção pedida para os próximos cortes deste curso. Só o pedido: o
    // que já foi cortado guarda o formato dele no próprio job.
    const formatos = await pedidosDeFormato(sb, "curso", ids);

    return NextResponse.json({
      cursos: (cursos || []).map((c: { id: string }) => ({
        ...c,
        videos: contagem.get(c.id) || 0,
        formato: formatos.get(c.id) || null,
      })),
    });
  }

  // ── curso escolhido: os cortes, agrupados por aula ──
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
      "id, job_id, external_id, titulo, descricao, hashtags, url, preview_url, thumbnail_url, duracao_seg, pontuacao, avaliacao, anotacao"
    )
    .in("job_id", jobIds)
    .eq("oculto", false)
    .order("pontuacao", { ascending: false });

  // O endereço assinado dos arquivos vale 24 horas. Renovar na leitura é o que
  // impede que o condutor abra a curadoria e encontre só retângulos pretos.
  const { clipes: frescos } = await renovarEnderecos(
    sb,
    (clipes || []) as ClipeComEndereco[]
  );

  const porJob = new Map<string, unknown[]>();
  for (const c of frescos as { job_id: string }[]) {
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
