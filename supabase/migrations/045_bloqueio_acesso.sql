-- 045_bloqueio_acesso.sql
-- Bloqueio de acesso à plataforma (Termos de Uso, 10.1).
--
-- Mora em `profiles` e não numa tabela à parte porque o middleware precisa
-- dessa informação em toda navegação protegida: uma coluna no perfil que já é
-- consultado sai de graça, uma tabela nova custaria um join por requisição.
--
-- O motivo é obrigatório na prática (a rota exige) e fica gravado: bloquear
-- sem dizer por quê é o tipo de decisão que ninguém consegue defender depois.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bloqueado_em TIMESTAMPTZ;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bloqueado_motivo TEXT;
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS bloqueado_por UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_bloqueado
  ON profiles (bloqueado) WHERE bloqueado = true;

-- Histórico das decisões: quem bloqueou, quando, por quê, e quando soltou.
-- Fica separado do perfil porque o perfil guarda o estado atual, e aqui é a
-- linha do tempo, que não pode ser sobrescrita.
CREATE TABLE IF NOT EXISTS bloqueio_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (acao IN ('bloqueio', 'desbloqueio')),
  motivo TEXT,
  feito_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bloqueio_eventos_user
  ON bloqueio_eventos (user_id, created_at DESC);

ALTER TABLE bloqueio_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bloqueio_eventos_admin" ON bloqueio_eventos;
CREATE POLICY "bloqueio_eventos_admin" ON bloqueio_eventos FOR SELECT
  USING (public.is_admin());
