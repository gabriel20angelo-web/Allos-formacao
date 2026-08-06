-- =============================================================
-- 090_seletivo_importacao.sql
-- O processo seletivo entra pela porta que a 089 deixou aberta
-- =============================================================
-- A 089 disse a frase e não teve com quem usá-la: CHAVE FORTE CASA SOZINHA,
-- NOME NUNCA CASA SOZINHO. Ela até reservou o tipo `avaliallos_id` e a coluna
-- `veio_do_seletivo` em `pessoas_resumo`, esperando esta migration. É esta.
--
-- O processo seletivo roda em outro sistema, cuidado por outra pessoa, e é por
-- onde boa parte da gente entra na Allos. O que chega de lá é um CSV. O
-- primeiro que veio, em 06/08/2026, tinha exatamente cinco colunas:
--
--     Nome completo, Paciente (caso), Nota final, Status, Data/hora (ISO)
--
-- Sem e-mail. Sem telefone. Sessenta e cinco linhas, uma por pessoa, e a única
-- coisa que liga aquela pessoa a alguém do nosso banco é o nome dela. Vinte e
-- uma das sessenta e cinco têm só duas palavras: "Sara Dias", "Vanessa Lima",
-- "Sarah Silva". Casar isso por nome contra 511 pessoas seria inventar
-- identidade e imprimir o chute como se fosse cadastro, que é o erro que a 089
-- inteira existe para não deixar acontecer de novo.
--
-- Então o desenho aqui parte de uma premissa desconfortável e assume ela até o
-- fim: A IMPORTAÇÃO NÃO PRECISA CASAR TUDO. Precisa casar o que dá para casar
-- com certeza, criar o que claramente é gente nova, e ter a coragem de mandar o
-- resto para um humano olhar. Uma fila de quinze pendências é um resultado bom.
-- Zero pendências e quinze vínculos errados é um desastre silencioso, porque
-- ninguém descobre até o certificado sair com as horas de outra pessoa.
--
-- Já foi pedido ao outro lado que o próximo export traga e-mail e/ou telefone,
-- e uma linha POR TENTATIVA em vez de uma por pessoa. Nada aqui depende disso
-- chegar. As colunas novas são lidas se existirem e ignoradas se não; a tabela
-- de tentativas guarda N linhas por candidato desde já, e um arquivo com uma
-- linha por pessoa simplesmente produz candidatos com uma tentativa só.
--
-- ── As quatro tabelas e por que são quatro ──
--
--   seletivo_importacoes  o arquivo bruto, inteiro, como veio. Guardar o CSV
--                         no banco é o que permite reprocessar meses depois
--                         sem pedir o arquivo de novo para quem já apagou.
--   seletivo_candidaturas uma linha por CANDIDATO. É aqui que mora o vínculo
--                         com `pessoas`, e é aqui que ele pode ser NULL, que é
--                         a coluna mais importante da migration: NULL quer
--                         dizer "ainda não sabemos", e não "não é ninguém".
--   seletivo_tentativas   uma linha por TENTATIVA. Caso, nota, status, quando.
--                         Separada porque a mesma pessoa tenta mais de uma vez
--                         e porque é o nível em que a idempotência acontece.
--   seletivo_decisoes     o rastro de cada decisão humana sobre um ambíguo.
--                         Existe pela mesma razão que `pessoa_fusoes`: sem
--                         desfazer, ninguém usa a ferramenta.
--
-- SEM TABELA TEMPORÁRIA, e não é preferência de estilo — é a mesma armadilha
-- que a 089 documentou. O SQL Editor do Supabase fala com o banco por um pooler
-- em modo transação, que pode mandar cada comando por uma conexão diferente.
-- Uma CREATE TEMP TABLE na primeira linha não existe mais na segunda:
-- `relation "_x" does not exist`. Onde este script precisou de estado
-- intermediário, ele usou CTE dentro do mesmo comando ou variável de plpgsql
-- dentro da mesma função.
--
-- NADA AQUI ALTERA TABELA EXISTENTE. `pessoa_identificadores` já aceita
-- `tipo = 'avaliallos_id'` e `origem = 'avaliallos'` desde a 089, então a
-- importação escreve nela sem precisar mexer em nenhum CHECK. Rodar esta
-- migration duas vezes é seguro.
-- =============================================================


-- ── 1. Um normalizador a mais ────────────────────────────────
-- A 089 trouxe normalizar_email, normalizar_telefone e normalizar_nome, e são
-- elas que continuam decidindo o que é igual a quê. Falta só um detalhe de
-- vitrine: três dos sessenta e cinco nomes do primeiro arquivo vieram inteiros
-- em caixa alta. Não é problema de casamento (normalizar_nome já derruba a
-- caixa), é problema de leitura: "RAFAELLY KETELLYN DE SOUZA LIMA" numa lista
-- de pessoas grita no meio das outras e parece erro de sistema.
--
-- Mexe só em quem gritou. Nome escrito normal passa intocado, porque corrigir
-- caixa de quem já escreveu certo é como se estraga "de Souza" em "De Souza".

