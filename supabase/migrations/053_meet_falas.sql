-- =============================================================
-- Texto da transcrição, pesquisável
-- =============================================================
-- Reverte a decisão inicial de guardar só duração: o Gabriel optou por manter
-- o texto no banco para poder buscar por palavra e trabalhar em cima depois.
--
-- Isso significa que relato de encontro de formação, que pode incluir material
-- clínico, passa a existir também aqui, com backup e réplica, e não só no Docs
-- do Drive. Daí a RLS ser restrita a admin e não haver policy de escrita
-- nenhuma: só o service role da ingestão escreve.
--
-- Uma linha por fala (não um blocão por encontro) porque é o que permite saber
-- quem disse o quê e quando, e porque busca em texto curto é muito mais rápida.

CREATE TABLE IF NOT EXISTS formacao_meet_falas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  encontro_id UUID NOT NULL REFERENCES formacao_meet_encontros(id) ON DELETE CASCADE,
  participacao_id UUID REFERENCES formacao_meet_participacoes(id) ON DELETE SET NULL,
  participant_api_id TEXT,
  display_name TEXT NOT NULL,
  aluno_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  texto TEXT NOT NULL,
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  segundos NUMERIC(8,2),
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE formacao_meet_falas IS
  'Transcrição da fala, uma linha por entrada. Contém material sensível: leitura só para admin.';

CREATE INDEX IF NOT EXISTS idx_meet_falas_encontro ON formacao_meet_falas(encontro_id, ordem);
CREATE INDEX IF NOT EXISTS idx_meet_falas_aluno ON formacao_meet_falas(aluno_id);

-- Busca por palavra com acento e radical do português ("supervisão" acha
-- "supervisões"). Sem isso, procurar num semestre de transcrições varre tudo.
CREATE INDEX IF NOT EXISTS idx_meet_falas_busca
  ON formacao_meet_falas USING GIN (to_tsvector('portuguese', texto));

ALTER TABLE formacao_meet_falas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_meet_falas" ON formacao_meet_falas;
CREATE POLICY "admin_read_meet_falas" ON formacao_meet_falas
  FOR SELECT USING (public.is_admin());

-- Marca se o texto daquele encontro já foi guardado, para a ingestão não
-- reprocessar o que já está completo.
ALTER TABLE formacao_meet_encontros
  ADD COLUMN IF NOT EXISTS falas_gravadas INTEGER NOT NULL DEFAULT 0;
