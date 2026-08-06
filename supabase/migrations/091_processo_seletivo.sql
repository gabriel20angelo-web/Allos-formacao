-- =============================================================
-- O processo seletivo entra no banco
-- =============================================================
-- O seletivo é a porta de entrada de boa parte de quem chega na Allos, e até
-- hoje ele vivia inteiro em outro sistema. O primeiro export que chegou tinha
-- só nome, e casar por nome é o erro que a 089 existe para impedir: das 65
-- pessoas, 15 casavam, e mesmo essas ficavam sob suspeita.
--
-- O export completo trouxe e-mail E WhatsApp, e o número mudou de figura:
-- **31 das 65 já existem como pessoa**, o dobro. É a diferença entre chave
-- forte e chave fraca, medida.
--
-- Duas tabelas, e a divisão entre elas é o que permite responder "quantas vezes
-- essa pessoa tentou", que era a pergunta que o formato antigo não respondia:
-- candidatura é a pessoa, tentativa é cada vez que ela fez a avaliação.
-- =============================================================

-- ── A candidatura ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seletivo_candidaturas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL nunca deveria acontecer com este export, porque todo mundo tem
  -- e-mail. Fica opcional para o dia em que chegar um arquivo pela metade:
  -- guardar o candidato sem pessoa é melhor que recusar a linha.
  pessoa_id      UUID REFERENCES public.pessoas(id) ON DELETE SET NULL,
  nome           TEXT NOT NULL,
  email          TEXT,
  telefone       TEXT,
  faculdade      TEXT,
  periodo        TEXT,
  vinculo        TEXT NOT NULL DEFAULT 'email',
  criada_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT seletivo_vinculo_conhecido
    CHECK (vinculo IN ('email', 'telefone', 'nova', 'manual'))
);

-- A mesma chave forte não pode virar dois candidatos, pela mesma razão que
-- vale do lado de `pessoa_identificadores`.
CREATE UNIQUE INDEX IF NOT EXISTS seletivo_cand_email
  ON public.seletivo_candidaturas (email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seletivo_cand_telefone
  ON public.seletivo_candidaturas (telefone) WHERE telefone IS NOT NULL;
CREATE INDEX IF NOT EXISTS seletivo_cand_pessoa
  ON public.seletivo_candidaturas (pessoa_id);

-- ── A tentativa ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.seletivo_tentativas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id  UUID NOT NULL REFERENCES public.seletivo_candidaturas(id) ON DELETE CASCADE,
  caso            TEXT,
  nota            NUMERIC,
  status          TEXT,
  sessoes         INT,
  duracao_seg     INT,
  -- Os seis critérios chegam em colunas separadas e ficam num objeto só: eles
  -- mudam de nome e de quantidade quando a rubrica muda, e uma coluna por
  -- critério viraria uma migration por revisão da avaliação.
  criterios       JSONB,
  avaliacao       TEXT,
  realizada_em    TIMESTAMPTZ,
  -- Idempotência: reimportar o mesmo arquivo não duplica. A chave é o texto
  -- cru da linha, não o valor convertido, senão uma mudança no parse reescreve
  -- todas as chaves e a mesma tentativa entra de novo.
  linha_chave     TEXT NOT NULL,
  importada_em    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seletivo_tent_unica
  ON public.seletivo_tentativas (candidatura_id, linha_chave);
CREATE INDEX IF NOT EXISTS seletivo_tent_cand
  ON public.seletivo_tentativas (candidatura_id);

-- ── Quem enxerga ─────────────────────────────────────────────
-- Nota e texto de avaliação de quem foi rejeitado é o dado mais sensível do
-- banco inteiro. Só admin, e a view herda isso por security_invoker.
ALTER TABLE public.seletivo_candidaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seletivo_tentativas   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seletivo_cand_admin ON public.seletivo_candidaturas;
CREATE POLICY seletivo_cand_admin ON public.seletivo_candidaturas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS seletivo_tent_admin ON public.seletivo_tentativas;
CREATE POLICY seletivo_tent_admin ON public.seletivo_tentativas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seletivo_candidaturas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seletivo_tentativas   TO authenticated;

-- ── A leitura ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.seletivo_visao
  WITH (security_invoker = true) AS
  SELECT c.id,
         c.pessoa_id,
         c.nome,
         c.email,
         c.telefone,
         c.faculdade,
         c.periodo,
         c.vinculo,
         count(t.id)                                   AS tentativas,
         max(t.nota)                                   AS melhor_nota,
         min(t.realizada_em)                           AS primeira_em,
         max(t.realizada_em)                           AS ultima_em,
         bool_or(lower(coalesce(t.status,'')) = 'ativo') AS passou,
         (SELECT tt.status FROM public.seletivo_tentativas tt
           WHERE tt.candidatura_id = c.id
           ORDER BY tt.realizada_em DESC NULLS LAST LIMIT 1) AS status_atual
    FROM public.seletivo_candidaturas c
    LEFT JOIN public.seletivo_tentativas t ON t.candidatura_id = c.id
   GROUP BY c.id;

GRANT SELECT ON public.seletivo_visao TO authenticated;

-- ── Conferência ──────────────────────────────────────────────
--   SELECT count(*) FROM seletivo_candidaturas;         -- 65 depois do 1º import
--   SELECT count(*) FROM seletivo_candidaturas WHERE pessoa_id IS NOT NULL;  -- ~31
--   SELECT vinculo, count(*) FROM seletivo_candidaturas GROUP BY 1;
