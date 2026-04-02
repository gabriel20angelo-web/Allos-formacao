-- Criar tabela de categorias
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Qualquer um pode ler categorias
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);

-- Apenas admins podem inserir/deletar
CREATE POLICY "categories_insert" ON categories FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "categories_delete" ON categories FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Apenas admins podem atualizar categorias
CREATE POLICY "categories_admin_update" ON categories FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Coluna de ordenação
ALTER TABLE categories ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Seed com categorias padrão
INSERT INTO categories (name) VALUES
  ('Psicologia Clínica'),
  ('Neuropsicologia'),
  ('Psicoterapia'),
  ('Avaliação Psicológica'),
  ('Supervisão Clínica'),
  ('Formação Continuada'),
  ('Pesquisa')
ON CONFLICT (name) DO NOTHING;
