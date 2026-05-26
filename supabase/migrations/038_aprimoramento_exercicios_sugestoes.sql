-- ============================================================
-- Sprint 3A — Aprimoramento: tabelas para exercícios e sugestões
-- ============================================================
-- O dataset dos exercícios deixa de viver hardcoded em
-- src/lib/aprimoramento-dinamicas.ts e passa a viver no banco. Isso
-- destrava: admin edita pelo painel, associados podem CRIAR (entra como
-- não-curado) ou SUGERIR ideias (fila de pendências pro admin).
--
-- Esta migration cria só o schema. O seed dos 100 exercícios atuais é
-- entregue em 038_seed.sql (rodar DEPOIS desta).
--
-- Idempotente: roda mais de uma vez sem quebrar.

-- ─── aprimoramento_exercicios ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aprimoramento_exercicios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL CHECK (
    category IN ('relacao', 'tecnica', 'autoconhecimento', 'manejo', 'operacional')
  ),
  formato TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  recursos TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  -- blocks: jsonb com array de objetos { type, text/items/etc }. Validação
  -- estrutural fica no app (zod) — postgres só garante que é jsonb válido.
  blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  curado BOOLEAN NOT NULL DEFAULT FALSE,
  -- criado_por: NULL pros 100 seed iniciais (sem autor identificado).
  -- ON DELETE SET NULL: se o user sumir, o exercício permanece sem autor.
  criado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'publicado' CHECK (
    status IN ('publicado', 'rascunho', 'arquivado')
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE aprimoramento_exercicios ENABLE ROW LEVEL SECURITY;

-- SELECT:
--   - associado/admin: vê todos os exercícios publicados
--   - admin: vê tudo (rascunho/arquivado)
--   - dono: vê os próprios em qualquer status
DROP POLICY IF EXISTS "select_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "select_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR SELECT USING (
    status = 'publicado'
    OR public.is_admin()
    OR criado_por = auth.uid()
  );

-- INSERT:
--   - admin: tudo
--   - associado (ou admin): com criado_por = self e curado = false
DROP POLICY IF EXISTS "insert_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "insert_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      criado_por = auth.uid()
      AND curado = FALSE
      AND EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
          AND role IN ('associado', 'admin')
      )
    )
  );

-- UPDATE:
--   - admin: tudo
--   - dono: pode editar enquanto curado = false (próprio rascunho).
--     Depois de curado, vira read-only pro dono (admin só).
DROP POLICY IF EXISTS "update_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "update_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR UPDATE USING (
    public.is_admin()
    OR (criado_por = auth.uid() AND curado = FALSE)
  )
  WITH CHECK (
    public.is_admin()
    OR (
      criado_por = auth.uid()
      AND curado = FALSE  -- dono não pode marcar como curado
    )
  );

-- DELETE: só admin
DROP POLICY IF EXISTS "delete_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "delete_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR DELETE USING (public.is_admin());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_aprimoramento_exercicios_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aprimoramento_exercicios_set_updated_at
  ON aprimoramento_exercicios;
CREATE TRIGGER aprimoramento_exercicios_set_updated_at
  BEFORE UPDATE ON aprimoramento_exercicios
  FOR EACH ROW EXECUTE FUNCTION public.touch_aprimoramento_exercicios_updated_at();

-- Indices
CREATE INDEX IF NOT EXISTS idx_aprimoramento_exercicios_status_curado
  ON aprimoramento_exercicios(status, curado);
CREATE INDEX IF NOT EXISTS idx_aprimoramento_exercicios_category
  ON aprimoramento_exercicios(category);
CREATE INDEX IF NOT EXISTS idx_aprimoramento_exercicios_criado_por
  ON aprimoramento_exercicios(criado_por)
  WHERE criado_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_aprimoramento_exercicios_number
  ON aprimoramento_exercicios(number);

-- ─── aprimoramento_sugestoes ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS aprimoramento_sugestoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  categoria_sugerida TEXT CHECK (
    categoria_sugerida IS NULL OR categoria_sugerida IN
      ('relacao', 'tecnica', 'autoconhecimento', 'manejo', 'operacional')
  ),
  criado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (
    status IN ('pendente', 'desenvolvido', 'descartado')
  ),
  nota_admin TEXT NOT NULL DEFAULT '',
  exercicio_id UUID REFERENCES aprimoramento_exercicios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE aprimoramento_sugestoes ENABLE ROW LEVEL SECURITY;

-- SELECT: dono OR admin
DROP POLICY IF EXISTS "select_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "select_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR SELECT USING (
    criado_por = auth.uid() OR public.is_admin()
  );

-- INSERT: associado/admin (com criado_por = self e status inicial = pendente)
DROP POLICY IF EXISTS "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR INSERT WITH CHECK (
    criado_por = auth.uid()
    AND status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('associado', 'admin')
    )
  );

-- UPDATE: só admin (muda status, anexa exercicio_id, escreve nota)
DROP POLICY IF EXISTS "update_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "update_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR UPDATE USING (public.is_admin())
              WITH CHECK (public.is_admin());

-- DELETE: admin
DROP POLICY IF EXISTS "delete_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "delete_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR DELETE USING (public.is_admin());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.touch_aprimoramento_sugestoes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aprimoramento_sugestoes_set_updated_at
  ON aprimoramento_sugestoes;
CREATE TRIGGER aprimoramento_sugestoes_set_updated_at
  BEFORE UPDATE ON aprimoramento_sugestoes
  FOR EACH ROW EXECUTE FUNCTION public.touch_aprimoramento_sugestoes_updated_at();

-- Indices
CREATE INDEX IF NOT EXISTS idx_aprimoramento_sugestoes_status
  ON aprimoramento_sugestoes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aprimoramento_sugestoes_criado_por
  ON aprimoramento_sugestoes(criado_por);
