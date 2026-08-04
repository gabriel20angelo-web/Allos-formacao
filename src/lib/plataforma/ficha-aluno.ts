// Tudo o que a plataforma sabe de quem tem conta.
//
// A ficha que abre ao clicar num nome nasceu olhando só para os encontros, e
// para quem tem conta isso é a menor parte da história: a mesma pessoa se
// matricula em curso, assiste aula, faz prova, tira certificado, avalia, manda
// dúvida e abre ocorrência. Ver a presença sem ver o resto é decidir sobre
// alguém com um terço do que se sabe dela.
//
// Fica em `plataforma/` e não em `meet/` de propósito: nada aqui é do módulo do
// Meet, e a ficha do Meet é só o primeiro lugar que pede.
//
// **As consultas usam `select("*")` de propósito.** Este banco tem migration
// escrita e não aplicada (`certificates.anulado` está na 050 e não existe em
// produção), e nomear uma coluna ausente não devolve campo nulo: devolve erro e
// derruba a consulta inteira. Com `*`, o que não existe chega indefinido e a
// tela mostra o resto.
//
// O que fica DE FORA, por decisão e não por esquecimento:
//   - `lesson_notes`, `admin_notes`, `aprimoramento_estados`: são material
//     privado da pessoa, e as próprias migrations dizem isso ("admin não
//     bisbilhota"). Ter service role não é motivo para ler.
//   - `formacao_meet_falas`: o texto do que foi dito em grupo clínico. A ficha
//     mostra quanto a pessoa falou, nunca o quê.

import type { SupabaseClient } from "@supabase/supabase-js";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Sb = SupabaseClient<any, "public", any>;

export interface CursoDaPessoa {
  curso_id: string;
  titulo: string;
  status: string | null;
  matriculado_em: string | null;
  concluido_em: string | null;
  aulas_total: number;
  aulas_concluidas: number;
  pct: number | null;
  minutos_uso: number;
  tem_certificado: boolean;
}

export interface FichaPlataforma {
  conta: {
    papel: string | null;
    cargos: string[];
    membro_desde: string | null;
    nome_no_certificado: string | null;
    bloqueado: boolean;
    bloqueado_motivo: string | null;
    bloqueado_em: string | null;
    termos_versao: string | null;
    termos_aceito_em: string | null;
  };
  uso: {
    minutos_totais: number;
    sessoes: number;
    dias_com_acesso: number;
    primeiro_acesso: string | null;
    ultimo_acesso: string | null;
  };
  cursos: CursoDaPessoa[];
  certificados: {
    curso: string;
    codigo: string | null;
    emitido_em: string | null;
  }[];
  verificacoes: {
    curso: string;
    status: string | null;
    motivo: string | null;
    created_at: string | null;
  }[];
  provas: {
    curso: string;
    tentativas: number;
    melhor_nota: number | null;
    passou: boolean;
    ultima_em: string | null;
  }[];
  horas_sincronas: {
    horas: number;
    encontros: number;
  };
  avaliacoes: {
    curso: string;
    nota: number | null;
    comentario: string | null;
    created_at: string | null;
  }[];
  participacao: {
    comentarios: number;
    duvidas: number;
    favoritos: number;
  };
  ocorrencias: {
    origem: string | null;
    status: string | null;
    relato: string | null;
    resposta: string | null;
    created_at: string | null;
  }[];
  bloqueios: {
    acao: string | null;
    motivo: string | null;
    created_at: string | null;
  }[];
}

