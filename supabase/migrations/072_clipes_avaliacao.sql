-- =============================================================
-- Clipe se assiste, se aprova e se esconde
-- =============================================================
-- Um encontro rende quarenta clipes. Empilhados numa lista, com título,
-- hashtags e três linhas de descrição cada, viram uma parede de texto onde não
-- dá para fazer a única coisa que importa: ver o vídeo e dizer se presta.
--
-- Sem lugar para guardar essa decisão, cada visita à tela recomeça do zero — o
-- clipe já rejeitado ontem aparece igual ao que ainda não foi visto.

ALTER TABLE formacao_clips
  -- null = ainda não avaliado. É diferente de rejeitado, e a tela precisa
  -- distinguir os dois para saber o que ainda falta olhar.
  ADD COLUMN IF NOT EXISTS avaliacao TEXT
    CHECK (avaliacao IS NULL OR avaliacao IN ('gostei', 'rejeitado')),
  ADD COLUMN IF NOT EXISTS avaliado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS avaliado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Some da lista sem virar rejeição: serve para tirar da frente o que já foi
  -- publicado ou o que não interessa agora.
  ADD COLUMN IF NOT EXISTS oculto BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN formacao_clips.avaliacao IS
  'gostei, rejeitado, ou nulo para o que ainda não foi visto. Nulo e rejeitado são estados diferentes.';

CREATE INDEX IF NOT EXISTS idx_clips_avaliacao
  ON formacao_clips(job_id, oculto, avaliacao);
