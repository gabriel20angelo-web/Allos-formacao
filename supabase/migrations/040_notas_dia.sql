-- 040_notas_dia.sql
-- Anotações ancoradas em um dia do calendário.
--
-- Existem para dar causa ao movimento do dashboard: "divulguei no Instagram",
-- "mandei e-mail para a lista", "feriado". Sem isso o pico de um dia é só um
-- pico. Por isso a data é livre — anotar um dia SEM nenhum evento é o caso
-- mais valioso: registra a divulgação que não rendeu nada.
--
-- Diferente de `admin_notes` (021), que é bloco de recados por usuário, sem data.

CREATE TABLE IF NOT EXISTS formacao_notas_dia (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  data DATE NOT NULL,
  texto TEXT NOT NULL,
  autor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_formacao_notas_dia_data
  ON formacao_notas_dia (data DESC);

ALTER TABLE formacao_notas_dia ENABLE ROW LEVEL SECURITY;

-- A anotação é da administração, não de quem digitou: todo admin lê e edita.
DROP POLICY IF EXISTS "notas_dia_admin" ON formacao_notas_dia;
CREATE POLICY "notas_dia_admin" ON formacao_notas_dia FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