CREATE OR REPLACE FUNCTION public.arrumar_caixa_nome(txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN t IS NULL THEN NULL
    WHEN t <> upper(t) THEN t
    ELSE replace(replace(replace(replace(replace(replace(replace(
           initcap(lower(t)),
           ' Da ', ' da '), ' De ', ' de '), ' Do ', ' do '),
           ' Das ', ' das '), ' Dos ', ' dos '), ' Di ', ' di '), ' E ', ' e ')
  END
  FROM (SELECT nullif(btrim(regexp_replace(coalesce(txt, ''), '\s+', ' ', 'g')), '') AS t) x
$$;

GRANT EXECUTE ON FUNCTION public.arrumar_caixa_nome(TEXT) TO authenticated, anon;


-- ── 2. O arquivo ─────────────────────────────────────────────
-- O CSV inteiro, em texto, do jeito que chegou. Sessenta e cinco linhas dão
-- cinco kilobytes; um export acumulado de dois anos daria talvez trezentos.
-- Cabe numa coluna TEXT com folga, e o que se ganha é grande: quando a regra de
-- casamento mudar (e ela vai mudar, porque a fila vai ensinar coisas), dá para
-- reprocessar tudo sem pedir nada a ninguém.
--
-- `estado` separa o que foi só espiado do que foi gravado. A tela mostra a
-- prévia ANTES de escrever em `pessoas`, e para mostrar a prévia ela precisa
-- ter o arquivo em algum lugar. Então o upload cria a linha em 'previa', e só o
-- botão de confirmar a leva a 'aplicada'. Uma prévia abandonada é lixo de cinco
-- kilobytes que ninguém precisa limpar com pressa.

CREATE TABLE IF NOT EXISTS public.seletivo_importacoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arquivo_nome   TEXT NOT NULL,
  -- sha256 do texto cru. É o primeiro dos quatro anéis de idempotência: com
  -- ele a tela consegue dizer "este arquivo exatamente já entrou dia tal",
  -- antes de qualquer linha ser lida. Não é UNIQUE de propósito: reimportar o
  -- mesmo arquivo é uma operação legítima (e inofensiva, pelos outros anéis),
  -- o que não pode é acontecer sem a pessoa saber.
  arquivo_hash   TEXT NOT NULL,
  arquivo_bytes  INTEGER,
  conteudo       TEXT NOT NULL,
  -- O cabeçalho como veio e o mapa que a tela usou para entender cada coluna.
  -- Guardar os dois é o que torna o reprocessamento fiel: sem o mapa, seis
  -- meses depois ninguém lembra que "Paciente (caso)" era o caso.
  cabecalho      TEXT[],
  mapa_colunas   JSONB,
  linhas_total   INTEGER NOT NULL DEFAULT 0,
  estado         TEXT NOT NULL DEFAULT 'previa',
  resumo         JSONB,
  enviada_por    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  enviada_em     TIMESTAMPTZ NOT NULL DEFAULT now(),
  aplicada_por   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aplicada_em    TIMESTAMPTZ,

  CONSTRAINT seletivo_imp_estado CHECK (estado IN ('previa', 'aplicada', 'descartada'))
);

CREATE INDEX IF NOT EXISTS seletivo_imp_hash ON public.seletivo_importacoes (arquivo_hash);
CREATE INDEX IF NOT EXISTS seletivo_imp_recentes ON public.seletivo_importacoes (enviada_em DESC);

COMMENT ON TABLE public.seletivo_importacoes IS
  'O CSV do processo seletivo, cru. Existe para poder reprocessar sem pedir o arquivo de novo.';
COMMENT ON COLUMN public.seletivo_importacoes.estado IS
  'previa = arquivo depositado, nada escrito em pessoas. aplicada = gravado. descartada = a pessoa desistiu.';


-- ── 3. O candidato ───────────────────────────────────────────
-- Uma linha por pessoa no processo seletivo, do lado de lá. A ligação com o
-- nosso mundo é `pessoa_id`, e ela é NULLABLE porque a dúvida precisa caber no
-- modelo. Um candidato sem pessoa não é um erro nem um dado incompleto: é um
-- item de fila, esperando alguém que sabe.
--
-- As três colunas normalizadas são GENERATED de propósito. A 089 deixou os
-- normalizadores como função justamente "para que a aplicação normalize
-- exatamente igual ao banco"; coluna gerada é o próximo passo dessa ideia, que
-- é não deixar a aplicação normalizar coisa nenhuma. Se um dia um normalizador
-- mudar de comportamento, lembre que os valores gravados NÃO se atualizam
-- sozinhos e um backfill vira necessário.

