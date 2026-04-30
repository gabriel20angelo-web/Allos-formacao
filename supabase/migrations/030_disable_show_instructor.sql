-- ============================================================
-- Sprint 9 — Esconder informações de professor por padrão
-- ============================================================
-- Todos os cursos hoje estão com show_instructor=true e linkados ao
-- Gabriel Angelo. Decisão: esconder professor por padrão até cadastros
-- de professores reais serem feitos. Admin reativa por curso quando
-- preencher informações corretas.

UPDATE courses SET show_instructor = false;

-- Default da coluna pra false em novos cursos
ALTER TABLE courses ALTER COLUMN show_instructor SET DEFAULT false;
