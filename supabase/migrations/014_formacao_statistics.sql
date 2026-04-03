-- =============================================================
-- Formação Statistics Tables
-- =============================================================

-- Weekly snapshots: captured BEFORE each "Nova Semana" reset
CREATE TABLE IF NOT EXISTS formacao_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  semana_inicio DATE NOT NULL,
  semana_fim DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  observacoes TEXT
);

-- Individual slot data within a snapshot
CREATE TABLE IF NOT EXISTS formacao_snapshot_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_id UUID NOT NULL REFERENCES formacao_snapshots(id) ON DELETE CASCADE,
  slot_id UUID NOT NULL,
  dia_semana INTEGER NOT NULL,
  horario_hora TEXT NOT NULL,
  atividade_nome TEXT,
  status TEXT NOT NULL,
  meet_link TEXT,
  condutores JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Granular log: every status change as it happens
CREATE TABLE IF NOT EXISTS formacao_slot_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES formacao_slots(id) ON DELETE CASCADE,
  status_anterior TEXT,
  status_novo TEXT NOT NULL,
  atividade_nome TEXT,
  condutor_ids UUID[] DEFAULT '{}',
  changed_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE formacao_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_snapshot_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_slot_logs ENABLE ROW LEVEL SECURITY;

-- Public read
CREATE POLICY "select_snapshots" ON formacao_snapshots FOR SELECT USING (true);
CREATE POLICY "select_snapshot_slots" ON formacao_snapshot_slots FOR SELECT USING (true);
CREATE POLICY "select_slot_logs" ON formacao_slot_logs FOR SELECT USING (true);

-- Admin write
CREATE POLICY "admin_all_snapshots" ON formacao_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_snapshot_slots" ON formacao_snapshot_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_slot_logs" ON formacao_slot_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_snapshot_slots_snapshot ON formacao_snapshot_slots(snapshot_id);
CREATE INDEX IF NOT EXISTS idx_snapshot_semana ON formacao_snapshots(semana_inicio);
CREATE INDEX IF NOT EXISTS idx_slot_logs_slot ON formacao_slot_logs(slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_logs_changed ON formacao_slot_logs(changed_at);
