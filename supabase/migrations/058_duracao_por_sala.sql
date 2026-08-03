-- =============================================================
-- Duração própria por sala
-- =============================================================
-- O teto de duração era um só para toda a Formação, e isso não serve: tem
-- grupo de uma hora e tem encontro que legitimamente passa de três. Um teto
-- global obriga a escolher entre derrubar o longo e deixar o curto aberto a
-- tarde inteira.
--
-- NULL significa "usa o padrão da Formação". Só quem foge da regra guarda um
-- número aqui, então mudar o padrão continua valendo para todo mundo que não
-- pediu exceção.

ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS duracao_min INTEGER
  CHECK (duracao_min IS NULL OR (duracao_min >= 30 AND duracao_min <= 600));

COMMENT ON COLUMN formacao_meet_spaces.duracao_min IS
  'Teto de duração desta sala, em minutos. NULL usa formacao_cronograma.limite_encerramento_min.';