/** Data local em YYYY-MM-DD, para contar dias com acesso sem virar o dia em UTC. */
function diaLocal(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

export async function fichaDaPlataforma(
  sb: Sb,
  alunoId: string,
  email: string | null
): Promise<FichaPlataforma> {
  const [
    perfilRes,
    termosRes,
    matriculasRes,
    progressoRes,
    usoRes,
    certsRes,
    verificacoesRes,
    provasRes,
    avaliacoesRes,
    comentariosRes,
    favoritosRes,
    bloqueiosRes,
  ] = await Promise.all([
    sb.from("profiles").select("*").eq("id", alunoId).maybeSingle(),
    sb
      .from("termos_aceites")
      .select("*")
      .eq("user_id", alunoId)
      .order("aceito_em", { ascending: false })
      .limit(1),
    sb
      .from("enrollments")
      .select("*, course:courses!course_id(id, title)")
      .eq("user_id", alunoId),
    sb
      .from("lesson_progress")
      .select("lesson_id, completed, completed_at")
      .eq("user_id", alunoId)
      .eq("completed", true)
      .limit(2000),
    sb.from("usage_sessions").select("*").eq("user_id", alunoId).limit(5000),
    sb.from("certificates").select("*, course:courses!course_id(title)").eq("user_id", alunoId),
    sb
      .from("certificate_reviews")
      .select("*, course:courses!course_id(title)")
      .eq("user_id", alunoId),
    sb
      .from("exam_attempts")
      .select("*, course:courses!course_id(title)")
      .eq("user_id", alunoId)
      .limit(200),
    sb.from("reviews").select("*, course:courses!course_id(title)").eq("user_id", alunoId),
    sb.from("lesson_comments").select("id").eq("user_id", alunoId).limit(500),
    sb.from("lesson_favorites").select("id").eq("user_id", alunoId).limit(500),
    sb
      .from("bloqueio_eventos")
      .select("*")
      .eq("user_id", alunoId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const perfil = (perfilRes.data || {}) as Record<string, unknown>;
  const termos = ((termosRes.data || []) as Record<string, unknown>[])[0];

  // ── cursos: matrícula, progresso e tempo ──
  const matriculas = (matriculasRes.data || []) as {
    course_id: string;
    status: string | null;
    enrolled_at: string | null;
    completed_at: string | null;
    course: { id: string; title: string } | null;
  }[];

  const cursoIds = matriculas.map((m) => m.course_id).filter(Boolean);

  // Aulas por curso, ignorando as seções extras: é o mesmo recorte que o painel
  // de alunos usa para o percentual, e misturar bônus com obrigatório faria
  // duas telas darem números diferentes para a mesma pessoa.
  const secoesRes = cursoIds.length
    ? await sb.from("sections").select("id, course_id, is_extra").in("course_id", cursoIds)
    : { data: [] as { id: string; course_id: string; is_extra: boolean }[] };

  const secoes = (secoesRes.data || []) as { id: string; course_id: string; is_extra: boolean }[];
  const secoesValidas = secoes.filter((s) => !s.is_extra);
  const cursoDaSecao = new Map(secoesValidas.map((s) => [s.id, s.course_id]));

  const { data: aulas } = secoesValidas.length
    ? await sb
        .from("lessons")
        .select("id, section_id")
        .in(
          "section_id",
          secoesValidas.map((s) => s.id)
        )
        .limit(5000)
    : { data: [] as { id: string; section_id: string }[] };

  const cursoDaAula = new Map<string, string>();
  const totalPorCurso = new Map<string, number>();
  for (const a of (aulas || []) as { id: string; section_id: string }[]) {
    const curso = cursoDaSecao.get(a.section_id);
    if (!curso) continue;
    cursoDaAula.set(a.id, curso);
    totalPorCurso.set(curso, (totalPorCurso.get(curso) || 0) + 1);
  }

  const concluidasPorCurso = new Map<string, number>();
  for (const p of (progressoRes.data || []) as { lesson_id: string }[]) {
    const curso = cursoDaAula.get(p.lesson_id);
    if (!curso) continue;
    concluidasPorCurso.set(curso, (concluidasPorCurso.get(curso) || 0) + 1);
  }

  // ── uso: permanência ativa (migration 042), agregada e nunca listada ──
  const sessoes = (usoRes.data || []) as {
    seconds: number | null;
    started_at: string | null;
    ended_at: string | null;
    course_id: string | null;
  }[];

  const segundosPorCurso = new Map<string, number>();
  const dias = new Set<string>();
  let segundosTotais = 0;
  let primeiro: string | null = null;
  let ultimo: string | null = null;

  for (const s of sessoes) {
    const seg = Math.max(0, Math.trunc(s.seconds ?? 0));
    segundosTotais += seg;
    if (s.course_id) {
      segundosPorCurso.set(s.course_id, (segundosPorCurso.get(s.course_id) || 0) + seg);
    }
    if (s.started_at) {
      if (!primeiro || s.started_at < primeiro) primeiro = s.started_at;
      const d = diaLocal(s.started_at);
      if (d) dias.add(d);
    }
    const fim = s.ended_at ?? s.started_at;
    if (fim && (!ultimo || fim > ultimo)) ultimo = fim;
  }

  const certificados = (certsRes.data || []) as {
    course_id: string;
    certificate_code: string | null;
    issued_at: string | null;
    course: { title: string } | null;
  }[];
  const cursosComCertificado = new Set(certificados.map((c) => c.course_id));

  const cursos: CursoDaPessoa[] = matriculas
    .map((m) => {
      const total = totalPorCurso.get(m.course_id) || 0;
      const feitas = concluidasPorCurso.get(m.course_id) || 0;
      return {
        curso_id: m.course_id,
        titulo: m.course?.title || "Curso removido",
        status: m.status,
        matriculado_em: m.enrolled_at,
        concluido_em: m.completed_at,
        aulas_total: total,
        aulas_concluidas: feitas,
        pct: total ? Math.round((feitas / total) * 100) : null,
        minutos_uso: Math.round((segundosPorCurso.get(m.course_id) || 0) / 60),
        tem_certificado: cursosComCertificado.has(m.course_id),
      };
    })
    .sort((a, b) => (b.matriculado_em || "").localeCompare(a.matriculado_em || ""));

  // ── provas: uma linha por curso, não por tentativa ──
  const tentativas = (provasRes.data || []) as {
    course_id: string;
    score: number | null;
    passed: boolean | null;
    attempted_at: string | null;
    course: { title: string } | null;
  }[];

  const provasPorCurso = new Map<
    string,
    { curso: string; tentativas: number; melhor_nota: number | null; passou: boolean; ultima_em: string | null }
  >();
  for (const t of tentativas) {
    const atual = provasPorCurso.get(t.course_id) || {
      curso: t.course?.title || "Curso removido",
      tentativas: 0,
      melhor_nota: null as number | null,
      passou: false,
      ultima_em: null as string | null,
    };
    atual.tentativas++;
    if (t.score !== null && (atual.melhor_nota === null || t.score > atual.melhor_nota)) {
      atual.melhor_nota = t.score;
    }
    if (t.passed) atual.passou = true;
    if (t.attempted_at && (!atual.ultima_em || t.attempted_at > atual.ultima_em)) {
      atual.ultima_em = t.attempted_at;
    }
    provasPorCurso.set(t.course_id, atual);
  }

  // ── horas síncronas, pelo e-mail ──
  //
  // A rota que o aluno vê soma por `ilike` no nome, e por isso "Ana Silva"
  // acumula as horas de "Ana Silva Santos". Aqui existe o e-mail, que é a
  // identidade de verdade, então a conta sai certa. As duas podem divergir, e a
  // divergente é a outra.
  let horasSincronas = { horas: 0, encontros: 0 };
  let duvidas = 0;
  let ocorrencias: FichaPlataforma["ocorrencias"] = [];

  if (email) {
    const [subsRes, atividadesRes, duvidasRes, ocorrenciasRes] = await Promise.all([
      sb.from("certificado_submissions").select("atividade_nome").ilike("email", email).limit(500),
      sb.from("certificado_atividades").select("nome, carga_horaria"),
      sb.from("video_questions").select("id").ilike("user_email", email).limit(200),
      sb
        .from("ocorrencia_respostas")
        .select("*")
        .ilike("email", email)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

    const carga = new Map<string, number>();
    for (const a of (atividadesRes.data || []) as { nome: string; carga_horaria: number }[]) {
      carga.set((a.nome || "").toLowerCase(), a.carga_horaria);
    }

    const subs = (subsRes.data || []) as { atividade_nome: string | null }[];
    horasSincronas = {
      // Duas horas quando a atividade não está no catálogo: é o mesmo fallback
      // da rota que o aluno vê, e mudar aqui faria dois números divergirem por
      // um motivo que ninguém consegue reconstruir depois.
      horas: subs.reduce((s, x) => s + (carga.get((x.atividade_nome || "").toLowerCase()) || 2), 0),
      encontros: subs.length,
    };
    duvidas = (duvidasRes.data || []).length;
    ocorrencias = ((ocorrenciasRes.data || []) as Record<string, unknown>[]).map((o) => ({
      origem: (o.origem as string) ?? null,
      status: (o.status as string) ?? null,
      relato: (o.relato as string) ?? null,
      resposta: (o.resposta as string) ?? null,
      created_at: (o.created_at as string) ?? null,
    }));
  }

  return {
    conta: {
      papel: (perfil.role as string) ?? null,
      cargos: ((perfil.cargos as string[]) || []).filter(Boolean),
      membro_desde: (perfil.created_at as string) ?? null,
      nome_no_certificado: (perfil.certificate_name as string) ?? null,
      bloqueado: !!perfil.bloqueado,
      bloqueado_motivo: (perfil.bloqueado_motivo as string) ?? null,
      bloqueado_em: (perfil.bloqueado_em as string) ?? null,
      termos_versao: (termos?.versao as string) ?? null,
      termos_aceito_em: (termos?.aceito_em as string) ?? null,
    },
    uso: {
      minutos_totais: Math.round(segundosTotais / 60),
      sessoes: sessoes.length,
      dias_com_acesso: dias.size,
      primeiro_acesso: primeiro,
      ultimo_acesso: ultimo,
    },
    cursos,
    certificados: certificados.map((c) => ({
      curso: c.course?.title || "Curso removido",
      codigo: c.certificate_code,
      emitido_em: c.issued_at,
    })),
    verificacoes: ((verificacoesRes.data || []) as Record<string, unknown>[]).map((v) => ({
      curso: ((v.course as { title?: string } | null)?.title) || "Curso removido",
      status: (v.status as string) ?? null,
      motivo: (v.motivo as string) ?? null,
      created_at: (v.created_at as string) ?? null,
    })),
    provas: Array.from(provasPorCurso.values()),
    horas_sincronas: horasSincronas,
    avaliacoes: ((avaliacoesRes.data || []) as Record<string, unknown>[]).map((a) => ({
      curso: ((a.course as { title?: string } | null)?.title) || "Curso removido",
      nota: (a.rating as number) ?? null,
      comentario: (a.comment as string) ?? null,
      created_at: (a.created_at as string) ?? null,
    })),
    participacao: {
      comentarios: (comentariosRes.data || []).length,
      duvidas,
      favoritos: (favoritosRes.data || []).length,
    },
    ocorrencias,
    bloqueios: ((bloqueiosRes.data || []) as Record<string, unknown>[]).map((b) => ({
      acao: (b.acao as string) ?? null,
      motivo: (b.motivo as string) ?? null,
      created_at: (b.created_at as string) ?? null,
    })),
  };
}
