-- =============================================================
-- Destaque de pessoa: a lista de 511 vira uma lista de decisões
-- =============================================================
-- A tela /formacao/admin/pessoas hoje responde bem à pergunta "quem é essa
-- pessoa": nome, horas, encontros, certificados, tudo cruzado desde a 089. O
-- que ela não responde é a pergunta que vem logo depois, que é a única que gera
-- trabalho: "com quem eu preciso falar".
--
-- Sem lugar para guardar isso, a resposta vive fora do sistema. Ela vira uma
-- anotação no caderno, uma mensagem que o admin manda para si mesmo, ou nada,
-- que é o caso mais comum: a pessoa que se destacou numa quinta é esquecida até
-- alguém reabrir o painel por outro motivo e reparar nela de novo. Com 511
-- linhas, reparar de novo é sorte, não processo.
--
-- Três coisas, e cada uma resolve uma parte diferente do esquecimento:
--
--   O destaque em si faz a pessoa saltar da lista. É o que substitui reencontrar
--   por acaso.
--
--   A cor separa os motivos. Convidar para monitoria, chamar para condução e
--   retomar contato com quem sumiu são três conversas distintas, com urgências
--   distintas, e uma marca única obrigaria o admin a abrir cada uma para lembrar
--   por que marcou. Quatro valores fechados, não texto livre: cor livre vira
--   dezessete tons de dourado ao longo de um semestre e a leitura da lista se
--   perde. As quatro são as da identidade visual da casa, então a tela não
--   precisa inventar paleta.
--
--   A nota guarda o motivo em uma frase. É o que faz o destaque sobreviver a um
--   mês parado: "falou muito bem no encontro sobre luto" ainda decide alguma
--   coisa em setembro, uma bolinha dourada sozinha já não decide.
--
-- Tabela separada, e não colunas em `pessoas`, por dois motivos. `pessoas` é
-- deliberadamente magra (a 089 escreveu isso no comentário dela): o que
-- identifica mora em `pessoa_identificadores`, e o que é juízo administrativo
-- não deveria morar junto do rótulo. E destaque é a exceção, não a regra: umas
-- dezenas de linhas contra 511, então uma tabela à parte é também o índice.
--
-- Chave primária na própria `pessoa_id`, sem id sintético: uma pessoa tem no
-- máximo um destaque. Marcar de novo é trocar a cor ou reescrever a nota, nunca
-- criar uma segunda marca, e o upsert da rota depende exatamente disso.
--
-- NADA AQUI ALTERA TABELA EXISTENTE. Rodar duas vezes é seguro.
-- =============================================================


-- ── A marca ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pessoa_destaques (
  -- Uma linha por pessoa. O CASCADE é o que impede o destaque de virar lixo
  -- órfão: pessoa fundida ou removida leva a marca junto, e o painel nunca
  -- mostra uma bolinha que aponta para ninguém.
  pessoa_id     UUID PRIMARY KEY REFERENCES public.pessoas(id) ON DELETE CASCADE,
  cor           TEXT NOT NULL DEFAULT 'dourado',
  -- Texto livre curto, e opcional: obrigar a escrever transformaria o gesto de
  -- um clique em um formulário, e o admin deixaria de marcar.
  nota          TEXT,
  -- Rastro de quem marcou. SET NULL porque perder o autor é aceitável, perder
  -- o destaque não: se a conta que marcou for removida, a decisão continua
  -- valendo, só fica sem assinatura.
  marcada_por   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Paleta fechada no banco, não só na tela. A tela é uma cliente entre outras
  -- (script de importação, correção à mão pelo SQL editor), e a única garantia
  -- de que a lista não vai acumular cor inventada é esta.
  CONSTRAINT pessoa_destaque_cor_conhecida
    CHECK (cor IN ('dourado', 'terracota', 'teal', 'roxo'))
);

COMMENT ON TABLE public.pessoa_destaques IS
  'Marca administrativa numa pessoa: cor por motivo e nota curta. Serve a decidir com quem falar, não a classificar ninguém.';
COMMENT ON COLUMN public.pessoa_destaques.cor IS
  'dourado, terracota, teal ou roxo. O significado de cada cor é convenção da tela, não do banco.';


-- ── Quem enxerga ─────────────────────────────────────────────
-- Nota sobre pessoa é juízo de terceiro sobre alguém que na maioria dos casos
-- nem tem conta na plataforma. Não pode vazar para autenticado comum e muito
-- menos para anônimo, então uma policy só, de admin, valendo para os quatro
-- verbos.
--
-- `public.is_admin()`, nunca `role = 'admin'`: desde a 078 os cargos são
-- acumuláveis, e quem administra e também conduz um grupo carrega "admin" na
-- lista de extras com outra coisa em `role`. A comparação crua barraria essa
-- pessoa em silêncio, com a tela apenas deixando de salvar.
ALTER TABLE public.pessoa_destaques ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pessoa_destaques_admin ON public.pessoa_destaques;
CREATE POLICY pessoa_destaques_admin ON public.pessoa_destaques
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_destaques TO authenticated;


-- ── A leitura mais frequente ─────────────────────────────────
-- "O que eu marquei ultimamente" é como o admin volta ao trabalho depois de uns
-- dias, então a ordem natural da tabela é a mais recente primeiro. É por
-- `criada_em`, não por `atualizada_em`: corrigir um erro de digitação na nota de
-- março não deveria empurrar aquela pessoa para o topo da fila de hoje.
CREATE INDEX IF NOT EXISTS pessoa_destaques_recentes
  ON public.pessoa_destaques (criada_em DESC);


-- ── Conferência ──────────────────────────────────────────────
--   SELECT count(*) FROM pessoa_destaques;                    -- 0 logo depois de aplicar
--   SELECT cor, count(*) FROM pessoa_destaques GROUP BY 1;    -- distribuição por motivo
--
--   -- O CHECK precisa recusar cor de fora da paleta:
--   INSERT INTO pessoa_destaques (pessoa_id, cor)
--     SELECT id, 'azul' FROM pessoas LIMIT 1;                 -- deve falhar
--
--   -- A policy precisa existir e valer para ALL:
--   SELECT policyname, cmd, roles FROM pg_policies
--    WHERE tablename = 'pessoa_destaques';
--
--   -- Com a chave anônima, a tabela deve responder lista vazia.
