-- =============================================================
-- Publicar no YouTube: uma fila só, duas ações
-- =============================================================
-- A fila de clipes já sabia levar um vídeo do Drive até o YouTube, porque o
-- OpusClip não lê Drive. Publicar um curso no YouTube é a mesma viagem sem a
-- última parada.
--
-- Duas filas separadas seriam pior que redundantes: as duas subiriam ao
-- YouTube, e o mesmo vídeo acabaria publicado duas vezes por caminhos que não
-- se enxergam. Então é uma fila só, e o que muda é o que se pede dela.

ALTER TABLE formacao_clip_jobs
  -- O que fazer depois que o vídeo estiver no YouTube. Cortar é opcional: quem
  -- só quer publicar não paga por corte nenhum.
  ADD COLUMN IF NOT EXISTS gerar_clipes BOOLEAN NOT NULL DEFAULT true,
  -- Trocar o vídeo da aula pelo do YouTube. Fica desligado por padrão porque
  -- muda o que o aluno vê, e isso não pode ser efeito colateral de outra coisa.
  ADD COLUMN IF NOT EXISTS trocar_fonte_da_aula BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fonte_trocada_em TIMESTAMPTZ;

COMMENT ON COLUMN formacao_clip_jobs.gerar_clipes IS
  'Mandar para corte depois de publicar. Falso quando o pedido foi só publicar no YouTube.';
COMMENT ON COLUMN formacao_clip_jobs.trocar_fonte_da_aula IS
  'Depois de publicar, apontar a aula para o vídeo do YouTube em vez do arquivo do Drive.';

-- O que já está na fila veio do pedido de clipes: continua sendo corte.
UPDATE formacao_clip_jobs SET gerar_clipes = true WHERE gerar_clipes IS NULL;

-- 'publicado' é o fim de linha de quem só queria o YouTube: chegou lá e não
-- vai para corte nenhum.
ALTER TABLE formacao_clip_jobs DROP CONSTRAINT IF EXISTS formacao_clip_jobs_status_check;
ALTER TABLE formacao_clip_jobs ADD CONSTRAINT formacao_clip_jobs_status_check
  CHECK (status IN ('pendente', 'subindo', 'processando', 'pronto', 'publicado', 'erro'));

-- =============================================================
-- Gravação nova sobe ao YouTube por padrão
-- =============================================================
-- Estava desligado por sala, e desligado é o que o Gabriel não esperava: a
-- gravação ia para o Drive, virava sugestão de aula, e ninguém entendia por que
-- não havia vídeo no YouTube. Inverter o padrão faz o comportamento comum
-- acontecer sem configuração, e o botão para desligar uma sala específica já
-- existe na tela.
ALTER TABLE formacao_meet_spaces ALTER COLUMN subir_youtube SET DEFAULT true;

COMMENT ON COLUMN formacao_meet_spaces.subir_youtube IS
  'Sobe a gravação deste grupo ao YouTube como não listada. Ligado por padrão; desligue na aba Salas para um grupo que não deve ser publicado.';
