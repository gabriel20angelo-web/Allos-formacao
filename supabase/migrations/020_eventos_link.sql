-- Add link field to events (YouTube, external URLs, etc.)
ALTER TABLE certificado_eventos ADD COLUMN IF NOT EXISTS link TEXT;
