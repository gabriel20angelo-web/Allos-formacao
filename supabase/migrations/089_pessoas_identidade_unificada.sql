-- =============================================================
-- Pessoas: uma identidade só para as quatro portas de entrada
-- =============================================================
-- Hoje a mesma pessoa existe em três lugares que não se conhecem: o formulário
-- de certificado (nome e e-mail digitados por ela), o Google Meet (nome de tela,
-- às vezes a conta Google) e a plataforma (`profiles`). Uma quarta porta vem aí,
-- o processo seletivo, que traz uma chave que nenhuma das outras tem: telefone.
--
-- O estrago de não ter isso resolvido é medível. O certificado de formação soma
-- horas por `ilike('%nome%')`, então "Ana Silva" leva as horas de "Ana Silva
-- Santos". O card Top Participantes agrupa por e-mail numa aba e por nome na
-- outra, e o pódio muda ao trocar de aba. O gráfico de retenção mensal mede uma
-- população diferente dos cards que estão logo acima dele. E só 20 pessoas
-- aparecem hoje nas duas listas do painel, não porque só 20 frequentem os dois
-- mundos, mas porque nada liga um mundo ao outro.
--
-- A regra que esta migration escreve em SQL, e que é a única coisa que precisa
-- ser lembrada depois:
--
--     CHAVE FORTE CASA SOZINHA. NOME NUNCA CASA SOZINHO.
--
-- Chave forte é a que não colide e não muda: telefone, conta Google, e-mail, id
-- do perfil. Chave fraca é nome, em qualquer variação. O `unique` parcial lá
-- embaixo é o que impede o sistema de voltar a tratar nome como se fosse forte:
-- duas pessoas PODEM ter o mesmo nome registrado, e nenhuma pode compartilhar
-- um e-mail.
--
-- O desenho não é novo: `formacao_meet_aliases` já acertou tudo isso na
-- migration 083 (chave fraca, chaves fortes, identidade sem conta, rastro de
-- quem confirmou). O que faltava era escopo, porque ela só serve ao Meet.
--
-- NADA AQUI ALTERA TABELA EXISTENTE. Só cria tabelas novas e as popula a partir
-- do que já existe. Rodar duas vezes é seguro.
-- =============================================================


-- ── 1. Normalizadores ────────────────────────────────────────
-- A comparação tem que acontecer sobre a forma normalizada, senão
-- "Maria@Gmail.com " e "maria@gmail.com" viram duas pessoas. Ficam como função
-- para que a aplicação normalize exatamente igual ao banco.

