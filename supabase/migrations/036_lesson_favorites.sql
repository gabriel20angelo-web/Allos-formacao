-- Lesson favorites: students can star lessons to revisit them later
CREATE TABLE IF NOT EXISTS lesson_favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE lesson_favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_favorites_select" ON lesson_favorites FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users_own_favorites_insert" ON lesson_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_favorites_delete" ON lesson_favorites FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_favorites_user ON lesson_favorites(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lesson_favorites_user_lesson ON lesson_favorites(user_id, lesson_id);
