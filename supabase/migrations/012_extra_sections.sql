-- ============================================================
-- Módulos extras (opcionais para certificado/prova)
-- ============================================================

ALTER TABLE sections ADD COLUMN is_extra BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN sections.is_extra IS 'Módulos extras não contam para conclusão do curso nem para a prova, mas adicionam horas ao certificado se concluídos.';
