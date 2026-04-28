-- ============================================================
-- FKs com ON DELETE CASCADE em tabelas dependentes de profiles
-- ============================================================
-- Antes: apagar um profile quebrava integridade referencial (FKs sem
-- ação em cascade deixavam registros órfãos). Agora: apagar profile
-- apaga matrícula, progresso, tentativas, certificados e reviews
-- daquele usuário. Comportamento desejado pra remoção de aluno.

-- enrollments
ALTER TABLE enrollments
  DROP CONSTRAINT IF EXISTS enrollments_user_id_fkey;
ALTER TABLE enrollments
  ADD CONSTRAINT enrollments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- lesson_progress
ALTER TABLE lesson_progress
  DROP CONSTRAINT IF EXISTS lesson_progress_user_id_fkey;
ALTER TABLE lesson_progress
  ADD CONSTRAINT lesson_progress_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- exam_attempts
ALTER TABLE exam_attempts
  DROP CONSTRAINT IF EXISTS exam_attempts_user_id_fkey;
ALTER TABLE exam_attempts
  ADD CONSTRAINT exam_attempts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- certificates
ALTER TABLE certificates
  DROP CONSTRAINT IF EXISTS certificates_user_id_fkey;
ALTER TABLE certificates
  ADD CONSTRAINT certificates_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- reviews
ALTER TABLE reviews
  DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;
ALTER TABLE reviews
  ADD CONSTRAINT reviews_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
