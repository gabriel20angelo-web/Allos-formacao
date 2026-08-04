-- =============================================================
-- Identidade do Meet resolvida pelo formulário de certificado
-- =============================================================
-- O problema que isto resolve: dos 77 presentes no encontro de 04/08/2026,
-- 31 casaram com uma conta e 46 ficaram como "sem cadastro". A fila de
-- conciliação só sabia comparar o nome exibido contra `profiles`, e a maior
-- parte de quem frequenta os grupos NÃO tem conta na plataforma — das 34
-- pessoas que preencheram o certificado daquele encontro, 21 não têm perfil.
-- Contra `profiles`, portanto, esses nomes nunca sairiam da fila.
--
-- Só que essas pessoas se identificam por conta própria, num lugar que já
-- existe: o formulário de certificado, onde escrevem nome completo, nome
-- social e e-mail logo depois do encontro. Cruzar as duas listas — quem
-- estava na sala e quem preencheu o formulário daquela atividade naquele dia
-- — identifica sozinho a maioria dos nomes.
--
-- Daí a mudança de conceito desta migration: SABER QUEM É deixa de ser a
-- mesma coisa que TER CONTA. O alias passa a poder guardar uma identidade
-- (nome verdadeiro + e-mail) mesmo quando não há perfil para apontar.
-- =============================================================

-- ── 1. O alias passa a aceitar identidade sem conta ──────────
-- `aluno_id NOT NULL` era o que amarrava identidade a cadastro. Sem soltar
-- isso, a única forma de registrar "esta é a Márcia Maria Pacheco de Aquino"
-- seria criar uma conta que ela não pediu, poluindo `profiles`, as contagens
-- de aluno e as políticas que dependem delas.
ALTER TABLE formacao_meet_aliases
  ALTER COLUMN aluno_id DROP NOT NULL;

ALTER TABLE formacao_meet_aliases
  ADD COLUMN IF NOT EXISTS pessoa_nome TEXT,
  ADD COLUMN IF NOT EXISTS pessoa_email TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS evidencia TEXT;

-- Um alias sem NADA não identifica ninguém e só atrapalharia a fila, que
-- passa a tratar "tem alias" como "já resolvido".
ALTER TABLE formacao_meet_aliases
  DROP CONSTRAINT IF EXISTS meet_alias_identifica_alguem;
ALTER TABLE formacao_meet_aliases
  ADD CONSTRAINT meet_alias_identifica_alguem
  CHECK (aluno_id IS NOT NULL OR pessoa_email IS NOT NULL OR pessoa_nome IS NOT NULL);

ALTER TABLE formacao_meet_aliases
  DROP CONSTRAINT IF EXISTS meet_alias_origem_conhecida;
ALTER TABLE formacao_meet_aliases
  ADD CONSTRAINT meet_alias_origem_conhecida
  CHECK (origem IN ('manual', 'automatico', 'certificado'));

COMMENT ON COLUMN formacao_meet_aliases.pessoa_email IS
  'E-mail declarado no formulário de certificado. É a identidade de quem participa sem ter conta.';
COMMENT ON COLUMN formacao_meet_aliases.origem IS
  'manual = alguém clicou no painel; automatico = casou com um perfil pela semelhança do nome; certificado = casou com quem preencheu o formulário daquele encontro.';
COMMENT ON COLUMN formacao_meet_aliases.evidencia IS
  'Em que o casamento se apoiou, em texto legível. Existe para poder desconfiar de um vínculo sem precisar reconstruir o raciocínio.';

-- Duas pessoas diferentes não podem ter o mesmo e-mail em aliases distintos?
-- Podem: a mesma pessoa entra com "Ana" no celular e "Ana Paula" no
-- computador, e cada grafia vira um alias apontando para o mesmo e-mail. O
-- índice é de busca, não de unicidade.
CREATE INDEX IF NOT EXISTS idx_meet_aliases_email
  ON formacao_meet_aliases(lower(pessoa_email))
  WHERE pessoa_email IS NOT NULL;

-- ── 2. A busca da coorte precisa ser barata ──────────────────
-- A rotina roda a cada 15 minutos e pergunta sempre a mesma coisa: quem
-- preencheu o formulário DESTA atividade DENTRO desta janela de dias.
CREATE INDEX IF NOT EXISTS idx_cert_submissions_atividade_data
  ON certificado_submissions(atividade_nome, created_at DESC);

-- E-mail é como a submissão vira pessoa: primeiro procura-se um perfil com
-- aquele endereço, e só depois se cai na semelhança de nome.
CREATE INDEX IF NOT EXISTS idx_profiles_email_lower
  ON profiles(lower(email));
