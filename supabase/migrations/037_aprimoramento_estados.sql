-- ============================================================
-- Sprint 2E — Estado pessoal de Aprimoramento de Dinâmicas
-- ============================================================
-- Cada associado/admin pode marcar exercícios como favoritos, feitos ou
-- "fazer depois", e deixar notas privadas. Os 13 exercícios são identificados
-- pelo slug do dataset em src/lib/aprimoramento-dinamicas.ts (texto opaco,
-- sem FK pra tabela — é conteúdo curado em código).

CREATE TABLE IF NOT EXISTS aprimoramento_estados (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exercise_slug TEXT NOT NULL,
  status TEXT CHECK (status IN ('favorito', 'feito', 'fazer-depois')),
  notas TEXT NOT NULL DEFAULT '',
  done_count INTEGER NOT NULL DEFAULT 0,
  last_done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_slug)
);

ALTER TABLE aprimoramento_estados ENABLE ROW LEVEL SECURITY;

-- Só o dono lê/escreve. Admin NÃO bisbilhota — é estado pessoal.
DROP POLICY IF EXISTS "own_aprimoramento_estados_select" ON aprimoramento_estados;
CREATE POLICY "own_aprimoramento_estados_select" ON aprimoramento_estados
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_aprimoramento_estados_insert" ON aprimoramento_estados;
CREATE POLICY "own_aprimoramento_estados_insert" ON aprimoramento_estados
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_aprimoramento_estados_update" ON aprimoramento_estados;
CREATE POLICY "own_aprimoramento_estados_update" ON aprimoramento_estados
  FOR UPDATE USING (auth.uid() = user_id)
              WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own_aprimoramento_estados_delete" ON aprimoramento_estados;
CREATE POLICY "own_aprimoramento_estados_delete" ON aprimoramento_estados
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger pra updated_at sempre que o row mudar.
CREATE OR REPLACE FUNCTION public.touch_aprimoramento_estados_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aprimoramento_estados_set_updated_at ON aprimoramento_estados;
CREATE TRIGGER aprimoramento_estados_set_updated_at
  BEFORE UPDATE ON aprimoramento_estados
  FOR EACH ROW EXECUTE FUNCTION public.touch_aprimoramento_estados_updated_at();

CREATE INDEX IF NOT EXISTS idx_aprimoramento_estados_user_status
  ON aprimoramento_estados(user_id, status)
  WHERE status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_aprimoramento_estados_user_done
  ON aprimoramento_estados(user_id, last_done_at DESC)
  WHERE last_done_at IS NOT NULL;
