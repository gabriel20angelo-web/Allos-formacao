-- ============================================================
-- ALLOS FORMAÇÃO — Schema Completo para Novo Supabase
-- Gerado em 2026-03-25
-- Cole TUDO no SQL Editor do novo projeto Supabase e clique Run
-- ============================================================

-- ============================================================
-- 0. EXTENSÕES
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('student', 'instructor', 'admin', 'associado');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE course_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE video_source AS ENUM ('youtube', 'google_drive', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('free', 'pending', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE instructor_role AS ENUM ('lead', 'assistant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- 2. TABELAS CORE — Usuários e Cursos
-- ============================================================

-- Profiles (estende auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'student',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Courses
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  long_description TEXT,
  thumbnail_url TEXT,
  instructor_id UUID NOT NULL REFERENCES profiles(id),
  is_free BOOLEAN NOT NULL DEFAULT false,
  price_cents INTEGER,
  status course_status NOT NULL DEFAULT 'draft',
  category TEXT,
  total_duration_minutes INTEGER,
  certificate_enabled BOOLEAN NOT NULL DEFAULT true,
  exam_enabled BOOLEAN NOT NULL DEFAULT false,
  exam_passing_score INTEGER NOT NULL DEFAULT 70,
  whatsapp_number TEXT,
  learning_points JSONB,
  -- Colunas adicionais (migrations 003-005)
  featured BOOLEAN DEFAULT false,
  featured_label TEXT,
  course_type TEXT NOT NULL DEFAULT 'async',
  default_lesson_thumbnail_url TEXT,
  -- Colunas de certificado
  certificate_hours INTEGER,
  certificate_body_text TEXT,
  certificate_signer_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Sections (módulos)
CREATE TABLE IF NOT EXISTS sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lessons (aulas)
CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT,
  video_source video_source,
  duration_minutes INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lesson Attachments
CREATE TABLE IF NOT EXISTS lesson_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size_bytes INTEGER,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Course Instructors (múltiplos professores)
CREATE TABLE IF NOT EXISTS course_instructors (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  instructor_id UUID NOT NULL REFERENCES profiles(id),
  role instructor_role NOT NULL DEFAULT 'assistant',
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, instructor_id)
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. TABELAS — Matrículas e Progresso
-- ============================================================

-- Enrollments (matrículas)
CREATE TABLE IF NOT EXISTS enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  status enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  payment_status payment_status NOT NULL DEFAULT 'free',
  payment_reference TEXT,
  UNIQUE (user_id, course_id)
);

-- Lesson Progress
CREATE TABLE IF NOT EXISTS lesson_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  lesson_id UUID NOT NULL REFERENCES lessons(id),
  completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE (user_id, lesson_id)
);

-- ============================================================
-- 4. TABELAS — Avaliações e Certificados
-- ============================================================

-- Exam Questions
CREATE TABLE IF NOT EXISTS exam_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Exam Attempts
CREATE TABLE IF NOT EXISTS exam_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  score INTEGER NOT NULL,
  passed BOOLEAN NOT NULL,
  answers JSONB,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Certificates
CREATE TABLE IF NOT EXISTS certificates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  certificate_code TEXT UNIQUE NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pdf_url TEXT
);

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  rating INTEGER NOT NULL CHECK (rating >= 0 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, course_id)
);

-- Lesson Comments
CREATE TABLE IF NOT EXISTS lesson_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. TABELAS — Formação (Grupos Síncronos)
-- ============================================================

-- Condutores (facilitadores dos grupos)
CREATE TABLE IF NOT EXISTS certificado_condutores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  observacoes TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Atividades (tipos de grupo/formação)
CREATE TABLE IF NOT EXISTS certificado_atividades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  carga_horaria INTEGER DEFAULT 2,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Submissions (feedbacks/presenças dos participantes)
CREATE TABLE IF NOT EXISTS certificado_submissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome_completo TEXT NOT NULL,
  nome_social TEXT,
  email TEXT NOT NULL,
  atividade_nome TEXT NOT NULL,
  nota_grupo INTEGER DEFAULT 0 CHECK (nota_grupo >= 0 AND nota_grupo <= 10),
  condutores TEXT[] DEFAULT '{}',
  nota_condutor INTEGER DEFAULT 0 CHECK (nota_condutor >= 0 AND nota_condutor <= 10),
  relato TEXT,
  certificado_gerado BOOLEAN DEFAULT false,
  certificado_resgatado BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Horários disponíveis
CREATE TABLE IF NOT EXISTS formacao_horarios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  hora TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Slots semanais (dia x horário)
CREATE TABLE IF NOT EXISTS formacao_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 4),
  horario_id UUID NOT NULL REFERENCES formacao_horarios(id) ON DELETE CASCADE,
  ativo BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente','conduzido','nao_conduzido','cancelado','desmarcado')),
  atividade_nome TEXT,
  meet_link TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(dia_semana, horario_id)
);

