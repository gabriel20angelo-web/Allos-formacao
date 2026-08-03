-- 049_sinais_estado.sql
-- Estado do sinal de atenção que saiu da lista aberta.
--
-- Mandar o e-mail não encerra o caso: abre uma espera. Antes disso, sair de
-- "em aberto" só acontecia por "Resolvido", e o aviso enviado ficava sem lugar
-- nenhum: ou o caso seguia incomodando na lista, ou ia para arquivado como se
-- já estivesse decidido.
--
-- Dois destinos possíveis agora:
--   email_enviado — avisamos, esperando manifestação
--   arquivado     — conferido e encerrado
--
-- A regra de retorno vale para os dois: se o peso recalculado passar do que
-- está gravado, a ocorrência volta para a lista aberta.

ALTER TABLE sinais_resolvidos
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'arquivado';

-- Constraint em passo separado: a coluna pode já existir de uma execução
-- anterior, e ADD CONSTRAINT não aceita IF NOT EXISTS.
DO $$
BEGIN
  ALTER TABLE sinais_resolvidos
    ADD CONSTRAINT sinais_resolvidos_estado_check
    CHECK (estado IN ('email_enviado', 'arquivado'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_sinais_resolvidos_estado
  ON sinais_resolvidos (estado, resolvido_em DESC);
