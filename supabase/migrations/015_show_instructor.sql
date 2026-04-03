-- Add show_instructor toggle (default false = hidden)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS show_instructor BOOLEAN NOT NULL DEFAULT false;
