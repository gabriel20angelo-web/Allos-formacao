-- =============================================================
-- Formato do corte: reels em pé (9:16) ou horizontal (16:9)
-- =============================================================
-- Até aqui todo corte saía em pé, e não por escolha: o OpusClip aplica o
-- template padrão da conta quando o pedido não diz nada, e o padrão de lá está
-- em `portrait`. Gravação de encontro é 16:9 na origem, então cortar em pé
-- obriga a ferramenta a recortar a tela, e é daí que vieram os cortes com a
-- foto de perfil no meio de uma tela quase toda preta.
--
-- Duas peças, com papéis diferentes:
--
--   `formacao_clip_jobs.formato`  o que valeu naquele envio, congelado. O corte
--                                 já foi pago naquela proporção, e mudar o
--                                 pedido depois não muda o arquivo que saiu.
--
--   `formacao_clip_formato`       o pedido de quem conduz, por sala ou por
--                                 curso. É preferência, não ordem: quem envia
--                                 continua sendo o administrador, e é o envio
--                                 que gasta crédito.
--
-- Um vídeo continua sendo cortado uma vez só (a chave única em `video_url` fica
-- como está). Querer o mesmo encontro nos dois formatos seria pagar duas vezes
-- pelos mesmos minutos, e essa não é uma conta que se aprova por engano.

ALTER TABLE formacao_clip_jobs
  ADD COLUMN IF NOT EXISTS formato TEXT NOT NULL DEFAULT 'reels'
    CHECK (formato IN ('reels', 'horizontal'));

COMMENT ON COLUMN formacao_clip_jobs.formato IS
  'Proporção pedida ao OpusClip neste envio: reels = 9:16 (portrait), horizontal = 16:9 (landscape). Congelado no envio.';

CREATE TABLE IF NOT EXISTS formacao_clip_formato (
  -- Sala do Meet (space_name) ou curso (id). Dois tipos de chave no mesmo
  -- lugar, porque o pedido é o mesmo gesto e separar em duas tabelas obrigaria
  -- a escrever duas vezes toda regra que valer para os dois.
  escopo TEXT NOT NULL CHECK (escopo IN ('sala', 'curso')),
  chave TEXT NOT NULL,
  formato TEXT NOT NULL CHECK (formato IN ('reels', 'horizontal')),
  pedido_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  pedido_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (escopo, chave)
);

COMMENT ON TABLE formacao_clip_formato IS
  'Em que proporção quem conduz quer os cortes daquela sala ou daquele curso. Lido no momento de enfileirar; o administrador pode sobrepor.';

ALTER TABLE formacao_clip_formato ENABLE ROW LEVEL SECURITY;

-- Leitura pelo mesmo critério das outras tabelas de corte. A escrita passa pela
-- rota do condutor, que usa a chave de serviço e confere o cargo antes.
DROP POLICY IF EXISTS "admin_read_clip_formato" ON formacao_clip_formato;
CREATE POLICY "admin_read_clip_formato" ON formacao_clip_formato
  FOR SELECT USING (public.is_admin());
