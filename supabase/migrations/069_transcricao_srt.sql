-- =============================================================
-- Guardar a legenda, não só o texto corrido
-- =============================================================
-- O OpusClip entrega dois arquivos da mesma transcrição, e o que parece óbvio é
-- o pior. O .txt do primeiro encontro da Alice tem 67 mil caracteres, ZERO
-- quebras de linha e 633 pontos finais colados na palavra seguinte:
--
--   "...mas pouco sentir, poucoÉ, e as críticas do behaviorismo..."
--
-- Serve para uma máquina procurar palavra. Não serve para alguém ler, e o
-- Gabriel quer justamente ler — a ideia é virar livro.
--
-- O .srt tem a mesma fala partida em blocos com início e fim. Com o tempo dá
-- para reconstruir o que a transcrição perdeu: onde alguém pausou, que é onde
-- termina um assunto. É a única pontuação estrutural que sobra de graça.
--
-- Por isso a legenda passa a ser guardada, e o texto corrido vira reserva para
-- quando ela não existir.

ALTER TABLE formacao_clip_jobs
  ADD COLUMN IF NOT EXISTS transcricao_srt TEXT;

COMMENT ON COLUMN formacao_clip_jobs.transcricao_srt IS
  'Legenda com tempos. Preferida sobre transcricao_texto: é dela que sai o texto com parágrafos, porque as pausas dizem onde quebrar.';

-- Buscar a transcrição de uma aula era varredura de tabela inteira: todos os
-- índices existentes são da fila (status, tempo), nenhum do que a tela pergunta.
CREATE INDEX IF NOT EXISTS idx_clip_jobs_lesson
  ON formacao_clip_jobs(lesson_id) WHERE lesson_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clip_jobs_curso
  ON formacao_clip_jobs(curso_id) WHERE curso_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_clip_jobs_encontro
  ON formacao_clip_jobs(encontro_id) WHERE encontro_id IS NOT NULL;

-- A ponte da aula para o encontro do Meet passa por aqui, e ia pelo mesmo
-- caminho lento.
CREATE INDEX IF NOT EXISTS idx_aulas_sugeridas_lesson
  ON formacao_meet_aulas_sugeridas(lesson_id) WHERE lesson_id IS NOT NULL;
