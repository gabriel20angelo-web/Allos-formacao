-- 047_sinais_resolvidos.sql
-- Arquivamento de sinais de atenção.
--
-- Os sinais não são gravados: nascem de um cálculo sobre os eventos, toda vez
-- que o painel abre. Então "resolver" não pode apagar nada — o que se guarda
-- aqui é a marca de que aquela ocorrência já foi olhada.
--
-- `peso_resolvido` é o que faz o sinal voltar. Se a pessoa tinha 4 feedbacks
-- num dia e o caso foi resolvido, some da lista; se depois mandar mais três, o
-- peso recalculado passa do arquivado e a ocorrência reaparece — que é
-- exatamente o comportamento pedido: arquivar não é perdoar para sempre.

CREATE TABLE IF NOT EXISTS sinais_resolvidos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  -- id determinístico do sinal (tipo + pessoa + dia), gerado em utils/suspeita
  sinal_id TEXT NOT NULL UNIQUE,
  pessoa TEXT NOT NULL,
  pessoa_email TEXT,
  tipo TEXT NOT NULL,
  dia DATE NOT NULL,
  titulo TEXT NOT NULL,
  peso_resolvido INTEGER NOT NULL DEFAULT 0,
  observacao TEXT,
  resolvido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  resolvido_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sinais_resolvidos_email
  ON sinais_resolvidos (pessoa_email);
CREATE INDEX IF NOT EXISTS idx_sinais_resolvidos_data
  ON sinais_resolvidos (resolvido_em DESC);

ALTER TABLE sinais_resolvidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sinais_resolvidos_admin" ON sinais_resolvidos;
CREATE POLICY "sinais_resolvidos_admin" ON sinais_resolvidos FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
