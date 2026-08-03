// Auditoria de carga horária antes de emitir certificado (cláusula 8.4/8.5 dos
// Termos de Uso).
//
// A regra é deliberadamente conservadora: só retém quando há prova de que a
// pessoa esteve pouco tempo, nunca por ausência de prova. Quem concluiu cursos
// antes de o rastreio existir não tem sessão registrada nenhuma, e reter esse
// caso seria acusar sem dado.

import type { SupabaseClient } from "@supabase/supabase-js";

/** Abaixo disto o tempo registrado é incompatível com a carga declarada. */
export const PROPORCAO_MINIMA = 0.4;

export interface ResultadoAuditoria {
  reter: boolean;
  motivo: string;
  segundosRegistrados: number;
  minutosConteudo: number;
  proporcao: number;
}

/**
 * @param sb cliente com service role (lê usage_sessions, que não tem policy
 *           de leitura para o próprio fluxo de emissão)
 */
export async function auditarCargaHoraria(
  sb: SupabaseClient,
  userId: string,
  courseId: string
): Promise<ResultadoAuditoria> {
  const vazio: ResultadoAuditoria = {
    reter: false,
    motivo: "",
    segundosRegistrados: 0,
    minutosConteudo: 0,
    proporcao: 1,
  };

  // Duração do conteúdo: o campo do curso quando existe, senão a soma das aulas.
  const { data: curso } = await sb
    .from("courses")
    .select("total_duration_minutes")
    .eq("id", courseId)
    .maybeSingle();

  let minutosConteudo = curso?.total_duration_minutes ?? 0;

  if (!minutosConteudo) {
    const { data: secoes } = await sb
      .from("sections")
      .select("id")
      .eq("course_id", courseId);
    const secaoIds = (secoes ?? []).map((s: { id: string }) => s.id);
    if (secaoIds.length > 0) {
      const { data: aulas } = await sb
        .from("lessons")
        .select("duration_minutes")
        .in("section_id", secaoIds);
      minutosConteudo = (aulas ?? []).reduce(
        (soma: number, a: { duration_minutes: number | null }) =>
          soma + (a.duration_minutes ?? 0),
        0
      );
    }
  }

  // Sem duração cadastrada não há régua: não dá para afirmar nada.
  if (!minutosConteudo) return vazio;

  // Tempo registrado nesta plataforma, deste usuário, em qualquer contexto.
  const { data: sessoesCurso } = await sb
    .from("usage_sessions")
    .select("seconds")
    .eq("user_id", userId)
    .eq("course_id", courseId);

  const segundosRegistrados = (sessoesCurso ?? []).reduce(
    (soma: number, s: { seconds: number }) => soma + (s.seconds ?? 0),
    0
  );

  // Nenhuma sessão em curso nenhum = a pessoa é anterior ao rastreio.
  // Emitir normalmente; a auditoria não alcança o que não foi medido.
  if (segundosRegistrados === 0) {
    const { count } = await sb
      .from("usage_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (!count) return vazio;
  }

  const proporcao = segundosRegistrados / (minutosConteudo * 60);
  if (proporcao >= PROPORCAO_MINIMA) {
    return {
      reter: false,
      motivo: "",
      segundosRegistrados,
      minutosConteudo,
      proporcao,
    };
  }

  const minutosRegistrados = Math.round(segundosRegistrados / 60);
  return {
    reter: true,
    motivo:
      `Tempo registrado na plataforma (${minutosRegistrados} min) muito abaixo ` +
      `da duração do conteúdo (${minutosConteudo} min): ` +
      `${Math.round(proporcao * 100)}% do esperado.`,
    segundosRegistrados,
    minutosConteudo,
    proporcao,
  };
}
