-- =============================================================
-- O condutor entra e vê o próprio grupo
-- =============================================================
-- Até aqui não havia como saber QUE PESSOA é um condutor. A ficha em
-- certificado_condutores tem nome, telefone e observações, e mais nada: nenhum
-- vínculo com conta. Todo o resto do sistema casa condutor por texto — compara
-- o nome exibido no Meet com o nome da ficha — e isso serve para estatística,
-- não para permissão. Nome não é identidade: dois "Ana Paula" derrubariam a
-- ideia inteira, e um apelido diferente no Meet já basta para errar.
--
-- Então o vínculo vira explícito, por conta, e não por semelhança de nome.

ALTER TABLE certificado_condutores
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN certificado_condutores.user_id IS
  'A conta desta pessoa. É o que permite abrir a área do condutor para ela; sem isso a ficha é só um nome em texto.';

CREATE UNIQUE INDEX IF NOT EXISTS idx_condutores_user
  ON certificado_condutores(user_id) WHERE user_id IS NOT NULL;

-- =============================================================
-- O papel
-- =============================================================
-- Rótulo novo em transação separada do uso: o Postgres não deixa usar um valor
-- de enum recém-criado na mesma transação. É por isso que a função abaixo
-- compara role como TEXTO — mesmo motivo do cargo de eventos, na 041.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'condutor';

CREATE OR REPLACE FUNCTION public.eh_condutor()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
     WHERE id = auth.uid()
       AND role::text IN ('condutor', 'admin')
  );
$$;

/**
 * Se o usuário logado conduz o grupo desta sala.
 *
 * Admin passa sempre. Para o resto, o caminho é conta → ficha do condutor →
 * alocação no horário → sala daquele horário. Cada elo é uma chave estrangeira
 * de verdade, não um nome parecido.
 */
CREATE OR REPLACE FUNCTION public.conduz_a_sala(p_space_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
      FROM formacao_meet_spaces s
      JOIN formacao_alocacoes a  ON a.slot_id = s.slot_id
      JOIN certificado_condutores c ON c.id = a.condutor_id
     WHERE s.space_name = p_space_name
       AND c.user_id = auth.uid()
  );
$$;

/** O mesmo, a partir do encontro. */
CREATE OR REPLACE FUNCTION public.conduz_o_encontro(p_encontro_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1
      FROM formacao_meet_encontros e
     WHERE e.id = p_encontro_id
       AND public.conduz_a_sala(e.space_name)
  );
$$;

GRANT EXECUTE ON FUNCTION public.eh_condutor() TO authenticated;
GRANT EXECUTE ON FUNCTION public.conduz_a_sala(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.conduz_o_encontro(UUID) TO authenticated;

-- =============================================================
-- O que ele enxerga
-- =============================================================
-- Só o próprio grupo. Um condutor não tem por que ver o quórum nem os cortes
-- de outro grupo, e a divisão precisa estar no banco: a tela pode errar, a
-- policy não.

DROP POLICY IF EXISTS condutor_le_sua_sala ON formacao_meet_spaces;
CREATE POLICY condutor_le_sua_sala ON formacao_meet_spaces
  FOR SELECT USING (public.conduz_a_sala(space_name));

DROP POLICY IF EXISTS condutor_le_seus_encontros ON formacao_meet_encontros;
CREATE POLICY condutor_le_seus_encontros ON formacao_meet_encontros
  FOR SELECT USING (public.conduz_a_sala(space_name));

DROP POLICY IF EXISTS condutor_le_suas_participacoes ON formacao_meet_participacoes;
CREATE POLICY condutor_le_suas_participacoes ON formacao_meet_participacoes
  FOR SELECT USING (public.conduz_o_encontro(encontro_id));

DROP POLICY IF EXISTS condutor_le_seus_jobs ON formacao_clip_jobs;
CREATE POLICY condutor_le_seus_jobs ON formacao_clip_jobs
  FOR SELECT USING (
    encontro_id IS NOT NULL AND public.conduz_o_encontro(encontro_id)
  );

DROP POLICY IF EXISTS condutor_le_seus_clipes ON formacao_clips;
CREATE POLICY condutor_le_seus_clipes ON formacao_clips
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formacao_clip_jobs j
       WHERE j.id = formacao_clips.job_id
         AND j.encontro_id IS NOT NULL
         AND public.conduz_o_encontro(j.encontro_id)
    )
  );

-- A curadoria é o trabalho dele: aprovar, reprovar, anotar. Só esses três
-- campos, e só nos cortes do próprio grupo — a checagem se repete no WITH CHECK
-- para que ele não consiga mover um clipe para fora do alcance dele.
DROP POLICY IF EXISTS condutor_avalia_seus_clipes ON formacao_clips;
CREATE POLICY condutor_avalia_seus_clipes ON formacao_clips
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM formacao_clip_jobs j
       WHERE j.id = formacao_clips.job_id
         AND j.encontro_id IS NOT NULL
         AND public.conduz_o_encontro(j.encontro_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM formacao_clip_jobs j
       WHERE j.id = formacao_clips.job_id
         AND j.encontro_id IS NOT NULL
         AND public.conduz_o_encontro(j.encontro_id)
    )
  );

-- A ficha própria, para a tela saber de quem se trata.
DROP POLICY IF EXISTS condutor_le_sua_ficha ON certificado_condutores;
CREATE POLICY condutor_le_sua_ficha ON certificado_condutores
  FOR SELECT USING (user_id = auth.uid());
