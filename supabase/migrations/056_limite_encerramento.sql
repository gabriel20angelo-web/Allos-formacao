-- =============================================================
-- Encerramento automático de reunião esquecida aberta
-- =============================================================
-- A sala do Meet é permanente por desenho: o link vale para sempre, e é isso
-- que evita reenviar link novo toda semana no WhatsApp. O efeito colateral é
-- que uma reunião esquecida aberta continua de pé, e continua gravando.
--
-- O limite abaixo é o teto de duração de um encontro. Passou disso sem ninguém
-- encerrar, o sistema encerra para todos.

ALTER TABLE formacao_cronograma
  ADD COLUMN IF NOT EXISTS limite_encerramento_min INTEGER NOT NULL DEFAULT 120;

COMMENT ON COLUMN formacao_cronograma.limite_encerramento_min IS
  'Teto de duração de um encontro, em minutos. Zero desliga o encerramento automático.';
