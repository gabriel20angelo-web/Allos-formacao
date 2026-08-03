// Baixar transcrição: de uma aula, de um curso inteiro, ou de tudo.
//
// Devolve arquivo, não JSON — é a primeira rota do projeto a fazer isso, e o
// motivo é o tamanho: a transcrição de um encontro passa de sessenta mil
// caracteres, e a de um curso passa de meio milhão. Isso não cabe num toast nem
// numa tela; é arquivo.
//
// Sem ZIP de propósito, apesar de "baixar o curso todo" sugerir vários
// arquivos. O projeto não tem biblioteca de compressão, e principalmente: o que
// se quer fazer com isso é escrever. Um documento contínuo, com cada encontro
// virando uma seção, já está costurado; sete arquivos soltos dariam trabalho
// para juntar de novo.

import { NextRequest, NextResponse } from "next/server";
import { exigirAdmin } from "@/lib/meet/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import {
  montarDocumento,
  nomeDeArquivo,
  transcricaoDaAula,
  transcricoesDoCurso,
} from "@/lib/meet/transcricao-busca";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Resposta que o navegador salva em vez de exibir. */
function arquivo(conteudo: string, nome: string, tipo = "text/markdown") {
  return new NextResponse(conteudo, {
    status: 200,
    headers: {
      "Content-Type": `${tipo}; charset=utf-8`,
      "Content-Disposition": `attachment; filename="${nome}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  const p = req.nextUrl.searchParams;
  const sb = await createServiceRoleClient();

  // ── uma aula ──
  const lessonId = p.get("lesson_id");
  if (lessonId) {
    const t = await transcricaoDaAula(sb, lessonId);
    if (!t) {
      return NextResponse.json(
        {
          error:
            "Esta aula não tem transcrição. Ela aparece depois que o vídeo passa pelo Meet com transcrição ligada, ou por um corte no OpusClip.",
        },
        { status: 404 }
      );
    }

    // A legenda crua serve para quem vai legendar vídeo, não para quem vai ler.
    if (p.get("formato") === "srt") {
      if (!t.srt) {
        return NextResponse.json(
          { error: "Esta transcrição não tem marcação de tempo, só texto." },
          { status: 404 }
        );
      }
      return arquivo(t.srt, nomeDeArquivo(t.titulo, "srt"), "application/x-subrip");
    }

    return arquivo(t.markdown, nomeDeArquivo(t.titulo, "md"));
  }

  // ── um curso ──
  const cursoId = p.get("curso_id");
  if (cursoId) {
    const { curso, itens, semTranscricao } = await transcricoesDoCurso(sb, cursoId);
    if (!itens.length) {
      return NextResponse.json(
        { error: `Nenhuma aula de "${curso}" tem transcrição ainda.` },
        { status: 404 }
      );
    }
    return arquivo(
      montarDocumento(curso, itens, semTranscricao),
      nomeDeArquivo(curso, "md")
    );
  }

  // ── tudo ──
  if (p.get("tudo")) {
    const { data: cursos } = await sb
      .from("courses")
      .select("id, title")
      .order("title", { ascending: true });

    const partes: string[] = [];
    let comTranscricao = 0;

    for (const c of (cursos || []) as { id: string; title: string }[]) {
      const { curso, itens, semTranscricao } = await transcricoesDoCurso(sb, c.id);
      if (!itens.length) continue;
      comTranscricao++;
      partes.push(montarDocumento(curso, itens, semTranscricao));
    }

    if (!comTranscricao) {
      return NextResponse.json({ error: "Nenhum curso tem transcrição ainda." }, { status: 404 });
    }

    return arquivo(partes.join("\n\n"), nomeDeArquivo("allos-transcricoes", "md"));
  }

  // ── sem parâmetro: o que existe, para a tela saber o que oferecer ──
  const inventarioDe = p.get("inventario_curso");
  if (inventarioDe) {
    const { itens, semTranscricao } = await transcricoesDoCurso(sb, inventarioDe);
    return NextResponse.json({
      com_transcricao: itens.map((i) => ({
        lesson_id: i.lessonId,
        titulo: i.titulo,
        origem: i.origem,
        falas: i.falas,
        caracteres: i.markdown.length,
      })),
      sem_transcricao: semTranscricao,
    });
  }

  return NextResponse.json(
    { error: "Informe lesson_id, curso_id, inventario_curso ou tudo=1." },
    { status: 400 }
  );
}
