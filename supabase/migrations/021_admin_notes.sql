-- Admin notes / reminders (not tied to lessons)
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_notes_select" ON admin_notes FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "admin_notes_insert" ON admin_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_notes_update" ON admin_notes FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "admin_notes_delete" ON admin_notes FOR DELETE
  USING (auth.uid() = user_id);
