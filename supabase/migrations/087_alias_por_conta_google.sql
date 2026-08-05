-- 087_alias_por_conta_google.sql
-- A identidade passa a viajar pela conta Google, e não só pelo nome de tela.
--
-- O alias é indexado pelo nome exibido no Meet, e nome de tela é a coisa menos
-- estável que existe: a mesma pessoa entra como "Andréa", depois como "Dreh",
-- depois pelo celular como "iPhone da Dreh". Cada variação volta para a fila
-- como se fosse gente nova, e o trabalho de identificar é refeito do zero.
--
-- A API do Meet devolve, junto do nome, o identificador da conta Google de quem
-- entrou logado. Ele já era gravado em cada participação e nunca tinha sido
-- usado para casar ninguém. Uma medição de 05/08/2026 mostrou por que ele vale:
-- de 43 participações pendentes de identificação, 42 traziam esse
-- identificador. Identificar a pessoa uma vez passa a resolver todos os
-- encontros dela, os passados e os que ainda vão acontecer, independentemente
-- do nome que ela escrever na tela.
--
-- A coluna já existe na tabela desde que os aliases nasceram. O que falta é
-- deixar o registro dizer que o casamento veio daí, e é só isso que esta
-- migration faz.

ALTER TABLE formacao_meet_aliases
  DROP CONSTRAINT IF EXISTS meet_alias_origem_conhecida;
ALTER TABLE formacao_meet_aliases
  ADD CONSTRAINT meet_alias_origem_conhecida
  CHECK (origem IN ('manual', 'automatico', 'certificado', 'conta_google'));

COMMENT ON COLUMN formacao_meet_aliases.origem IS
  'manual = alguém clicou no painel; automatico = casou com um perfil pela semelhança do nome; certificado = casou com quem preencheu o formulário daquele encontro; conta_google = o nome de tela é novo, mas a conta Google que entrou já tinha identidade conhecida.';

-- A busca da propagação é sempre "quem já tem esta conta Google", e sem índice
-- ela varre a tabela inteira a cada rodada do cron.
CREATE INDEX IF NOT EXISTS idx_meet_aliases_google_user
  ON formacao_meet_aliases (google_user_id)
  WHERE google_user_id IS NOT NULL;