CREATE OR REPLACE FUNCTION public.normalizar_email(txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(lower(btrim(coalesce(txt, ''))), '')
$$;

-- Telefone brasileiro: guarda só dígitos e derruba o 55 do país, para que
-- "+55 (81) 99999-9999" e "81999999999" sejam a mesma chave.
CREATE OR REPLACE FUNCTION public.normalizar_telefone(txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
           WHEN d = '' THEN NULL
           WHEN length(d) >= 12 AND left(d, 2) = '55' THEN right(d, length(d) - 2)
           ELSE d
         END
  FROM (SELECT regexp_replace(coalesce(txt, ''), '\D', '', 'g') AS d) x
$$;

-- Sem depender da extensão unaccent, que pode não estar instalada.
CREATE OR REPLACE FUNCTION public.normalizar_nome(txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      lower(translate(coalesce(txt, ''),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
      '\s+', ' ', 'g')),
    '')
$$;

GRANT EXECUTE ON FUNCTION public.normalizar_email(TEXT)    TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.normalizar_telefone(TEXT) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.normalizar_nome(TEXT)     TO authenticated, anon;


-- ── 2. A pessoa ──────────────────────────────────────────────
-- Uma linha por ser humano. Deliberadamente magra: tudo que identifica mora na
-- tabela de identificadores, e o que está aqui é só o rótulo pelo qual essa
-- pessoa é reconhecida numa tela.

CREATE TABLE IF NOT EXISTS public.pessoas (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_canonico TEXT NOT NULL,
  nome_social   TEXT,
  observacao    TEXT,
  criada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pessoas IS
  'Identidade canônica. Uma linha = um ser humano. As chaves vivem em pessoa_identificadores.';


-- ── 3. Os identificadores ────────────────────────────────────
-- Cada chave conhecida daquela pessoa, com de onde ela veio e quem confirmou.
-- `forca` é coluna gerada: derivar do tipo impede que alguém grave um nome
-- marcado como forte e reabra o buraco que esta migration fecha.

CREATE TABLE IF NOT EXISTS public.pessoa_identificadores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- DEFERRABLE de propósito: a carga inicial cria a pessoa e o e-mail dela no
  -- mesmo comando, e sem adiar a checagem para o fim da transação a ordem
  -- interna do comando decidiria se a migration passa ou quebra.
  pessoa_id      UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE
                   DEFERRABLE INITIALLY DEFERRED,
  tipo           TEXT NOT NULL,
  valor          TEXT NOT NULL,
  valor_original TEXT,
  forca          TEXT GENERATED ALWAYS AS (
                   CASE WHEN tipo IN ('email','telefone','google_user_id','profile_id','avaliallos_id')
                        THEN 'forte' ELSE 'fraca' END
                 ) STORED,
  origem         TEXT NOT NULL DEFAULT 'manual',
  evidencia      JSONB,
  confirmado_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT ident_tipo_conhecido CHECK (tipo IN (
    'email','telefone','google_user_id','profile_id','avaliallos_id',
    'nome_exibicao','nome_digitado'
  )),
  CONSTRAINT ident_origem_conhecida CHECK (origem IN (
    'manual','automatico','certificado','meet','plataforma','avaliallos','migracao_089'
  )),
  CONSTRAINT ident_valor_nao_vazio CHECK (btrim(valor) <> '')
);

-- ⭐ O coração da coisa: uma chave forte pertence a UMA pessoa e ponto.
-- Tentar gravar o mesmo e-mail em duas pessoas passa a falhar, em vez de
-- produzir duas contagens diferentes em duas telas.
CREATE UNIQUE INDEX IF NOT EXISTS pessoa_ident_forte_unica
  ON public.pessoa_identificadores (tipo, valor)
  WHERE forca = 'forte';

-- Nome, ao contrário, PODE se repetir entre pessoas. Três contas já assinaram
-- "Arthur de Assis Souza" no formulário, e são três pessoas. O índice aqui
-- serve para busca, não para exclusividade.
CREATE INDEX IF NOT EXISTS pessoa_ident_fraca_busca
  ON public.pessoa_identificadores (valor)
  WHERE forca = 'fraca';

-- A mesma chave não se repete dentro da mesma pessoa.
CREATE UNIQUE INDEX IF NOT EXISTS pessoa_ident_sem_repeticao
  ON public.pessoa_identificadores (pessoa_id, tipo, valor);

CREATE INDEX IF NOT EXISTS pessoa_ident_por_pessoa
  ON public.pessoa_identificadores (pessoa_id);

COMMENT ON COLUMN public.pessoa_identificadores.forca IS
  'Derivada do tipo. Forte casa sozinha; fraca só sugere e precisa de confirmação humana.';

-- Para quem já criou a tabela numa tentativa anterior, quando a FK ainda era
-- imediata. Sem isto, a carga da seção 6 falha na primeira linha.
ALTER TABLE public.pessoa_identificadores
  DROP CONSTRAINT IF EXISTS pessoa_identificadores_pessoa_id_fkey;
ALTER TABLE public.pessoa_identificadores
  ADD CONSTRAINT pessoa_identificadores_pessoa_id_fkey
  FOREIGN KEY (pessoa_id) REFERENCES public.pessoas(id) ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;


-- ── 4. Fusões ────────────────────────────────────────────────
-- Duas pessoas descobertas como a mesma. Guardar o registro é o que torna a
-- operação reversível: sem ele, fundir é destrutivo e ninguém vai ousar usar.

CREATE TABLE IF NOT EXISTS public.pessoa_fusoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pessoa_mantida UUID NOT NULL REFERENCES public.pessoas(id) ON DELETE CASCADE,
  pessoa_absorvida UUID NOT NULL,
  snapshot       JSONB NOT NULL,
  motivo         TEXT,
  feita_por      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  feita_em       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.pessoas_fundir(
  manter   UUID,
  absorver UUID,
  motivo   TEXT DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap JSONB;
BEGIN
  -- auth.uid() é NULL no SQL Editor, onde já se roda como dono do banco. A
  -- checagem vale para quem chega pela aplicação, que é onde ela protege.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin funde pessoas.';
  END IF;
  IF manter = absorver THEN
    RAISE EXCEPTION 'Origem e destino são a mesma pessoa.';
  END IF;

  -- O snapshot é o desfazer: guarda a pessoa absorvida inteira, com as chaves
  -- que ela tinha, antes de qualquer coisa se mover.
  SELECT jsonb_build_object(
           'pessoa', to_jsonb(p),
           'identificadores', (
             SELECT coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb)
               FROM public.pessoa_identificadores i
              WHERE i.pessoa_id = p.id
           )
         )
    INTO snap
    FROM public.pessoas p
   WHERE p.id = absorver;

  IF snap IS NULL THEN
    RAISE EXCEPTION 'Pessoa a absorver não existe: %', absorver;
  END IF;

  INSERT INTO public.pessoa_fusoes (pessoa_mantida, pessoa_absorvida, snapshot, motivo, feita_por)
  VALUES (manter, absorver, snap, motivo, auth.uid());

  -- Chave que a pessoa mantida já tem é descartada, não duplicada.
  UPDATE public.pessoa_identificadores i
     SET pessoa_id = manter
   WHERE i.pessoa_id = absorver
     AND NOT EXISTS (
       SELECT 1 FROM public.pessoa_identificadores j
        WHERE j.pessoa_id = manter AND j.tipo = i.tipo AND j.valor = i.valor
     );

  DELETE FROM public.pessoas WHERE id = absorver;
  UPDATE public.pessoas SET atualizada_em = now() WHERE id = manter;
END;
$$;

GRANT EXECUTE ON FUNCTION public.pessoas_fundir(UUID, UUID, TEXT) TO authenticated;


-- ── 5. Quem enxerga ──────────────────────────────────────────
-- Isto é dado pessoal de gente que não pediu conta na plataforma. Fica fechado
-- em admin, via is_admin(), que desde a 078 enxerga cargo acumulado. Comparar
-- `role = 'admin'` na unha aqui deixaria de fora quem é admin por cargo.

ALTER TABLE public.pessoas                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_identificadores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pessoa_fusoes          ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pessoas_admin ON public.pessoas;
CREATE POLICY pessoas_admin ON public.pessoas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pessoa_ident_admin ON public.pessoa_identificadores;
CREATE POLICY pessoa_ident_admin ON public.pessoa_identificadores
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS pessoa_fusoes_admin ON public.pessoa_fusoes;
CREATE POLICY pessoa_fusoes_admin ON public.pessoa_fusoes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoas                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_identificadores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pessoa_fusoes          TO authenticated;


-- ── 6. População inicial ─────────────────────────────────────
-- O e-mail é a única chave forte que atravessa as três fontes atuais, então é
-- por ele que a primeira carga é feita. Quem não tem e-mail em lugar nenhum
-- fica de fora de propósito: entrar por nome seria justamente o erro que esta
-- migration existe para não cometer.

-- SEM TABELA TEMPORÁRIA, e isto não é preferência de estilo. O SQL Editor do
-- Supabase fala com o banco através de um pooler em modo transação, que pode
-- mandar cada comando por uma conexão diferente. Tabela temporária vive numa
-- sessão só, então a segunda linha do script já não enxerga a que a primeira
-- criou: `relation "_fontes_email" does not exist`.
--
-- O que substitui o mapa temporário de e-mail para pessoa é a própria
-- `pessoa_identificadores`: depois do comando abaixo, o vínculo já está gravado
-- e os passos seguintes leem de lá. Só o primeiro precisa criar a pessoa e o
-- e-mail dela juntos, e para isso existe uma CTE que escreve nas duas tabelas
-- de uma vez. É por causa dela que a chave estrangeira é DEFERRABLE.

WITH fontes AS (
  SELECT public.normalizar_email(p.email) AS email, p.full_name AS nome
    FROM public.profiles p
   WHERE public.normalizar_email(p.email) IS NOT NULL
  UNION ALL
  SELECT public.normalizar_email(s.email), NULLIF(btrim(s.nome_completo), '')
    FROM public.certificado_submissions s
   WHERE public.normalizar_email(s.email) IS NOT NULL
  UNION ALL
  SELECT public.normalizar_email(a.pessoa_email), NULLIF(btrim(a.pessoa_nome), '')
    FROM public.formacao_meet_aliases a
   WHERE public.normalizar_email(a.pessoa_email) IS NOT NULL
),
-- O nome mais longo é o mais completo, e é por ele que a pessoa é reconhecida
-- numa lista: a mesma conta assinou "Mariana Alves" e "Mariana Alves Ribeiro do
-- Nascimento", e é o segundo que identifica.
agrupado AS (
  SELECT f.email,
         (array_agg(f.nome ORDER BY length(f.nome) DESC NULLS LAST))[1] AS nome
    FROM fontes f
   GROUP BY f.email
),
-- Quem já tem pessoa de uma execução anterior fica de fora, e é isto que torna
-- o script seguro de rodar de novo.
novas AS (
  SELECT gen_random_uuid() AS pessoa_id, a.email, a.nome
    FROM agrupado a
   WHERE NOT EXISTS (
     SELECT 1 FROM public.pessoa_identificadores i
      WHERE i.tipo = 'email' AND i.valor = a.email
   )
),
cria_pessoas AS (
  INSERT INTO public.pessoas (id, nome_canonico)
  SELECT pessoa_id, coalesce(nome, email) FROM novas
  RETURNING id
)
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, origem, evidencia)
SELECT pessoa_id, 'email', email, 'migracao_089',
       jsonb_build_object('nota', 'e-mail unificado de profiles, certificado e meet')
  FROM novas
ON CONFLICT DO NOTHING;

-- 6.1 conta da plataforma
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem)
SELECT m.pessoa_id, 'profile_id', p.id::text, p.full_name, 'plataforma'
  FROM public.profiles p
  JOIN public.pessoa_identificadores m
    ON m.tipo = 'email' AND m.valor = public.normalizar_email(p.email)
