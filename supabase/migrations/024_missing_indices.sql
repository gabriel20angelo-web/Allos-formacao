-- ============================================================
-- Indices faltando em FKs frequentemente filtradas
-- ============================================================
-- Sem esses indices, queries que filtram por lesson_id, user_id ou
-- instructor_id fazem scan completo. Em volume baixo passa, mas
-- planejando crescimento é bom adicionar.

CREATE INDEX IF NOT EXISTS idx_lesson_attachments_lesson_id
  ON lesson_attachments (lesson_id);

CREATE INDEX IF NOT EXISTS idx_admin_notes_user_id
  ON admin_notes (user_id);

CREATE INDEX IF NOT EXISTS idx_course_instructors_instructor_id
  ON course_instructors (instructor_id);