CREATE TABLE IF NOT EXISTS public.seletivo_candidaturas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- A certidão de nascimento da linha, não a chave de busca. Vale
  -- 'ext:<id>' | 'email:<norm>' | 'tel:<norm>' | 'nome:<norm>', pela primeira
  -- chave que existia no dia em que este candidato apareceu, e NUNCA muda
  -- depois. A busca de verdade acontece pelas colunas fortes abaixo, em ordem
  -- de precedência. Esta coluna é o último anel de segurança: se a busca da
  -- rota tiver um bug, o UNIQUE aqui impede que o mesmo arquivo, rodado duas
  -- vezes, produza dois candidatos.
  chave_origem    TEXT NOT NULL,

  nome_origem     TEXT,
  email_origem    TEXT,
  telefone_origem TEXT,
  -- O id do candidato no sistema de lá, quando o export trouxer. É a chave que
  -- resolve o problema inteiro, e é por isso que ela é a primeira coisa a pedir
  -- no CSV ideal: com ela nada disto aqui precisa adivinhar nada.
  externo_id      TEXT,

  nome_normalizado     TEXT GENERATED ALWAYS AS (public.normalizar_nome(nome_origem)) STORED,
  email_normalizado    TEXT GENERATED ALWAYS AS (public.normalizar_email(email_origem)) STORED,
  telefone_normalizado TEXT GENERATED ALWAYS AS (public.normalizar_telefone(telefone_origem)) STORED,

  pessoa_id       UUID REFERENCES public.pessoas(id) ON DELETE SET NULL,
  vinculo         TEXT NOT NULL DEFAULT 'ambiguo',
  vinculo_motivo  TEXT,
  -- O que o casador viu na hora: quem foram os candidatos a pessoa, por que
  -- cada um entrou na lista, quantas palavras tinha o nome. É o que a fila de
  -- confirmação mostra para o humano decidir sem ter que refazer a conta.
  vinculo_evidencia JSONB,

  confirmado_por  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  confirmado_em   TIMESTAMPTZ,

  primeira_importacao_id UUID REFERENCES public.seletivo_importacoes(id) ON DELETE SET NULL,
  ultima_importacao_id   UUID REFERENCES public.seletivo_importacoes(id) ON DELETE SET NULL,

  criada_em       TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizada_em   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT seletivo_cand_vinculo_conhecido CHECK (vinculo IN (
    'forte',       -- casou por e-mail, telefone ou id externo
    'nome_unico',  -- nome de 3+ palavras significativas, único no banco
    'nova',        -- ninguém parecido: pessoa criada por esta importação
    'manual',      -- um humano decidiu, e a decisão dele vale para sempre
    'ambiguo',     -- na fila: nome curto, homônimo, ou só parecido
    'conflito',    -- na fila: as chaves fortes apontam para pessoas diferentes
    'ignorada'     -- fora da fila por decisão humana, sem pessoa
  )),

  -- O invariante que impede a tabela de mentir: ou tem pessoa e saiu da fila,
  -- ou não tem pessoa e está num dos três estados de espera. Sem isto, um bug
  -- de escrita produz candidato "resolvido" apontando para lugar nenhum, e a
  -- fila fica vazia sem que nada tenha sido resolvido.
  CONSTRAINT seletivo_cand_fila_coerente CHECK (
    (pessoa_id IS NULL) = (vinculo IN ('ambiguo', 'conflito', 'ignorada'))
  )
);

-- ⭐ A lei da 089, repetida aqui porque vale igual deste lado da porta.
-- Chave forte é única entre candidatos. Nome NÃO tem índice único, e não é
-- esquecimento: dois candidatos podem se chamar "Sara Dias" e serem duas
-- pessoas, exatamente como do lado de `pessoas`.
CREATE UNIQUE INDEX IF NOT EXISTS seletivo_cand_chave       ON public.seletivo_candidaturas (chave_origem);
CREATE UNIQUE INDEX IF NOT EXISTS seletivo_cand_externo     ON public.seletivo_candidaturas (externo_id)            WHERE externo_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seletivo_cand_email       ON public.seletivo_candidaturas (email_normalizado)     WHERE email_normalizado IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS seletivo_cand_telefone    ON public.seletivo_candidaturas (telefone_normalizado)  WHERE telefone_normalizado IS NOT NULL;
CREATE        INDEX IF NOT EXISTS seletivo_cand_nome        ON public.seletivo_candidaturas (nome_normalizado);
CREATE        INDEX IF NOT EXISTS seletivo_cand_pessoa      ON public.seletivo_candidaturas (pessoa_id);
CREATE        INDEX IF NOT EXISTS seletivo_cand_fila        ON public.seletivo_candidaturas (vinculo) WHERE pessoa_id IS NULL;

COMMENT ON COLUMN public.seletivo_candidaturas.pessoa_id IS
  'NULL quer dizer "ainda não sabemos", nunca "não é ninguém". NULL + vinculo ambiguo/conflito = está na fila.';


-- ── 4. A tentativa ───────────────────────────────────────────
-- Uma linha por vez que o candidato tentou. O primeiro arquivo trouxe uma
-- tentativa por pessoa porque o export era assim; o próximo deve trazer várias,
-- e a tabela já está pronta para as duas formas.
--
-- Os campos `_origem` guardam o texto EXATO da célula do CSV, e não são
-- redundância: são eles que a chave de idempotência hasheia. Hashear o valor já
-- convertido significaria que uma mudança na função de parse (um fuso, uma
-- vírgula decimal) reescreve todas as chaves e a mesma linha entra de novo.
-- O texto cru não muda nunca, então a chave não muda nunca.

CREATE TABLE IF NOT EXISTS public.seletivo_tentativas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id UUID NOT NULL REFERENCES public.seletivo_candidaturas(id) ON DELETE CASCADE,
  importacao_id  UUID REFERENCES public.seletivo_importacoes(id) ON DELETE SET NULL,

  externo_tentativa_id TEXT,

  caso_origem         TEXT,
  nota_origem         TEXT,
  status_origem       TEXT,
  realizada_em_origem TEXT,

  -- Convertidos pela rota, porque converter aqui dentro (num GENERATED) faria
  -- uma célula com "40,5xyz" derrubar o INSERT inteiro sem chance de tratar.
  caso           TEXT,
  nota           NUMERIC,
  realizada_em   TIMESTAMPTZ,

  -- O status, ao contrário, converte aqui: o CASE é total, não tem entrada que
  -- o faça falhar, e deixar o vocabulário no banco é o que impede cada tela de
  -- inventar a sua própria lista de sinônimos de "aprovado".
  status TEXT GENERATED ALWAYS AS (
    CASE
      WHEN btrim(coalesce(status_origem, '')) = '' THEN NULL
      WHEN lower(btrim(status_origem)) IN
        ('ativo','ativa','aprovado','aprovada','aceito','aceita','selecionado','selecionada','active','approved')
        THEN 'ativo'
      WHEN lower(btrim(status_origem)) IN
        ('rejeitado','rejeitada','reprovado','reprovada','recusado','recusada','eliminado','eliminada','rejected','denied')
        THEN 'rejeitado'
      WHEN lower(btrim(status_origem)) IN
        ('pendente','em andamento','andamento','aguardando','em análise','em analise','pending')
        THEN 'pendente'
      ELSE 'outro'
    END
  ) STORED,

  linha_num      INTEGER,

  -- ⭐ O anel de idempotência que faz o trabalho de verdade.
  -- Se o export der um id de tentativa, é ele. Se não der, é o md5 do conteúdo
  -- cru da linha. Duas tentativas genuinamente iguais em caso, nota e status
  -- mas em datas diferentes têm hashes diferentes e entram as duas, que é o
  -- certo. A mesma linha vinda no arquivo da semana que vem colide e não entra.
  -- Todos os argumentos são TEXT, então a expressão é imutável sem depender de
  -- fuso, locale ou de como o parse do dia converteu a data.
  linha_chave TEXT GENERATED ALWAYS AS (
    coalesce(
      nullif(btrim(coalesce(externo_tentativa_id, '')), ''),
      md5(
        lower(btrim(coalesce(caso_origem, '')))         || '|' ||
        btrim(coalesce(nota_origem, ''))                || '|' ||
        lower(btrim(coalesce(status_origem, '')))       || '|' ||
        btrim(coalesce(realizada_em_origem, ''))
      )
    )
  ) STORED,

  criada_em      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS seletivo_tent_unica
  ON public.seletivo_tentativas (candidatura_id, linha_chave);

