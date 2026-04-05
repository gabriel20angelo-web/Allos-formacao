-- Fix: add WITH CHECK to instructor update policy
-- Without it, Postgres silently rejects updates even when USING passes
DROP POLICY IF EXISTS "Instructors can update own courses" ON courses;
CREATE POLICY "Instructors can update own courses" ON courses
  FOR UPDATE
  USING (instructor_id = auth.uid())
  WITH CHECK (instructor_id = auth.uid());

-- Ensure featured and is_structured columns exist
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured_label TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_structured BOOLEAN DEFAULT false;
