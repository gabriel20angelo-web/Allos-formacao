-- ============================================================
-- Sprint 8 — co-instrutores podem moderar comentários do próprio curso
-- ============================================================
-- Migration 027 cobriu apenas `c.instructor_id = auth.uid()` (lead
-- instructor). Cursos que têm co-instrutores cadastrados em
-- course_instructors ficavam sem permissão de delete.

DROP POLICY IF EXISTS "delete_lesson_comment_own_or_course_owner" ON lesson_comments;

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
        AND (
          c.instructor_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM course_instructors ci
            WHERE ci.course_id = c.id
              AND ci.instructor_id = auth.uid()
          )
        )
    )
  );
