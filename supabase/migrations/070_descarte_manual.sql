-- =============================================================
-- Descarte de gente não é desfeito por rotina
-- =============================================================
-- O administrador descartava um encontro e, quinze minutos depois, ele voltava
-- para as médias como se nada tivesse acontecido — com o motivo apagado junto.
--
-- A causa: a ingestão reescreve o encontro em toda rodada enquanto a
-- transcrição não fica pronta, e gravava `descartado` pela heurística
-- automática (uma pessoa, até cinco minutos). Um encontro real descartado à mão
-- não casa com essa heurística, então voltava como `descartado = false`. A
-- linha de presença, que o descarte tinha apagado, era recriada no mesmo passo.
--
-- Esta coluna separa as duas coisas: o que a rotina achou e o que uma pessoa
-- decidiu. A rotina só mexe no que ela mesma marcou.

ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS descartado_manual BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN formacao_meet_encontros.descartado_manual IS
  'Verdadeiro quando o descarte (ou a restauração) foi decidido por uma pessoa. A ingestão nunca sobrescreve descartado nesses casos.';

-- O que já foi descartado e não bate com a heurística automática só pode ter
-- vindo de uma decisão manual: marca como tal para não ser desfeito na próxima
-- rodada.
UPDATE formacao_meet_encontros
   SET descartado_manual = true
 WHERE descartado = true
   AND NOT (COALESCE(total_participantes, 0) <= 1 AND COALESCE(duracao_min, 0) <= 5);

CREATE INDEX IF NOT EXISTS idx_encontros_descartado
  ON formacao_meet_encontros(descartado, data_reuniao DESC);
