-- ============================================================
-- Sprint 12 — Atalhos publicos como entidade propria
-- ============================================================
-- Tabela `study_links` standalone, gerenciada em /formacao/admin/atalhos.
-- Substitui a abordagem da migration 032 (colunas em courses) que nao foi aplicada.
-- Idempotente: tudo IF NOT EXISTS / DROP IF EXISTS.

CREATE TABLE IF NOT EXISTS public.study_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL,
  destination_url TEXT NOT NULL,
  label TEXT,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT study_links_slug_format
    CHECK (slug ~ '^[a-z0-9][a-z0-9-]{0,63}$'),
  CONSTRAINT study_links_url_nonempty
    CHECK (length(destination_url) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_study_links_slug
  ON public.study_links (slug);

CREATE OR REPLACE FUNCTION public.touch_study_links_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_study_links_updated_at ON public.study_links;
CREATE TRIGGER trg_study_links_updated_at
  BEFORE UPDATE ON public.study_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_study_links_updated_at();

ALTER TABLE public.study_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS study_links_read_all ON public.study_links;
CREATE POLICY study_links_read_all ON public.study_links
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS study_links_write_admin ON public.study_links;
CREATE POLICY study_links_write_admin ON public.study_links
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'instructor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'instructor')
    )
  );

-- RPC: resolve shortlink + incrementa clicks atomicamente.
-- SECURITY DEFINER pra anon poder resolver mesmo com RLS.
CREATE OR REPLACE FUNCTION public.resolve_study_link(p_slug TEXT)
RETURNS TABLE(destination_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.study_links
  SET clicks = clicks + 1
  WHERE study_links.slug = p_slug
  RETURNING study_links.destination_url;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_study_link(TEXT) TO anon, authenticated;
GRANT SELECT ON public.study_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.study_links TO authenticated;

-- Limpeza preventiva: caso alguem tenha aplicado parcialmente a 032 antes,
-- remove colunas em courses pra nao confundir.
ALTER TABLE public.courses
  DROP CONSTRAINT IF EXISTS study_link_slug_format;

DROP INDEX IF EXISTS public.idx_courses_study_link_slug;

ALTER TABLE public.courses
  DROP COLUMN IF EXISTS study_link_slug,
  DROP COLUMN IF EXISTS study_link_url,
  DROP COLUMN IF EXISTS study_link_label,
  DROP COLUMN IF EXISTS study_link_clicks;
