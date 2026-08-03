-- =============================================================
-- Quórum e participação pela Google Meet API
-- =============================================================
-- Substitui o registro manual de quórum por captura automática via API
-- oficial do Meet. Sem bot na sala, sem extensão no navegador: o servidor
-- lê os conference records depois que o encontro termina.
--
-- Três decisões que explicam o formato das tabelas:
--
-- 1. formacao_slots é grade semanal fixa, não lista de datas. Então o space
--    do Meet é PERMANENTE por slot (um por sala), e cada semana produz um
--    conference record novo dentro do mesmo space. Nada é criado toda semana.
-- 2. A API devolve nome exibido, nunca e-mail. A identidade se resolve por
--    formacao_meet_aliases, preenchida uma vez por pessoa e válida pra sempre.
-- 3. Conteúdo de fala NÃO entra no banco. Guardamos duração e contagem de
--    turnos, nunca o texto: encontro de formação toca em material clínico.
--
-- formacao_meet_presencas (017) continua viva, alimentada por derivação, senão
-- quebram /admin/estatisticas, /admin/condutores, /admin/atividades,
-- /admin/calendario e /admin/quorum.
-- =============================================================

-- ── 1. O space permanente de cada slot ───────────────────────
CREATE TABLE IF NOT EXISTS formacao_meet_spaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID UNIQUE REFERENCES formacao_slots(id) ON DELETE CASCADE,
  space_name TEXT NOT NULL UNIQUE,          -- "spaces/AbCdEfGh"
  meeting_code TEXT,                        -- "abc-defg-hij"
  meeting_uri TEXT,                         -- https://meet.google.com/abc-defg-hij
  -- padrão de artefatos deste slot; exceções pontuais vão em _excecoes
  gravar BOOLEAN NOT NULL DEFAULT false,
  transcrever BOOLEAN NOT NULL DEFAULT true,
  notas BOOLEAN NOT NULL DEFAULT false,
  -- OPEN: quem tem o link entra direto, sem ninguém admitir. É o que faz
  -- sentido para grupo aberto com gente de fora do domínio. Fica no banco
  -- porque o condutor pode desligar "acesso rápido" dentro da reunião e
  -- fechar a sala sem querer; o painel precisa poder reabrir.
  access_type TEXT NOT NULL DEFAULT 'OPEN'
    CHECK (access_type IN ('OPEN', 'TRUSTED', 'RESTRICTED')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE formacao_meet_spaces IS
  'Uma sala permanente do Meet por slot da grade. gravar/transcrever/notas são o padrão do slot.';

-- ── 2. Exceção pontual de artefatos numa data ────────────────
-- "nesta terça não grava" ou "neste encontro grava". Um job aplica antes do
-- horário e reverte depois, porque a config vive no space, que é permanente.
CREATE TABLE IF NOT EXISTS formacao_meet_excecoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES formacao_slots(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  gravar BOOLEAN,
  transcrever BOOLEAN,
  notas BOOLEAN,
  motivo TEXT,
  aplicada_em TIMESTAMPTZ,
  revertida_em TIMESTAMPTZ,
  criado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (slot_id, data)
);

-- ── 3. O encontro que de fato aconteceu ──────────────────────
CREATE TABLE IF NOT EXISTS formacao_meet_encontros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conference_record_id TEXT NOT NULL UNIQUE,  -- "conferenceRecords/xyz"
  space_name TEXT NOT NULL,
  slot_id UUID REFERENCES formacao_slots(id) ON DELETE SET NULL,
  atividade_nome TEXT,
  condutor_nome TEXT,
  data_reuniao DATE NOT NULL,
  dia_semana INTEGER CHECK (dia_semana >= 0 AND dia_semana <= 6),
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ,
  duracao_min INTEGER,
  duracao_prevista_min INTEGER,
  total_participantes INTEGER NOT NULL DEFAULT 0,
  identificados INTEGER NOT NULL DEFAULT 0,     -- quantos casaram com aluno
  minutos_somados INTEGER NOT NULL DEFAULT 0,   -- soma da presença de todos
  media_permanencia_pct NUMERIC(5,2),
  vozes_ativas_pct NUMERIC(5,2),                -- % dos presentes que falou
  fala_condutor_pct NUMERIC(5,2),               -- % do tempo falado pelo condutor
  gravacao_uri TEXT,
  transcricao_uri TEXT,
  transcricao_ingerida BOOLEAN NOT NULL DEFAULT false,
  ingerido_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON COLUMN formacao_meet_encontros.vozes_ativas_pct IS
  'Percentual de presentes que falou ao menos uma vez. Indicador de grupo vivo, mais honesto que quórum.';

-- ── 4. Uma linha por pessoa por encontro ─────────────────────
CREATE TABLE IF NOT EXISTS formacao_meet_participacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  encontro_id UUID NOT NULL REFERENCES formacao_meet_encontros(id) ON DELETE CASCADE,
  participant_api_id TEXT NOT NULL,   -- ".../participants/123"
  display_name TEXT NOT NULL,
  display_name_norm TEXT NOT NULL,    -- minúsculo, sem acento: chave de casamento
  tipo TEXT NOT NULL DEFAULT 'signed_in'
    CHECK (tipo IN ('signed_in', 'anonymous', 'phone')),
  google_user_id TEXT,                -- "users/..." quando logado
  aluno_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  primeira_entrada TIMESTAMPTZ,
  ultima_saida TIMESTAMPTZ,
  minutos_presentes INTEGER NOT NULL DEFAULT 0,
  n_sessoes INTEGER NOT NULL DEFAULT 1,        -- reentradas
  permanencia_pct NUMERIC(5,2),
  atraso_min INTEGER,                          -- entrada menos início do encontro
  saida_antecipada_min INTEGER,
  minutos_fala NUMERIC(6,2),                   -- null quando não houve transcrição
  n_turnos_fala INTEGER,
  eh_condutor BOOLEAN NOT NULL DEFAULT false,  -- casou com um condutor alocado ao slot
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (encontro_id, participant_api_id)
);

