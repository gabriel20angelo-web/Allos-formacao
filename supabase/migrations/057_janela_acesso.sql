-- =============================================================
-- Janela de acesso da sala
-- =============================================================
-- Encerrar a reunião não fecha a sala: o link é permanente e qualquer um abre
-- uma reunião nova em seguida. Para a sala existir só na hora do grupo, o que
-- muda é o tipo de acesso, não a conferência.
--
-- Dentro da janela do encontro a sala fica OPEN (entra quem tem o link, sem
-- ninguém admitir). Fora dela vira RESTRICTED: quem tenta entrar bate à porta,
-- e como não há ninguém dentro para abrir, não entra.
--
-- `janela_automatica` existe pelo mesmo motivo de `status_automatico_em` nos
-- slots: quando o admin mexe no acesso à mão, ele tem um motivo que o sistema
-- não conhece, e o automático precisa parar de brigar com ele.

ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS janela_automatica BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN formacao_meet_spaces.janela_automatica IS
  'Abre e fecha a sala no horário do grupo. Desliga sozinho quando alguém troca o acesso à mão.';
