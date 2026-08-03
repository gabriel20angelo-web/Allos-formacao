-- =============================================================
-- Gravação sobe para o YouTube como não listada
-- =============================================================
-- Vídeo de duas horas passa de um gigabyte, e o servidor tem alguns minutos por
-- requisição. Não cabe num envio só: é preciso ir em pedaços, guardando onde
-- parou, e continuar na batida seguinte do agendador.
--
-- É por isso que existem as colunas de progresso abaixo. Sem elas, uma falha no
-- meio significaria recomeçar do zero toda vez, e um vídeo grande nunca subiria.
--
-- `inicio_efetivo_seg` resolve o incômodo que fez o Gabriel desligar a gravação:
-- a sala abre quinze minutos antes e a gravação pega esse vazio. Como sabemos a
-- que horas cada pessoa entrou, o vídeo publicado começa no ponto em que o
-- encontro de fato começou.

ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_status TEXT
  CHECK (youtube_status IS NULL OR youtube_status IN ('pendente', 'enviando', 'pronto', 'erro'));
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_upload_url TEXT;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_bytes_enviados BIGINT NOT NULL DEFAULT 0;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_bytes_total BIGINT;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_erro TEXT;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS youtube_tentativas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS inicio_efetivo_seg INTEGER;

COMMENT ON COLUMN formacao_meet_encontros.inicio_efetivo_seg IS
  'Segundos desde o início da gravação até o encontro realmente começar. O vídeo da aula começa daqui.';

CREATE INDEX IF NOT EXISTS idx_encontros_youtube_status
  ON formacao_meet_encontros(youtube_status)
  WHERE youtube_status IN ('pendente', 'enviando');

-- Qual sala manda a gravação para o YouTube. Fica por sala porque nem todo
-- grupo publica: o que não vira aula não precisa sair do Drive.
ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS subir_youtube BOOLEAN NOT NULL DEFAULT false;
