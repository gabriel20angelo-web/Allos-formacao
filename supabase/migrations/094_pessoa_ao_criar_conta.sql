-- Conta nova passa a virar pessoa sozinha.
--
-- A migration 089 criou `pessoas` e `pessoa_identificadores` e carregou a base
-- de uma vez, mas NÃO criou trigger nenhum. O efeito é que a tabela nasceu
-- correta e envelhece errada: medido em 06/08/2026, onze perfis criados naquele
-- mesmo dia já estavam fora de `pessoas`.
--
-- Isso não é um detalhe de higiene. A tela de Pessoas é a única que enxerga
-- quem participa sem ter conta, e ela lista o que está em `pessoas`. Sem
-- trigger, quem se cadastra hoje só aparece lá quando alguém rodar a carga à
-- mão, e ninguém vai lembrar de rodar.
--
-- ⚠️ A regra da 089 vale aqui inteira: CHAVE FORTE CASA SOZINHA, NOME NUNCA.
-- Por isso o trigger casa por e-mail normalizado, que é chave forte, e nunca
-- por nome. Uma conta nova cujo e-mail já é conhecido ANEXA o `profile_id` à
-- pessoa que já existe, em vez de criar uma segunda: é exatamente o caso de
-- quem participava dos grupos há meses e só agora criou conta na plataforma.

-- ── A função ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pessoa_ao_criar_perfil()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email  TEXT;
  v_pessoa UUID;
BEGIN
  v_email := public.normalizar_email(NEW.email);

  -- Já existe alguém com este e-mail? Então a conta é dessa pessoa.
  IF v_email IS NOT NULL THEN
    SELECT pessoa_id INTO v_pessoa
      FROM public.pessoa_identificadores
     WHERE tipo = 'email' AND valor = v_email
     LIMIT 1;
  END IF;

  -- Não existe: nasce uma pessoa nova, com o nome que a conta trouxe.
  IF v_pessoa IS NULL THEN
    INSERT INTO public.pessoas (nome_canonico)
    VALUES (COALESCE(NULLIF(btrim(NEW.full_name), ''), NEW.email, 'sem nome'))
    RETURNING id INTO v_pessoa;

    IF v_email IS NOT NULL THEN
      INSERT INTO public.pessoa_identificadores
        (pessoa_id, tipo, valor, valor_original, origem)
      VALUES (v_pessoa, 'email', v_email, NEW.email, 'plataforma')
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  -- O vínculo com a conta, que é o que faz a pessoa contar como "tem conta".
  -- `ON CONFLICT DO NOTHING` porque o índice único de chave forte é global: se
  -- este profile_id já estiver amarrado, não há nada a fazer.
  INSERT INTO public.pessoa_identificadores
    (pessoa_id, tipo, valor, valor_original, origem)
  VALUES (v_pessoa, 'profile_id', NEW.id::text, NEW.id::text, 'plataforma')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.pessoa_ao_criar_perfil() IS
  'Liga conta nova a uma pessoa. Casa por e-mail normalizado, que é chave forte; nunca por nome.';

-- ── O gatilho ────────────────────────────────────────────────
-- AFTER INSERT, e não BEFORE: se a criação da pessoa falhar por qualquer
-- motivo, o cadastro da conta não pode falhar junto. Perder o vínculo é
-- recuperável pela carga; impedir alguém de criar conta não é.
DROP TRIGGER IF EXISTS trg_pessoa_ao_criar_perfil ON public.profiles;
CREATE TRIGGER trg_pessoa_ao_criar_perfil
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.pessoa_ao_criar_perfil();

-- ── Os que já ficaram para trás ──────────────────────────────
-- Onze em 06/08/2026, todos criados naquele dia. Mesma lógica do trigger, em
-- lote: quem tem e-mail conhecido é anexado, o resto vira pessoa nova.
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem)
SELECT i.pessoa_id, 'profile_id', p.id::text, p.id::text, 'migracao_094'
  FROM public.profiles p
  JOIN public.pessoa_identificadores i
    ON i.tipo = 'email' AND i.valor = public.normalizar_email(p.email)
 WHERE NOT EXISTS (
         SELECT 1 FROM public.pessoa_identificadores x
          WHERE x.tipo = 'profile_id' AND x.valor = p.id::text
       )
ON CONFLICT DO NOTHING;

WITH orfaos AS (
  SELECT p.id, p.email, p.full_name
    FROM public.profiles p
   WHERE NOT EXISTS (
           SELECT 1 FROM public.pessoa_identificadores x
            WHERE x.tipo = 'profile_id' AND x.valor = p.id::text
         )
), criadas AS (
  INSERT INTO public.pessoas (nome_canonico)
  SELECT COALESCE(NULLIF(btrim(o.full_name), ''), o.email, 'sem nome') FROM orfaos o
  RETURNING id, nome_canonico
), pareado AS (
  SELECT c.id AS pessoa_id, o.id AS profile_id, o.email
    FROM (SELECT *, row_number() OVER (ORDER BY id) AS n FROM criadas) c
    JOIN (SELECT *, row_number() OVER (ORDER BY id) AS n FROM orfaos) o USING (n)
)
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem)
SELECT pessoa_id, 'profile_id', profile_id::text, profile_id::text, 'migracao_094' FROM pareado
UNION ALL
SELECT pessoa_id, 'email', public.normalizar_email(email), email, 'migracao_094'
  FROM pareado WHERE public.normalizar_email(email) IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── Conferência ──────────────────────────────────────────────
--   -- Deve devolver zero depois de aplicar:
--   SELECT count(*) FROM profiles p
--    WHERE NOT EXISTS (SELECT 1 FROM pessoa_identificadores x
--                       WHERE x.tipo='profile_id' AND x.valor = p.id::text);
--
--   -- E deve continuar devolvendo zero depois do próximo cadastro.
