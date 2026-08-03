-- =============================================================
-- O condutor enxerga também os cortes que vieram das aulas
-- =============================================================
-- Um corte pode nascer por dois caminhos, e eles nunca preenchem as mesmas
-- colunas: o do encontro capturado guarda `encontro_id`, e o da aula do curso
-- guarda `lesson_id`. A permissão do condutor só olhava o primeiro, então os
-- cortes dos cursos ficavam invisíveis para ele — inclusive os do próprio
-- encontro dele, quando a gravação virou aula e foi enfileirada por ali.
--
-- A ponte entre os dois existe e é a fila de aulas sugeridas: ela guarda de
-- qual encontro nasceu cada aula.

CREATE OR REPLACE FUNCTION public.conduz_a_aula(p_lesson_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    -- A aula nasceu de uma gravação: o encontro dela diz de quem é.
    SELECT 1
      FROM formacao_meet_aulas_sugeridas s
     WHERE s.lesson_id = p_lesson_id
       AND public.conduz_o_encontro(s.encontro_id)
  ) OR EXISTS (
    -- Ou a aula é de um curso que está vinculado a uma sala dele. Cobre a aula
    -- cadastrada à mão, que não tem encontro de origem.
    SELECT 1
      FROM lessons l
      JOIN sections sec ON sec.id = l.section_id
      JOIN formacao_meet_spaces sp ON sp.curso_id = sec.course_id
      JOIN formacao_alocacoes a ON a.slot_id = sp.slot_id
      JOIN certificado_condutores c ON c.id = a.condutor_id
     WHERE l.id = p_lesson_id
       AND c.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.conduz_a_aula(UUID) TO authenticated;

DROP POLICY IF EXISTS condutor_le_seus_jobs ON formacao_clip_jobs;
CREATE POLICY condutor_le_seus_jobs ON formacao_clip_jobs
  FOR SELECT USING (
    (encontro_id IS NOT NULL AND public.conduz_o_encontro(encontro_id))
    OR (lesson_id IS NOT NULL AND public.conduz_a_aula(lesson_id))
  );

DROP POLICY IF EXISTS condutor_le_seus_clipes ON formacao_clips;
CREATE POLICY condutor_le_seus_clipes ON formacao_clips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formacao_clip_jobs j
       WHERE j.id = formacao_clips.job_id
         AND (
           (j.encontro_id IS NOT NULL AND public.conduz_o_encontro(j.encontro_id))
           OR (j.lesson_id IS NOT NULL AND public.conduz_a_aula(j.lesson_id))
         )
    )
  );

DROP POLICY IF EXISTS condutor_avalia_seus_clipes ON formacao_clips;
CREATE POLICY condutor_avalia_seus_clipes ON formacao_clips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM formacao_clip_jobs j
       WHERE j.id = formacao_clips.job_id
         AND (
           (j.encontro_id IS NOT NULL AND public.conduz_o_encontro(j.encontro_id))
           OR (j.lesson_id IS NOT NULL AND public.conduz_a_aula(j.lesson_id))
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM formacao_clip_jobs j
       WHERE j.id = formacao_clips.job_id
         AND (
           (j.encontro_id IS NOT NULL AND public.conduz_o_encontro(j.encontro_id))
           OR (j.lesson_id IS NOT NULL AND public.conduz_a_aula(j.lesson_id))
         )
    )
  );
