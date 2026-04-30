-- ============================================================
-- Sprint 9 — Cursos "Ao vivo + Gravação" (sync) com encontros agendados
-- ============================================================
-- Adiciona campos de comunidade/professor em `courses` e tabela
-- `course_meetings` pra agendar encontros (gera "AO VIVO AGORA" quando
-- now() está dentro da janela starts_at..starts_at+duration).
--
-- Pensado pra cursos cujo encontro acontece fora da plataforma (Meet por
-- fora) e cuja gravação é publicada como lessons no acervo.

-- ── 1. Colunas em courses (todas nullable; só usadas se course_type='sync') ──
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS whatsapp_group_url TEXT,
  ADD COLUMN IF NOT EXISTS meet_url TEXT,
  ADD COLUMN IF NOT EXISTS instructor_bio TEXT,
  ADD COLUMN IF NOT EXISTS live_session_duration_minutes INTEGER DEFAULT 120;

-- ── 2. Tabela course_meetings ──
CREATE TABLE IF NOT EXISTS course_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  title TEXT,
  meet_url_override TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pras duas queries quentes:
--   a) "ao vivo agora" → WHERE now() BETWEEN starts_at AND starts_at + interval
--   b) "próximo encontro" → WHERE course_id = $1 AND starts_at > now() ORDER BY starts_at ASC
CREATE INDEX IF NOT EXISTS idx_course_meetings_starts_at
  ON course_meetings (starts_at);

CREATE INDEX IF NOT EXISTS idx_course_meetings_course_id_starts_at
  ON course_meetings (course_id, starts_at);

-- ── 3. RLS ──
ALTER TABLE course_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_course_meetings_public" ON course_meetings;
CREATE POLICY "select_course_meetings_public" ON course_meetings
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "insert_course_meetings_admin" ON course_meetings;
CREATE POLICY "insert_course_meetings_admin" ON course_meetings
  FOR INSERT
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "update_course_meetings_admin" ON course_meetings;
CREATE POLICY "update_course_meetings_admin" ON course_meetings
  FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "delete_course_meetings_admin" ON course_meetings;
CREATE POLICY "delete_course_meetings_admin" ON course_meetings
  FOR DELETE
  USING (public.is_admin());