ON CONFLICT DO NOTHING;

-- 6.2 conta Google, pelos aliases que já foram resolvidos contra um perfil
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem, evidencia, confirmado_por)
SELECT m.pessoa_id, 'google_user_id', a.google_user_id, a.display_name, 'meet',
       jsonb_build_object('alias_id', a.id, 'origem_alias', a.origem),
       (SELECT pr.id FROM public.profiles pr WHERE pr.id = a.confirmado_por)
  FROM public.formacao_meet_aliases a
  JOIN public.profiles p ON p.id = a.aluno_id
  JOIN public.pessoa_identificadores m
    ON m.tipo = 'email' AND m.valor = public.normalizar_email(p.email)
 WHERE a.google_user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6.3 conta Google dos identificados sem conta na plataforma (migration 083)
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem, evidencia, confirmado_por)
SELECT m.pessoa_id, 'google_user_id', a.google_user_id, a.display_name, 'meet',
       jsonb_build_object('alias_id', a.id, 'origem_alias', a.origem),
       (SELECT pr.id FROM public.profiles pr WHERE pr.id = a.confirmado_por)
  FROM public.formacao_meet_aliases a
  JOIN public.pessoa_identificadores m
    ON m.tipo = 'email' AND m.valor = public.normalizar_email(a.pessoa_email)
 WHERE a.google_user_id IS NOT NULL AND a.aluno_id IS NULL
