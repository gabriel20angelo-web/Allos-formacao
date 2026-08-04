-- =============================================================
-- A área de quem conduz passa a ser por CARGO, não por vínculo
-- =============================================================
-- A 074 desenhou o acesso do condutor como uma cadeia de quatro elos: conta →
-- ficha em certificado_condutores → alocação no horário → sala daquele
-- horário. A intenção era boa: um condutor não tem por que ver o quórum do
-- grupo do outro.
--
-- O que aconteceu na prática foi outra coisa. Em 04/08/2026 havia 9 pessoas
-- com o cargo, 6 fichas ligadas a uma conta, 6 alocações e ZERO salas com
-- curso vinculado. Cada elo faltando dava uma tela diferente, e nenhuma delas
-- dizia o que fazer: "sua conta não está ligada a uma ficha de condutor",
-- "você ainda não está alocado em nenhum horário", "nenhum curso seu tem
-- cortes ainda". A última era a pior, porque parecia estado do trabalho ("o
-- corte ainda não rodou") e era estado do cadastro.
--
-- A regra agora é uma só: quem tem o cargo `condutor` alcança a área inteira.
-- São pessoas da mesma casa fazendo o mesmo trabalho, e o custo de uma
-- enxergar o grupo da outra é muito menor que o de nenhuma conseguir entrar.
--
-- As funções conduz_a_sala(), conduz_o_encontro() e conduz_a_aula() ficam de
-- pé: elas continuam respondendo corretamente "de quem é este grupo", que é
-- pergunta legítima para estatística e para a tela marcar "seu grupo". Só
-- deixam de ser o cadeado. Espelha src/lib/condutor.ts.

-- =============================================================
-- A pergunta única
-- =============================================================
-- Escrita sem depender de tem_algum_cargo() (migration 079) de propósito: se
-- esta migration for aplicada antes daquela, a área do condutor não pode cair
-- junto. Olha o papel principal E os extras, como manda a 078 — comparar
-- `role` direto barra em silêncio quem tem o cargo entre os extras.
CREATE OR REPLACE FUNCTION public.eh_condutor()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND (
         role::text IN ('condutor', 'admin')
         OR 'condutor'::user_role = ANY (cargos)
         OR 'admin'::user_role = ANY (cargos)
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.eh_condutor() TO authenticated;

COMMENT ON FUNCTION public.eh_condutor() IS
  'Tem o cargo de condutor (ou administra). É a permissão da área de quem conduz: cargo basta, ficha e alocação não entram. Espelho de identificarCondutor() em src/lib/condutor.ts.';

-- =============================================================
-- O que ele enxerga
-- =============================================================
-- Nomes novos porque os antigos passariam a mentir: "condutor_le_sua_sala"
-- descreve um recorte que não existe mais, e policy com nome errado é a coisa
-- que a próxima pessoa lê em vez de ler o corpo.

DROP POLICY IF EXISTS condutor_le_sua_sala ON formacao_meet_spaces;
DROP POLICY IF EXISTS condutor_le_as_salas ON formacao_meet_spaces;
CREATE POLICY condutor_le_as_salas ON formacao_meet_spaces
  FOR SELECT USING (public.eh_condutor());

DROP POLICY IF EXISTS condutor_le_seus_encontros ON formacao_meet_encontros;
DROP POLICY IF EXISTS condutor_le_os_encontros ON formacao_meet_encontros;
CREATE POLICY condutor_le_os_encontros ON formacao_meet_encontros
  FOR SELECT USING (public.eh_condutor());

DROP POLICY IF EXISTS condutor_le_suas_participacoes ON formacao_meet_participacoes;
DROP POLICY IF EXISTS condutor_le_as_participacoes ON formacao_meet_participacoes;
CREATE POLICY condutor_le_as_participacoes ON formacao_meet_participacoes
  FOR SELECT USING (public.eh_condutor());

DROP POLICY IF EXISTS condutor_le_seus_jobs ON formacao_clip_jobs;
DROP POLICY IF EXISTS condutor_le_os_jobs ON formacao_clip_jobs;
CREATE POLICY condutor_le_os_jobs ON formacao_clip_jobs
  FOR SELECT USING (public.eh_condutor());

DROP POLICY IF EXISTS condutor_le_seus_clipes ON formacao_clips;
DROP POLICY IF EXISTS condutor_le_os_clipes ON formacao_clips;
CREATE POLICY condutor_le_os_clipes ON formacao_clips
  FOR SELECT USING (public.eh_condutor());

-- =============================================================
-- O que ele muda
-- =============================================================
-- Continua sendo só a curadoria: aprovar, reprovar, anotar. Apagar, publicar e
-- mandar cortar seguem fora do alcance dele, e é por isso que esta policy
-- existe em vez de um `FOR ALL`. Quem avaliou fica gravado em `avaliado_por`.
DROP POLICY IF EXISTS condutor_avalia_seus_clipes ON formacao_clips;
DROP POLICY IF EXISTS condutor_avalia_os_clipes ON formacao_clips;
CREATE POLICY condutor_avalia_os_clipes ON formacao_clips
  FOR UPDATE USING (public.eh_condutor())
  WITH CHECK (public.eh_condutor());

-- A ficha continua sendo a própria: nome, telefone e observações de outra
-- pessoa não são parte do trabalho de conduzir um grupo, e abrir isso não foi
-- pedido nem seria necessário para nada da tela.

-- =============================================================
-- Conferência
-- =============================================================
-- CUIDADO: não dá para conferir no SQL Editor. Ele roda como `postgres`, que
-- ignora RLS, e ali auth.uid() é nulo. No SQL Editor só cabe perguntar se a
-- migration ENTROU, olhando o catálogo:
--
--   SELECT policyname, qual FROM pg_policies
--    WHERE tablename = 'formacao_meet_spaces' AND policyname LIKE 'condutor%';
--   -- esperado: condutor_le_as_salas, com qual = eh_condutor()
--
-- Se FUNCIONA é pergunta de fora, com um token de verdade de quem tem o cargo
-- condutor e nenhuma ficha ligada:
--
--   curl "$SUPABASE_URL/rest/v1/formacao_meet_spaces?select=space_name" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN"
--   -- esperado: as salas ativas, e não []
