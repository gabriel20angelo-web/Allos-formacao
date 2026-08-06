-- =============================================================
-- A grade para de ser pública
-- =============================================================
-- Testando a chave anônima (a que vai no JavaScript servido a qualquer
-- visitante) contra o banco de produção em 06/08/2026, duas tabelas
-- responderam com dados:
--
--   formacao_slot_logs   ⛔ aberta
--   formacao_alocacoes   ⛔ aberta
--
-- As duas vêm da migration 011, que criou oito policies `USING (true)` de uma
-- vez. A 051 fechou o que era óbvio (perfil, certificado, presença) e passou
-- reto por estas, provavelmente porque grade parece dado administrativo inócuo.
-- Não é:
--
--   `formacao_slot_logs` guarda `condutor_ids`, `status_novo` e `motivo`. Ou
--   seja, qualquer pessoa com o endereço do banco conseguia ler que fulano foi
--   marcado como "nao_conduzido" numa terça de junho, e o motivo escrito por
--   quem marcou. É registro de trabalho de voluntário, exposto sem login.
--
--   `formacao_alocacoes` diz quem está escalado em qual horário. Sozinha
--   parece inofensiva, mas cruzada com a anterior identifica pessoa por UUID
--   e reconstrói a escala inteira da casa.
--
-- O resto do que a 011 abriu segue aberto de propósito, e vale registrar o
-- porquê para ninguém "consertar" isso depois sem querer: `certificado_*`
-- (condutores, atividades, eventos), `formacao_horarios`, `formacao_slots` e
-- `formacao_cronograma` alimentam a página pública de inscrição, que é
-- anônima por natureza. Fechá-las derruba o site.
-- =============================================================

-- ── Logs de status ───────────────────────────────────────────
DROP POLICY IF EXISTS "select_slot_logs" ON public.formacao_slot_logs;

DROP POLICY IF EXISTS slot_logs_admin ON public.formacao_slot_logs;
CREATE POLICY slot_logs_admin ON public.formacao_slot_logs
  FOR SELECT USING (public.is_admin());

-- ── Alocações ────────────────────────────────────────────────
-- Aqui a leitura não pode ser só de admin: a área do condutor precisa saber
-- em que slot a pessoa está, e a tela pública de horários mostra o nome de
-- quem conduz. O que se corta é o acesso ANÔNIMO, mantendo quem tem sessão.
DROP POLICY IF EXISTS "select_alocacoes" ON public.formacao_alocacoes;

DROP POLICY IF EXISTS alocacoes_autenticado ON public.formacao_alocacoes;
CREATE POLICY alocacoes_autenticado ON public.formacao_alocacoes
  FOR SELECT TO authenticated USING (true);

-- ── Conferência ──────────────────────────────────────────────
-- Depois de aplicar, repetir o teste com a chave anônima. As duas devem
-- responder lista vazia, e o painel de admin deve continuar mostrando o
-- ranking de condutores da tela de estatísticas, que lê `formacao_slot_logs`.
--
--   SELECT tablename, policyname, roles, cmd
--     FROM pg_policies
--    WHERE tablename IN ('formacao_slot_logs', 'formacao_alocacoes')
--    ORDER BY tablename, policyname;
