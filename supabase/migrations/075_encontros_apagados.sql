-- =============================================================
-- Apagar de vez precisa durar
-- =============================================================
-- O Gabriel apagou os encontros e eles voltaram. Todos os dez reapareceram no
-- mesmo minuto, em sequência de segundos — a assinatura de uma varredura.
--
-- A causa: apagar removia a nossa linha, mas o registro continua existindo do
-- lado do Google, e a ingestão o encontra de novo na rodada seguinte e recria
-- tudo. Apagar era, na prática, esconder por quinze minutos.
--
-- Uma marca na própria linha não resolveria, porque a linha é justamente o que
-- some. Então a lembrança mora numa tabela à parte, que sobrevive ao apagar.

CREATE TABLE IF NOT EXISTS formacao_meet_apagados (
  conference_record_id TEXT PRIMARY KEY,
  space_name TEXT,
  motivo TEXT,
  apagado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  apagado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE formacao_meet_apagados IS
  'Conferências que não devem voltar. A ingestão pula o que está aqui: sem isto, apagar um encontro dura só até a próxima rodada.';

ALTER TABLE formacao_meet_apagados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_le_apagados ON formacao_meet_apagados;
CREATE POLICY admin_le_apagados ON formacao_meet_apagados
  FOR SELECT USING (public.is_admin());

-- =============================================================
-- Encontro sem ninguém não é encontro
-- =============================================================
-- A regra automática exigia UMA pessoa por até cinco minutos. Uma sala que
-- ficou aberta sozinha por sete minutos, com zero participantes, escapava e
-- entrava nas médias — e três dos encontros que sobraram na tela eram
-- exatamente isso.
--
-- Zero participante é lixo por definição, independentemente da duração.
UPDATE formacao_meet_encontros
   SET descartado = true,
       descartado_motivo = 'Descartado automaticamente: ninguém entrou.'
 WHERE descartado = false
   AND descartado_manual = false
   AND COALESCE(total_participantes, 0) = 0;
