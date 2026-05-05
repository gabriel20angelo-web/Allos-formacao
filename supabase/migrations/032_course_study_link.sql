-- ============================================================
-- Sprint 11 — Atalho publico por curso (grupo de estudo)
-- ============================================================
-- Cada curso pode ter um shortlink customizado (ex: /formacao/jung2026)
-- que redireciona pra uma URL externa (grupo de estudo, WhatsApp, etc).
-- Modelo do allos.org.br/painel, mas com destino livre por curso.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS study_link_slug TEXT,
  ADD COLUMN IF NOT EXISTS study_link_url TEXT,
  ADD COLUMN IF NOT EXISTS study_link_label TEXT,
  ADD COLUMN IF NOT EXISTS study_link_clicks INTEGER NOT NULL DEFAULT 0;

-- Slug formato a-z0-9-, comeca com letra/numero, ate 64 chars
ALTER TABLE courses DROP CONSTRAINT IF EXISTS study_link_slug_format;
ALTER TABLE courses ADD CONSTRAINT study_link_slug_format
  CHECK (study_link_slug IS NULL OR study_link_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$');

-- Slug unico quando preenchido (multiplos NULLs permitidos)
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_study_link_slug
  ON courses(study_link_slug)
  WHERE study_link_slug IS NOT NULL;

-- RPC: resolve shortlink + incrementa clicks atomicamente.
-- SECURITY DEFINER bypassa RLS de courses (precisa ler draft tambem).
CREATE OR REPLACE FUNCTION public.resolve_study_link(p_slug TEXT)
RETURNS TABLE(destination_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE courses
  SET study_link_clicks = COALESCE(study_link_clicks, 0) + 1
  WHERE study_link_slug = p_slug
    AND study_link_url IS NOT NULL
    AND study_link_url <> ''
  RETURNING study_link_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_study_link(TEXT) TO anon, authenticated;
