-- Add atividade_nome to meet presence records
ALTER TABLE formacao_meet_presencas ADD COLUMN IF NOT EXISTS atividade_nome TEXT;
