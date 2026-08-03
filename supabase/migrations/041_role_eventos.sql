-- 041_role_eventos.sql
-- Cargo "eventos": quem cuida dos eventos do calendário, e só disso.
--
-- Ganha acesso ao painel apenas em /formacao/admin/eventos — não vê alunos,
-- certificados, financeiro nem o resto da formação.
--
-- As comparações usam `role::text` de propósito: `ALTER TYPE ... ADD VALUE`
-- não permite usar o rótulo novo na mesma transação, e comparar como texto
-- deixa o script inteiro rodar de uma vez no SQL Editor.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'eventos';

CREATE OR REPLACE FUNCTION public.can_manage_events() RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  STABLE
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role::text IN ('admin', 'eventos')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_manage_events() TO authenticated, anon;

-- Escrita em eventos: admin (policy antiga) ou o cargo eventos (esta).
DROP POLICY IF EXISTS "eventos_manage" ON certificado_eventos;
CREATE POLICY "eventos_manage" ON certificado_eventos FOR ALL
  USING (public.can_manage_events())
  WITH CHECK (public.can_manage_events());
