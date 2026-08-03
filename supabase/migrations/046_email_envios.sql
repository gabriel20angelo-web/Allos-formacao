-- 046_email_envios.sql
-- Histórico dos e-mails enviados pelo painel.
--
-- Guarda o corpo exato do que saiu, não um identificador de template: o texto
-- é montado a partir dos dados do dia do envio, então reconstruí-lo depois
-- daria outro resultado. Se alguém contestar o que recebeu, a prova é esta.
--
-- Também serve de trava contra reenvio acidental: a interface mostra quando o
-- último aviso foi mandado para aquela pessoa.

CREATE TABLE IF NOT EXISTS email_envios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  destinatario TEXT NOT NULL,
  tipo TEXT NOT NULL,
  assunto TEXT NOT NULL,
  corpo TEXT NOT NULL,
  enviado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_envios_destinatario
  ON email_envios (destinatario, created_at DESC);

ALTER TABLE email_envios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_envios_admin" ON email_envios;
CREATE POLICY "email_envios_admin" ON email_envios FOR SELECT
  USING (public.is_admin());
