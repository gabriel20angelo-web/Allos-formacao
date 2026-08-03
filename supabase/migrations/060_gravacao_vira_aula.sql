-- =============================================================
-- Gravação do encontro vira aula do curso
-- =============================================================
-- Quando um grupo da grade corresponde a um curso da plataforma, a gravação
-- daquele encontro deveria virar aula sem ninguém copiar link à mão.
--
-- Duas decisões que explicam o formato:
--
-- 1. A aula NÃO nasce publicada. `lessons` não tem estado de rascunho (aula
--    criada é aula visível para o aluno), então a fila vive numa tabela própria
--    e a aula só passa a existir quando alguém aprova. Isso importa porque a
--    gravação começa antes do grupo se formar e pega a conversa de chegada.
--
-- 2. A ligação é da SALA com o curso, não do encontro. O encontro herda: assim
--    configura-se uma vez por grupo, e não a cada semana.

ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS curso_id UUID REFERENCES courses(id) ON DELETE SET NULL;
ALTER TABLE formacao_meet_spaces
  ADD COLUMN IF NOT EXISTS secao_id UUID REFERENCES sections(id) ON DELETE SET NULL;

COMMENT ON COLUMN formacao_meet_spaces.curso_id IS
  'Curso que recebe as gravações deste grupo como aulas. NULL desliga a sugestão.';

CREATE TABLE IF NOT EXISTS formacao_meet_aulas_sugeridas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  encontro_id UUID NOT NULL REFERENCES formacao_meet_encontros(id) ON DELETE CASCADE,
  curso_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  secao_id UUID REFERENCES sections(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  video_url TEXT NOT NULL,
  duracao_min INTEGER,
  data_reuniao DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovada', 'descartada')),
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  decidido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  decidido_em TIMESTAMPTZ,
  erro TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Um encontro sugere uma aula, e só. Sem isso, cada rodada do cron
  -- empilharia a mesma gravação na fila.
  UNIQUE (encontro_id)
);

COMMENT ON TABLE formacao_meet_aulas_sugeridas IS
  'Fila de gravações esperando virar aula. A aula em lessons só é criada na aprovação.';

CREATE INDEX IF NOT EXISTS idx_aulas_sugeridas_status
  ON formacao_meet_aulas_sugeridas(status, data_reuniao DESC);

ALTER TABLE formacao_meet_aulas_sugeridas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_aulas_sugeridas" ON formacao_meet_aulas_sugeridas;
CREATE POLICY "admin_read_aulas_sugeridas" ON formacao_meet_aulas_sugeridas
  FOR SELECT USING (public.is_admin());
