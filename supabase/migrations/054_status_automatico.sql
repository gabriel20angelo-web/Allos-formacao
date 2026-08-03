-- =============================================================
-- Status do slot preenchido pelo sistema
-- =============================================================
-- O calendário deixa de depender de alguém marcar trinta grupos por semana:
-- se existe registro de conferência na sala daquele grupo, o slot vira
-- "conduzido"; se não existe, vira "nao_conduzido".
--
-- Duas colunas de rastro, e elas são o que torna isso defensável:
--
-- `origem` no log separa o que o sistema deduziu do que uma pessoa decidiu.
-- Esse histórico alimenta o ranking de condutores, então quando alguém
-- contestar um "não conduzido" meses depois, a diferença precisa estar escrita.
--
-- `status_automatico_em` no slot marca que aquele status foi posto pelo
-- sistema. É o que permite corrigir sozinho (registro atrasado chega e vira
-- conduzido) sem nunca sobrescrever uma decisão manual: quem marcou "cancelado"
-- na mão marcou por um motivo que o sistema não conhece.

ALTER TABLE formacao_slot_logs
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
  CHECK (origem IN ('manual', 'automatico', 'correcao'));

ALTER TABLE formacao_slot_logs
  ADD COLUMN IF NOT EXISTS motivo TEXT;

ALTER TABLE formacao_slots
  ADD COLUMN IF NOT EXISTS status_automatico_em TIMESTAMPTZ;

COMMENT ON COLUMN formacao_slots.status_automatico_em IS
  'Preenchido quando foi o sistema que marcou. NULL significa decisão humana, que o automático nunca sobrescreve.';

-- Reset semanal automático precisa saber se já rodou nesta semana, senão
-- reseta várias vezes por dia e apaga o que a semana acumulou.
ALTER TABLE formacao_snapshots
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual'
  CHECK (origem IN ('manual', 'automatico'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_snapshots_semana
  ON formacao_snapshots(semana_inicio);

CREATE INDEX IF NOT EXISTS idx_slot_logs_origem ON formacao_slot_logs(origem, changed_at DESC);
