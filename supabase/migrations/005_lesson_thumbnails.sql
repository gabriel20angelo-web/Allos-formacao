-- Thumbnail individual por aula
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Thumbnail padrão para aulas do curso (usado quando a aula não tem thumbnail própria)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS default_lesson_thumbnail_url TEXT;
