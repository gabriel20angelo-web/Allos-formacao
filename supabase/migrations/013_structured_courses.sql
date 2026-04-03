-- Add is_structured flag to differentiate structured courses from recorded sessions
ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_structured BOOLEAN DEFAULT false;
