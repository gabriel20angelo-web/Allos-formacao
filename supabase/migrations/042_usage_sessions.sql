-- 042_usage_sessions.sql
-- Tempo de uso da plataforma.
--
-- O player é um iframe de terceiro, então não dá para ler o tempo real de
-- reprodução. O que se pode medir com honestidade é permanência ativa: o
-- cliente manda um sinal a cada minuto enquanto a aba está visível, e o
-- servidor costura esses sinais em sessões.
--
-- Uma sessão é uma janela contínua de presença: sinal que chega até 3 minutos
-- depois do anterior soma na sessão aberta; passou disso, abre outra. Assim
-- fechar o notebook não vira "oito horas assistindo".
--
-- É esse número que a cláusula 8.4 dos Termos de Uso chama de "registro de
-- tempo de reprodução" — e o que sustenta reter um certificado.

CREATE TABLE IF NOT EXISTS usage_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
  lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
  -- rota reduzida ("curso", "aula", "meus-cursos", "admin"...)
  contexto TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_sessions_user
  ON usage_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_lesson
  ON usage_sessions (lesson_id);
CREATE INDEX IF NOT EXISTS idx_usage_sessions_course
  ON usage_sessions (course_id);
-- a rota de ping procura a sessão ainda aberta desta pessoa
CREATE INDEX IF NOT EXISTS idx_usage_sessions_aberta
  ON usage_sessions (user_id, ended_at DESC);

ALTER TABLE usage_sessions ENABLE ROW LEVEL SECURITY;

-- Cada um vê o próprio tempo; admin vê tudo. A escrita é só da rota de ping,
-- que usa service role — sem policy de INSERT, ninguém forja tempo pelo client.
DROP POLICY IF EXISTS "usage_sessions_own" ON usage_sessions;
CREATE POLICY "usage_sessions_own" ON usage_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "usage_sessions_admin" ON usage_sessions;
CREATE POLICY "usage_sessions_admin" ON usage_sessions FOR SELECT
  USING (public.is_admin());
