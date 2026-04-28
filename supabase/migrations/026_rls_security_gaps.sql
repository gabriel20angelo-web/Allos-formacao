-- ============================================================
-- Sprint 5 — Tapando RLS gaps de segurança/privacidade
-- ============================================================
-- 1) profiles.email não deve mais ser legível por anon (LGPD)
-- 2) certificado_condutores.telefone idem
-- 3) lesson_comments DELETE só pelo dono ou admin/instructor do curso
-- 4) formacao_meet_presencas INSERT/DELETE fechados (apenas admin via
--    service role — extensão chega via API com shared secret)

-- ── 1. Profiles: separar campos públicos vs privados ──
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
DROP POLICY IF EXISTS "select_profile_self_or_admin" ON profiles;

-- Anon e usuários comuns leem apenas dados não sensíveis.
-- Como Postgres RLS não filtra colunas, criamos uma view + policy de
-- SELECT só pra o próprio user e admins.
CREATE POLICY "select_profile_self_or_admin" ON profiles
  FOR SELECT
  USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- View pública sem email (joins client-side devem usar essa).
CREATE OR REPLACE VIEW public_profiles AS
  SELECT id, full_name, avatar_url, role, created_at FROM profiles;

GRANT SELECT ON public_profiles TO anon, authenticated;

-- ── 2. Condutores: telefone não público ──
DROP POLICY IF EXISTS "select_condutores" ON certificado_condutores;
DROP POLICY IF EXISTS "select_condutores_admin" ON certificado_condutores;
CREATE POLICY "select_condutores_admin" ON certificado_condutores
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- View pública só com nome (extensão Chrome / form usa essa).
CREATE OR REPLACE VIEW certificado_condutores_publica AS
  SELECT id, nome, ativo FROM certificado_condutores;

GRANT SELECT ON certificado_condutores_publica TO anon, authenticated;

-- ── 3. lesson_comments DELETE: dono OR admin OR instructor do curso ──
DROP POLICY IF EXISTS "Users can delete own comments or moderators can delete any" ON lesson_comments;
DROP POLICY IF EXISTS "delete_lesson_comment_own_or_course_owner" ON lesson_comments;
CREATE POLICY "delete_lesson_comment_own_or_course_owner" ON lesson_comments
  FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM lessons l
      JOIN sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      JOIN profiles p ON p.id = auth.uid()
      WHERE l.id = lesson_comments.lesson_id
        AND p.role = 'instructor'
        AND c.instructor_id = p.id
    )
  );

-- ── 4. formacao_meet_presencas: fechar INSERT/DELETE pra anon ──
-- A extensão Chrome usa endpoint /api/meet-presenca com MEET_PRESENCA_TOKEN.
-- O endpoint usa service_role, que bypassa RLS, então fechar policy não
-- afeta a extensão; mas bloqueia tentativas via REST direto da Supabase.
DROP POLICY IF EXISTS "insert_meet_presencas" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "insert_meet_presencas_admin" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "delete_meet_presencas" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "delete_meet_presencas_admin" ON formacao_meet_presencas;

CREATE POLICY "insert_meet_presencas_admin" ON formacao_meet_presencas
  FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

CREATE POLICY "delete_meet_presencas_admin" ON formacao_meet_presencas
  FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
