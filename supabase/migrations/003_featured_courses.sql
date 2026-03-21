-- Cursos em destaque (visivel na pagina inicial)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured BOOLEAN DEFAULT false;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS featured_label TEXT;