CREATE INDEX IF NOT EXISTS seletivo_tent_por_cand  ON public.seletivo_tentativas (candidatura_id);
CREATE INDEX IF NOT EXISTS seletivo_tent_por_imp   ON public.seletivo_tentativas (importacao_id);
CREATE INDEX IF NOT EXISTS seletivo_tent_por_data  ON public.seletivo_tentativas (realizada_em DESC);

COMMENT ON COLUMN public.seletivo_tentativas.linha_chave IS
  'Idempotência. md5 do texto CRU da linha, ou o id de tentativa do outro sistema quando existir.';


-- ── 5. O rastro das decisões ─────────────────────────────────
-- Cada vez que um humano resolve um ambíguo, sobra uma linha aqui com o estado
-- de antes. É o mesmo motivo de `pessoa_fusoes` na 089: uma ferramenta que
-- decide identidade e não sabe desfazer é uma ferramenta que ninguém usa duas
-- vezes.

CREATE TABLE IF NOT EXISTS public.seletivo_decisoes (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidatura_id UUID NOT NULL REFERENCES public.seletivo_candidaturas(id) ON DELETE CASCADE,
  acao           TEXT NOT NULL,
  pessoa_id      UUID REFERENCES public.pessoas(id) ON DELETE SET NULL,
  vinculo_antes  TEXT,
  pessoa_antes   UUID,
  motivo         TEXT,
  evidencia      JSONB,
  decidida_por   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decidida_em    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT seletivo_dec_acao CHECK (acao IN ('ligar', 'criar', 'ignorar', 'reabrir', 'importacao'))
);

CREATE INDEX IF NOT EXISTS seletivo_dec_por_cand ON public.seletivo_decisoes (candidatura_id, decidida_em DESC);


-- ── 6. Quem enxerga ──────────────────────────────────────────
-- Nota de processo seletivo e status de rejeição são o dado mais sensível que
-- este banco guarda: diz quem não passou. Fechado em admin, via is_admin(),
-- que desde a 078 enxerga cargo acumulado.

ALTER TABLE public.seletivo_importacoes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seletivo_candidaturas  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seletivo_tentativas    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seletivo_decisoes      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seletivo_imp_admin ON public.seletivo_importacoes;
CREATE POLICY seletivo_imp_admin ON public.seletivo_importacoes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS seletivo_cand_admin ON public.seletivo_candidaturas;
CREATE POLICY seletivo_cand_admin ON public.seletivo_candidaturas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS seletivo_tent_admin ON public.seletivo_tentativas;
CREATE POLICY seletivo_tent_admin ON public.seletivo_tentativas
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS seletivo_dec_admin ON public.seletivo_decisoes;
CREATE POLICY seletivo_dec_admin ON public.seletivo_decisoes
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.seletivo_importacoes  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seletivo_candidaturas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seletivo_tentativas   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seletivo_decisoes     TO authenticated;


-- ── 7. Carimbar os identificadores ───────────────────────────
-- Sai da importação e da resolução manual, então mora numa função só: sempre
-- que um candidato ganha pessoa, as chaves dele têm que ir parar em
-- `pessoa_identificadores`, senão a próxima importação não vai reconhecer
-- ninguém e a fila vai crescer de novo pelos mesmos motivos.
--
-- Os tipos e a origem já existem na 089. `avaliallos` está na lista de origens
-- permitidas e `avaliallos_id` na de tipos, reservados lá pensando exatamente
-- neste dia. Nenhum CHECK precisa ser alterado.
--
-- A checagem de dono antes de cada chave forte é o detalhe que decide se a
-- importação termina ou aborta: o índice único da 089 recusaria um e-mail que
-- já é de outra pessoa, e um RAISE no meio de um FOR desfaria as sessenta e
-- quatro linhas anteriores. Aqui a chave disputada simplesmente não é gravada,
-- e o candidato fica com o vínculo que tinha.

