-- =============================================================
-- A memória de quem avisa
-- =============================================================
-- A captura roda a cada 15 minutos. Sem memória, qualquer alarme viraria
-- quatro e-mails por hora sobre o mesmo problema, e e-mail repetido é a forma
-- mais rápida de ensinar alguém a ignorar o assunto inteiro.
--
-- Esta tabela guarda uma linha por assunto ("captura"), com a hora do último
-- e-mail enviado. Quem avisa só volta a avisar depois da folga.
--
-- Não tem policy nenhuma de propósito: quem escreve aqui é a rota, com a
-- chave de serviço. Ninguém precisa ler isso pelo navegador.

CREATE TABLE IF NOT EXISTS public.avisos_watermarks (
  chave        TEXT PRIMARY KEY,
  ultimo_email TIMESTAMPTZ,
  ultimo_texto TEXT,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.avisos_watermarks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.avisos_watermarks IS
  'Última vez que cada assunto gerou aviso por e-mail. Serve para não repetir o mesmo alarme a cada rodada do cron. Escrita só pela chave de serviço.';

-- =============================================================
-- Conferência
-- =============================================================
--   SELECT * FROM public.avisos_watermarks;
--   -- vazia agora; ganha a linha 'captura' no primeiro alarme enviado.
