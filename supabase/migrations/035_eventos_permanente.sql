-- Eventos permanentes não são auto-desativados quando data_fim passa.
-- Auto-desativação roda no client (EventosTab) ao montar a aba.
ALTER TABLE certificado_eventos
  ADD COLUMN IF NOT EXISTS permanente BOOLEAN NOT NULL DEFAULT false;