CREATE OR REPLACE FUNCTION public.seletivo_carimbar_identificadores(
  p_candidatura_id UUID,
  p_pessoa_id      UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT * INTO c FROM public.seletivo_candidaturas WHERE id = p_candidatura_id;
  IF NOT FOUND OR p_pessoa_id IS NULL THEN RETURN; END IF;

  -- O nome, sempre, e sempre FRACO. É ele que faz a próxima importação
  -- reconhecer esta pessoa sem que ninguém precise decidir de novo.
  IF c.nome_normalizado IS NOT NULL THEN
    INSERT INTO public.pessoa_identificadores
      (pessoa_id, tipo, valor, valor_original, origem, evidencia)
    VALUES (p_pessoa_id, 'nome_digitado', c.nome_normalizado, c.nome_origem, 'avaliallos',
            jsonb_build_object('candidatura_id', c.id, 'nota', 'nome como veio no processo seletivo'))
    ON CONFLICT DO NOTHING;
  END IF;

  IF c.email_normalizado IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.pessoa_identificadores i
        WHERE i.tipo = 'email' AND i.valor = c.email_normalizado AND i.pessoa_id <> p_pessoa_id
     ) THEN
    INSERT INTO public.pessoa_identificadores
      (pessoa_id, tipo, valor, valor_original, origem, evidencia)
    VALUES (p_pessoa_id, 'email', c.email_normalizado, c.email_origem, 'avaliallos',
            jsonb_build_object('candidatura_id', c.id))
    ON CONFLICT DO NOTHING;
  END IF;

  IF c.telefone_normalizado IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.pessoa_identificadores i
        WHERE i.tipo = 'telefone' AND i.valor = c.telefone_normalizado AND i.pessoa_id <> p_pessoa_id
     ) THEN
    INSERT INTO public.pessoa_identificadores
      (pessoa_id, tipo, valor, valor_original, origem, evidencia)
    VALUES (p_pessoa_id, 'telefone', c.telefone_normalizado, c.telefone_origem, 'avaliallos',
            jsonb_build_object('candidatura_id', c.id))
    ON CONFLICT DO NOTHING;
  END IF;

  IF c.externo_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.pessoa_identificadores i
        WHERE i.tipo = 'avaliallos_id' AND i.valor = c.externo_id AND i.pessoa_id <> p_pessoa_id
     ) THEN
    INSERT INTO public.pessoa_identificadores
      (pessoa_id, tipo, valor, valor_original, origem, evidencia)
    VALUES (p_pessoa_id, 'avaliallos_id', c.externo_id, c.externo_id, 'avaliallos',
            jsonb_build_object('candidatura_id', c.id))
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seletivo_carimbar_identificadores(UUID, UUID) TO authenticated;


-- ── 8. Aplicar a importação ──────────────────────────────────
-- A rota calcula o plano em JS (é lá que dá para escrever a regra de casamento
-- de um jeito legível e testável), e manda o plano inteiro para cá numa
-- chamada. A razão de ser uma função e não vinte round-trips do cliente é
-- transação: o supabase-js não abre uma. Sem isto, uma queda de rede no meio
-- deixa trinta candidatos gravados, quinze pessoas criadas e nenhuma tentativa,
-- e ninguém sabe onde parou.
--
-- Formato de p_plano:
--   { "candidaturas": [ {
--       "chave_origem": "nome:sara dias",
--       "nome_origem": "Sara Dias", "email_origem": null, "telefone_origem": null,
--       "externo_id": null,
--       "decisao": "ligar" | "criar" | "fila",
--       "pessoa_id": "<uuid>" | null,
--       "nivel": "forte|nome_unico|nova|manual|ambiguo|conflito",
--       "motivo": "email|telefone|externo|nome_unico|nome_curto|homonimo|conflito|parecido|nada",
--       "evidencia": { "candidatos": [ ... ] },
--       "tentativas": [ { "caso_origem": "...", "nota_origem": "40",
--                         "status_origem": "Ativo", "realizada_em_origem": "2026-...",
--                         "caso": "...", "nota": 40, "realizada_em": "2026-...",
--                         "externo_tentativa_id": null, "linha_num": 4 } ]
--   } ] }

