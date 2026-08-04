-- =============================================================
-- O Postgres passa a dizer a mesma coisa que a tela
-- =============================================================
-- O contrato das áreas agora está escrito num lugar só do lado do TypeScript
-- (src/lib/areas.ts), e dele saem o menu do site, a navegação do painel e o
-- gate de rota. Isto aqui é o outro lado: sem ele, o botão aparece e a
-- gravação falha calada, que é exatamente a divergência que a 078 tentou
-- fechar e deixou pela metade.
--
-- O que muda:
--   1. Uma função para perguntar por vários cargos de uma vez.
--   2. O Aprimoramento passa a ser de associado e condutor (o cargo `eventos`
--      sai — quem cuida do calendário não usa o acervo de dinâmicas).
--   3. A leitura do acervo passa a exigir cargo. Até agora não exigia.

-- =============================================================
-- A pergunta, no plural
-- =============================================================
-- As policies vinham repetindo quatro `tem_cargo(...)` unidos por OR. Repetir
-- é onde o erro entra: basta uma das quatro sobrar de fora numa policy nova
-- para a porta ficar aberta ou fechada sem que ninguém veja.
CREATE OR REPLACE FUNCTION public.tem_algum_cargo(p_cargos TEXT[])
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND (
         -- O administrador passa sempre, e é por isso que ele não precisa
         -- (nem deve) ser repetido na lista de cada chamada.
         role::text = 'admin'
         OR 'admin'::user_role = ANY (cargos)
         OR role::text = ANY (p_cargos)
         OR EXISTS (
              SELECT 1 FROM unnest(cargos) c
               WHERE c::text = ANY (p_cargos)
            )
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tem_algum_cargo(TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.tem_algum_cargo(TEXT[]) IS
  'Basta um dos cargos servir. Olha o papel principal e os extras, e o administrador passa sempre. Espelho de temAlgumCargo() em src/lib/cargos.ts — os dois precisam responder a mesma coisa.';

-- =============================================================
-- Quem lê o acervo de dinâmicas
-- =============================================================
-- A policy dizia `status = 'publicado'` e mais nada, sem olhar cargo nenhum. O
-- comentário dela, escrito na 038, já afirmava "associado/admin vê os
-- publicados" — mas isso nunca foi verdade no banco: o único gate era o
-- `redirect` no topo da página, e página não é permissão. Quem chamasse a API
-- direto lia o acervo inteiro.
--
-- O dono continua vendo os próprios em qualquer situação, senão perderia de
-- vista o rascunho que acabou de mandar.
DROP POLICY IF EXISTS "select_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "select_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR SELECT USING (
    (status = 'publicado' AND public.tem_algum_cargo(ARRAY['associado', 'condutor']))
    OR public.is_admin()
    OR criado_por = auth.uid()
  );

-- =============================================================
-- Quem escreve
-- =============================================================
-- Mesma lista da leitura. O cargo `eventos`, que a 076 e a 078 incluíam, sai:
-- quem cuida do calendário de eventos não trabalha com dinâmicas de grupo, e
-- deixar a permissão de escrita mais larga que a área visível é a forma de
-- divergência mais difícil de perceber depois.
DROP POLICY IF EXISTS "insert_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "insert_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      criado_por = auth.uid()
      -- Exercício de quem não é administrador nasce não curado, sempre: curar
      -- é o gesto de quem responde pelo acervo.
      AND curado = FALSE
      AND public.tem_algum_cargo(ARRAY['associado', 'condutor'])
    )
  );

DROP POLICY IF EXISTS "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR INSERT WITH CHECK (
    criado_por = auth.uid()
    AND status = 'pendente'
    AND public.tem_algum_cargo(ARRAY['associado', 'condutor'])
  );

-- =============================================================
-- Conferência
-- =============================================================
-- CUIDADO: não dá para conferir isto no SQL Editor. Ele roda como `postgres`,
-- que ignora RLS por completo, e ali `auth.uid()` é nulo — um
-- `SELECT count(*) FROM aprimoramento_exercicios` devolve a tabela inteira com
-- ou sem esta migration, e não prova nada.
--
-- No SQL Editor só cabe perguntar se a migration ENTROU, olhando o catálogo,
-- que não está sujeito a RLS:
--
--   SELECT proname FROM pg_proc WHERE proname = 'tem_algum_cargo';
--   SELECT policyname, qual FROM pg_policies
--    WHERE tablename = 'aprimoramento_exercicios' AND cmd = 'SELECT';
--   -- o `qual` tem que citar tem_algum_cargo
--
-- Se a policy FUNCIONA é pergunta de fora, com um token de verdade. Anônimo:
--
--   curl "$SUPABASE_URL/rest/v1/aprimoramento_exercicios?select=slug&limit=1" \
--        -H "apikey: $ANON_KEY"
--   -- esperado: []
--
-- E o caso que de fato importa, que é uma conta logada SEM cargo (um aluno):
--
--   TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
--     -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
--     -d '{"email":"...","password":"..."}' | jq -r .access_token)
--   curl "$SUPABASE_URL/rest/v1/aprimoramento_exercicios?select=slug&limit=1" \
--        -H "apikey: $ANON_KEY" -H "Authorization: Bearer $TOKEN"
--   -- esperado: []
