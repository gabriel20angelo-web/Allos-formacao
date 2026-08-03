-- =============================================================
-- Atalhos: criar a tabela que nunca existiu, e ligá-la ao Meet
-- =============================================================
-- A tela de atalhos sempre respondeu "Erro ao carregar atalhos". A causa não
-- era permissão nem coluna errada: a tabela nunca foi criada. A migration 033
-- foi escrita e não foi aplicada, e o banco responde PGRST205 — "Could not find
-- the table 'public.study_links'". A tela engolia o erro e mostrava a frase
-- genérica, o que escondeu isso por meses.
--
-- A primeira metade daqui é a 033, inteira e idempotente, para que rodar esta
-- resolva o caso sem depender de arqueologia de qual migration faltou.
--
-- A segunda metade é o que o Gabriel pediu: o atalho passa a poder apontar para
-- uma SALA do Meet em vez de um endereço fixo. Quem divulga passa a divulgar
-- allos.org.br/formacao/<slug>, e o clique acontece no site antes de seguir
-- para a reunião. Quando o link da sala mudar, o atalho segue sozinho — não há
-- endereço copiado para atualizar em lugar nenhum.

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
    CHECK (destination_url IS NULL OR length(destination_url) > 0)
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

-- Leitura aberta é intencional aqui: um atalho é público por definição, e o que
-- ele guarda é um endereço que já vai ser divulgado. Nada pessoal mora nesta
-- tabela.
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

-- =============================================================
-- Ligação com a sala do Meet
-- =============================================================
-- Sem chave estrangeira de propósito: apagar uma sala não pode apagar o atalho
-- que já foi divulgado. O atalho fica sem destino e a tela mostra isso, que é
-- melhor que o endereço sumir da mão de quem já o tem.
ALTER TABLE public.study_links
  ADD COLUMN IF NOT EXISTS space_name TEXT;

COMMENT ON COLUMN public.study_links.space_name IS
  'Sala do Meet para onde este atalho leva. Quando preenchido, o destino é lido da sala a cada clique, então trocar o link da sala não exige mexer no atalho.';

-- Atalho ligado a uma sala não precisa de endereço próprio: ele vem da sala.
ALTER TABLE public.study_links ALTER COLUMN destination_url DROP NOT NULL;

ALTER TABLE public.study_links DROP CONSTRAINT IF EXISTS study_links_tem_destino;
ALTER TABLE public.study_links ADD CONSTRAINT study_links_tem_destino
  CHECK (destination_url IS NOT NULL OR space_name IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_study_links_space
  ON public.study_links (space_name) WHERE space_name IS NOT NULL;

-- =============================================================
-- Resolver: conta o clique e diz para onde ir
-- =============================================================
-- SECURITY DEFINER porque quem clica costuma não estar logado, e a contagem
-- precisa acontecer mesmo assim.
CREATE OR REPLACE FUNCTION public.resolve_study_link(p_slug TEXT)
RETURNS TABLE(destination_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_space TEXT;
  v_url   TEXT;
BEGIN
  -- Conta o clique primeiro: quem clicou clicou, mesmo que o destino esteja
  -- quebrado. Perder essa informação esconderia justamente o atalho com
  -- problema, que é o que mais interessa saber.
  UPDATE public.study_links sl
     SET clicks = sl.clicks + 1
   WHERE sl.slug = p_slug
  RETURNING sl.space_name, sl.destination_url
    INTO v_space, v_url;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Ligado a uma sala: o endereço vem da sala, sempre o de agora.
  IF v_space IS NOT NULL THEN
    SELECT s.meeting_uri
      INTO v_url
      FROM public.formacao_meet_spaces s
     WHERE s.space_name = v_space
       AND s.ativo = true;
  END IF;

  IF v_url IS NULL OR length(v_url) = 0 THEN
    RETURN;
  END IF;

  destination_url := v_url;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_study_link(TEXT) TO anon, authenticated;
GRANT SELECT ON public.study_links TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.study_links TO authenticated;

-- Sobra da 032, que também não foi aplicada. Sem efeito se as colunas não
-- existirem, e evita confusão se alguém tiver aplicado pela metade.
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS study_link_slug_format;
DROP INDEX IF EXISTS public.idx_courses_study_link_slug;
ALTER TABLE public.courses
  DROP COLUMN IF EXISTS study_link_slug,
  DROP COLUMN IF EXISTS study_link_url,
  DROP COLUMN IF EXISTS study_link_label,
  DROP COLUMN IF EXISTS study_link_clicks;