CREATE OR REPLACE FUNCTION public.seletivo_aplicar(
  p_importacao_id UUID,
  p_plano         JSONB
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c            JSONB;
  t            JSONB;
  v_cand       UUID;
  v_pessoa     UUID;
  v_forte      UUID;
  v_decisao    TEXT;
  v_vinculo    TEXT;
  v_nome       TEXT;
  v_email      TEXT;
  v_tel        TEXT;
  v_ext        TEXT;
  n_ligadas    INTEGER := 0;
  n_criadas    INTEGER := 0;
  n_fila       INTEGER := 0;
  n_intactas   INTEGER := 0;
  n_desviadas  INTEGER := 0;
  n_tent_novas INTEGER := 0;
  n_tent_rep   INTEGER := 0;
  v_resumo     JSONB;
BEGIN
  -- auth.uid() é NULL no SQL Editor, onde já se roda como dono do banco. A
  -- checagem vale para quem chega pela aplicação, que é onde ela protege.
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin importa o processo seletivo.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.seletivo_importacoes WHERE id = p_importacao_id) THEN
    RAISE EXCEPTION 'Importação não existe: %', p_importacao_id;
  END IF;

  FOR c IN SELECT * FROM jsonb_array_elements(coalesce(p_plano -> 'candidaturas', '[]'::jsonb))
  LOOP
    v_decisao := coalesce(c ->> 'decisao', 'fila');
    v_nome    := nullif(btrim(coalesce(c ->> 'nome_origem', '')), '');
    v_email   := public.normalizar_email(c ->> 'email_origem');
    v_tel     := public.normalizar_telefone(c ->> 'telefone_origem');
    v_ext     := nullif(btrim(coalesce(c ->> 'externo_id', '')), '');
    v_pessoa  := nullif(c ->> 'pessoa_id', '')::UUID;

    -- ⭐ Rede de segurança: a chave forte manda, mesmo contra o plano.
    -- O plano foi calculado sobre uma leitura de `pessoas` de segundos atrás.
    -- Se nesse meio-tempo alguém ganhou este e-mail (outra aba, outro admin,
    -- uma inscrição), ligar é o certo e criar seria duplicar. Reconsultar aqui
    -- dentro da transação custa três selects e fecha a corrida.
    v_forte := NULL;
    IF v_ext IS NOT NULL THEN
      SELECT i.pessoa_id INTO v_forte FROM public.pessoa_identificadores i
       WHERE i.tipo = 'avaliallos_id' AND i.valor = v_ext LIMIT 1;
    END IF;
    IF v_forte IS NULL AND v_email IS NOT NULL THEN
      SELECT i.pessoa_id INTO v_forte FROM public.pessoa_identificadores i
       WHERE i.tipo = 'email' AND i.valor = v_email LIMIT 1;
    END IF;
    IF v_forte IS NULL AND v_tel IS NOT NULL THEN
      SELECT i.pessoa_id INTO v_forte FROM public.pessoa_identificadores i
       WHERE i.tipo = 'telefone' AND i.valor = v_tel LIMIT 1;
    END IF;

    IF v_forte IS NOT NULL THEN
      IF v_decisao <> 'ligar' OR v_pessoa IS DISTINCT FROM v_forte THEN
        n_desviadas := n_desviadas + 1;
      END IF;
      v_pessoa  := v_forte;
      v_decisao := 'ligar';
    END IF;

    -- ⭐ Segunda rede: este candidato já foi importado antes e já tem pessoa?
    -- O ON CONFLICT lá embaixo já protege a tabela, mas tarde demais: sem esta
    -- consulta, um plano que diga "criar" para uma chave que já existe criaria
    -- a pessoa PRIMEIRO, o upsert manteria a pessoa antiga, e sobraria uma
    -- pessoa órfã no banco a cada reimportação. Perguntar antes custa um select.
    v_cand := NULL;
    SELECT s.id, s.pessoa_id INTO v_cand, v_forte
      FROM public.seletivo_candidaturas s
     WHERE s.chave_origem = c ->> 'chave_origem';
    IF v_cand IS NOT NULL AND v_forte IS NOT NULL THEN
      v_pessoa   := v_forte;
      v_decisao  := 'ligar';
      n_intactas := n_intactas + 1;
    END IF;

    IF v_decisao = 'criar' AND v_pessoa IS NULL THEN
      INSERT INTO public.pessoas (nome_canonico, observacao)
      VALUES (coalesce(public.arrumar_caixa_nome(v_nome), v_email, v_tel, 'sem nome'),
              'Criada pela importação do processo seletivo.')
      RETURNING id INTO v_pessoa;
      n_criadas := n_criadas + 1;
      v_vinculo := 'nova';
    ELSIF v_decisao = 'ligar' AND v_pessoa IS NOT NULL THEN
      -- "ligadas" conta vínculo NOVO. Quem já estava ligado de uma importação
      -- anterior é "intacta", e separar os dois é o que faz a segunda rodada do
      -- mesmo arquivo devolver zero em tudo, que é a prova da idempotência.
      IF v_cand IS NULL OR v_forte IS NULL THEN
        n_ligadas := n_ligadas + 1;
      END IF;
      v_vinculo := CASE WHEN coalesce(c ->> 'nivel', '') IN ('forte', 'nome_unico', 'manual', 'nova')
                        THEN c ->> 'nivel' ELSE 'forte' END;
    ELSE
      v_pessoa  := NULL;
      n_fila    := n_fila + 1;
      v_vinculo := CASE WHEN coalesce(c ->> 'nivel', '') IN ('conflito', 'ignorada')
                        THEN c ->> 'nivel' ELSE 'ambiguo' END;
    END IF;

    INSERT INTO public.seletivo_candidaturas (
      chave_origem, nome_origem, email_origem, telefone_origem, externo_id,
      pessoa_id, vinculo, vinculo_motivo, vinculo_evidencia,
      primeira_importacao_id, ultima_importacao_id
    ) VALUES (
      c ->> 'chave_origem', v_nome,
      nullif(btrim(coalesce(c ->> 'email_origem', '')), ''),
      nullif(btrim(coalesce(c ->> 'telefone_origem', '')), ''),
      v_ext, v_pessoa, v_vinculo, c ->> 'motivo', c -> 'evidencia',
      p_importacao_id, p_importacao_id
    )
    -- Dentro do ON CONFLICT a linha existente se chama pelo nome CRU da tabela.
    -- Qualificar com `public.` aqui é erro de sintaxe ("missing FROM-clause
    -- entry for table public"), e é um erro que só aparece na hora de rodar.
    ON CONFLICT (chave_origem) DO UPDATE SET
      -- ⭐ Enriquecer, nunca apagar. O arquivo novo pode trazer o e-mail que
      -- faltava e não pode tirar o telefone que já tínhamos, porque um export
      -- com uma coluna a menos apagaria meses de dado sem avisar.
      nome_origem     = coalesce(excluded.nome_origem,     seletivo_candidaturas.nome_origem),
      email_origem    = coalesce(excluded.email_origem,    seletivo_candidaturas.email_origem),
      telefone_origem = coalesce(excluded.telefone_origem, seletivo_candidaturas.telefone_origem),
      externo_id      = coalesce(excluded.externo_id,      seletivo_candidaturas.externo_id),

      -- ⭐ E o principal: DECISÃO HUMANA VENCE ALGORITMO, PARA SEMPRE.
      -- Quem já tem pessoa fica como está. Uma importação futura não desfaz o
      -- que alguém confirmou olhando as evidências, nem manda de volta para a
      -- fila algo que já foi resolvido. Sem esta linha, reimportar seria
      -- reabrir todo o trabalho manual acumulado.
      pessoa_id = coalesce(seletivo_candidaturas.pessoa_id, excluded.pessoa_id),
      vinculo   = CASE WHEN seletivo_candidaturas.pessoa_id IS NOT NULL
                       THEN seletivo_candidaturas.vinculo ELSE excluded.vinculo END,
      vinculo_motivo = CASE WHEN seletivo_candidaturas.pessoa_id IS NOT NULL
                            THEN seletivo_candidaturas.vinculo_motivo ELSE excluded.vinculo_motivo END,
      vinculo_evidencia = CASE WHEN seletivo_candidaturas.pessoa_id IS NOT NULL
                               THEN seletivo_candidaturas.vinculo_evidencia ELSE excluded.vinculo_evidencia END,

      ultima_importacao_id = p_importacao_id,
      atualizada_em = now()
    RETURNING id, pessoa_id INTO v_cand, v_pessoa;

    IF v_pessoa IS NOT NULL THEN
      PERFORM public.seletivo_carimbar_identificadores(v_cand, v_pessoa);
    END IF;

    FOR t IN SELECT * FROM jsonb_array_elements(coalesce(c -> 'tentativas', '[]'::jsonb))
    LOOP
      INSERT INTO public.seletivo_tentativas (
        candidatura_id, importacao_id, externo_tentativa_id,
        caso_origem, nota_origem, status_origem, realizada_em_origem,
        caso, nota, realizada_em, linha_num
      ) VALUES (
        v_cand, p_importacao_id,
        nullif(btrim(coalesce(t ->> 'externo_tentativa_id', '')), ''),
        t ->> 'caso_origem', t ->> 'nota_origem', t ->> 'status_origem', t ->> 'realizada_em_origem',
        nullif(btrim(coalesce(t ->> 'caso', '')), ''),
        nullif(t ->> 'nota', '')::NUMERIC,
        nullif(t ->> 'realizada_em', '')::TIMESTAMPTZ,
        nullif(t ->> 'linha_num', '')::INTEGER
      )
      ON CONFLICT (candidatura_id, linha_chave) DO NOTHING;

      IF FOUND THEN n_tent_novas := n_tent_novas + 1;
      ELSE           n_tent_rep  := n_tent_rep  + 1;
      END IF;
    END LOOP;
  END LOOP;

  -- Reimportar o mesmo arquivo tem que devolver ligadas=0, criadas=0,
  -- tentativas_novas=0, e tudo em `intactas` e `tentativas_repetidas`. Se não
  -- devolver, algum dos quatro anéis de idempotência furou.
  v_resumo := jsonb_build_object(
    'ligadas',              n_ligadas,
    'criadas',              n_criadas,
    'intactas',             n_intactas,
    'na_fila',              n_fila,
    'desviadas',            n_desviadas,
    'tentativas_novas',     n_tent_novas,
    'tentativas_repetidas', n_tent_rep,
    'em',                   now()
  );

  UPDATE public.seletivo_importacoes
     SET estado       = 'aplicada',
         aplicada_em  = now(),
         aplicada_por = auth.uid(),
         resumo       = v_resumo
   WHERE id = p_importacao_id;

  RETURN v_resumo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seletivo_aplicar(UUID, JSONB) TO authenticated;


-- ── 9. Resolver um da fila ───────────────────────────────────
-- O admin decide um por vez, olhando as evidências dos dois lados. Quatro
-- ações e nada mais: é esta pessoa, não é nenhuma delas, isto não é candidato
-- válido, e me desfaça o que eu acabei de fazer.

CREATE OR REPLACE FUNCTION public.seletivo_resolver(
  p_candidatura_id UUID,
  p_acao           TEXT,
  p_pessoa_id      UUID DEFAULT NULL,
  p_motivo         TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_pessoa UUID;
  v_vinculo TEXT;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin resolve a fila do processo seletivo.';
  END IF;

  SELECT * INTO c FROM public.seletivo_candidaturas WHERE id = p_candidatura_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidatura não existe: %', p_candidatura_id;
  END IF;

  IF p_acao = 'ligar' THEN
    IF p_pessoa_id IS NULL THEN
      RAISE EXCEPTION 'Ligar exige dizer a qual pessoa.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.pessoas WHERE id = p_pessoa_id) THEN
      RAISE EXCEPTION 'Pessoa não existe: %', p_pessoa_id;
    END IF;
    v_pessoa  := p_pessoa_id;
    v_vinculo := 'manual';

  ELSIF p_acao = 'criar' THEN
    INSERT INTO public.pessoas (nome_canonico, observacao)
    VALUES (coalesce(public.arrumar_caixa_nome(c.nome_origem), c.email_origem, 'sem nome'),
            coalesce(p_motivo, 'Criada ao resolver a fila do processo seletivo.'))
    RETURNING id INTO v_pessoa;
    v_vinculo := 'manual';

  ELSIF p_acao = 'ignorar' THEN
    v_pessoa  := NULL;
    v_vinculo := 'ignorada';

  ELSIF p_acao = 'reabrir' THEN
    -- Desfaz. A pessoa criada por engano NÃO é apagada aqui de propósito:
    -- apagar em cascata levaria junto identificadores que podem ter vindo de
    -- outra fonte no meio-tempo. Ela fica órfã e some pela tela de duplicadas.
    v_pessoa  := NULL;
    v_vinculo := 'ambiguo';

  ELSE
    RAISE EXCEPTION 'Ação desconhecida: % (use ligar, criar, ignorar ou reabrir)', p_acao;
  END IF;

  INSERT INTO public.seletivo_decisoes
    (candidatura_id, acao, pessoa_id, vinculo_antes, pessoa_antes, motivo, evidencia, decidida_por)
  VALUES (p_candidatura_id, p_acao, v_pessoa, c.vinculo, c.pessoa_id, p_motivo,
          c.vinculo_evidencia, auth.uid());

  UPDATE public.seletivo_candidaturas
     SET pessoa_id      = v_pessoa,
         vinculo        = v_vinculo,
         vinculo_motivo = coalesce(p_motivo, vinculo_motivo),
         confirmado_por = CASE WHEN p_acao = 'reabrir' THEN NULL ELSE auth.uid() END,
         confirmado_em  = CASE WHEN p_acao = 'reabrir' THEN NULL ELSE now() END,
         atualizada_em  = now()
   WHERE id = p_candidatura_id;

  IF v_pessoa IS NOT NULL THEN
    PERFORM public.seletivo_carimbar_identificadores(p_candidatura_id, v_pessoa);
  END IF;

  RETURN jsonb_build_object('ok', true, 'candidatura_id', p_candidatura_id,
                            'pessoa_id', v_pessoa, 'vinculo', v_vinculo);
END;
$$;

GRANT EXECUTE ON FUNCTION public.seletivo_resolver(UUID, TEXT, UUID, TEXT) TO authenticated;


-- ── 10. Onde olhar depois ────────────────────────────────────
-- `security_invoker` é obrigatório: sem ele a view roda com os poderes de quem
-- a criou e devolve as linhas por cima da RLS que acabou de ser posta, que é
-- exatamente o vazamento que a 051 teve de fechar depois.

CREATE OR REPLACE VIEW public.seletivo_candidatos
  WITH (security_invoker = true) AS
  SELECT c.id,
         c.nome_origem,
         c.email_origem,
         c.telefone_origem,
         c.externo_id,
         c.pessoa_id,
         p.nome_canonico AS pessoa_nome,
         c.vinculo,
         c.vinculo_motivo,
         count(t.id)                                                         AS tentativas,
         max(t.nota)                                                         AS melhor_nota,
         (array_agg(t.nota   ORDER BY t.realizada_em DESC NULLS LAST))[1]    AS ultima_nota,
         (array_agg(t.status ORDER BY t.realizada_em DESC NULLS LAST))[1]    AS status_atual,
         (array_agg(t.caso   ORDER BY t.realizada_em DESC NULLS LAST))[1]    AS ultimo_caso,
         bool_or(t.status = 'ativo')                                         AS passou_alguma_vez,
         min(t.realizada_em)                                                 AS primeira_tentativa,
         max(t.realizada_em)                                                 AS ultima_tentativa,
         c.criada_em
    FROM public.seletivo_candidaturas c
    LEFT JOIN public.pessoas p             ON p.id = c.pessoa_id
    LEFT JOIN public.seletivo_tentativas t ON t.candidatura_id = c.id
   GROUP BY c.id, p.nome_canonico;

GRANT SELECT ON public.seletivo_candidatos TO authenticated;

-- A fila. Não é uma lista de erros, é uma lista para um humano olhar — e ela
-- deve ter linhas mesmo quando tudo funcionou. Um arquivo em que nada cai aqui
-- é mais suspeito do que um em que quinze caem.
CREATE OR REPLACE VIEW public.seletivo_fila
  WITH (security_invoker = true) AS
  SELECT c.id,
         c.nome_origem,
         c.email_origem,
         c.telefone_origem,
         c.nome_normalizado,
         array_length(string_to_array(c.nome_normalizado, ' '), 1) AS palavras_no_nome,
         c.vinculo,
         c.vinculo_motivo,
         c.vinculo_evidencia,
         jsonb_array_length(coalesce(c.vinculo_evidencia -> 'candidatos', '[]'::jsonb)) AS sugestoes,
         count(t.id)        AS tentativas,
         max(t.nota)        AS melhor_nota,
         max(t.realizada_em) AS ultima_tentativa,
         c.ultima_importacao_id,
         c.criada_em
    FROM public.seletivo_candidaturas c
    LEFT JOIN public.seletivo_tentativas t ON t.candidatura_id = c.id
   WHERE c.pessoa_id IS NULL
     AND c.vinculo IN ('ambiguo', 'conflito')
   GROUP BY c.id;

GRANT SELECT ON public.seletivo_fila TO authenticated;


-- ── 11. Conferência ──────────────────────────────────────────
-- Rode depois de cada importação.
--
--   SELECT estado, count(*) FROM seletivo_importacoes GROUP BY 1;
--   SELECT vinculo, count(*) FROM seletivo_candidaturas GROUP BY 1 ORDER BY 2 DESC;
--   SELECT count(*) FROM seletivo_tentativas;
--   SELECT * FROM seletivo_fila ORDER BY sugestoes DESC, melhor_nota DESC;
--
-- E a prova de que a idempotência funciona: aplique a MESMA importação de novo
-- e compare. `tentativas_novas` tem que voltar 0 e as três contagens acima têm
-- que ficar idênticas.
--
--   SELECT public.seletivo_aplicar('<id da importacao>', '<mesmo plano>'::jsonb);
--
-- Esperado no arquivo de 06/08/2026 (65 linhas, sem e-mail e sem telefone),
-- contra as 511 pessoas de hoje: nenhum casamento por chave forte, porque não
-- há chave forte no arquivo. Tudo decidido por nome. As 21 linhas de nome com
-- duas palavras não podem casar sozinhas em nenhuma hipótese — ou caem na fila,
-- se baterem com alguém, ou viram pessoa nova, se não baterem com ninguém.
