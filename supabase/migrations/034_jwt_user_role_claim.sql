-- ============================================================
-- Sprint 12 — Custom claim user_role no JWT (Auth Hook)
-- ============================================================
-- O middleware lia profiles.role em toda request /admin/*. Esta hook injeta
-- o role no access_token, eliminando a query e levando o middleware a 0 RTT.
--
-- POS-MIGRATION: ativar a hook em
--   Dashboard > Authentication > Hooks > Add hook > Custom Access Token
--   schema: public, function: custom_access_token_hook
-- e marcar enabled.

-- A funcao roda em cada token issuance/refresh. Recebe o JWT em construcao,
-- le profiles.role, e devolve o JWT com claim adicional user_role.
-- SECURITY DEFINER porque precisa ler profiles ignorando RLS do usuario.

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role TEXT;
  claims jsonb;
BEGIN
  -- Le o role da tabela profiles
  SELECT p.role INTO user_role
  FROM public.profiles p
  WHERE p.id = (event->>'user_id')::uuid
  LIMIT 1;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    -- Garantir que o claim existe mesmo sem profile (visitante recem-cadastrado)
    claims := jsonb_set(claims, '{user_role}', 'null'::jsonb);
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- A hook precisa ser executavel pelo papel supabase_auth_admin
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) FROM authenticated, anon, public;

-- Permissao explicita pra ler profiles (SECURITY DEFINER ja bypassa RLS, mas
-- a Auth ainda checa GRANT SELECT antes de invocar).
GRANT SELECT ON public.profiles TO supabase_auth_admin;

-- RLS policy: supabase_auth_admin pode ler profiles mesmo com RLS ON
DROP POLICY IF EXISTS "Auth admin can read profiles for hook" ON public.profiles;
CREATE POLICY "Auth admin can read profiles for hook" ON public.profiles
  AS PERMISSIVE FOR SELECT
  TO supabase_auth_admin
  USING (true);
