-- =============================================================
-- Curadoria de corte: por que presta, ou por que não
-- =============================================================
-- Quem conduziu o encontro é quem sabe se um corte presta: estava lá, sabe o
-- que veio antes da frase, e reconhece quando um trecho bom isolado acaba
-- dizendo o contrário do que foi dito.
--
-- Mas "não presta" sem motivo não ensina nada a quem faz a curadoria depois. A
-- anotação é o que transforma uma rejeição num critério — "cortou no meio da
-- ressalva", "o áudio some aos doze segundos" — e é ela que permite melhorar o
-- pedido de corte na próxima vez, em vez de só jogar fora.

ALTER TABLE formacao_clips
  ADD COLUMN IF NOT EXISTS anotacao TEXT;

COMMENT ON COLUMN formacao_clips.anotacao IS
  'Por que este corte presta ou não presta, na palavra de quem conduziu o encontro.';
