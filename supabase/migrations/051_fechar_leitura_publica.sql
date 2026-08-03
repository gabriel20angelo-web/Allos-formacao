-- 051_fechar_leitura_publica.sql
-- URGENTE: fecha leitura pública de dados pessoais.
--
-- Verificado em 2026-08-03 com a chave anônima (a mesma que vai no JavaScript
-- servido a qualquer visitante, e que portanto não é segredo):
--
--   GET /rest/v1/profiles?select=full_name,email
--   → devolvia nome completo e e-mail de TODAS as contas, sem login.
--
--   GET /rest/v1/certificates?select=certificate_code,user_id
--   → devolvia a lista inteira de certificados, permitindo enumerar códigos e
--     ligar cada um a um usuário.
--
-- A policy de profiles vinha da migration 000 ("Public profiles are viewable",
-- USING (true)), pensada para exibir nome de instrutor. O efeito colateral era
-- expor a base inteira de e-mails.
--
-- O que muda: `anon` deixa de ler as duas tabelas. Quem está logado continua
-- lendo, porque a aplicação depende disso para mostrar nome de autor de
-- comentário, instrutor do curso e rankings. O acesso público ao que é
-- legitimamente público passa a sair por view restrita.

-- ── profiles ──
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;
DROP POLICY IF EXISTS "profiles_select" ON profiles;

-- Autenticados leem (a aplicação precisa); anônimos não leem nada.
CREATE POLICY "profiles_select_autenticado" ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- View pública com o mínimo: nome e avatar, sem e-mail e sem papel.
-- É o que basta para creditar autoria de conteúdo em página aberta.
CREATE OR REPLACE VIEW profiles_publicos AS
  SELECT id, full_name, avatar_url FROM profiles;
GRANT SELECT ON profiles_publicos TO anon, authenticated;

-- ── certificates ──
-- A verificação pública de autenticidade (Termos, 8.3) passou a ser feita pela
-- rota /formacao/api/verificar-certificado, que usa service role e devolve só
-- o necessário. Com isso a leitura direta pelo anon deixa de ser precisa, e
-- listar todos os certificados nunca foi o objetivo da cláusula.
DROP POLICY IF EXISTS "certificates_public_verify" ON certificates;

CREATE POLICY "certificates_select_proprio" ON certificates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- ── formacao_meet_presencas ──
-- Guarda nomes de participantes em JSONB. Não há motivo para leitura anônima.
DROP POLICY IF EXISTS "select_presencas" ON formacao_meet_presencas;
DROP POLICY IF EXISTS "formacao_meet_presencas_select" ON formacao_meet_presencas;
CREATE POLICY "presencas_admin" ON formacao_meet_presencas FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ── video_questions ──
-- Tem coluna user_email. Fecha para anônimo pelo mesmo motivo.
DROP POLICY IF EXISTS "video_questions_select" ON video_questions;
DROP POLICY IF EXISTS "Anyone can view video questions" ON video_questions;
CREATE POLICY "video_questions_autenticado" ON video_questions FOR SELECT
  TO authenticated
  USING (true);

-- PENDÊNCIA CONHECIDA, que esta migration não resolve: entre contas
-- autenticadas o e-mail de terceiros continua legível. Fechar isso exige
-- privilégio por coluna (REVOKE SELECT (email)) e trocar os joins que hoje
-- leem `profiles` direto pelo client. Fica registrado para não se perder.
