-- =============================================================
-- Clipes curtos a partir da gravação (OpusClip)
-- =============================================================
-- O vídeo inteiro vai para o YouTube como não listado E para o OpusClip, que
-- corta em trechos curtos. Os dois caminhos são independentes: um não espera o
-- outro, e a falha de um não impede o outro.
--
-- Custo é o motivo de existir a chave por sala. Essas ferramentas cobram por
-- minuto de vídeo ORIGINAL, não por clipe gerado: processar todos os encontros
-- de todos os grupos sairia caro rápido. Só quem for marcado gera clipe.

ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS gerar_clipes BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN formacao_meet_spaces.gerar_clipes IS
  'Manda a gravação deste grupo para cortar em clipes. Custa por minuto de vídeo, então é escolha por grupo.';

CREATE TABLE IF NOT EXISTS formacao_clip_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- Um dos dois: encontro capturado do Meet, ou aula que já existia no curso.
  encontro_id UUID REFERENCES formacao_meet_encontros(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
  curso_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  video_url TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'opusclip',
  external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'processando', 'pronto', 'erro')),
  erro TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  enviado_em TIMESTAMPTZ,
  concluido_em TIMESTAMPTZ,
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Não mandar o mesmo vídeo duas vezes: cada envio é cobrado.
  UNIQUE (video_url)
);

CREATE TABLE IF NOT EXISTS formacao_clips (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id UUID NOT NULL REFERENCES formacao_clip_jobs(id) ON DELETE CASCADE,
  external_id TEXT,
  titulo TEXT,
  url TEXT,
  thumbnail_url TEXT,
  duracao_seg NUMERIC(8,2),
  pontuacao NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clip_jobs_status ON formacao_clip_jobs(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clips_job ON formacao_clips(job_id);

ALTER TABLE formacao_clip_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_clips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_clip_jobs" ON formacao_clip_jobs;
CREATE POLICY "admin_read_clip_jobs" ON formacao_clip_jobs
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_clips" ON formacao_clips;
CREATE POLICY "admin_read_clips" ON formacao_clips
  FOR SELECT USING (public.is_admin());
