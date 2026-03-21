-- Tipo de curso: async (gravado) ou sync (ao vivo + gravação)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_type TEXT NOT NULL DEFAULT 'async';

-- Garante que featured e featured_label existem (idempotente com 003)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured_label TEXT;

-- Index para queries de destaque na home
CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses (featured) WHERE featured = true;
