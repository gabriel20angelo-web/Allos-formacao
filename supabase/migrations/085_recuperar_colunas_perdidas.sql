-- 085_recuperar_colunas_perdidas.sql
-- As colunas que existem na planta e não existem no banco.
--
-- Em 05/08/2026 uma varredura conferiu, um por um, os 160 objetos declarados
-- nas migrations contra o banco de produção pela API REST. Dez colunas, vindas
-- de três migrations antigas, nunca chegaram lá. O efeito de cada ausência é
-- diferente, e vale registrar porque explica a ordem em que aparecem aqui.
--
-- A 050 é a que dói. A rota pública de verificação seleciona anulado,
-- anulado_em e anulado_motivo, e uma coluna inexistente derruba o select
-- inteiro: hoje TODA consulta de código responde 500. A cláusula 8.3 dos Termos
-- promete essa consulta a quem recebe o certificado, e a página está no ar
-- prometendo o que não entrega. O componente de anulação escrito para essas
-- colunas nunca teve como funcionar.
--
-- A 059 falha calada. A pasta raiz do Drive fica no cronograma e é lida em
-- pastas.ts e arquivar.ts; como a coluna não existe, a consulta volta vazia, a
-- raiz vira nula e a criação da pasta de uma sala nova desiste sem erro nenhum.
-- As salas de hoje já têm pasta gravada, então o problema só aparece na próxima
-- que for criada, que é o pior momento para descobrir.
--
-- A 032 não quebra nada, porque o atalho por curso nunca foi usado no código.
-- Entra junto porque a constraint, o índice único e a função resolve_study_link
-- dependem das quatro colunas, e planta que mente sobre o banco é dívida que
-- cobra juros no ambiente seguinte.
--
-- Tudo abaixo repete o conteúdo original das três migrations e é idempotente:
-- rodar de novo onde já foi aplicado não faz nada. Elas continuam no
-- repositório como registro do que se pretendeu e quando.

-- ── 050: anulação de certificado (Termos de Uso, 8.3 e 8.7) ──
-- Anular não apaga: o registro continua existindo para que a consulta pelo
-- código diga "existiu e foi anulado" em vez de "não existe". A diferença
-- importa para quem recebeu o documento e precisa saber que ele deixou de valer.

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS anulado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS anulado_em TIMESTAMPTZ;
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS anulado_motivo TEXT;
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS anulado_por UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_certificates_codigo
  ON certificates (certificate_code);

-- ── 059: pasta de destino das gravações ──
-- O ID é o que a API do Drive usa; a URL é o que a pessoa cola no campo. Por
-- isso os dois são guardados, e a leitura aceita qualquer um dos formatos.

ALTER TABLE formacao_cronograma
  ADD COLUMN IF NOT EXISTS pasta_drive_id TEXT;
ALTER TABLE formacao_cronograma
  ADD COLUMN IF NOT EXISTS pasta_drive_url TEXT;

-- ── 032: atalho público por curso ──

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS study_link_slug TEXT,
  ADD COLUMN IF NOT EXISTS study_link_url TEXT,
  ADD COLUMN IF NOT EXISTS study_link_label TEXT,
  ADD COLUMN IF NOT EXISTS study_link_clicks INTEGER NOT NULL DEFAULT 0;

ALTER TABLE courses DROP CONSTRAINT IF EXISTS study_link_slug_format;
ALTER TABLE courses ADD CONSTRAINT study_link_slug_format
  CHECK (study_link_slug IS NULL OR study_link_slug ~ '^[a-z0-9][a-z0-9-]{0,63}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_study_link_slug
  ON courses(study_link_slug)
  WHERE study_link_slug IS NOT NULL;

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
