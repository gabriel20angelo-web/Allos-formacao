-- 043_certificate_reviews.sql
-- Certificado retido para verificação (cláusulas 8.4 e 8.5 dos Termos de Uso).
--
-- Quando o tempo registrado na plataforma é incompatível com a carga horária
-- que o certificado declararia, a emissão para aqui em vez de sair automática.
-- O aluno explica, a administração responde. Os dois lados ficam registrados,
-- porque quem assina a declaração de carga horária é a Allos.
--
-- Ciclo do status:
--   retido    → travou na emissão, aluno ainda não se manifestou
--   explicado → aluno respondeu, esperando a administração
--   aprovado  → liberado; o certificado é emitido
--   recusado  → não emitido, com o motivo registrado

CREATE TABLE IF NOT EXISTS certificate_reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'retido'
    CHECK (status IN ('retido', 'explicado', 'aprovado', 'recusado')),
  -- números que motivaram a retenção, congelados no momento em que ela ocorreu
  motivo TEXT NOT NULL,
  segundos_registrados INTEGER NOT NULL DEFAULT 0,
  minutos_conteudo INTEGER NOT NULL DEFAULT 0,
  explicacao TEXT,
  explicado_em TIMESTAMPTZ,
  resposta TEXT,
  respondido_em TIMESTAMPTZ,
  respondido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_certificate_reviews_status
  ON certificate_reviews (status, created_at DESC);

ALTER TABLE certificate_reviews ENABLE ROW LEVEL SECURITY;

-- O aluno lê o próprio caso e pode escrever a explicação; nada além disso.
DROP POLICY IF EXISTS "cert_reviews_own_select" ON certificate_reviews;
CREATE POLICY "cert_reviews_own_select" ON certificate_reviews FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cert_reviews_admin" ON certificate_reviews;
CREATE POLICY "cert_reviews_admin" ON certificate_reviews FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
