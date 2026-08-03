-- =============================================================
-- Quem conduz e quem cuida de eventos também é associado
-- =============================================================
-- O papel de uma pessoa é uma coluna só, então marcar alguém como "condutor"
-- apagava o "associado" dela. Na prática isso tirava dessa pessoa o
-- Aprimoramento — que é material de trabalho de quem conduz grupo, exatamente
-- quem mais precisa dele.
--
-- A leitura já funcionava por acaso: a policy de SELECT libera todo exercício
-- publicado, sem olhar papel. Quem barrava era o `redirect` da página. Mas
-- CRIAR exercício e ENVIAR sugestão travavam no banco, e é isso que muda aqui.

DROP POLICY IF EXISTS "insert_aprimoramento_exercicios" ON aprimoramento_exercicios;
CREATE POLICY "insert_aprimoramento_exercicios" ON aprimoramento_exercicios
  FOR INSERT WITH CHECK (
    public.is_admin()
    OR (
      criado_por = auth.uid()
      -- Exercício de quem não é administrador nasce não curado, sempre: curar
      -- é o gesto de quem responde pelo acervo.
      AND curado = FALSE
      AND EXISTS (
        SELECT 1 FROM profiles
         WHERE id = auth.uid()
           AND role::text IN ('associado', 'admin', 'condutor', 'eventos')
      )
    )
  );

DROP POLICY IF EXISTS "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes;
CREATE POLICY "insert_aprimoramento_sugestoes" ON aprimoramento_sugestoes
  FOR INSERT WITH CHECK (
    criado_por = auth.uid()
    AND status = 'pendente'
    AND EXISTS (
      SELECT 1 FROM profiles
       WHERE id = auth.uid()
         AND role::text IN ('associado', 'admin', 'condutor', 'eventos')
    )
  );
