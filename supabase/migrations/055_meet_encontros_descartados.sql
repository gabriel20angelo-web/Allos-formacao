-- =============================================================
-- Encontros descartados
-- =============================================================
-- O Google abre um registro de conferência novo toda vez que a sala fica vazia
-- e alguém entra de novo. Testar o link três vezes produz três "encontros" de
-- um minuto com uma pessoa. São reais, mas são lixo, e lixo dentro da média
-- estraga todo indicador do grupo.
--
-- Descartar em vez de apagar, por dois motivos. Apagar faz o encontro voltar na
-- captura seguinte, porque a busca parte do último registro conhecido e ele
-- acabou de sumir. E o dado bruto, mesmo inútil, é a única prova de que aquela
-- sala funcionou naquele dia.

ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS descartado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS descartado_motivo TEXT;

COMMENT ON COLUMN formacao_meet_encontros.descartado IS
  'Fora de toda estatística. Marcado à mão pelo admin ou automaticamente quando o encontro é curto demais e sozinho demais para ser um encontro.';

CREATE INDEX IF NOT EXISTS idx_meet_encontros_descartado
  ON formacao_meet_encontros(descartado, data_reuniao DESC);
