-- A chave do grupo deixa de ser uma string.
--
-- Até aqui, o que amarra um grupo ao seu horário é `formacao_slots.atividade_nome`,
-- que é TEXT livre. O catálogo `certificado_atividades` tem um `id` UUID e ele
-- não é referenciado por NENHUMA tabela do banco: medido em 06/08/2026, zero
-- chaves estrangeiras de entrada. O id do catálogo é um identificador que não
-- identifica nada, e quem une o sistema é o texto de um lado e `formacao_slots.id`
-- do outro, sem os dois se tocarem.
--
-- O efeito prático disso é um ciclo de duplicação silencioso: renomear uma
-- atividade no painel órfã todo o histórico dela, e o botão "Sincronizar
-- feedbacks" recria o nome antigo como atividade nova na execução seguinte.
--
-- Esta migration é aditiva e não apaga nada.
--
-- ⚠️ `atividade_nome` CONTINUA onde está, de propósito. Cinco lugares leem o
-- texto para contar carga horária de certificado (`api/ranking`,
-- `api/my-sync-hours`, `lib/plataforma/ficha-aluno`, `PessoaModal`,
-- `api/admin/email-suspeita`), e a agregação de quórum casa formulário com
-- encontro por `data|nome_normalizado` (`lib/meet/quorum.ts`). Tirar o texto
-- agora zeraria as horas de quem participou. O texto vira rótulo; o id vira
-- identidade.

-- ── 1. A coluna ──────────────────────────────────────────────
-- Nullable de propósito: existem 13 atividades sem slot e pode existir slot
-- cuja atividade foi digitada fora do catálogo. NOT NULL travaria a grade.
--
-- ON DELETE SET NULL e não CASCADE: apagar uma atividade do catálogo não pode
-- derrubar a posição dela na grade junto, senão a grade da semana some por
-- causa de uma limpeza de cadastro.
ALTER TABLE formacao_slots
  ADD COLUMN IF NOT EXISTS atividade_id UUID
    REFERENCES certificado_atividades(id) ON DELETE SET NULL;

COMMENT ON COLUMN formacao_slots.atividade_id IS
  'Identidade do grupo. `atividade_nome` continua como rótulo, para o cálculo de horas e para a agregação de quórum, que casam por texto.';

CREATE INDEX IF NOT EXISTS idx_slots_atividade_id
  ON formacao_slots(atividade_id) WHERE atividade_id IS NOT NULL;

-- ── 2. Backfill por nome normalizado ─────────────────────────
-- Sem acento, minúsculo, espaço colapsado, que é a mesma régua de `chaveTexto`
-- em `src/lib/meet/quorum.ts`. Medido em 06/08/2026: acerta 6 de 6 slots, e a
-- normalização não produz nenhuma colisão entre os 19 nomes do catálogo.
--
-- `unaccent` não está garantido nesta instância, então a remoção de acento é
-- feita por `translate`, que não depende de extensão.
UPDATE formacao_slots s
SET atividade_id = a.id
FROM certificado_atividades a
WHERE s.atividade_id IS NULL
  AND s.atividade_nome IS NOT NULL
  AND regexp_replace(
        lower(translate(s.atividade_nome,
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
        '\s+', ' ', 'g') =
      regexp_replace(
        lower(translate(a.nome,
          'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
          'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
        '\s+', ' ', 'g');

-- ── 3. O catálogo deixa de aceitar nome duplicado ────────────
-- Hoje a checagem de duplicata é só no cliente (`atividades/page.tsx`), o que
-- significa que duas abas abertas criam duas atividades com o mesmo nome, e a
-- partir daí nenhum casamento por texto sabe qual é qual.
--
-- Medido antes de escrever isto: os 19 nomes são distintos até normalizados,
-- então o índice entra sem conflito. Se um dia falhar ao aplicar, é porque
-- alguém criou uma duplicata, e o erro é a informação que se quer.
CREATE UNIQUE INDEX IF NOT EXISTS idx_atividades_nome_unico
  ON certificado_atividades (
    regexp_replace(
      lower(translate(nome,
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN')),
      '\s+', ' ', 'g')
  );