-- ── 5. Nome do Meet amarrado a uma pessoa ────────────────────
CREATE TABLE IF NOT EXISTS formacao_meet_aliases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name_norm TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  aluno_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  google_user_id TEXT,
  confirmado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE formacao_meet_aliases IS
  'Resolvido uma vez por pessoa, vale para sempre. É o que transforma nome exibido em histórico individual.';

-- ── 6. Credencial da conta organizadora (linha única) ────────
-- Fica no banco e não em env var pra poder refazer o consentimento sem
-- redeploy. RLS ligada e SEM policy: nem anon nem authenticated leem; só o
-- service role, que bypassa.
CREATE TABLE IF NOT EXISTS formacao_meet_credenciais (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  organizer_email TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  scopes TEXT,
  ultimo_uso TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ DEFAULT now()
);

-- ── 7. Log das rodadas de ingestão ───────────────────────────
CREATE TABLE IF NOT EXISTS formacao_meet_ingest_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  executado_em TIMESTAMPTZ DEFAULT now(),
  origem TEXT DEFAULT 'cron',
  spaces_varridos INTEGER DEFAULT 0,
  encontros_novos INTEGER DEFAULT 0,
  encontros_atualizados INTEGER DEFAULT 0,
  participacoes_gravadas INTEGER DEFAULT 0,
  nomes_nao_reconhecidos INTEGER DEFAULT 0,
  duracao_ms INTEGER,
  erro TEXT
);

-- ── Ponte com a tabela antiga ────────────────────────────────
-- A ingestão deriva uma linha em formacao_meet_presencas para cada encontro,
-- pra não quebrar as cinco telas que já leem de lá. A coluna abaixo é o que
-- torna a derivação idempotente: sem ela, cada rodada do cron duplicaria o
-- mesmo encontro. Registros manuais antigos ficam com NULL, e vários NULL não
-- colidem em UNIQUE no Postgres.
ALTER TABLE formacao_meet_presencas
  ADD COLUMN IF NOT EXISTS conference_record_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_meet_presencas_conf_record
  ON formacao_meet_presencas(conference_record_id)
  WHERE conference_record_id IS NOT NULL;

-- ── Índices ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_meet_spaces_slot ON formacao_meet_spaces(slot_id);
CREATE INDEX IF NOT EXISTS idx_meet_excecoes_data ON formacao_meet_excecoes(data);
CREATE INDEX IF NOT EXISTS idx_meet_encontros_data ON formacao_meet_encontros(data_reuniao DESC);
CREATE INDEX IF NOT EXISTS idx_meet_encontros_slot ON formacao_meet_encontros(slot_id);
CREATE INDEX IF NOT EXISTS idx_meet_encontros_space ON formacao_meet_encontros(space_name);
CREATE INDEX IF NOT EXISTS idx_meet_particip_encontro ON formacao_meet_participacoes(encontro_id);
CREATE INDEX IF NOT EXISTS idx_meet_particip_aluno ON formacao_meet_participacoes(aluno_id);
CREATE INDEX IF NOT EXISTS idx_meet_particip_norm ON formacao_meet_participacoes(display_name_norm);
CREATE INDEX IF NOT EXISTS idx_meet_aliases_aluno ON formacao_meet_aliases(aluno_id);

-- ── RLS ──────────────────────────────────────────────────────
-- Leitura: admin. Escrita: ninguém pela anon key; só o service role das
-- rotas server-side. Não repetir o erro da 017, que tinha INSERT aberto.
ALTER TABLE formacao_meet_spaces        ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_meet_excecoes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_meet_encontros     ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_meet_participacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_meet_aliases       ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_meet_credenciais   ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_meet_ingest_logs   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_meet_spaces" ON formacao_meet_spaces;
CREATE POLICY "admin_read_meet_spaces" ON formacao_meet_spaces
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_meet_excecoes" ON formacao_meet_excecoes;
CREATE POLICY "admin_read_meet_excecoes" ON formacao_meet_excecoes
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_meet_encontros" ON formacao_meet_encontros;
CREATE POLICY "admin_read_meet_encontros" ON formacao_meet_encontros
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_meet_particip" ON formacao_meet_participacoes;
CREATE POLICY "admin_read_meet_particip" ON formacao_meet_participacoes
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_meet_aliases" ON formacao_meet_aliases;
CREATE POLICY "admin_read_meet_aliases" ON formacao_meet_aliases
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_meet_logs" ON formacao_meet_ingest_logs;
CREATE POLICY "admin_read_meet_logs" ON formacao_meet_ingest_logs
  FOR SELECT USING (public.is_admin());

-- formacao_meet_credenciais fica sem nenhuma policy de propósito.

-- ── updated_at ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_meet_spaces_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_meet_spaces_updated_at ON formacao_meet_spaces;
CREATE TRIGGER trg_meet_spaces_updated_at
  BEFORE UPDATE ON formacao_meet_spaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_meet_spaces_updated_at();
