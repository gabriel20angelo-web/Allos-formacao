-- 050_certificado_anulacao.sql
-- Anulação de certificado e verificação pública (Termos de Uso, 8.3 e 8.7).
--
-- A cláusula 8.3 promete um verificador público que informa "se o documento é
-- autêntico, se está válido e se foi anulado". Sem estas colunas a terceira
-- pergunta não tem resposta, e a 8.7, que manda a anulação constar no
-- verificador, seria letra morta.
--
-- Anular não apaga o certificado: o registro tem que continuar existindo para
-- que a consulta pelo código diga "existiu e foi anulado" em vez de "não
-- existe". A diferença importa para quem recebeu o documento.

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

-- A consulta pública já era permitida pela policy "certificates_public_verify"
-- (migration 000). Ela continua valendo: quem tem o código vê o registro, e a
-- rota de verificação devolve só o necessário, sem expor e-mail nem histórico.
