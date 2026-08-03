-- =============================================================
-- Tira a pasta das gravações de uma tabela de leitura pública
-- =============================================================
-- `formacao_cronograma` tem policy `SELECT USING (true)` desde o começo, e de
-- propósito: o formulário público lê horário e duração de lá. Só que RLS é por
-- LINHA, não por coluna. Ao acrescentar `pasta_drive_id`/`pasta_drive_url`
-- naquela tabela, eu tornei o endereço da pasta de gravações legível por
-- qualquer visitante com a chave anônima, que está no JavaScript do site.
--
-- Ter o identificador da pasta não dá acesso ao conteúdo (o Google ainda exige
-- permissão), mas é o endereço de onde mora todo o material dos encontros, e
-- não tem por que estar exposto.
--
-- A configuração sensível do módulo passa a viver em tabela própria, com a
-- mesma regra das outras: leitura só para admin, escrita só pelo service role.

CREATE TABLE IF NOT EXISTS formacao_meet_config (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pasta_drive_id TEXT,
  pasta_drive_url TEXT,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE formacao_meet_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_meet_config" ON formacao_meet_config;
CREATE POLICY "admin_read_meet_config" ON formacao_meet_config
  FOR SELECT USING (public.is_admin());

-- Leva o que já foi configurado para o lugar novo, antes de apagar o antigo.
INSERT INTO formacao_meet_config (id, pasta_drive_id, pasta_drive_url)
SELECT 1, pasta_drive_id, pasta_drive_url
FROM formacao_cronograma
WHERE pasta_drive_id IS NOT NULL
LIMIT 1
ON CONFLICT (id) DO UPDATE
  SET pasta_drive_id = EXCLUDED.pasta_drive_id,
      pasta_drive_url = EXCLUDED.pasta_drive_url;

ALTER TABLE formacao_cronograma DROP COLUMN IF EXISTS pasta_drive_id;
ALTER TABLE formacao_cronograma DROP COLUMN IF EXISTS pasta_drive_url;

-- tolerancia_atraso_min e limite_encerramento_min continuam onde estão: são
-- regras do encontro, da mesma natureza de duracao_minutos, e saber que um
-- grupo tolera sete minutos de atraso não é informação que precise de sigilo.
