-- 080_congelar_cargo_do_proprio_perfil.sql
-- URGENTE: qualquer conta logada conseguia se tornar administradora.
--
-- Verificado em 2026-08-03 com uma conta de teste recém-criada, papel
-- `student`, usando a chave anônima (a que vai no JavaScript servido a
-- qualquer visitante) mais o próprio token de sessão:
--
--   PATCH /rest/v1/profiles?id=eq.<o próprio id>
--   { "role": "admin", "cargos": ["admin","condutor","eventos"] }
--   → 200, e a linha voltou com role = admin.
--
-- Depois disso a mesma conta leu, pela API REST: `formacao_meet_falas` (o texto
-- do que foi dito nos grupos), `formacao_meet_encontros`, `formacao_meet_spaces`
-- (os links das salas), `certificado_submissions` e `certificado_condutores`.
-- Sem relogar: as funções `is_admin()` e `tem_cargo()` consultam a tabela, não
-- o token.
--
-- A causa é a policy que vem da migration 000/002:
--
--   CREATE POLICY "profiles_update_own" ON profiles
--     FOR UPDATE USING (auth.uid() = id);
--
-- Ela está certa no que se propôs a fazer — cada pessoa edita o próprio perfil
-- — e o problema é o que ela não diz: RLS decide LINHAS, nunca COLUNAS. Quem
-- pode escrever na própria linha pode escrever em qualquer campo dela, e
-- `role` e `cargos` são campos dela.
--
-- A migration 051 fechou a leitura pública desta mesma tabela. A escrita não
-- foi olhada na ocasião.
--
-- O que muda: as duas colunas de permissão passam a ser imutáveis para quem não
-- é administrador. Todo o resto do perfil continua editável como antes.

-- =============================================================
-- Por que um gatilho, e não uma policy
-- =============================================================
-- Uma policy com WITH CHECK compara a linha nova com valores fixos, mas não
-- enxerga a linha ANTIGA, então não consegue dizer "este campo não pode mudar"
-- sem congelá-lo também para o administrador. O gatilho vê OLD e NEW, e é o
-- único lugar onde a regra pode ser exatamente esta: mudou o cargo? quem está
-- mudando é admin?
--
-- Gatilho também vale para o service role, que bypassa RLS. É de propósito: a
-- rota /formacao/admin/configuracoes/update-role escreve por ele, e é ela quem
-- distribui cargos. Por isso a checagem abaixo deixa passar quando não há
-- usuário na sessão — service role e cron não têm `auth.uid()`.

CREATE OR REPLACE FUNCTION public.impedir_autopromocao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Nada a fazer quando as colunas de permissão não foram tocadas. É o caso de
  -- toda edição normal de perfil (nome, avatar, aceite de termos), e sair cedo
  -- aqui evita uma consulta a `profiles` em cada uma delas.
  IF NEW.role IS NOT DISTINCT FROM OLD.role
     AND NEW.cargos IS NOT DISTINCT FROM OLD.cargos THEN
    RETURN NEW;
  END IF;

  -- Sem usuário na sessão é service role, cron ou console: quem já tem a chave
  -- do banco não precisa passar por aqui, e é por este caminho que a tela de
  -- Configurações troca o cargo de alguém.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Administrador muda cargo de quem quiser, inclusive o próprio. Pelos dois
  -- lugares onde o cargo mora: quem carrega "admin" apenas em `cargos` também
  -- é administrador (migration 078).
  IF EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND (role = 'admin' OR 'admin' = ANY (cargos))
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Cargo só é alterado por um administrador.'
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS impedir_autopromocao ON public.profiles;
CREATE TRIGGER impedir_autopromocao
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.impedir_autopromocao();

COMMENT ON FUNCTION public.impedir_autopromocao() IS
  'Congela profiles.role e profiles.cargos para quem não é administrador. Existe porque RLS decide linha, não coluna: a policy que deixa cada pessoa editar o próprio perfil deixava junto escrever o próprio cargo.';
