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
import { montarUrl } from "@/lib/meet/aulas";
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

  // Gravações que existem e NÃO viraram sugestão, com o motivo. É o que faltava
  // para a tela parar de dizer "nada esperando" quando na verdade há uma
  // gravação bloqueada por falta de configuração: sem isto, o vazio é
  // indistinguível de "está tudo certo, não houve encontro".
  const { data: comGravacao } = await sb
    .from("formacao_meet_encontros")
    .select(
      "id, space_name, atividade_nome, data_reuniao, duracao_min, gravacao_uri, youtube_status, youtube_video_id, youtube_bytes_enviados, youtube_bytes_total, youtube_erro, youtube_tentativas"
    )
    .eq("descartado", false)
    // O que foi marcado para não virar aula sai da fila sem descartar o
    // encontro: a presença dele continua valendo.
    .eq("aula_ignorada", false)
    .not("gravacao_uri", "is", null)
    .order("data_reuniao", { ascending: false })
    .limit(30);

  const idsComSugestao = new Set(
    [...(fila || []), ...(publicadas || [])].map((s: { encontro_id: string }) => s.encontro_id)
  );

  const { data: spaces } = await sb
    .from("formacao_meet_spaces")
    .select("space_name, curso_id, rotulo, slot_id, subir_youtube");
  const spacePorNome = new Map(
    (spaces || []).map(
      (s: { space_name: string; curso_id: string | null; subir_youtube: boolean }) => [
        s.space_name,
        s,
      ]
    )
  );

  const bloqueadas = ((comGravacao || []) as {
    id: string;
    space_name: string;
    atividade_nome: string | null;
    data_reuniao: string;
    youtube_status: string | null;
    youtube_video_id: string | null;
    youtube_bytes_enviados: number | null;
    youtube_bytes_total: number | null;
    youtube_erro: string | null;
    youtube_tentativas: number | null;
  }[])
    .filter((e) => !idsComSugestao.has(e.id))
    .map((e) => {
      const space = spacePorNome.get(e.space_name);

      // Esperar o YouTube é o estado normal de uma gravação recém-terminada,
      // não uma falha. Precisa aparecer como espera, com o quanto já subiu, ou
      // a tela vira um alarme que se aprende a ignorar.
      const esperandoYoutube = !!space?.subir_youtube && !e.youtube_video_id;
      const pct =
        e.youtube_bytes_total && e.youtube_bytes_enviados
          ? Math.round((e.youtube_bytes_enviados / e.youtube_bytes_total) * 100)
          : 0;

      let motivo: string;
      if (!space) {
        motivo = "A sala deste encontro não existe mais no painel.";
      } else if (!space.curso_id) {
        motivo =
          "Este grupo não tem curso vinculado. Escolha o curso na aba Salas, em 'Gravações viram aulas de'.";
      } else if (esperandoYoutube) {
        motivo =
          e.youtube_status === "erro"
            ? `O envio ao YouTube falhou depois de ${e.youtube_tentativas || 0} tentativas: ${e.youtube_erro || "sem detalhe"}`
            : e.youtube_status === "enviando"
              ? `Subindo para o YouTube: ${pct}% enviado. A aula entra na fila quando terminar.`
              : "Esperando o envio ao YouTube começar. O agendador pega uma gravação a cada quinze minutos.";
      } else {
        motivo =
          "Motivo desconhecido: a gravação existe e o grupo tem curso, mas a sugestão não foi criada.";
      }

      return {
        id: e.id,
        titulo: e.atividade_nome || "Encontro",
        data_reuniao: e.data_reuniao,
        motivo,
        esperando_youtube: esperandoYoutube,
        youtube_status: e.youtube_status,
        youtube_pct: pct,
        curso_id: space?.curso_id || null,
      };
    });

  return NextResponse.json({
    fila: (fila || []).map(enriquecer),
    publicadas: (publicadas || []).map(enriquecer),
    bloqueadas,
  });
}

