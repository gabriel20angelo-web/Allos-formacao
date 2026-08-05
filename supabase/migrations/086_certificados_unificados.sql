-- 086_certificados_unificados.sql
-- Os três certificados passam a morar na mesma tabela.
--
-- A plataforma emite três documentos com o mesmo rosto e histórias diferentes.
-- O de curso nasce em issue-certificate, grava linha em certificates, ganha
-- código e pode ser conferido por quem recebe. O de formação e a declaração
-- avulsa saem do painel como PDF e não deixam rastro nenhum: sem código, sem
-- consulta pública, sem anulação. Quem recebe um não tem como provar que é
-- autêntico, e a Allos não tem como desfazer se for preciso.
--
-- A correção é aditiva de propósito, porque o fluxo de curso já quebrou antes e
-- não pode ser tocado. A coluna tipo nasce com DEFAULT 'curso': o
-- issue-certificate continua inserindo sem saber que ela existe, e a linha nasce
-- classificada certo sem que uma linha de código mude no caminho vivo. Os tipos
-- novos entram por rota de API própria, com service role, e não por este
-- caminho.
--
-- user_id e course_id deixam de ser obrigatórios porque os documentos novos
-- frequentemente não têm nem um nem outro. A maior parte de quem participa dos
-- grupos não tem conta na plataforma, e a declaração avulsa não se refere a
-- curso nenhum. Exigir as duas chaves seria obrigar a inventar vínculo para
-- poder registrar, que é como se perde a confiança no registro.
--
-- Sem backfill do que já foi entregue. Reconstituir por agregado de nome quem
-- resgatou certificado de formação nos meses passados seria chutar identidade e
-- imprimir o chute como se fosse registro. O rastro começa agora.

-- ── Chaves que passam a admitir ausência ──

ALTER TABLE certificates ALTER COLUMN course_id DROP NOT NULL;
ALTER TABLE certificates ALTER COLUMN user_id DROP NOT NULL;

-- ── O que distingue um documento do outro ──

ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'curso';

ALTER TABLE certificates DROP CONSTRAINT IF EXISTS certificates_tipo_check;
ALTER TABLE certificates ADD CONSTRAINT certificates_tipo_check
  CHECK (tipo IN ('curso', 'formacao', 'avulso'));

-- A carga horária do certificado de curso vem de courses.certificate_hours, e
-- continua vindo de lá. Esta coluna é para os documentos que não têm curso por
-- trás: as horas somadas da formação e as da declaração avulsa, que são
-- decididas na hora da emissão e não existem em lugar nenhum depois.
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS horas NUMERIC;

-- O nome impresso no documento. Para o certificado de curso o nome sai do
-- perfil, mas quem recebe certificado de formação muitas vezes não tem perfil, e
-- o nome que vale é o que a própria pessoa escreveu no formulário. Guardar aqui
-- é o que permite a verificação pública responder quem é o titular sem inventar.
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS nome_certificado TEXT;

-- O que sustenta o número. Quais atividades foram somadas, qual texto foi
-- impresso, quem emitiu e a partir de qual tela. É o que se lê quando, meses
-- depois, alguém pergunta de onde saíram aquelas horas.
ALTER TABLE certificates
  ADD COLUMN IF NOT EXISTS detalhes JSONB;

CREATE INDEX IF NOT EXISTS idx_certificates_tipo ON certificates (tipo);

-- Busca por titular sem conta, que é como se procura um certificado de formação
-- quando chega a dúvida por e-mail e a pessoa só sabe dizer o próprio nome.
CREATE INDEX IF NOT EXISTS idx_certificates_nome
  ON certificates (lower(nome_certificado));

-- ── A policy de admin que barrava quem tem o cargo como extra ──
-- Mesmo conserto já feito na 027, 028, 078 e 081: comparar role = 'admin' na
-- unha ignora quem carrega o cargo no array cargos, e a tela do painel deixa
-- clicar num botão que o banco recusa em silêncio. A anulação escreve direto do
-- client, então sem isto o componente novo falharia justamente para o perfil que
-- mais precisa dele.
DROP POLICY IF EXISTS "certificates_admin" ON certificates;
CREATE POLICY "certificates_admin" ON certificates
  FOR ALL USING (public.is_admin());