ON CONFLICT DO NOTHING;

-- 6.4 nome de tela do Meet, como chave FRACA
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem, evidencia, confirmado_por)
SELECT DISTINCT m.pessoa_id, 'nome_exibicao', public.normalizar_nome(a.display_name), a.display_name, 'meet',
       jsonb_build_object('alias_id', a.id),
       (SELECT pr.id FROM public.profiles pr WHERE pr.id = a.confirmado_por)
  FROM public.formacao_meet_aliases a
  LEFT JOIN public.profiles p ON p.id = a.aluno_id
  JOIN public.pessoa_identificadores m
    ON m.tipo = 'email'
   AND m.valor = coalesce(public.normalizar_email(p.email),
                          public.normalizar_email(a.pessoa_email))
 WHERE public.normalizar_nome(a.display_name) IS NOT NULL
ON CONFLICT DO NOTHING;

-- 6.5 nome digitado no formulário, também FRACO. É o que permite descobrir
-- depois que dois e-mails são a mesma pessoa, sem nunca decidir isso sozinho.
INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem)
SELECT DISTINCT m.pessoa_id, 'nome_digitado', public.normalizar_nome(s.nome_completo),
       btrim(s.nome_completo), 'certificado'
  FROM public.certificado_submissions s
  JOIN public.pessoa_identificadores m
    ON m.tipo = 'email' AND m.valor = public.normalizar_email(s.email)
 WHERE public.normalizar_nome(s.nome_completo) IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO public.pessoa_identificadores (pessoa_id, tipo, valor, valor_original, origem)