export async function POST(req: NextRequest) {
  const auth = await exigirAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.erro }, { status: auth.status });
  }

  let body: {
    id?: string;
    acao?: "aprovar" | "descartar" | "criar" | "ignorar";
    titulo?: string;
    encontro_id?: string;
    curso_id?: string;
    /** Publicar com o arquivo do Drive mesmo sem o vídeo no YouTube. */
    forcar_drive?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const sb = await createServiceRoleClient();

  // ── gravação bloqueada: virar aula agora, escolhendo o curso na hora ──
  // O caminho normal pega o curso da sala, e é por isso que a gravação de um
  // grupo sem curso vinculado empacava. Aqui o curso vem do clique, então
  // resolve o caso sem obrigar a ir configurar a sala primeiro.
  if (body.acao === "criar" && body.encontro_id) {
    if (!body.curso_id) {
      return NextResponse.json({ error: "Escolha o curso." }, { status: 400 });
    }

    const { data: e } = await sb
      .from("formacao_meet_encontros")
      .select(
        "id, space_name, atividade_nome, data_reuniao, duracao_min, gravacao_uri, youtube_video_id, youtube_status, youtube_bytes_enviados, youtube_bytes_total, inicio_efetivo_seg"
      )
      .eq("id", body.encontro_id)
      .maybeSingle();

    if (!e) return NextResponse.json({ error: "Encontro não encontrado" }, { status: 404 });
    if (!e.gravacao_uri) {
      return NextResponse.json({ error: "Este encontro não tem gravação." }, { status: 400 });
    }

    // Este era o caminho por onde o Drive entrava. Criar a aula na mão, com a
    // gravação recém-chegada, pegava o link do Drive porque o envio ao YouTube
    // ainda não tinha terminado; e depois de aprovada ninguém voltava lá. Agora
    // a espera é explícita, e furar a fila é um clique separado.
    const { data: space } = await sb
      .from("formacao_meet_spaces")
      .select("subir_youtube")
      .eq("space_name", e.space_name)
      .maybeSingle();

    if (space?.subir_youtube && !e.youtube_video_id && !body.forcar_drive) {
      const pct =
        e.youtube_bytes_total && e.youtube_bytes_enviados
          ? Math.round((e.youtube_bytes_enviados / e.youtube_bytes_total) * 100)
          : 0;
      return NextResponse.json(
        {
          error:
            e.youtube_status === "erro"
              ? "O envio desta gravação ao YouTube falhou. Resolva o envio, ou use 'publicar com o Drive' se quiser liberar assim mesmo."
              : `A gravação ainda está subindo para o YouTube (${pct}%). A aula do curso é o vídeo do YouTube, não o arquivo do Drive. Espere terminar, ou use 'publicar com o Drive' se tiver pressa.`,
          esperando_youtube: true,
          youtube_pct: pct,
        },
        { status: 409 }
      );
    }

    const dia = new Date(`${e.data_reuniao}T12:00:00`).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    });

    const { error } = await sb.from("formacao_meet_aulas_sugeridas").insert({
      encontro_id: e.id,
      curso_id: body.curso_id,
      titulo: body.titulo?.trim() || `${e.atividade_nome || "Encontro"} · ${dia}`,
      video_url: montarUrl(e.gravacao_uri, e.youtube_video_id, e.inicio_efetivo_seg),
      duracao_min: e.duracao_min || null,
      data_reuniao: e.data_reuniao,
    });

    if (error) {
      return NextResponse.json(
        {
          error: error.message.includes("duplicate")
            ? "Esta gravação já está na fila."
            : error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      ok: true,
      aviso: "Na fila de aprovação. Confira o título e publique.",
    });
  }

  // ── gravação que nunca vai virar aula ──
  if (body.acao === "ignorar" && body.encontro_id) {
    const { error } = await sb
      .from("formacao_meet_encontros")
      .update({ aula_ignorada: true })
      .eq("id", body.encontro_id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      aviso: "Fora da fila de aulas. O encontro continua contando para presença e quórum.",
    });
  }

  if (!body.id || !body.acao) {
    return NextResponse.json({ error: "id e acao obrigatórios" }, { status: 400 });
  }

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

  // O link é relido do encontro AGORA, e não confiado ao que a sugestão guardou.
  // Entre a fila carregar na tela e o clique em publicar pode ter terminado o
  // envio ao YouTube: em 04/08/2026 foram dezessete segundos, e a aula nasceu
  // apontando para o Drive com o vídeo já pronto do outro lado.
  let videoUrl: string = sug.video_url;

  const { data: enc } = await sb
    .from("formacao_meet_encontros")
    .select("space_name, gravacao_uri, youtube_video_id, youtube_status, inicio_efetivo_seg")
    .eq("id", sug.encontro_id)
    .maybeSingle();

  if (enc) {
    if (enc.youtube_video_id) {
      videoUrl = montarUrl(enc.gravacao_uri || videoUrl, enc.youtube_video_id, enc.inicio_efetivo_seg);
    } else if (!body.forcar_drive) {
      const { data: space } = await sb
        .from("formacao_meet_spaces")
        .select("subir_youtube")
        .eq("space_name", enc.space_name)
        .maybeSingle();

      if (space?.subir_youtube) {
        return NextResponse.json(
          {
            error:
              enc.youtube_status === "erro"
                ? "O envio desta gravação ao YouTube falhou. Resolva o envio, ou publique com o Drive se quiser liberar assim mesmo."
                : "A gravação ainda está subindo para o YouTube. A aula do curso é o vídeo do YouTube, não o arquivo do Drive. Espere terminar, ou publique com o Drive se tiver pressa.",
            esperando_youtube: true,
          },
          { status: 409 }
        );
      }
    }
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
  const fonte = detectVideoSource(videoUrl);
  let avisoDrive: string | null = null;

  if (fonte === "google_drive") {
    const fileId = extrairIdDaPasta(videoUrl);
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
      video_url: videoUrl,
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
      // Guarda o link de fato usado. É por ele que a rotina reconhece, depois,
      // se a aula continua com o que ela pôs lá ou se alguém trocou à mão.
      video_url: videoUrl,
      lesson_id: aula.id,
      decidido_por: auth.userId,
      decidido_em: new Date().toISOString(),
      erro: avisoDrive,
    })
    .eq("id", body.id);

  return NextResponse.json({ ok: true, lesson_id: aula.id, aviso: avisoDrive });
}
