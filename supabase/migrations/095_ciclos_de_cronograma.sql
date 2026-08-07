-- O ciclo, que é a entidade que faltava para comparar qualquer coisa.
--
-- Hoje o painel só sabe dois recortes de tempo: "esta semana" e "tudo". Mas a
-- formação não roda em semanas, roda em ciclos: um cronograma abre, roda alguns
-- meses, fecha, e outro abre no lugar. Sem essa entidade, "este ciclo foi melhor
-- que o anterior" não é uma pergunta que o banco saiba responder, e comparar
-- cronogramas vira trabalho de memória de quem estava lá.
--
-- ⚠️ NÃO existe tabela nova de retrato aqui, de propósito. `formacao_snapshots`
-- e `formacao_snapshot_slots` já congelam a grade toda semana, com dia, hora,
-- atividade, status, meet_link e condutores. Congelar de novo por ciclo criaria
-- duas verdades sobre a mesma grade, e duas verdades divergem com o tempo. O
-- ciclo vira PAI dos snapshots que já existem.
--
-- ⚠️ E o encontro se liga ao ciclo por DATA, não por coluna nova. Não há
-- `formacao_meet_encontros.ciclo_id` nesta migration, e isso é escolha:
--   * a data já existe, é NOT NULL, e funciona retroativamente sem backfill
--   * `slot_id` vira NULL quando alguém apaga um slot, e a data sobrevive a isso
--   * uma coluna criaria uma segunda verdade que pode divergir da data
-- O preço: ciclos NÃO PODEM SE SOBREPOR. Se um dia existirem trilhas paralelas
-- rodando ao mesmo tempo, a data deixa de decidir e a coluna passa a ser
-- obrigatória. Está registrado aqui para quem chegar nesse dia saber por quê.
--
-- Esta migration é aditiva. Nada é apagado, e nada existente muda de sentido.

-- ── 1. O ciclo ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.formacao_ciclos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  inicio DATE NOT NULL,
  -- NULL enquanto está aberto. É o que separa "rodando" de "terminou".
  fim DATE,
  status TEXT NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('planejado', 'ativo', 'encerrado')),
  -- ⭐ O "espaço para anotações gerais do cronograma" que foi pedido.
  -- `formacao_snapshots.observacoes` já existe para a anotação da SEMANA, e
  -- está NULL desde sempre porque nunca teve escritor nem leitor. São duas
  -- escalas do mesmo gesto: o que aconteceu nesta semana, e o que este ciclo
  -- ensinou.
  observacoes TEXT,
  -- O retrato final da grade, gravado no encerramento.
  --
  -- Derivar do último snapshot seria possível e mais barato, e mesmo assim isto
  -- existe: `formacao_snapshot_slots.slot_id` não tem chave estrangeira, e
  -- apagar um horário derruba os slots em cascata. Um ciclo encerrado precisa
  -- sobreviver a uma faxina na grade feita seis meses depois.
  grade_final JSONB,
  encerrado_em TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Um ciclo ativo por vez. É o que garante que "o ciclo atual" seja uma pergunta
-- com uma resposta só, e é também o que impede a sobreposição de que o
-- cabeçalho fala.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ciclos_um_ativo
  ON public.formacao_ciclos (status)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS idx_ciclos_periodo
  ON public.formacao_ciclos (inicio, fim);

-- Um ciclo não pode terminar antes de começar.
ALTER TABLE public.formacao_ciclos
  DROP CONSTRAINT IF EXISTS chk_ciclos_periodo;
ALTER TABLE public.formacao_ciclos
  ADD CONSTRAINT chk_ciclos_periodo CHECK (fim IS NULL OR fim >= inicio);

-- ── 2. O snapshot semanal ganha um pai ───────────────────────
-- Nullable de propósito: existe um snapshot órfão na base (semana de 27/07, de
-- antes de qualquer ciclo existir) e ele não deve ser inventado dentro de um
-- ciclo só para a coluna ficar cheia.
--
-- ON DELETE SET NULL: apagar um ciclo por engano não pode levar junto os
-- retratos semanais, que são o dado bruto do qual o ciclo é só o recorte.
ALTER TABLE public.formacao_snapshots
  ADD COLUMN IF NOT EXISTS ciclo_id UUID
  REFERENCES public.formacao_ciclos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_snapshots_ciclo
  ON public.formacao_snapshots (ciclo_id);

-- ── 3. ⛔ O histórico para de morrer em cascata ──────────────
--
-- `formacao_slot_logs.slot_id` era ON DELETE CASCADE (migration 014). Isso quer
-- dizer que apagar um slot apaga TODO o histórico de status dele, e apagar um
-- horário apaga os slots daquele horário em cascata e os logs junto: medido em
-- 06/08/2026, apagar "14:00" levaria quatro dos seis grupos e o histórico
-- inteiro deles, com um clique.
--
-- SET NULL e não RESTRICT: RESTRICT tornaria impossível remover um slot que já
-- teve qualquer mudança de status, o que trava a operação normal da grade. Com
-- SET NULL o slot sai e o log fica, com o `atividade_nome` e o `condutor_ids`
-- que ele já congelava. O histórico perde o ponteiro e mantém o conteúdo, que é
-- exatamente o que um histórico precisa fazer.
ALTER TABLE public.formacao_slot_logs
  DROP CONSTRAINT IF EXISTS formacao_slot_logs_slot_id_fkey;

ALTER TABLE public.formacao_slot_logs
  ALTER COLUMN slot_id DROP NOT NULL;

ALTER TABLE public.formacao_slot_logs
  ADD CONSTRAINT formacao_slot_logs_slot_id_fkey
  FOREIGN KEY (slot_id) REFERENCES public.formacao_slots(id) ON DELETE SET NULL;

-- ── 4. RLS ───────────────────────────────────────────────────
-- O ciclo é dado de gestão: quem administra lê e escreve, mais ninguém.
-- A grade pública não precisa dele, e as anotações do ciclo são justamente o
-- tipo de texto que não deve vazar.
ALTER TABLE public.formacao_ciclos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_all_ciclos" ON public.formacao_ciclos;
CREATE POLICY "admin_all_ciclos" ON public.formacao_ciclos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE profiles.id = auth.uid()
         AND (profiles.role = 'admin' OR 'admin' = ANY(COALESCE(profiles.cargos, '{}')))
    )
  );

-- ── 5. Conferência ───────────────────────────────────────────
-- Depois de rodar, isto deve devolver:
--   ciclos = 0, snapshots_sem_ciclo = 1, logs_cascade = 0
--
-- SELECT
--   (SELECT count(*) FROM public.formacao_ciclos) AS ciclos,
--   (SELECT count(*) FROM public.formacao_snapshots WHERE ciclo_id IS NULL)
--     AS snapshots_sem_ciclo,
--   (SELECT count(*) FROM pg_constraint
--     WHERE conname = 'formacao_slot_logs_slot_id_fkey' AND confdeltype = 'c')
--     AS logs_cascade;
