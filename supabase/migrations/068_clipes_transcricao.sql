-- =============================================================
-- O que o corte devolve junto com os clipes
-- =============================================================
-- Descobertas ao ler a API de verdade, depois que 41 clipes prontos pareceram
-- zero por horas (estavam em /exportable-clips, não dentro do projeto):
--
-- 1. Cada clipe vem com título, descrição, hashtags, pontuação e O TEXTO
--    FALADO nele. Isso é legenda pronta, e jogar fora seria desperdiçar algo
--    que já foi pago.
--
-- 2. O projeto devolve a TRANSCRIÇÃO do vídeo inteiro. Isso importa mais do
--    que parece: os encontros antigos só existiam como arquivo no Drive e
--    nunca passaram pelo Meet, então o sistema não tinha transcrição nenhuma
--    deles. Agora tem, sem custo além do corte que já foi pago.
--
-- A transcrição fica guardada como texto, não como endereço: o endereço que a
-- API devolve é temporário, e o projeto lá expira em trinta dias.

ALTER TABLE formacao_clip_jobs
  ADD COLUMN IF NOT EXISTS transcricao_texto TEXT,
  ADD COLUMN IF NOT EXISTS transcricao_em TIMESTAMPTZ;

COMMENT ON COLUMN formacao_clip_jobs.transcricao_texto IS
  'Transcrição do vídeo inteiro, feita pelo OpusClip. Guardada aqui porque o endereço original expira e o projeto some em 30 dias.';

ALTER TABLE formacao_clips
  ADD COLUMN IF NOT EXISTS descricao TEXT,
  ADD COLUMN IF NOT EXISTS hashtags TEXT[],
  -- O que é dito no clipe. Legenda pronta para quem for publicar.
  ADD COLUMN IF NOT EXISTS texto TEXT,
  ADD COLUMN IF NOT EXISTS preview_url TEXT,
  -- Onde o clipe está no vídeo original. É array porque um clipe pode ser
  -- costurado de trechos que não são vizinhos.
  ADD COLUMN IF NOT EXISTS trechos JSONB;

COMMENT ON COLUMN formacao_clips.trechos IS
  'Pares [início, fim] em milissegundos dentro do vídeo original. Mais de um par quando o clipe costura trechos separados.';

-- A pontuação vinha como NUMERIC(5,2) e o que a API devolve pode passar de
-- 999,99. Perder o clipe inteiro por causa de um número grande seria bobo.
ALTER TABLE formacao_clips ALTER COLUMN pontuacao TYPE NUMERIC(10,3);
