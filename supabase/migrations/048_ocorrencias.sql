-- 048_ocorrencias.sql
-- Respostas de ocorrência enviadas pela página pública.
--
-- Quem recebe um aviso não responde o e-mail: responde por uma página do site.
-- Três motivos práticos: a resposta chega estruturada (nome, e-mail, contato)
-- em vez de espalhada numa thread; fica no painel junto do caso, e não na caixa
-- de entrada de alguém; e quem está com acesso bloqueado consegue se manifestar
-- sem precisar entrar na plataforma.
--
-- A página é pública e sem login por isso mesmo. Como qualquer formulário
-- aberto, tem honeypot e limite por IP na rota; aqui o que importa é que o
-- registro guarde de onde veio.

CREATE TABLE IF NOT EXISTS ocorrencia_respostas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  nome TEXT NOT NULL,
  whatsapp TEXT,
  relato TEXT NOT NULL,
  -- de onde a pessoa veio: aviso de atividade, bloqueio de acesso, certificado
  origem TEXT NOT NULL DEFAULT 'aviso'
    CHECK (origem IN ('aviso', 'bloqueio', 'certificado', 'outro')),
  status TEXT NOT NULL DEFAULT 'nova'
    CHECK (status IN ('nova', 'respondida', 'arquivada')),
  resposta TEXT,
  respondido_em TIMESTAMPTZ,
  respondido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- vínculo com a conta quando o e-mail bate com um cadastro
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ocorrencia_respostas_status
  ON ocorrencia_respostas (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ocorrencia_respostas_email
  ON ocorrencia_respostas (email, created_at DESC);

ALTER TABLE ocorrencia_respostas ENABLE ROW LEVEL SECURITY;

-- Só admin lê e responde. A inserção vem da rota pública, com service role:
-- sem policy de INSERT, ninguém escreve direto pelo client.
DROP POLICY IF EXISTS "ocorrencia_respostas_admin" ON ocorrencia_respostas;
CREATE POLICY "ocorrencia_respostas_admin" ON ocorrencia_respostas FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
