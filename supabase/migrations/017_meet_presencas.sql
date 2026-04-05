-- =============================================================
-- Meet Presence Tracking
-- Dados de quórum capturados pela extensão Chrome no Google Meet
-- =============================================================

CREATE TABLE IF NOT EXISTS formacao_meet_presencas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID REFERENCES formacao_slots(id) ON DELETE SET NULL,
  meet_link TEXT NOT NULL,
  condutor_nome TEXT NOT NULL,
  data_reuniao DATE NOT NULL,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  hora_inicio TIMESTAMPTZ NOT NULL,
  hora_fim TIMESTAMPTZ NOT NULL,
  duracao_minutos INTEGER NOT NULL,
  participantes JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_participantes INTEGER NOT NULL DEFAULT 0,
  media_participantes NUMERIC(5,2) DEFAULT 0,
  pico_participantes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE formacao_meet_presencas ENABLE ROW LEVEL SECURITY;

-- Public read (para o painel)
CREATE POLICY "select_meet_presencas" ON formacao_meet_presencas
  FOR SELECT USING (true);

-- Insert aberto (extensão envia sem auth)
CREATE POLICY "insert_meet_presencas" ON formacao_meet_presencas
  FOR INSERT WITH CHECK (true);

-- Admin full access
CREATE POLICY "admin_all_meet_presencas" ON formacao_meet_presencas
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_meet_presencas_data ON formacao_meet_presencas(data_reuniao);
CREATE INDEX IF NOT EXISTS idx_meet_presencas_slot ON formacao_meet_presencas(slot_id);
CREATE INDEX IF NOT EXISTS idx_meet_presencas_created ON formacao_meet_presencas(created_at);
