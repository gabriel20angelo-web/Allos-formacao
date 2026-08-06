-- =============================================================
-- 090_pessoas_painel.sql: a camada de dados de /formacao/admin/pessoas
-- =============================================================
-- NÃO APLICADA. Escrita a partir da leitura das migrations 000, 011, 039, 042,
-- 051, 053, 055, 070, 074, 075, 078, 083, 086, 087 e 089, e do código de
-- ingestão (src/lib/meet/ingest.ts, src/lib/meet/nomes.ts).
--
-- A 089 criou a identidade. Esta cria a LEITURA da identidade: uma espinha de
-- presenças e cinco perguntas em cima dela. Nada de tabela nova, nada de
-- backfill: só views e funções. Rodar duas vezes é seguro.
--
-- Duas regras que governam tudo abaixo:
--
-- 1. PRESENÇA É UMA POR PESSOA POR DIA POR ATIVIDADE. A mesma presença chega
--    por dois caminhos (o formulário que a pessoa preenche e a sala do Meet
--    que a mede), e somar os dois dobra todo mundo que faz as duas coisas.
--
-- 2. O NÚMERO NUNCA NASCE DE UM NOME SOLTO. Participação do Meet só vira
--    pessoa por conta da plataforma, conta Google ou alias já confirmado. O
--    que não casa por nenhuma dessas três NÃO entra na conta e aparece em
--    `pessoa_participacoes_sem_dono`, para ser resolvido por gente. Contar por
--    semelhança de nome é exatamente o erro que a 089 existe para fechar.
--
-- ⚠️ PENDÊNCIA DE SEGURANÇA QUE ESTA MIGRATION NÃO RESOLVE
--    `certificado_submissions` ainda carrega a policy da 011:
--        CREATE POLICY "select_submissions" ... FOR SELECT USING (true);
--    A 051 fechou profiles, certificates, formacao_meet_presencas e
--    video_questions para o anon, e passou reto por esta. Hoje a chave anônima
--    lê nome, e-mail e RELATO de todo mundo que já preencheu o formulário,
--    ou seja, relato de grupo de formação, que é material clínico. Fechar isso é uma
--    migration à parte, porque o formulário público vive em outro repositório
--    (allos-site) e precisa ser conferido antes. As views abaixo são
--    concedidas só a `authenticated` justamente para não ampliar o vazamento.


