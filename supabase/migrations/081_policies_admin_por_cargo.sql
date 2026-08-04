-- =============================================================
-- As duas policies que ficaram para trás
-- =============================================================
-- A 027 criou `is_admin()` e a 078 a reescreveu para olhar também a lista de
-- cargos extras, porque administrador que carrega "admin" em `cargos` (e não
-- na coluna `role`) estava sendo barrado em silêncio. Esse conserto foi
-- passando tabela por tabela e duas ficaram de fora, ainda comparando
-- `role = 'admin'` na unha, do jeito que o schema original escreveu:
--
--   reviews_delete_admin    (apagar avaliação de curso)
--   video_questions_admin   (responder e apagar dúvida em vídeo)
--
-- O efeito era pior do que "não deixa": a tela de Moderação só olhava o campo
-- de erro da resposta, e um DELETE barrado por RLS não devolve erro nenhum,
-- devolve sucesso com zero linhas. O clique dizia "Excluído com sucesso" e
-- nada saía do banco. A tela foi corrigida para conferir a contagem; aqui se
-- corrige a causa.

-- =============================================================
-- Avaliações de curso
-- =============================================================
DROP POLICY IF EXISTS "reviews_delete_admin" ON reviews;
CREATE POLICY "reviews_delete_admin" ON reviews
  FOR DELETE USING (public.is_admin());

-- =============================================================
-- Dúvidas em vídeo
-- =============================================================
-- Era FOR ALL só com USING. Sem WITH CHECK, o Postgres reaproveita o USING
-- para a escrita, então a forma abaixo preserva o comportamento anterior em
-- vez de estreitá-lo sem querer. A leitura pública continua sendo assunto da
-- `video_questions_autenticado`, criada na 051, que não é tocada aqui.
DROP POLICY IF EXISTS "video_questions_admin" ON video_questions;
CREATE POLICY "video_questions_admin" ON video_questions
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- =============================================================
-- Conferência
-- =============================================================
-- Como sempre: o SQL Editor roda como `postgres` e ignora RLS, então testar
-- o efeito por lá não prova nada. O que dá para perguntar aqui é se a
-- migration entrou, olhando o catálogo:
--
--   SELECT policyname, cmd, qual, with_check
--     FROM pg_policies
--    WHERE policyname IN ('reviews_delete_admin', 'video_questions_admin');
--   -- as duas linhas têm que citar is_admin()
--
-- Se a permissão FUNCIONA é pergunta de fora, com uma conta de verdade que
-- tenha "admin" apenas em `cargos`, apagando uma avaliação de teste.
