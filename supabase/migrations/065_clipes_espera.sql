-- =============================================================
-- Esperar o YouTube terminar de processar antes de cortar
-- =============================================================
-- Terminar de ENVIAR não é o mesmo que estar disponível. Depois que o upload
-- fecha, o YouTube ainda processa o arquivo, e um encontro de uma hora e meia
-- leva um bom tempo nisso. Nessa janela o OpusClip responde:
--
--   "We are unable to handle processing YouTube that is still ongoing.
--    Please try again after it ends."
--
-- Isso não é falha: é cedo demais. Tratar como falha queimava as três
-- tentativas do vídeo em quarenta e cinco minutos e o marcava como erro
-- permanente, quando bastava esperar.

ALTER TABLE formacao_clip_jobs
  -- Antes deste instante, nem tenta. Evita bater na porta do OpusClip a cada
  -- rodada só para ouvir a mesma recusa.
  ADD COLUMN IF NOT EXISTS tentar_apos TIMESTAMPTZ,
  -- Espera não é tentativa: contada à parte para que o teto de erro continue
  -- valendo só para problema de verdade.
  ADD COLUMN IF NOT EXISTS esperas INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN formacao_clip_jobs.tentar_apos IS
  'Não enviar antes deste instante. Usado enquanto o YouTube ainda processa o vídeo recém-enviado.';

CREATE INDEX IF NOT EXISTS idx_clip_jobs_prontos
  ON formacao_clip_jobs(status, tentar_apos)
  WHERE status = 'pendente';

-- Devolve à fila o que falhou por ter sido enviado cedo demais.
UPDATE formacao_clip_jobs
   SET status = 'pendente',
       tentativas = 0,
       erro = NULL,
       tentar_apos = now() + interval '15 minutes'
 WHERE youtube_video_id IS NOT NULL
   AND status IN ('pendente', 'erro');
