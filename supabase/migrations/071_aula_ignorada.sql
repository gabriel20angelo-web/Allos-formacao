-- =============================================================
-- Gravação que não vai virar aula, e tudo bem
-- =============================================================
-- A tela lista "gravações sem virar aula" com o motivo, e até aqui só
-- informava: não havia botão nenhum. Uma gravação que nunca vai virar aula
-- ficava ali para sempre, num card âmbar de aviso, ensinando quem olha a
-- ignorar avisos.
--
-- Descartar o encontro seria resolver a coisa errada: o encontro aconteceu, o
-- quórum dele vale, e só a aula é que não interessa. São duas decisões
-- diferentes e precisavam de dois campos diferentes.

ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS aula_ignorada BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN formacao_meet_encontros.aula_ignorada IS
  'A gravação deste encontro não deve virar aula. O encontro continua valendo para presença e quórum: só some da fila de aulas.';