-- Alocações (condutor → slot)
CREATE TABLE IF NOT EXISTS formacao_alocacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slot_id UUID NOT NULL REFERENCES formacao_slots(id) ON DELETE CASCADE,
  condutor_id UUID NOT NULL REFERENCES certificado_condutores(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(slot_id, condutor_id)
);

-- Cronograma (config singleton)
CREATE TABLE IF NOT EXISTS formacao_cronograma (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  imagem_base64 TEXT,
  grupos_visiveis BOOLEAN DEFAULT true,
  duracao_minutos INTEGER DEFAULT 90,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Eventos temporários
CREATE TABLE IF NOT EXISTS certificado_eventos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  descricao TEXT,
  data_inicio TIMESTAMPTZ NOT NULL,
  data_fim TIMESTAMPTZ NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. TABELAS — Features extras
-- ============================================================

-- Perguntas de vídeo
CREATE TABLE IF NOT EXISTS video_questions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  user_name TEXT,
  user_email TEXT,
  question TEXT NOT NULL,
  answered BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Inscritos para notificação
CREATE TABLE IF NOT EXISTS notify_subscribers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_courses_slug ON courses(slug);
CREATE INDEX IF NOT EXISTS idx_courses_status ON courses(status);
CREATE INDEX IF NOT EXISTS idx_courses_instructor ON courses(instructor_id);
CREATE INDEX IF NOT EXISTS idx_courses_featured ON courses(featured) WHERE featured = true;
CREATE INDEX IF NOT EXISTS idx_sections_course ON sections(course_id);
CREATE INDEX IF NOT EXISTS idx_lessons_section ON lessons(section_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_reviews_course ON reviews(course_id);
CREATE INDEX IF NOT EXISTS idx_certificates_code ON certificates(certificate_code);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON lesson_comments(lesson_id);
CREATE INDEX IF NOT EXISTS idx_submissions_nome ON certificado_submissions(nome_completo);
CREATE INDEX IF NOT EXISTS idx_submissions_created ON certificado_submissions(created_at);
CREATE INDEX IF NOT EXISTS idx_slots_horario ON formacao_slots(horario_id);
CREATE INDEX IF NOT EXISTS idx_alocacoes_slot ON formacao_alocacoes(slot_id);

-- ============================================================
-- 8. TRIGGERS E FUNCTIONS
-- ============================================================

-- Auto-criar profile ao signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Usuário'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-calcular duração total do curso
CREATE OR REPLACE FUNCTION update_course_duration()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE courses
  SET total_duration_minutes = (
    SELECT COALESCE(SUM(l.duration_minutes), 0)
    FROM lessons l
    JOIN sections s ON l.section_id = s.id
    WHERE s.course_id = (
      SELECT course_id FROM sections WHERE id = COALESCE(NEW.section_id, OLD.section_id)
    )
  ),
  updated_at = NOW()
  WHERE id = (
    SELECT course_id FROM sections WHERE id = COALESCE(NEW.section_id, OLD.section_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_course_duration ON lessons;
CREATE TRIGGER trigger_update_course_duration
  AFTER INSERT OR UPDATE OR DELETE ON lessons
  FOR EACH ROW EXECUTE FUNCTION update_course_duration();

-- ============================================================
-- 9. ROW LEVEL SECURITY — Habilitar em todas as tabelas
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_instructors ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_condutores ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_atividades ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_horarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_alocacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE formacao_cronograma ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificado_eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notify_subscribers ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 10. RLS POLICIES — Profiles
-- ============================================================
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- 11. RLS POLICIES — Courses
-- ============================================================
CREATE POLICY "courses_select_published" ON courses
  FOR SELECT USING (status = 'published');

CREATE POLICY "courses_select_own" ON courses
  FOR SELECT USING (instructor_id = auth.uid());

CREATE POLICY "courses_select_admin" ON courses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "courses_insert_instructor" ON courses
  FOR INSERT WITH CHECK (
    instructor_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
  );

CREATE POLICY "courses_update_own" ON courses
  FOR UPDATE USING (instructor_id = auth.uid());

CREATE POLICY "courses_admin_all" ON courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 12. RLS POLICIES — Sections
-- ============================================================
CREATE POLICY "sections_select" ON sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND status = 'published')
    OR EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "sections_manage" ON sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 13. RLS POLICIES — Lessons
-- ============================================================
CREATE POLICY "lessons_select" ON lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sections s JOIN courses c ON c.id = s.course_id
      WHERE s.id = section_id AND (c.status = 'published' OR c.instructor_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "lessons_manage" ON lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sections s JOIN courses c ON c.id = s.course_id
      WHERE s.id = section_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 14. RLS POLICIES — Lesson Attachments
-- ============================================================
CREATE POLICY "attachments_select" ON lesson_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l JOIN sections s ON s.id = l.section_id JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND (c.status = 'published' OR c.instructor_id = auth.uid())
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "attachments_manage" ON lesson_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons l JOIN sections s ON s.id = l.section_id JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 15. RLS POLICIES — Enrollments
-- ============================================================
CREATE POLICY "enrollments_own" ON enrollments
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "enrollments_instructor_view" ON enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "enrollments_admin" ON enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 16. RLS POLICIES — Lesson Progress
-- ============================================================
CREATE POLICY "progress_own" ON lesson_progress
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "progress_instructor_view" ON lesson_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l JOIN sections s ON s.id = l.section_id JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "progress_admin_view" ON lesson_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 17. RLS POLICIES — Exams
-- ============================================================
CREATE POLICY "exam_questions_select" ON exam_questions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM enrollments WHERE course_id = exam_questions.course_id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "exam_questions_manage" ON exam_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "exam_attempts_own" ON exam_attempts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "exam_attempts_instructor_view" ON exam_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "exam_attempts_admin_view" ON exam_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 18. RLS POLICIES — Certificates
-- ============================================================
CREATE POLICY "certificates_public_verify" ON certificates
  FOR SELECT USING (true);

CREATE POLICY "certificates_create_own" ON certificates
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "certificates_admin" ON certificates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 19. RLS POLICIES — Reviews
-- ============================================================
CREATE POLICY "reviews_select" ON reviews
  FOR SELECT USING (true);

CREATE POLICY "reviews_insert_own" ON reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reviews_update_own" ON reviews
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "reviews_delete_admin" ON reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 20. RLS POLICIES — Lesson Comments
-- ============================================================
CREATE POLICY "comments_select" ON lesson_comments
  FOR SELECT USING (true);

CREATE POLICY "comments_insert_own" ON lesson_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "comments_delete" ON lesson_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor'))
  );

-- ============================================================
-- 21. RLS POLICIES — Course Instructors
-- ============================================================
CREATE POLICY "instructors_select" ON course_instructors
  FOR SELECT USING (true);

CREATE POLICY "instructors_admin" ON course_instructors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 22. RLS POLICIES — Categories
-- ============================================================
CREATE POLICY "categories_select" ON categories
  FOR SELECT USING (true);

CREATE POLICY "categories_admin_insert" ON categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "categories_admin_delete" ON categories
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- 23. RLS POLICIES — Formação (Grupos Síncronos)
-- ============================================================

-- SELECT aberto (form público precisa ler)
CREATE POLICY "select_condutores" ON certificado_condutores FOR SELECT USING (true);
CREATE POLICY "select_atividades" ON certificado_atividades FOR SELECT USING (true);
CREATE POLICY "select_submissions" ON certificado_submissions FOR SELECT USING (true);
CREATE POLICY "select_horarios" ON formacao_horarios FOR SELECT USING (true);
CREATE POLICY "select_slots" ON formacao_slots FOR SELECT USING (true);
CREATE POLICY "select_alocacoes" ON formacao_alocacoes FOR SELECT USING (true);
CREATE POLICY "select_cronograma" ON formacao_cronograma FOR SELECT USING (true);
CREATE POLICY "select_eventos" ON certificado_eventos FOR SELECT USING (true);

-- Submissions: form público pode inserir e atualizar
CREATE POLICY "insert_submissions_anon" ON certificado_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "update_submissions" ON certificado_submissions FOR UPDATE USING (true);

-- Admin full access
CREATE POLICY "admin_all_condutores" ON certificado_condutores FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_atividades" ON certificado_atividades FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_delete_submissions" ON certificado_submissions FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_horarios" ON formacao_horarios FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_slots" ON formacao_slots FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_alocacoes" ON formacao_alocacoes FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_cronograma" ON formacao_cronograma FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));
CREATE POLICY "admin_all_eventos" ON certificado_eventos FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ============================================================
-- 24. RLS POLICIES — Features extras
-- ============================================================

-- Video questions: qualquer autenticado pode inserir, admin vê tudo
CREATE POLICY "video_questions_insert" ON video_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "video_questions_select" ON video_questions FOR SELECT USING (true);
CREATE POLICY "video_questions_admin" ON video_questions FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- Notify subscribers: qualquer um pode se inscrever
CREATE POLICY "notify_insert" ON notify_subscribers FOR INSERT WITH CHECK (true);
CREATE POLICY "notify_select_admin" ON notify_subscribers FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

-- ============================================================
-- 25. SEED DATA — Dados iniciais obrigatórios
-- ============================================================

-- Categorias padrão
INSERT INTO categories (name) VALUES
  ('Psicologia Clínica'),
  ('Neuropsicologia'),
  ('Psicoterapia'),
  ('Avaliação Psicológica'),
  ('Supervisão Clínica'),
  ('Formação Continuada'),
  ('Pesquisa')
ON CONFLICT (name) DO NOTHING;

-- Horários padrão da formação
INSERT INTO formacao_horarios (hora, ordem) VALUES
  ('14:00', 1), ('16:00', 2), ('19:00', 3)
ON CONFLICT DO NOTHING;

-- Cronograma singleton
INSERT INTO formacao_cronograma (grupos_visiveis, duracao_minutos) VALUES (true, 90);