-- ── 1. Paridade de normalização com o TypeScript ─────────────
-- `normalizar_nome` (089) tira acento e colapsa espaço, e mais nada.
-- `normalizarNome` (src/lib/meet/nomes.ts), que é quem escreveu cada
-- `display_name_norm` gravado em formacao_meet_participacoes e em
-- formacao_meet_aliases, TAMBÉM troca toda pontuação por espaço. As duas
-- discordam em qualquer nome com hífen, ponto ou apóstrofo:
--
--     normalizar_nome('Ana-Paula J. D''Ávila')      → 'ana-paula j. d''avila'
--     normalizarNome('Ana-Paula J. D''Ávila')       → 'ana paula j d avila'
--
-- Ou seja: os `nome_exibicao` que a 089 gravou na seção 6.4 NÃO casam com
-- `display_name_norm`. Enquanto o casamento do Meet passar por conta, conta
-- Google ou alias (que é como as views abaixo fazem), isso não dá prejuízo,
-- mas qualquer junção futura por nome de tela tem que usar esta função aqui.
CREATE OR REPLACE FUNCTION public.normalizar_nome_meet(txt TEXT)
RETURNS TEXT LANGUAGE sql IMMUTABLE AS $$
  SELECT NULLIF(
    btrim(regexp_replace(
      regexp_replace(
        lower(translate(coalesce(txt, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),
        '[^a-z0-9[:space:]]', ' ', 'g'),
      '[[:space:]]+', ' ', 'g')),
    '')
$$;

GRANT EXECUTE ON FUNCTION public.normalizar_nome_meet(TEXT) TO authenticated, anon;


-- ── 2. Índices que as views abaixo pedem ─────────────────────
-- `normalizar_email` é IMMUTABLE, então serve de expressão de índice. Sem
-- este, casar submissão com pessoa é sequential scan a cada consulta.
CREATE INDEX IF NOT EXISTS idx_cert_subs_email_norm
  ON public.certificado_submissions (public.normalizar_email(email));

-- A 089 deixou (tipo,valor) único só para chave forte e (valor) só para fraca.
-- O resolvedor pergunta sempre "tipo = X e valor = Y", inclusive para fraca.
CREATE INDEX IF NOT EXISTS idx_pessoa_ident_tipo_valor
  ON public.pessoa_identificadores (tipo, valor);

CREATE INDEX IF NOT EXISTS idx_meet_particip_google
  ON public.formacao_meet_participacoes (google_user_id)
  WHERE google_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_lesson_progress_concluida
  ON public.lesson_progress (user_id) WHERE completed;


-- ── 3. A submissão sem as duplicatas ─────────────────────────
-- Mesma pessoa, mesma atividade, mesmo dia aparece mais de uma vez (a pessoa
-- reenvia o formulário). Contar as duas infla presença, infla relato e infla o
-- denominador da nota do condutor.
--
-- Fica a MAIS COMPLETA, não a última: quem reenvia costuma reenviar para
-- escrever mais, e o relato é o que se perde ao escolher errado. Empate de
-- tamanho desempata pela mais recente.
--
-- `coalesce(..., 'sem-email:'||id)` porque NULL não é igual a NULL em DISTINCT
-- ON, mas é AGRUPADO junto. Sem isso, todas as submissões sem e-mail válido
-- colapsariam numa só.
CREATE OR REPLACE VIEW public.certificado_submissions_unicas
  WITH (security_invoker = true) AS
SELECT DISTINCT ON (
         coalesce(public.normalizar_email(s.email), 'sem-email:' || s.id::text),
         coalesce(public.normalizar_nome(s.atividade_nome), ''),
         (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date
       )
       s.*,
       public.normalizar_email(s.email)                            AS email_norm,
       public.normalizar_nome(s.atividade_nome)                    AS atividade_norm,
       (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date        AS dia
  FROM public.certificado_submissions s
 ORDER BY coalesce(public.normalizar_email(s.email), 'sem-email:' || s.id::text),
          coalesce(public.normalizar_nome(s.atividade_nome), ''),
          (s.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
          char_length(btrim(coalesce(s.relato, ''))) DESC,
          s.created_at DESC;

COMMENT ON VIEW public.certificado_submissions_unicas IS
  'Uma submissão por pessoa+atividade+dia. Toda contagem sobre o formulário tem que sair daqui, nunca da tabela crua.';


-- ── 4. Participação do Meet com dono ─────────────────────────
-- Três caminhos, nesta ordem, e nenhum deles é nome solto:
--   1. conta da plataforma  (aluno_id → profile_id)
--   2. conta Google         (google_user_id)
--   3. alias já confirmado  (display_name_norm → conta, ou → e-mail declarado)
-- O `LIMIT 1` sobre `ordem` é o que faz a chave mais forte ganhar quando mais
-- de um caminho responde.
CREATE OR REPLACE VIEW public.pessoa_participacoes
  WITH (security_invoker = true) AS
SELECT p.id                    AS participacao_id,
       p.encontro_id,
       e.slot_id,
       e.data_reuniao,
       e.inicio,
       e.atividade_nome,
       e.condutor_nome,
       e.fala_condutor_pct,
       p.display_name,
       p.display_name_norm,
       p.google_user_id,
       p.aluno_id,
       p.minutos_presentes,
       p.permanencia_pct,
       p.atraso_min,
       p.minutos_fala,
       p.n_turnos_fala,
       p.eh_condutor,
       r.pessoa_id,
       r.via
  FROM public.formacao_meet_participacoes p
  JOIN public.formacao_meet_encontros e ON e.id = p.encontro_id
  LEFT JOIN LATERAL (
    SELECT x.pessoa_id, x.via
      FROM (
        SELECT i.pessoa_id, 'conta'::text AS via, 1 AS ordem
          FROM public.pessoa_identificadores i
         WHERE p.aluno_id IS NOT NULL
           AND i.tipo = 'profile_id' AND i.valor = p.aluno_id::text
        UNION ALL
        SELECT i.pessoa_id, 'conta_google', 2
          FROM public.pessoa_identificadores i
         WHERE p.google_user_id IS NOT NULL
           AND i.tipo = 'google_user_id' AND i.valor = p.google_user_id
        UNION ALL
        SELECT i.pessoa_id, 'alias_conta', 3
          FROM public.formacao_meet_aliases a
          JOIN public.pessoa_identificadores i
            ON i.tipo = 'profile_id' AND i.valor = a.aluno_id::text
         WHERE a.aluno_id IS NOT NULL
           AND a.display_name_norm = p.display_name_norm
        UNION ALL
        SELECT i.pessoa_id, 'alias_email', 4
          FROM public.formacao_meet_aliases a
          JOIN public.pessoa_identificadores i
            ON i.tipo = 'email' AND i.valor = public.normalizar_email(a.pessoa_email)
         WHERE a.pessoa_email IS NOT NULL
           AND a.display_name_norm = p.display_name_norm
      ) x
     ORDER BY x.ordem
     LIMIT 1
  ) r ON true
 WHERE e.descartado = false;

COMMENT ON VIEW public.pessoa_participacoes IS
  'Cada linha do Meet com a pessoa a que ela pertence, quando dá para saber. pessoa_id NULL = ainda não identificada, e é assim que tem que ficar até alguém confirmar.';


-- A fila do que o painel não sabe atribuir. É o denominador honesto de
-- qualquer indicador do Meet: sem ele, cobertura baixa passa por grupo pequeno.
CREATE OR REPLACE VIEW public.pessoa_participacoes_sem_dono
  WITH (security_invoker = true) AS
SELECT pp.participacao_id, pp.encontro_id, pp.data_reuniao, pp.atividade_nome,
       pp.display_name, pp.display_name_norm, pp.google_user_id,
       pp.minutos_presentes
  FROM public.pessoa_participacoes pp
 WHERE pp.pessoa_id IS NULL
   AND pp.eh_condutor = false;


-- ── 5. A espinha: presença ───────────────────────────────────
-- Uma linha por pessoa por dia por atividade, venha de onde vier. `declarada`
-- e `medida` ficam como colunas para a tela poder mostrar de onde veio o
-- número, e para dar de graça o cruzamento "declarou e não estava".
--
-- ⚠️ A chave de atividade é o nome normalizado dos dois lados:
-- `certificado_submissions.atividade_nome` vem do formulário e
-- `formacao_meet_encontros.atividade_nome` vem de `formacao_slots.atividade_nome`
-- (ou de `formacao_meet_spaces.rotulo`, nas salas avulsas). Se um grupo estiver
-- escrito diferente nos dois lugares, a MESMA presença vira DUAS. A consulta de
-- conferência da seção 10 mostra onde isso acontece; enquanto houver divergência,
-- trocar a chave por pessoa+dia é uma linha (comentada abaixo).
CREATE OR REPLACE VIEW public.pessoa_presencas
  WITH (security_invoker = true) AS
WITH declarada AS (
  SELECT i.pessoa_id,
         u.dia,
         coalesce(u.atividade_norm, '(sem atividade)') AS atividade,
         u.created_at AS quando
    FROM public.certificado_submissions_unicas u
    JOIN public.pessoa_identificadores i
      ON i.tipo = 'email' AND i.valor = u.email_norm
),
medida AS (
  SELECT pp.pessoa_id,
         pp.data_reuniao AS dia,
         coalesce(public.normalizar_nome(pp.atividade_nome), '(sem atividade)') AS atividade,
         pp.inicio AS quando
    FROM public.pessoa_participacoes pp
   WHERE pp.pessoa_id IS NOT NULL
     AND pp.eh_condutor = false
)
SELECT u.pessoa_id,
       u.dia,
       u.atividade,          -- trocar por pessoa+dia: remover daqui e do GROUP BY
       bool_or(u.fonte = 'declarada') AS declarada,
       bool_or(u.fonte = 'medida')    AS medida,
       min(u.quando)                  AS quando
  FROM (
    SELECT pessoa_id, dia, atividade, quando, 'declarada'::text AS fonte FROM declarada
    UNION ALL
    SELECT pessoa_id, dia, atividade, quando, 'medida'::text            FROM medida
  ) u
 GROUP BY u.pessoa_id, u.dia, u.atividade;

COMMENT ON VIEW public.pessoa_presencas IS
  'A unidade de presença do sistema: pessoa + dia + atividade, uma vez só, tenha ela declarado, sido medida, ou as duas coisas.';


-- ── 6. A ficha: os dois mundos na mesma linha ────────────────
-- Uma linha por pessoa, com tudo que a tabela ordenável da tela precisa. Cada
-- fonte é varrida UMA vez, em CTE própria, e não em subconsulta correlacionada
-- por pessoa, que é a diferença entre 300 ms e meio minuto.
CREATE OR REPLACE VIEW public.pessoas_ficha
  WITH (security_invoker = true) AS
WITH ident AS (
  SELECT i.pessoa_id,
         min(i.valor) FILTER (WHERE i.tipo = 'email')                AS email,
         min(i.valor) FILTER (WHERE i.tipo = 'telefone')             AS telefone,
         (count(*)    FILTER (WHERE i.tipo = 'profile_id')     > 0)  AS tem_conta,
         (count(*)    FILTER (WHERE i.tipo = 'google_user_id') > 0)  AS tem_google
    FROM public.pessoa_identificadores i
   GROUP BY i.pessoa_id
),
contas AS (
  SELECT i.pessoa_id, i.valor::uuid AS user_id
    FROM public.pessoa_identificadores i
   WHERE i.tipo = 'profile_id'
),
grupo AS (
  SELECT pr.pessoa_id,
         count(*)                     AS presencas_grupo,
         count(*) FILTER (WHERE pr.declarada) AS presencas_declaradas,
         count(*) FILTER (WHERE pr.medida)    AS presencas_medidas,
         count(DISTINCT pr.atividade) AS atividades_distintas,
         min(pr.dia)                  AS primeira_presenca,
         max(pr.dia)                  AS ultima_presenca
    FROM public.pessoa_presencas pr
   GROUP BY pr.pessoa_id
),
formulario AS (
  SELECT i.pessoa_id,
         count(*) FILTER (WHERE char_length(btrim(coalesce(u.relato, ''))) >= 80) AS relatos_longos,
         count(*) FILTER (WHERE btrim(coalesce(u.relato, '')) <> '')              AS relatos,
         avg(u.nota_grupo)    FILTER (WHERE u.nota_grupo > 0)                     AS nota_grupo_media
    FROM public.certificado_submissions_unicas u
    JOIN public.pessoa_identificadores i
      ON i.tipo = 'email' AND i.valor = u.email_norm
   GROUP BY i.pessoa_id
),
aulas AS (
  SELECT c.pessoa_id, count(*) AS aulas_concluidas
    FROM contas c
    JOIN public.lesson_progress lp ON lp.user_id = c.user_id AND lp.completed
   GROUP BY c.pessoa_id
),
tempo AS (
  SELECT c.pessoa_id,
         round(sum(us.seconds) / 3600.0, 1) AS horas_plataforma,
         max(us.ended_at)                   AS ultimo_acesso
    FROM contas c
    JOIN public.usage_sessions us ON us.user_id = c.user_id
   GROUP BY c.pessoa_id
),
meet AS (
  SELECT pp.pessoa_id,
         count(DISTINCT pp.encontro_id)                       AS encontros_meet,
         sum(pp.minutos_presentes)                            AS minutos_sala,
         sum(coalesce(pp.n_turnos_fala, 0))                   AS turnos_fala,
         round(sum(coalesce(pp.minutos_fala, 0))::numeric, 1) AS minutos_fala,
         round(avg(pp.permanencia_pct), 1)                    AS permanencia_media_pct
    FROM public.pessoa_participacoes pp
   WHERE pp.pessoa_id IS NOT NULL AND pp.eh_condutor = false
   GROUP BY pp.pessoa_id
)
SELECT p.id                                        AS pessoa_id,
       coalesce(p.nome_social, p.nome_canonico)    AS nome,
       id.email,
       id.telefone,
       coalesce(id.tem_conta,  false)              AS tem_conta,
       coalesce(id.tem_google, false)              AS tem_google,
       coalesce(g.presencas_grupo, 0)::int         AS presencas_grupo,
       coalesce(g.presencas_declaradas, 0)::int    AS presencas_declaradas,
       coalesce(g.presencas_medidas, 0)::int       AS presencas_medidas,
       coalesce(g.atividades_distintas, 0)::int    AS atividades_distintas,
       coalesce(f.relatos, 0)::int                 AS relatos,
       coalesce(f.relatos_longos, 0)::int          AS relatos_longos,
       round(f.nota_grupo_media, 2)                AS nota_grupo_media,
       coalesce(a.aulas_concluidas, 0)::int        AS aulas_concluidas,
       coalesce(t.horas_plataforma, 0)             AS horas_plataforma,
       t.ultimo_acesso,
       coalesce(m.encontros_meet, 0)::int          AS encontros_meet,
       coalesce(m.minutos_sala, 0)::int            AS minutos_sala,
       coalesce(m.turnos_fala, 0)::int             AS turnos_fala,
       coalesce(m.minutos_fala, 0)                 AS minutos_fala,
       m.permanencia_media_pct,
       g.primeira_presenca,
       g.ultima_presenca,
       CASE WHEN g.ultima_presenca IS NULL THEN NULL
            ELSE ((now() AT TIME ZONE 'America/Sao_Paulo')::date - g.ultima_presenca)
       END                                         AS dias_desde_ultima
  FROM public.pessoas p
  LEFT JOIN ident      id ON id.pessoa_id = p.id
  LEFT JOIN grupo      g  ON g.pessoa_id  = p.id
  LEFT JOIN formulario f  ON f.pessoa_id  = p.id
  LEFT JOIN aulas      a  ON a.pessoa_id  = p.id
  LEFT JOIN tempo      t  ON t.pessoa_id  = p.id
  LEFT JOIN meet       m  ON m.pessoa_id  = p.id;

COMMENT ON VIEW public.pessoas_ficha IS
  'Uma linha por pessoa com grupo e plataforma lado a lado. É a fonte da tabela ordenável de /formacao/admin/pessoas.';


-- ── 7. As cinco perguntas ────────────────────────────────────
-- Todas SECURITY INVOKER (a RLS de `pessoas` e `pessoa_identificadores`
-- continua valendo) MAIS a checagem explícita, no molde de `pessoas_fundir`:
-- sem ela um não-admin receberia zero em vez de erro, que é pior: número
-- errado é mais perigoso que número ausente. auth.uid() é NULL no service role
-- e no SQL Editor, e nesses dois casos a porta já foi conferida antes.

-- 7.1 Núcleo ativo ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pessoas_nucleo(
  p_dias   INTEGER DEFAULT 90,
  p_minimo INTEGER DEFAULT 5
) RETURNS TABLE (
  desde DATE, ate DATE, minimo INTEGER,
  nucleo INTEGER, ativos INTEGER, presencas INTEGER, media_presencas NUMERIC
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin lê o painel de pessoas.';
  END IF;

  RETURN QUERY
  WITH j AS (
    SELECT ((now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias) AS d0,
            (now() AT TIME ZONE 'America/Sao_Paulo')::date           AS d1
  ),
  por_pessoa AS (
    SELECT pr.pessoa_id, count(*) AS n
      FROM public.pessoa_presencas pr, j
     WHERE pr.dia > j.d0 AND pr.dia <= j.d1
     GROUP BY pr.pessoa_id
  )
  SELECT (SELECT j.d0 FROM j), (SELECT j.d1 FROM j), p_minimo,
         count(*) FILTER (WHERE pp.n >= p_minimo)::int,
         count(*)::int,
         coalesce(sum(pp.n), 0)::int,
         round(avg(pp.n), 2)
    FROM por_pessoa pp;
END;
$$;

-- 7.2 A linha do tempo do núcleo (um ponto por quinzena) ──────
-- Cada ponto responde a MESMA pergunta do card, na data daquele ponto: quantas
-- pessoas tinham 5+ presenças nos 90 dias anteriores. Assim o último ponto da
-- linha é, por construção, o número que está no card, e não outro indicador
-- parecido, que é como o painel de hoje acabou com um gráfico de retenção
-- medindo população diferente dos cards acima dele.
--
-- A âncora é HOJE e a série anda para trás, senão o último ponto cai num dia
-- qualquer até treze dias atrás e a linha nunca encosta no card.
CREATE OR REPLACE FUNCTION public.pessoas_nucleo_serie(
  p_meses  INTEGER DEFAULT 6,
  p_janela INTEGER DEFAULT 90,
  p_minimo INTEGER DEFAULT 5
) RETURNS TABLE (ate DATE, nucleo INTEGER, ativos INTEGER, presencas INTEGER)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin lê o painel de pessoas.';
  END IF;

  RETURN QUERY
  WITH hoje AS (SELECT (now() AT TIME ZONE 'America/Sao_Paulo')::date AS d),
  -- MATERIALIZED de propósito: sem isso a view seria recalculada uma vez por
  -- ponto da série, treze vezes.
  pres AS MATERIALIZED (
    SELECT pr.pessoa_id, pr.dia
      FROM public.pessoa_presencas pr, hoje h
     WHERE pr.dia > h.d - (p_meses * 30 + p_janela)
  ),
  pontos AS (
    SELECT (h.d - (n * 14))::date AS ate
      FROM hoje h,
           generate_series(0, ceil((p_meses * 30.0) / 14.0)::int) AS n
  )
  SELECT pt.ate,
         count(x.pessoa_id) FILTER (WHERE x.n >= p_minimo)::int,
         count(x.pessoa_id)::int,
         coalesce(sum(x.n), 0)::int
    FROM pontos pt
    LEFT JOIN LATERAL (
      SELECT p2.pessoa_id, count(*) AS n
        FROM pres p2
       WHERE p2.dia > pt.ate - p_janela AND p2.dia <= pt.ate
       GROUP BY p2.pessoa_id
    ) x ON true
   GROUP BY pt.ate
   ORDER BY pt.ate;
END;
$$;

-- 7.3 Quem era núcleo e sumiu ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.pessoas_sumidas(
  p_minimo   INTEGER DEFAULT 5,
  p_dias_sem INTEGER DEFAULT 45
) RETURNS TABLE (
  pessoa_id UUID, nome TEXT, email TEXT, tem_conta BOOLEAN,
  presencas INTEGER, atividades INTEGER, relatos INTEGER,
  primeira DATE, ultima DATE, dias_sem INTEGER
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin lê o painel de pessoas.';
  END IF;

  RETURN QUERY
  SELECT f.pessoa_id, f.nome, f.email, f.tem_conta,
         f.presencas_grupo, f.atividades_distintas, f.relatos,
         f.primeira_presenca, f.ultima_presenca, f.dias_desde_ultima
    FROM public.pessoas_ficha f
   WHERE f.presencas_grupo >= p_minimo
     AND f.dias_desde_ultima >= p_dias_sem
   ORDER BY f.presencas_grupo DESC, f.ultima_presenca DESC;
END;
$$;

-- 7.4 Retorno da estreia, por coorte ──────────────────────────
-- `maduros` existe porque a coorte do mês corrente ainda não teve 30 dias para
-- voltar. Dividir por `estrearam` faria a última barra despencar todo mês, e
-- alguém leria isso como queda real.
--
-- Uma honestidade a mais para a tela: "estreia" é a primeira presença QUE
-- EXISTE NO BANCO. A captura do Meet começou em 2026 (migration 051), então
-- coortes anteriores a ela são declaração pura, e quem já frequentava antes do
-- formulário aparece estreando no dia em que preencheu.
CREATE OR REPLACE FUNCTION public.pessoas_coorte_estreia(
  p_meses INTEGER DEFAULT 12,
  p_dias  INTEGER DEFAULT 30
) RETURNS TABLE (
  coorte DATE, estrearam INTEGER, maduros INTEGER, voltaram INTEGER, pct NUMERIC
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin lê o painel de pessoas.';
  END IF;

  RETURN QUERY
  WITH pres AS MATERIALIZED (
    SELECT pr.pessoa_id, pr.dia FROM public.pessoa_presencas pr
  ),
  est AS (
    SELECT p.pessoa_id, min(p.dia) AS primeira FROM pres p GROUP BY p.pessoa_id
  ),
  -- Auto-junção e não EXISTS correlacionado: o EXISTS reexecutaria a espinha
  -- inteira uma vez por pessoa.
  marc AS (
    SELECT e.pessoa_id,
           date_trunc('month', e.primeira)::date AS coorte,
           ((e.primeira + p_dias) <= (now() AT TIME ZONE 'America/Sao_Paulo')::date) AS maduro,
           coalesce(bool_or(p.dia > e.primeira AND p.dia <= e.primeira + p_dias), false) AS voltou
      FROM est e
      LEFT JOIN pres p ON p.pessoa_id = e.pessoa_id
     WHERE e.primeira >= (now() AT TIME ZONE 'America/Sao_Paulo')::date - (p_meses * 31)
     GROUP BY e.pessoa_id, e.primeira
  )
  SELECT m.coorte,
         count(*)::int,
         count(*) FILTER (WHERE m.maduro)::int,
         count(*) FILTER (WHERE m.voltou)::int,
         round(100.0 * count(*) FILTER (WHERE m.voltou)
               / nullif(count(*) FILTER (WHERE m.maduro), 0), 1)
    FROM marc m
   GROUP BY m.coorte
   ORDER BY m.coorte;
END;
$$;

-- 7.5 Condutores ──────────────────────────────────────────────
-- A nota SÓ conta quando a submissão lista condutor. Submissão sem condutor
-- grava 5 fixo, que não é avaliação nenhuma: é o valor inicial de um campo que
-- ninguém respondeu, e ele puxa toda média para o meio.
--
-- Dois números de Meet, e a diferença entre eles é informação: `alocados` é o
-- que a grade diz que a pessoa deveria ter conduzido; `na_sala` é onde ela
-- apareceu de fato.
--
-- Condutor sem ficha em certificado_condutores (renomeado, apagado) entra pelo
-- UNION de baixo, com id NULL, em vez de sumir da tela em silêncio.
CREATE OR REPLACE FUNCTION public.condutores_desempenho(
  p_dias INTEGER DEFAULT 180
) RETURNS TABLE (
  condutor_id UUID, nome TEXT, arquivado BOOLEAN, tem_ficha BOOLEAN,
  avaliacoes INTEGER, nota_media NUMERIC, nota_grupo_media NUMERIC,
  relatos INTEGER, relatos_longos INTEGER, ultima_avaliacao DATE,
  encontros_alocados INTEGER, encontros_na_sala INTEGER,
  minutos_fala NUMERIC, fala_condutor_pct_medio NUMERIC
)
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  corte DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::date - p_dias;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin lê o painel de pessoas.';
  END IF;

  RETURN QUERY
  WITH avaliacao AS (
    SELECT public.normalizar_nome(nome_cond) AS chave,
           btrim(nome_cond)                  AS nome_bruto,
           u.nota_condutor, u.nota_grupo, u.relato, u.dia
      FROM public.certificado_submissions_unicas u
      CROSS JOIN LATERAL unnest(u.condutores) AS nome_cond
     WHERE coalesce(cardinality(u.condutores), 0) > 0
       AND btrim(coalesce(nome_cond, '')) <> ''
       AND u.dia > corte
  ),
  agr AS (
    SELECT a.chave,
           max(a.nome_bruto)                                                          AS nome_bruto,
           count(*)::int                                                              AS avaliacoes,
           round(avg(a.nota_condutor) FILTER (WHERE a.nota_condutor > 0), 2)          AS nota_media,
           round(avg(a.nota_grupo)    FILTER (WHERE a.nota_grupo    > 0), 2)          AS nota_grupo_media,
           count(*) FILTER (WHERE btrim(coalesce(a.relato, '')) <> '')::int           AS relatos,
           count(*) FILTER (WHERE char_length(btrim(coalesce(a.relato, ''))) >= 80)::int AS relatos_longos,
           max(a.dia)                                                                 AS ultima_avaliacao
      FROM avaliacao a
     GROUP BY a.chave
  ),
  alocado AS (
    SELECT al.condutor_id, count(DISTINCT e.id)::int AS n
      FROM public.formacao_alocacoes al
      JOIN public.formacao_meet_encontros e ON e.slot_id = al.slot_id
     WHERE e.descartado = false AND e.data_reuniao > corte
     GROUP BY al.condutor_id
  ),
  na_sala AS (
    SELECT c.id AS condutor_id,
           count(DISTINCT p.encontro_id)::int                   AS n,
           round(sum(coalesce(p.minutos_fala, 0))::numeric, 1)  AS minutos_fala,
           round(avg(e.fala_condutor_pct), 1)                   AS fala_pct
      FROM public.certificado_condutores c
      JOIN public.formacao_meet_participacoes p
        ON (c.user_id IS NOT NULL AND p.aluno_id = c.user_id)
        OR p.display_name_norm = public.normalizar_nome_meet(c.nome)
      JOIN public.formacao_meet_encontros e ON e.id = p.encontro_id
     WHERE e.descartado = false AND e.data_reuniao > corte
     GROUP BY c.id
  )
  SELECT c.id, c.nome, c.arquivado, true,
         coalesce(a.avaliacoes, 0), a.nota_media, a.nota_grupo_media,
         coalesce(a.relatos, 0), coalesce(a.relatos_longos, 0), a.ultima_avaliacao,
         coalesce(al.n, 0), coalesce(s.n, 0),
         coalesce(s.minutos_fala, 0), s.fala_pct
    FROM public.certificado_condutores c
    LEFT JOIN agr     a  ON a.chave = public.normalizar_nome(c.nome)
    LEFT JOIN alocado al ON al.condutor_id = c.id
    LEFT JOIN na_sala s  ON s.condutor_id  = c.id

  UNION ALL

  SELECT NULL::uuid, a.nome_bruto, false, false,
         a.avaliacoes, a.nota_media, a.nota_grupo_media,
         a.relatos, a.relatos_longos, a.ultima_avaliacao,
         0, 0, 0::numeric, NULL::numeric
    FROM agr a
   WHERE NOT EXISTS (
     SELECT 1 FROM public.certificado_condutores c
      WHERE public.normalizar_nome(c.nome) = a.chave
   )
   ORDER BY 5 DESC NULLS LAST, 2;
END;
$$;


-- ── 8. O embrulho que a tela chama ───────────────────────────
-- RETURNS JSONB, e isso é a peça central do desenho.
--
-- O PostgREST desta instância corta a resposta em 1000 linhas SEM AVISO, e o
-- corte vale também para função que devolve SETOF/TABLE, e subir o `.limit()`
-- não adianta, porque o teto é do servidor. `.range()` resolve, ao custo de
-- paginar seis listas diferentes na mão. Já uma função que devolve JSONB
-- devolve UMA linha, e a lista inteira viaja dentro dela. O teto deixa de
-- existir sem ninguém precisar lembrar dele.
--
-- (É o mesmo teto que hoje trunca /formacao/admin/page.tsx, que lê
-- `certificado_submissions` sem range nenhum e calcula retenção e média de
-- condutor sobre as 1000 primeiras linhas que o Postgres devolver.)
CREATE OR REPLACE FUNCTION public.pessoas_painel(
  p_dias_nucleo     INTEGER DEFAULT 90,
  p_minimo          INTEGER DEFAULT 5,
  p_dias_sem        INTEGER DEFAULT 45,
  p_meses_serie     INTEGER DEFAULT 6,
  p_meses_coorte    INTEGER DEFAULT 12,
  p_dias_condutores INTEGER DEFAULT 180
) RETURNS JSONB
LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE
  saida JSONB;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Só admin lê o painel de pessoas.';
  END IF;

  -- A ficha é calculada UMA vez e serve duas saídas: a tabela e os sumidos,
  -- que são um recorte dela. Chamar pessoas_sumidas() aqui dobraria o trabalho
  -- mais caro do painel.
  WITH f AS MATERIALIZED (SELECT * FROM public.pessoas_ficha)
  SELECT jsonb_build_object(
    'gerado_em', now(),
    'parametros', jsonb_build_object(
      'dias_nucleo', p_dias_nucleo, 'minimo', p_minimo, 'dias_sem', p_dias_sem,
      'meses_serie', p_meses_serie, 'meses_coorte', p_meses_coorte,
      'dias_condutores', p_dias_condutores
    ),
    'nucleo',  (SELECT to_jsonb(x) FROM public.pessoas_nucleo(p_dias_nucleo, p_minimo) x),
    'serie',   (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.ate), '[]'::jsonb)
                  FROM public.pessoas_nucleo_serie(p_meses_serie, p_dias_nucleo, p_minimo) x),
    'ficha',   (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.presencas_grupo DESC), '[]'::jsonb)
                  FROM f),
    'sumidos', (SELECT coalesce(jsonb_agg(to_jsonb(f) ORDER BY f.presencas_grupo DESC), '[]'::jsonb)
                  FROM f
                 WHERE f.presencas_grupo >= p_minimo
                   AND f.dias_desde_ultima >= p_dias_sem),
    'coortes', (SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.coorte), '[]'::jsonb)
                  FROM public.pessoas_coorte_estreia(p_meses_coorte) x),
    'condutores', (SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb)
                  FROM public.condutores_desempenho(p_dias_condutores) x),
    -- Sem isto o painel afirma mais do que sabe: participação do Meet que
    -- ainda não tem dono não está em nenhum dos números acima.
    'cobertura', (SELECT jsonb_build_object(
                    'participacoes_sem_dono', count(*),
                    'nomes_sem_dono', count(DISTINCT d.display_name_norm))
                  FROM public.pessoa_participacoes_sem_dono d)
  ) INTO saida;

  RETURN saida;
END;
$$;


-- ── 9. Quem enxerga ──────────────────────────────────────────
-- Duas coisas que o Postgres e o Supabase fazem SOZINHOS e que precisam ser
-- desfeitas na mão, senão esta migration publica dado clínico:
--
--   1. `CREATE FUNCTION` concede EXECUTE a PUBLIC por padrão. Sem o REVOKE
--      abaixo, `anon` chama `condutores_desempenho()` pela chave anônima.
--   2. O Supabase tem ALTER DEFAULT PRIVILEGES concedendo tudo no schema
--      `public` a anon/authenticated/service_role. Toda view nova nasce
--      legível pelo anon.
--
-- E o guarda de is_admin() dentro das funções NÃO cobre o anon: para uma
-- requisição anônima `auth.uid()` é NULL, que é a mesma assinatura do service
-- role. Quem barra o anon é a falta de privilégio, não o IF. Para a maioria
-- das views a RLS de `pessoas`/`pessoa_identificadores` já devolveria vazio,
-- mas `certificado_submissions_unicas` sai de uma tabela que hoje é legível por
-- qualquer visitante (a pendência anotada no cabeçalho), e ela carrega o
-- relato inteiro.
REVOKE EXECUTE ON FUNCTION public.pessoas_nucleo(INTEGER, INTEGER)                FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pessoas_nucleo_serie(INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pessoas_sumidas(INTEGER, INTEGER)               FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pessoas_coorte_estreia(INTEGER, INTEGER)        FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.condutores_desempenho(INTEGER)                  FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pessoas_painel(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) FROM PUBLIC, anon;

REVOKE ALL ON public.certificado_submissions_unicas  FROM anon;
REVOKE ALL ON public.pessoa_participacoes            FROM anon;
REVOKE ALL ON public.pessoa_participacoes_sem_dono   FROM anon;
REVOKE ALL ON public.pessoa_presencas                FROM anon;
REVOKE ALL ON public.pessoas_ficha                   FROM anon;

GRANT SELECT ON public.certificado_submissions_unicas   TO authenticated;
GRANT SELECT ON public.pessoa_participacoes             TO authenticated;
GRANT SELECT ON public.pessoa_participacoes_sem_dono    TO authenticated;
GRANT SELECT ON public.pessoa_presencas                 TO authenticated;
GRANT SELECT ON public.pessoas_ficha                    TO authenticated;

GRANT EXECUTE ON FUNCTION public.pessoas_nucleo(INTEGER, INTEGER)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.pessoas_nucleo_serie(INTEGER, INTEGER, INTEGER)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.pessoas_sumidas(INTEGER, INTEGER)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.pessoas_coorte_estreia(INTEGER, INTEGER)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.condutores_desempenho(INTEGER)                      TO authenticated;
GRANT EXECUTE ON FUNCTION public.pessoas_painel(INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER) TO authenticated;


-- ── 10. Conferência ──────────────────────────────────────────
-- Rodar DEPOIS de aplicar, no SQL Editor, e ler os quatro resultados antes de
-- acreditar em qualquer número da tela.
--
-- (a) Tamanho do que está sendo varrido, para o custo deixar de ser chute:
--   SELECT 'submissions' t, count(*) FROM certificado_submissions
--   UNION ALL SELECT 'submissions únicas', count(*) FROM certificado_submissions_unicas
--   UNION ALL SELECT 'participações',  count(*) FROM formacao_meet_participacoes
--   UNION ALL SELECT 'presenças',      count(*) FROM pessoa_presencas
--   UNION ALL SELECT 'usage_sessions', count(*) FROM usage_sessions
--   UNION ALL SELECT 'falas',          count(*) FROM formacao_meet_falas;
--
-- (b) Quanto do Meet o painel consegue atribuir. Cobertura baixa aqui vira
--     núcleo pequeno lá, e a causa não estaria escrita em lugar nenhum:
--   SELECT via, count(*) FROM pessoa_participacoes
--    WHERE eh_condutor = false GROUP BY via ORDER BY 2 DESC;
--
-- (c) ⚠️ O nome da atividade bate nos dois mundos? Toda linha que sair daqui é
--     uma presença contada DUAS vezes na espinha:
--   SELECT coalesce(f.a, m.a) AS atividade, f.n AS no_formulario, m.n AS no_meet
--     FROM (SELECT normalizar_nome(atividade_nome) a, count(*) n
--             FROM certificado_submissions GROUP BY 1) f
--     FULL JOIN (SELECT normalizar_nome(atividade_nome) a, count(*) n
--                  FROM formacao_meet_encontros WHERE descartado = false GROUP BY 1) m
--       ON m.a = f.a
--    WHERE f.a IS NULL OR m.a IS NULL
--    ORDER BY 1;
--
-- (d) Quanto custa de verdade:
--   EXPLAIN (ANALYZE, BUFFERS) SELECT pessoas_painel();
--
--
-- ── SE (d) PASSAR DE ~2 s ────────────────────────────────────
-- A espinha vira matéria, e o cron do Meet (que já roda de 15 em 15 minutos na
-- Railway) atualiza. Trocar a view por matéria não muda uma linha das funções
-- acima, porque todas leem `pessoa_presencas` pelo nome.
--
--   CREATE MATERIALIZED VIEW public.pessoa_presencas_mv AS
--     SELECT * FROM public.pessoa_presencas;
--   CREATE UNIQUE INDEX pessoa_presencas_mv_pk
--     ON public.pessoa_presencas_mv (pessoa_id, dia, atividade);
--   CREATE INDEX pessoa_presencas_mv_dia ON public.pessoa_presencas_mv (dia);
--   -- CONCURRENTLY exige o índice único acima e não trava leitura:
--   REFRESH MATERIALIZED VIEW CONCURRENTLY public.pessoa_presencas_mv;
--
-- Matéria NÃO tem RLS, então ela não pode ser concedida a authenticated: fica
-- só para o service role, e a tela continua entrando pela rota de API. Foi
-- assim que a 051 teve de consertar view que devolvia linha por cima da RLS.
