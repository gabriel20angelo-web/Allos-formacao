-- 044_aceite_termos.sql
-- Registro de aceite dos Termos de Uso (cláusula 3).
--
-- O documento promete que "o aceite fica registrado com data, hora, endereço IP
-- e número da versão aceita" e que esse registro serve de prova para as duas
-- partes. Sem esta tabela a cláusula seria letra morta.
--
-- Uma linha por versão aceita: quando os termos mudarem para 1.1, o aceite
-- anterior continua valendo como prova do que foi aceito naquela data.

CREATE TABLE IF NOT EXISTS termos_aceites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  versao TEXT NOT NULL,
  documento TEXT NOT NULL DEFAULT 'termos-de-uso',
  ip TEXT,
  user_agent TEXT,
  aceito_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, documento, versao)
);

CREATE INDEX IF NOT EXISTS idx_termos_aceites_user
  ON termos_aceites (user_id, aceito_em DESC);

ALTER TABLE termos_aceites ENABLE ROW LEVEL SECURITY;

-- Cada um consulta o próprio aceite; admin consulta todos. A escrita é só da
-- rota que registra, com service role: ninguém forja um aceite pelo client.
DROP POLICY IF EXISTS "termos_aceites_own" ON termos_aceites;
CREATE POLICY "termos_aceites_own" ON termos_aceites FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "termos_aceites_admin" ON termos_aceites;
CREATE POLICY "termos_aceites_admin" ON termos_aceites FOR SELECT
  USING (public.is_admin());
