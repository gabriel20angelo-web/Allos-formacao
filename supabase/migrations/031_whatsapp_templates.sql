-- Mensagens padrões de WhatsApp (bloco de notas pessoal por usuário).
-- Acessível em /formacao/admin/calendario aba WhatsApp.

CREATE TABLE IF NOT EXISTS whatsapp_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL DEFAULT '',
  mensagem TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_templates_select" ON whatsapp_templates FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "whatsapp_templates_insert" ON whatsapp_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "whatsapp_templates_update" ON whatsapp_templates FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "whatsapp_templates_delete" ON whatsapp_templates FOR DELETE
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS whatsapp_templates_user_created
  ON whatsapp_templates(user_id, created_at);
