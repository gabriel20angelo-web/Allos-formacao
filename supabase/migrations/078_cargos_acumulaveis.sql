-- =============================================================
-- Uma pessoa pode ter mais de um cargo
-- =============================================================
-- `profiles.role` é uma coluna só, então marcar alguém como condutora apagava
-- o cargo anterior dela. A Tácia cuida dos eventos E conduz um grupo, e não
-- havia como dizer isso: escolher um cargo tirava o outro.
--
-- O papel principal FICA como está, e ganha companhia. Fazer o contrário
-- (trocar tudo por uma lista) exigiria reescrever dezoito migrations que
-- dependem de `is_admin()` e cada policy que compara `role`, e um erro em
-- qualquer uma delas abre ou fecha porta silenciosamente. Aqui o que existe
-- continua valendo, e os cargos extras somam.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cargos user_role[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN profiles.cargos IS
  'Cargos ADICIONAIS ao papel principal. Quem tem role=eventos e cargos={condutor} é as duas coisas. O papel principal continua governando o que já existia.';

-- =============================================================
-- A pergunta única
-- =============================================================
-- Toda checagem passa a ser "esta pessoa tem tal cargo?", em vez de "o papel
-- dela é exatamente tal?". Sem isto, cada lugar precisaria lembrar de olhar as
-- duas colunas, e o que fosse esquecido falharia calado.
CREATE OR REPLACE FUNCTION public.tem_cargo(p_cargo TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = auth.uid()
       AND (
         role::text = p_cargo
         OR p_cargo = ANY (SELECT unnest(cargos)::text)
       )
  );
$$;

GRANT EXECUTE ON FUNCTION public.tem_cargo(TEXT) TO authenticated, anon;

-- As três funções que já governam acesso passam a enxergar os cargos extras.
-- A assinatura não muda, então as policies que as usam continuam valendo sem
-- serem tocadas — que é o ponto: dezoito migrations dependem de is_admin().
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND (role = 'admin' OR 'admin' = ANY (cargos))
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_events()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid()
       AND (
         role::text IN ('admin', 'eventos')
         OR 'admin'::user_role = ANY (cargos)
         OR 'eventos'::user_role = ANY (cargos)
       )
  );
$$;

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

-- As policies de escrita do Aprimoramento comparavam role diretamente.
DROP POLICY IF EXISTS "insert_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "insert_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      criado_por = auth.uid()
      AND curado = FALSE
      AND (
        public.tem_cargo('associado') OR public.tem_cargo('condutor')
        OR public.tem_cargo('eventos') OR public.tem_cargo('admin')
      )
    )
  );

DROP POLICY IF EXISTS "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR INSERT WITH CHECK (
    criado_por = auth.uid()
    AND status = 'pendente'
    AND (
      public.tem_cargo('associado') OR public.tem_cargo('condutor')
      OR public.tem_cargo('eventos') OR public.tem_cargo('admin')
    )
  );

-- =============================================================
-- Os cargos viajam no token, junto do papel
-- =============================================================
-- O middleware decide por claim para não consultar o banco a cada requisição.
-- Sem os cargos no token, ele leria só o papel principal e mandaria a pessoa
-- embora da área do segundo cargo dela.
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role   TEXT;
  v_cargos TEXT[];
  claims   jsonb;
BEGIN
  SELECT p.role::text, ARRAY(SELECT unnest(p.cargos)::text)
    INTO v_role, v_cargos
    FROM public.profiles p
   WHERE p.id = (event->>'user_id')::uuid
   LIMIT 1;

  claims := event->'claims';

  IF v_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(v_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
  END IF;

  claims := jsonb_set(claims, '{user_cargos}', to_jsonb(COALESCE(v_cargos, ARRAY[]::TEXT[])));

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;
