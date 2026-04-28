-- ============================================================
-- Fix RLS de certificado_submissions
-- ============================================================
-- Antes: SELECT/INSERT/UPDATE abertos pra anonymous (qualquer pessoa
-- podia ler nome+email+atividade de todos os alunos e poluir/editar
-- registros). Agora: leitura/edição apenas para admins; INSERT
-- continua aberto pro form público funcionar.

-- Drop policies antigas
DROP POLICY IF EXISTS "select_submissions" ON certificado_submissions;
DROP POLICY IF EXISTS "update_submissions" ON certificado_submissions;
-- INSERT permanece aberto (form público sem auth ainda submete via anon key)
-- mas reescreve a policy abaixo pra deixar o contrato explícito.
DROP POLICY IF EXISTS "insert_submissions_anon" ON certificado_submissions;

-- SELECT: apenas admins (admin tools usam service role, que bypassa RLS,
-- mas se algo for via anon key no client, exige auth).
CREATE POLICY "select_submissions_admin_only" ON certificado_submissions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- INSERT: aberto para anon (form público sem login)
CREATE POLICY "insert_submissions_anon" ON certificado_submissions
  FOR INSERT
  WITH CHECK (true);

-- UPDATE: apenas admins (impede que anon edite registros depois)
CREATE POLICY "update_submissions_admin_only" ON certificado_submissions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );
