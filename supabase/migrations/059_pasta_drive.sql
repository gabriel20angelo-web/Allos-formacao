-- =============================================================
-- Pasta de destino das gravações
-- =============================================================
-- O Meet joga gravação e transcrição numa pasta que ele mesmo escolhe, no Drive
-- de quem organiza. Em três meses ninguém acha nada ali.
--
-- Aqui fica a pasta para onde o sistema move os arquivos assim que o Google
-- termina de gerá-los. Por sala, para separar por grupo; e uma padrão da
-- Formação, para as salas que não pedirem exceção.
--
-- Guardamos o ID e a URL: o ID é o que a API usa, a URL é o que a pessoa cola.

ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS pasta_drive_id TEXT;
ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS pasta_drive_url TEXT;

ALTER TABLE formacao_cronograma
  ADD COLUMN IF NOT EXISTS pasta_drive_id TEXT;
ALTER TABLE formacao_cronograma
  ADD COLUMN IF NOT EXISTS pasta_drive_url TEXT;

-- Os identificadores dos arquivos no Drive, que a API do Meet entrega junto do
-- link. Sem eles não há como mover nada: o link de exportação não serve.
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS gravacao_file_id TEXT;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS transcricao_file_id TEXT;

-- Mover é uma operação que pode falhar por permissão. Marcar o que já foi
-- movido evita tentar de novo a cada batida do cron e deixa visível o que
-- ficou para trás.
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS arquivos_movidos_em TIMESTAMPTZ;
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS arquivos_erro TEXT;
