-- =============================================================
-- Salas do Meet sem vínculo com a grade
-- =============================================================
-- Nem toda reunião é um grupo da grade semanal: reunião de equipe, evento
-- pontual, plantão, conversa com convidado. Essas salas precisam existir com
-- nome próprio, e o quórum delas continua sendo capturado igual.
--
-- slot_id já era nullable e UNIQUE; no Postgres vários NULL não colidem em
-- índice único, então dá para ter quantas salas avulsas quiser.

ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS rotulo TEXT;

COMMENT ON COLUMN formacao_meet_spaces.rotulo IS
  'Nome da sala quando ela não pertence a um slot da grade. Vira atividade_nome na captura.';

-- Uma das duas coisas precisa existir, senão a sala não tem identidade nenhuma
-- e ninguém sabe do que é o quórum.
ALTER TABLE formacao_meet_spaces
  DROP CONSTRAINT IF EXISTS chk_meet_space_identidade;
ALTER TABLE formacao_meet_spaces
  ADD CONSTRAINT chk_meet_space_identidade
  CHECK (slot_id IS NOT NULL OR (rotulo IS NOT NULL AND length(trim(rotulo)) > 0));
