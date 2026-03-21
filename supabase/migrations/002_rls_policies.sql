-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- ============================================================
-- PROFILES
-- ============================================================
-- Qualquer um pode ver perfis (nomes aparecem em reviews, comentários, etc.)
CREATE POLICY "Public profiles are viewable" ON profiles
  FOR SELECT USING (true);

-- Usuário edita seu próprio perfil
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- ============================================================
-- COURSES
-- ============================================================
-- Qualquer um vê cursos publicados
CREATE POLICY "Anyone can view published courses" ON courses
  FOR SELECT USING (status = 'published');

-- Instructor vê seus próprios cursos (qualquer status)
CREATE POLICY "Instructors can view own courses" ON courses
  FOR SELECT USING (instructor_id = auth.uid());

-- Admin vê todos
CREATE POLICY "Admins can view all courses" ON courses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Instructor gerencia seus cursos
CREATE POLICY "Instructors can insert own courses" ON courses
  FOR INSERT WITH CHECK (
    instructor_id = auth.uid() AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('instructor', 'admin'))
  );

CREATE POLICY "Instructors can update own courses" ON courses
  FOR UPDATE USING (instructor_id = auth.uid());

-- Admin gerencia todos os cursos
CREATE POLICY "Admins can manage all courses" ON courses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- SECTIONS
-- ============================================================
CREATE POLICY "Anyone can view sections of published courses" ON sections
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND status = 'published')
    OR
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Instructors manage sections of own courses" ON sections
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- LESSONS
-- ============================================================
CREATE POLICY "Anyone can view lessons of published courses" ON lessons
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sections s
      JOIN courses c ON c.id = s.course_id
      WHERE s.id = section_id AND (c.status = 'published' OR c.instructor_id = auth.uid())
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Instructors manage lessons of own courses" ON lessons
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM sections s
      JOIN courses c ON c.id = s.course_id
      WHERE s.id = section_id AND (c.instructor_id = auth.uid())
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- LESSON ATTACHMENTS
-- ============================================================
CREATE POLICY "Anyone can view attachments of published courses" ON lesson_attachments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND (c.status = 'published' OR c.instructor_id = auth.uid())
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Instructors manage attachments of own courses" ON lesson_attachments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND c.instructor_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- ENROLLMENTS
-- ============================================================
-- Aluno gerencia suas matrículas
CREATE POLICY "Students manage own enrollments" ON enrollments
  FOR ALL USING (user_id = auth.uid());

-- Instructor vê matrículas dos seus cursos
CREATE POLICY "Instructors view enrollments of own courses" ON enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
  );

-- Admin vê tudo
CREATE POLICY "Admins manage all enrollments" ON enrollments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- LESSON PROGRESS
-- ============================================================
CREATE POLICY "Students manage own progress" ON lesson_progress
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Instructors view progress of own course students" ON lesson_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lessons l
      JOIN sections s ON s.id = l.section_id
      JOIN courses c ON c.id = s.course_id
      WHERE l.id = lesson_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins view all progress" ON lesson_progress
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- EXAM QUESTIONS
-- ============================================================
CREATE POLICY "Enrolled students view exam questions" ON exam_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM enrollments
      WHERE course_id = exam_questions.course_id AND user_id = auth.uid()
    )
    OR
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Instructors manage exam questions of own courses" ON exam_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- EXAM ATTEMPTS
-- ============================================================
CREATE POLICY "Students manage own attempts" ON exam_attempts
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Instructors view attempts of own course students" ON exam_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM courses WHERE id = course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "Admins view all attempts" ON exam_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- CERTIFICATES
-- ============================================================
-- Verificação pública de certificados
CREATE POLICY "Anyone can verify certificates" ON certificates
  FOR SELECT USING (true);

-- Alunos criam seus certificados
CREATE POLICY "Students create own certificates" ON certificates
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admin gerencia todos
CREATE POLICY "Admins manage all certificates" ON certificates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- REVIEWS
-- ============================================================
-- Qualquer um vê reviews
CREATE POLICY "Anyone can view reviews" ON reviews
  FOR SELECT USING (true);

-- Alunos gerenciam seus reviews
CREATE POLICY "Students manage own reviews" ON reviews
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students update own reviews" ON reviews
  FOR UPDATE USING (user_id = auth.uid());

-- Admin pode deletar
CREATE POLICY "Admins can delete reviews" ON reviews
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- LESSON COMMENTS
-- ============================================================
-- Qualquer matriculado pode ver comentários
CREATE POLICY "Enrolled users view lesson comments" ON lesson_comments
  FOR SELECT USING (true);

-- Matriculados podem comentar
CREATE POLICY "Users create own comments" ON lesson_comments
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Dono, instructor ou admin podem deletar
CREATE POLICY "Users delete own comments" ON lesson_comments
  FOR DELETE USING (
    user_id = auth.uid()
    OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'instructor'))
  );

-- ============================================================
-- COURSE INSTRUCTORS
-- ============================================================
CREATE POLICY "Anyone can view course instructors" ON course_instructors
  FOR SELECT USING (true);

CREATE POLICY "Admins manage course instructors" ON course_instructors
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
