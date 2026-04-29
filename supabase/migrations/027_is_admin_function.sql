-- ============================================================
-- Sprint 7 — função is_admin() SECURITY DEFINER + policies sem recursão
-- ============================================================
-- Sprint 5 quebrou o site com policies que faziam EXISTS dentro da
-- própria tabela `profiles` (recursão silenciosa → 0 rows). A correção é
-- usar uma função SECURITY DEFINER, que roda com o role do criador
-- (postgres) e não dispara as policies da tabela.
--
-- Profiles continua com `Public profiles are viewable USING (true)`
-- intencionalmente (joins client-side `instructor:profiles!...` em 8+
-- arquivos dependem disso). Sprint 8 vai migrar esses joins pra view
-- `public_profiles` antes de fechar profiles.

-- Função pra checar se o user atual é admin, sem disparar RLS de profiles.
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- ── certificado_condutores: telefone só admin ──
DROP POLICY IF EXISTS "select_condutores_admin" ON certificado_condutores;
DROP POLICY IF EXISTS "select_condutores" ON certificado_condutores;
CREATE POLICY "select_condutores_admin" ON certificado_condutores
  FOR SELECT
  USING (public.is_admin());

-- View pública (id, nome, ativo) — extensão Chrome / forms usam essa.
CREATE OR REPLACE VIEW certificado_condutores_publica AS
  SELECT id, nome, ativo FROM certificado_condutores;
GRANT SELECT ON certificado_condutores_publica TO anon, authenticated;

-- ── lesson_comments DELETE: dono OR admin OR instructor do curso ──
DROP POLICY IF EXISTS "delete_lesson_comment_own_or_course_owner" ON lesson_comments;
DROP POLICY IF EXISTS "Users can delete own comments or moderators can delete any" ON lesson_comments;
CREATE POLICY "delete_lesson_comment_own_or_course_owner" ON lesson_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1
      FROM lessons l
      JOIN sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_comments.lesson_id
        AND c.instructor_id = auth.uid()
    )
  );

-- ── formacao_meet_presencas: INSERT/DELETE só admin ──
-- Endpoint /api/meet-presenca usa service_role (bypassa RLS); a extensão
-- Chrome chega via shared secret. Fechar a policy só fecha tentativas
-- via REST direto (anon key).
DROP POLICY IF EXISTS "insert_meet_presencas_admin" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "insert_meet_presencas" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "delete_meet_presencas_admin" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "delete_meet_presencas" ON formacao_meet_presencas;

CREATE POLICY "insert_meet_presencas_admin" ON formacao_meet_presencas
  FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "delete_meet_presencas_admin" ON formacao_meet_presencas
  FOR DELETE
  USING (public.is_admin());
