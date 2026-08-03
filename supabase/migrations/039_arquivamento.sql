-- 039_arquivamento.sql
-- Arquivamento de atividades e condutores.
--
-- `ativo`     → controla a publicação no formulário de certificação.
-- `arquivado` → tira do painel do admin sem apagar o registro (o histórico de
--               feedbacks/presenças continua apontando para o nome).
--
-- Arquivar sempre despublica (ativo = false), mas desarquivar NÃO republica:
-- o admin decide reativar depois.

ALTER TABLE certificado_atividades
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE certificado_condutores
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_certificado_atividades_arquivado
  ON certificado_atividades (arquivado);

CREATE INDEX IF NOT EXISTS idx_certificado_condutores_arquivado
  ON certificado_condutores (arquivado);
