-- =============================================================
-- Clipe de vídeo que está no Drive: passa pelo YouTube antes
-- =============================================================
-- O OpusClip não lê Google Drive. A lista dele é YouTube, Vimeo, Zoom, Rumble,
-- Twitch, Facebook, LinkedIn, Twitter e StreamYard. Testado: link do Drive volta
-- 422 "Unsupported video link", link do YouTube volta 201 — inclusive vídeo NÃO
-- LISTADO, que é como este sistema publica.
--
-- Então o caminho de um vídeo que mora no Drive é: sobe ao YouTube como não
-- listado, e só então vai para o corte. As duas coisas que o Gabriel pediu
-- ("manda pro YouTube e pro OpusClip") viraram uma só, em ordem.
--
-- O envio ao YouTube é retomável e leva várias rodadas: um encontro de uma hora
-- e meia passa de 800 MB. Por isso o progresso mora aqui, e não na memória.

ALTER TABLE formacao_clip_jobs
  -- Endereço que de fato vai ao OpusClip. Fica separado de video_url porque a
  -- chave única é video_url: ela precisa continuar apontando para a origem, ou
  -- o mesmo vídeo entraria de novo pelo endereço novo.
  ADD COLUMN IF NOT EXISTS video_url_envio TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS youtube_upload_url TEXT,
  ADD COLUMN IF NOT EXISTS youtube_bytes_enviados BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS youtube_bytes_total BIGINT,
  ADD COLUMN IF NOT EXISTS youtube_tentativas INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS youtube_erro TEXT,
  -- Carimbo de quem está mexendo agora. Duas rodadas sobrepostas mandando o
  -- mesmo arquivo não corrompem nada (o envio retomável é por deslocamento),
  -- mas gastam banda em dobro à toa.
  ADD COLUMN IF NOT EXISTS trabalhando_desde TIMESTAMPTZ;

COMMENT ON COLUMN formacao_clip_jobs.video_url_envio IS
  'Endereço realmente mandado ao OpusClip. Igual a video_url quando a origem já é aceita; vira o link do YouTube quando o vídeo veio do Drive.';

-- 'subindo' é o estado novo: o vídeo está a caminho do YouTube, ainda não foi
-- para o corte.
ALTER TABLE formacao_clip_jobs DROP CONSTRAINT IF EXISTS formacao_clip_jobs_status_check;
ALTER TABLE formacao_clip_jobs ADD CONSTRAINT formacao_clip_jobs_status_check
  CHECK (status IN ('pendente', 'subindo', 'processando', 'pronto', 'erro'));

-- Preenche o que já está na fila: tudo que é link do Drive ganha o file id.
UPDATE formacao_clip_jobs
   SET drive_file_id = substring(video_url from '/d/([a-zA-Z0-9_-]{10,})')
 WHERE drive_file_id IS NULL
   AND video_url LIKE '%drive.google.com%';

UPDATE formacao_clip_jobs
   SET drive_file_id = substring(video_url from '[?&]id=([a-zA-Z0-9_-]{10,})')
 WHERE drive_file_id IS NULL
   AND video_url LIKE '%drive.google.com%';

-- O que não é do Drive já podia ter ido direto: mantém o endereço original.
UPDATE formacao_clip_jobs
   SET video_url_envio = video_url
 WHERE video_url_envio IS NULL
   AND video_url NOT LIKE '%drive.google.com%';

-- Quem tentou e falhou por causa do Drive volta para a fila: agora existe
-- caminho para esse vídeo.
UPDATE formacao_clip_jobs
   SET status = 'pendente', tentativas = 0, erro = NULL
 WHERE status IN ('pendente', 'erro')
   AND drive_file_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clip_jobs_subindo
  ON formacao_clip_jobs(status, created_at)
  WHERE status IN ('pendente', 'subindo');