SELECT DISTINCT m.pessoa_id, 'nome_digitado', public.normalizar_nome(s.nome_social),
       btrim(s.nome_social), 'certificado'
  FROM public.certificado_submissions s
  JOIN public.pessoa_identificadores m
    ON m.tipo = 'email' AND m.valor = public.normalizar_email(s.email)
 WHERE public.normalizar_nome(s.nome_social) IS NOT NULL
ON CONFLICT DO NOTHING;


-- ── 7. Onde olhar depois ─────────────────────────────────────

-- `security_invoker` é obrigatório aqui: sem ele a view roda com os poderes de
-- quem a criou e devolve as linhas por cima da RLS que acabou de ser posta nas
-- tabelas, que é exatamente o vazamento que a 051 teve de fechar depois.
CREATE OR REPLACE VIEW public.pessoas_resumo
  WITH (security_invoker = true) AS
  SELECT p.id,
         p.nome_canonico,
         max(i.valor) FILTER (WHERE i.tipo = 'email')                AS email,
         max(i.valor) FILTER (WHERE i.tipo = 'telefone')             AS telefone,
         (count(*)    FILTER (WHERE i.tipo = 'profile_id')     > 0)  AS tem_conta,
         (count(*)    FILTER (WHERE i.tipo = 'google_user_id') > 0)  AS tem_google,
         (count(*)    FILTER (WHERE i.tipo = 'avaliallos_id')  > 0)  AS veio_do_seletivo,
         count(*)     FILTER (WHERE i.forca = 'fraca')               AS nomes_conhecidos,
         p.criada_em
    FROM public.pessoas p
    LEFT JOIN public.pessoa_identificadores i ON i.pessoa_id = p.id
   GROUP BY p.id, p.nome_canonico, p.criada_em;

GRANT SELECT ON public.pessoas_resumo TO authenticated;

-- Candidatas a fusão: mesmo nome, e-mails diferentes. NÃO é uma lista de
-- duplicatas, é uma lista para um humano olhar. Homônimo real cai aqui e deve
-- cair mesmo: a decisão é de quem conhece as pessoas.
CREATE OR REPLACE VIEW public.pessoas_possiveis_duplicadas
  WITH (security_invoker = true) AS
  SELECT i.valor AS nome_normalizado,
         count(DISTINCT i.pessoa_id) AS quantas_pessoas,
         array_agg(DISTINCT i.pessoa_id) AS pessoa_ids
    FROM public.pessoa_identificadores i
   WHERE i.forca = 'fraca'
   GROUP BY i.valor
  HAVING count(DISTINCT i.pessoa_id) > 1;

GRANT SELECT ON public.pessoas_possiveis_duplicadas TO authenticated;


-- ── 8. Conferência ───────────────────────────────────────────
-- Rode depois e compare com o que o painel diz hoje.
--
--   SELECT count(*) FROM pessoas;
--   SELECT tipo, forca, count(*) FROM pessoa_identificadores GROUP BY 1,2 ORDER BY 1;
--   SELECT count(*) FROM pessoas_resumo WHERE tem_conta AND email IS NOT NULL;
--   SELECT * FROM pessoas_possiveis_duplicadas ORDER BY quantas_pessoas DESC;
--
-- Esperado nesta base em 06/08/2026: por volta de 516 pessoas (218 dos grupos
-- mais 359 contas, menos as 61 que estão nas duas), e a lista de possíveis
-- duplicadas deve trazer pouca coisa, com uns quatro nomes usados por mais de
-- um e-mail.
