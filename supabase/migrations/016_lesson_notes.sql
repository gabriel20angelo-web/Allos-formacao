-- Lesson notes: one note per user per lesson
CREATE TABLE IF NOT EXISTS lesson_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, lesson_id)
);

ALTER TABLE lesson_notes ENABLE ROW LEVEL SECURITY;

-- Users can only see/edit their own notes
CREATE POLICY "users_own_notes_select" ON lesson_notes FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users_own_notes_insert" ON lesson_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_own_notes_update" ON lesson_notes FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "users_own_notes_delete" ON lesson_notes FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_lesson_notes_user_lesson ON lesson_notes(user_id, lesson_id);
