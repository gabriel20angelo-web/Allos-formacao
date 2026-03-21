-- ============================================================
-- SEED DATA — Dados de exemplo para desenvolvimento
-- ============================================================
-- NOTA: Execute este seed APÓS criar um usuário via auth.
-- Os UUIDs abaixo são exemplos; substitua pelos IDs reais.

-- IDs fictícios para referência
-- Substitua pelo ID real do usuário admin criado:
-- admin_id: 00000000-0000-0000-0000-000000000001
-- instructor_id: 00000000-0000-0000-0000-000000000002
-- student_id: 00000000-0000-0000-0000-000000000003

-- ============================================================
-- PROFILES (se rodando localmente sem auth trigger)
-- ============================================================
INSERT INTO profiles (id, full_name, email, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Admin Allos', 'admin@allos.org.br', 'admin'),
  ('00000000-0000-0000-0000-000000000002', 'Dra. Mariana Silva', 'mariana@allos.org.br', 'instructor'),
  ('00000000-0000-0000-0000-000000000003', 'João Aluno', 'joao@email.com', 'student')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- COURSES
-- ============================================================
INSERT INTO courses (id, title, slug, description, long_description, instructor_id, is_free, status, category, certificate_enabled, exam_enabled, exam_passing_score, learning_points) VALUES
(
  '10000000-0000-0000-0000-000000000001',
  'Introdução à Psicoterapia',
  'introducao-psicoterapia',
  'Entenda os fundamentos da prática psicoterápica com uma abordagem acolhedora e baseada em evidências.',
  '## Sobre o curso

Este curso oferece uma introdução completa aos fundamentos da psicoterapia, abordando as principais escolas teóricas e técnicas básicas para a prática clínica.

### Para quem é este curso?

- Estudantes de psicologia em busca de uma visão panorâmica
- Profissionais que desejam revisar conceitos fundamentais
- Interessados em entender como funciona o processo terapêutico

### Metodologia

Aulas gravadas com casos clínicos ilustrativos, leituras complementares e exercícios de reflexão.',
  '00000000-0000-0000-0000-000000000002',
  true,
  'published',
  'Psicologia Clínica',
  true,
  false,
  70,
  '["Compreender as bases teóricas da psicoterapia", "Identificar as principais abordagens terapêuticas", "Entender o setting terapêutico", "Reconhecer fatores comuns de eficácia", "Desenvolver escuta empática"]'
),
(
  '10000000-0000-0000-0000-000000000002',
  'Avaliação Neuropsicológica: da Teoria à Prática',
  'avaliacao-neuropsicologica',
  'Domine os instrumentos e protocolos de avaliação neuropsicológica com foco em casos clínicos reais.',
  '## Sobre o curso

Um curso completo sobre avaliação neuropsicológica, desde a fundamentação teórica até a aplicação prática dos principais instrumentos.

### Conteúdo programático

1. Fundamentos da neuropsicologia
2. Instrumentos de avaliação padronizados
3. Elaboração de laudos
4. Casos clínicos supervisionados
5. Devolutiva ao paciente e à família',
  '00000000-0000-0000-0000-000000000002',
  false,
  'published',
  'Neuropsicologia',
  true,
  true,
  70,
  '["Aplicar os principais testes neuropsicológicos", "Elaborar laudos neuropsicológicos completos", "Conduzir devolutivas com pacientes e famílias", "Interpretar resultados com rigor científico"]'
);

UPDATE courses SET price_cents = 19900 WHERE id = '10000000-0000-0000-0000-000000000002';

-- ============================================================
-- SECTIONS
-- ============================================================
-- Curso 1: Introdução à Psicoterapia
INSERT INTO sections (id, course_id, title, position) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Módulo 1 — Fundamentos', 0),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'Módulo 2 — Abordagens Teóricas', 1),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'Módulo 3 — Prática Clínica', 2);

-- Curso 2: Avaliação Neuropsicológica
INSERT INTO sections (id, course_id, title, position) VALUES
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002', 'Módulo 1 — Bases da Neuropsicologia', 0),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002', 'Módulo 2 — Instrumentos de Avaliação', 1);

-- ============================================================
-- LESSONS
-- ============================================================
-- Curso 1, Módulo 1
INSERT INTO lessons (id, section_id, title, description, video_url, video_source, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'O que é psicoterapia?', 'Nesta aula introdutória, discutimos o conceito de psicoterapia e seus objetivos fundamentais.', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 25, 0, true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'História da psicoterapia', 'Uma viagem pelas origens da prática psicoterápica, de Freud aos dias atuais.', NULL, NULL, 30, 1, false),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', 'O setting terapêutico', 'Como o ambiente e o enquadre influenciam o processo terapêutico.', NULL, NULL, 20, 2, false);

-- Curso 1, Módulo 2
INSERT INTO lessons (id, section_id, title, description, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000002', 'Psicanálise', 'Fundamentos da abordagem psicanalítica.', 35, 0, false),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', 'Terapia Cognitivo-Comportamental', 'Princípios e técnicas da TCC.', 40, 1, false);

-- Curso 1, Módulo 3
INSERT INTO lessons (id, section_id, title, description, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000003', 'Primeiro atendimento', 'Como conduzir a primeira sessão com um paciente.', 30, 0, false),
  ('30000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000003', 'Escuta ativa e empatia', 'Desenvolvendo habilidades fundamentais para a prática clínica.', 25, 1, false);

-- Curso 2, Módulo 1
INSERT INTO lessons (id, section_id, title, description, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000004', 'Introdução à Neuropsicologia', 'O que é neuropsicologia e qual seu papel na saúde mental.', 30, 0, true),
  ('30000000-0000-0000-0000-000000000009', '20000000-0000-0000-0000-000000000004', 'Neuroanatomia funcional', 'Revisão das principais estruturas cerebrais relevantes para avaliação.', 45, 1, false);

-- Curso 2, Módulo 2
INSERT INTO lessons (id, section_id, title, description, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000010', '20000000-0000-0000-0000-000000000005', 'WAIS e WISC', 'Aplicação e interpretação das escalas Wechsler.', 50, 0, false),
  ('30000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000005', 'Testes de atenção e memória', 'Trail Making Test, Stroop, e outros instrumentos essenciais.', 40, 1, false);

-- ============================================================
-- EXAM QUESTIONS (Curso 2 — tem prova)
-- ============================================================
INSERT INTO exam_questions (id, course_id, question_text, options, position) VALUES
(
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  'Qual é o principal objetivo da avaliação neuropsicológica?',
  '[{"id":"a1","text":"Diagnosticar transtornos de personalidade","is_correct":false},{"id":"a2","text":"Avaliar funções cognitivas e sua relação com o cérebro","is_correct":true},{"id":"a3","text":"Prescrever medicação psicotrópica","is_correct":false},{"id":"a4","text":"Realizar psicoterapia","is_correct":false}]',
  0
),
(
  '40000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'O Trail Making Test avalia primariamente:',
  '[{"id":"b1","text":"Memória de longo prazo","is_correct":false},{"id":"b2","text":"Inteligência geral","is_correct":false},{"id":"b3","text":"Atenção alternada e flexibilidade cognitiva","is_correct":true},{"id":"b4","text":"Linguagem expressiva","is_correct":false}]',
  1
),
(
  '40000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000002',
  'Qual escala Wechsler é destinada à avaliação de adultos?',
  '[{"id":"c1","text":"WISC","is_correct":false},{"id":"c2","text":"WAIS","is_correct":true},{"id":"c3","text":"WPPSI","is_correct":false},{"id":"c4","text":"WMS","is_correct":false}]',
  2
);

-- ============================================================
-- CURSO 3: Psicologia Analítica de Jung
-- (baseado na playlist YouTube PL1Vwy7VAMFcpOW10YuLtF7RKfLJ9MHNmd)
-- ============================================================
INSERT INTO courses (id, title, slug, description, long_description, instructor_id, is_free, status, category, certificate_enabled, exam_enabled, exam_passing_score, learning_points) VALUES
(
  '10000000-0000-0000-0000-000000000003',
  'Psicologia Analítica de Jung — Da Teoria à Prática Clínica',
  'psicologia-analitica-jung',
  'Um percurso completo pela Psicologia Analítica: dos fundamentos filosóficos de Kant e Hegel à prática clínica junguiana, passando por arquétipos, individuação e método dialético.',
  '## Sobre o curso

Uma formação abrangente em Psicologia Analítica de C.G. Jung, construída a partir das Obras Completas e de reflexões clínicas contemporâneas.

### Para quem é este curso?

- Psicólogos e psicoterapeutas que desejam aprofundar-se na abordagem junguiana
- Estudantes de psicologia interessados em Psicologia Analítica
- Profissionais que buscam integrar teoria e prática clínica junguiana

### Estrutura

O curso está organizado em 5 módulos temáticos com 21 videoaulas, partindo dos fundamentos teóricos, passando pelos conceitos centrais, pelas bases filosóficas (antinomias), pela prática clínica e culminando em tópicos avançados.

### Metodologia

Videoaulas expositivas com referências diretas às Obras Completas de Jung, análise de conceitos, discussão de casos e reflexões críticas sobre a prática.',
  '00000000-0000-0000-0000-000000000002',
  true,
  'published',
  'Psicologia Analítica',
  true,
  true,
  70,
  '["Compreender os fundamentos da Psicologia Analítica de Jung", "Diferenciar Psicologia Analítica de outras abordagens psicanalíticas", "Conhecer as bases filosóficas (Kant, Hegel) do pensamento junguiano", "Aplicar o método clínico de Jung na prática terapêutica", "Refletir criticamente sobre conceitos como arquétipos, individuação e inconsciente", "Desenvolver habilidades de leitura das Obras Completas de Jung"]'
);

-- Curso 3, Módulo 1 — Fundamentos da Psicologia Analítica
INSERT INTO sections (id, course_id, title, position) VALUES
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003', 'Módulo 1 — Fundamentos da Psicologia Analítica', 0),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000003', 'Módulo 2 — Conceitos Centrais da Psicologia Junguiana', 1),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000003', 'Módulo 3 — Antinomias e Bases Filosóficas', 2),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000003', 'Módulo 4 — Prática Clínica Junguiana', 3),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000003', 'Módulo 5 — Tópicos Avançados e Leituras', 4);

-- Módulo 1 — Fundamentos
INSERT INTO lessons (id, section_id, title, description, video_url, video_source, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000020', '20000000-0000-0000-0000-000000000010',
   'Introdução à prática da psicoterapia',
   'Aula inaugural baseada no Vol. 16/1 §1 das Obras Completas. O que é a prática da psicoterapia para Jung e qual seu ponto de partida.',
   'https://www.youtube.com/watch?v=eQyPHRBKrkc', 'youtube', 20, 0, true),
  ('30000000-0000-0000-0000-000000000021', '20000000-0000-0000-0000-000000000010',
   'Qual é o método clínico do Jung?',
   'Exploração do método clínico junguiano a partir do Vol. 16/1 §6-25. Como Jung propõe trabalhar com o paciente.',
   'https://www.youtube.com/watch?v=jI2FXTkN9cg', 'youtube', 25, 1, false),
  ('30000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000010',
   'Psicologia Analítica É PSICANÁLISE!',
   'Discussão sobre a relação entre Psicologia Analítica e Psicanálise, baseada no Vol. 17 §202-206.',
   'https://www.youtube.com/watch?v=gMHJmOTNpfg', 'youtube', 20, 2, false),
  ('30000000-0000-0000-0000-000000000023', '20000000-0000-0000-0000-000000000010',
   'Psicologia NÃO É CIÊNCIA! Conhecimento e Compreensão',
   'Reflexão sobre o estatuto epistemológico da psicologia: é ciência? O que significa conhecer e compreender na prática psicológica.',
   'https://www.youtube.com/watch?v=1Zv0q90kAgk', 'youtube', 20, 3, false);

-- Módulo 2 — Conceitos Centrais
INSERT INTO lessons (id, section_id, title, description, video_url, video_source, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000024', '20000000-0000-0000-0000-000000000011',
   'Arquétipos NÃO EXISTEM!',
   'Uma provocação necessária: o que Jung realmente quis dizer com arquétipos? Desmistificando um dos conceitos mais mal compreendidos.',
   'https://www.youtube.com/watch?v=5Br_Dsi5Ws0', 'youtube', 20, 0, true),
  ('30000000-0000-0000-0000-000000000025', '20000000-0000-0000-0000-000000000011',
   'Por que Jung NÃO É MÍSTICO',
   'Análise a partir do Vol. 11/6 §460. Desconstruindo a ideia de que a Psicologia Analítica é misticismo.',
   'https://www.youtube.com/watch?v=1sI_VU34vMw', 'youtube', 20, 1, false),
  ('30000000-0000-0000-0000-000000000026', '20000000-0000-0000-0000-000000000011',
   'Junguianos NÃO DEVERIAM EXISTIR!',
   'Uma reflexão crítica sobre o que significa ser "junguiano" e os riscos da identificação com uma escola.',
   'https://www.youtube.com/watch?v=9OaHGu-B9k8', 'youtube', 20, 2, false),
  ('30000000-0000-0000-0000-000000000027', '20000000-0000-0000-0000-000000000011',
   'Meu único inimigo é apenas o teu NOME!',
   'Sobre a importância dos nomes, rótulos e categorias na psicologia e como eles podem se tornar obstáculos.',
   'https://www.youtube.com/watch?v=jEIP6xI9ZJc', 'youtube', 20, 3, false);

-- Módulo 3 — Antinomias e Bases Filosóficas
INSERT INTO lessons (id, section_id, title, description, video_url, video_source, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000028', '20000000-0000-0000-0000-000000000012',
   'Antinomias em Kant — Crítica da Razão Pura',
   'As antinomias kantianas e sua influência no pensamento de Jung. Uma introdução à Crítica da Razão Pura.',
   'https://www.youtube.com/watch?v=rOJOYlAA8W4', 'youtube', 25, 0, false),
  ('30000000-0000-0000-0000-000000000029', '20000000-0000-0000-0000-000000000012',
   'Antinomias em Hegel — O que é FENOMENOLOGIA?',
   'A fenomenologia hegeliana e sua relação com a dialética presente na obra de Jung.',
   'https://www.youtube.com/watch?v=35lsqGhDf5s', 'youtube', 25, 1, false),
  ('30000000-0000-0000-0000-000000000030', '20000000-0000-0000-0000-000000000012',
   'Antinomias em Jung — Por que Jung NÃO É Kantiano?',
   'Como Jung se distancia de Kant ao lidar com as antinomias psíquicas. A especificidade do pensamento junguiano.',
   'https://www.youtube.com/watch?v=T1KaLHvV8GQ', 'youtube', 25, 2, false);

-- Módulo 4 — Prática Clínica Junguiana
INSERT INTO lessons (id, section_id, title, description, video_url, video_source, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000031', '20000000-0000-0000-0000-000000000013',
   'O que eu PRECISO SABER para fazer bons DIAGNÓSTICOS CLÍNICOS?',
   'Fundamentos do diagnóstico na perspectiva junguiana. O que observar e como pensar clinicamente.',
   'https://www.youtube.com/watch?v=3a8Z6FfIZ50', 'youtube', 25, 0, false),
  ('30000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000013',
   'Irracionalização dos objetivos em terapia',
   'Baseado no Vol. 16/1 §80-83. Por que os objetivos racionais podem atrapalhar o processo terapêutico.',
   'https://www.youtube.com/watch?v=Nvz-hFUwDMY', 'youtube', 20, 1, false),
  ('30000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000013',
   'Você Deve MESMO Seguir o Inconsciente? Individuação e Método Dialético',
   'Individuação não é simplesmente "seguir o inconsciente". Uma discussão sobre o método dialético na prática.',
   'https://www.youtube.com/watch?v=sMZLaEoj7bE', 'youtube', 25, 2, false),
  ('30000000-0000-0000-0000-000000000034', '20000000-0000-0000-0000-000000000013',
   'É possível se puxar pelos próprios cabelos?',
   'Reflexão a partir do Vol. 17 p. 97 sobre os limites e possibilidades do autoconhecimento.',
   'https://www.youtube.com/watch?v=xPjVjRpxZMk', 'youtube', 20, 3, false),
  ('30000000-0000-0000-0000-000000000035', '20000000-0000-0000-0000-000000000013',
   'A problemática da AUTOANÁLISE',
   'Quem é bom terapeuta NÃO PRECISA fazer terapia? Discussão baseada no Vol. 16/2 §287.',
   'https://www.youtube.com/watch?v=Qm7YuWrTyLw', 'youtube', 20, 4, false),
  ('30000000-0000-0000-0000-000000000036', '20000000-0000-0000-0000-000000000013',
   'Psicoterapia Junguiana em GRUPO?',
   'É possível fazer psicoterapia junguiana em grupo? Reflexões sobre setting e adaptações da abordagem.',
   'https://www.youtube.com/watch?v=Q5ms7rOrKo0', 'youtube', 20, 5, false);

-- Módulo 5 — Tópicos Avançados e Leituras
INSERT INTO lessons (id, section_id, title, description, video_url, video_source, duration_minutes, position, is_preview) VALUES
  ('30000000-0000-0000-0000-000000000037', '20000000-0000-0000-0000-000000000014',
   'Psicologia e Poesia',
   'Baseado no Vol. 15, Cap. 7, p. 85 das Obras Completas. A relação entre a psique e a criação poética.',
   'https://www.youtube.com/watch?v=ySS72cPAe1w', 'youtube', 20, 0, false),
  ('30000000-0000-0000-0000-000000000038', '20000000-0000-0000-0000-000000000014',
   'O papel do pioneiro',
   'Reflexão a partir do Vol. 18/2 §1126 sobre o que significa ser pioneiro na psicologia.',
   'https://www.youtube.com/watch?v=apLyr1VRtSA', 'youtube', 20, 1, false),
  ('30000000-0000-0000-0000-000000000039', '20000000-0000-0000-0000-000000000014',
   'Os junguianos são débeis mentais?',
   'Uma provocação a partir do Vol. 12 §126. Autocrítica e a armadilha da superficialidade na Psicologia Analítica.',
   'https://www.youtube.com/watch?v=xVlwbSUUmAA', 'youtube', 20, 2, false),
  ('30000000-0000-0000-0000-000000000040', '20000000-0000-0000-0000-000000000014',
   'Dicas práticas para ler TEXTOS DIFÍCEIS',
   'Orientações concretas para enfrentar a leitura das Obras Completas de Jung e outros textos densos.',
   'https://www.youtube.com/watch?v=9emk5-Y6MWE', 'youtube', 15, 3, true);

-- Questões da prova — Curso 3
INSERT INTO exam_questions (id, course_id, question_text, options, position) VALUES
(
  '40000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000003',
  'Segundo a discussão do curso, qual a relação entre Psicologia Analítica e Psicanálise?',
  '[{"id":"a1","text":"São abordagens completamente opostas e incompatíveis","is_correct":false},{"id":"a2","text":"A Psicologia Analítica é uma vertente dentro do campo psicanalítico","is_correct":true},{"id":"a3","text":"Jung rejeitou totalmente a psicanálise freudiana","is_correct":false},{"id":"a4","text":"São exatamente a mesma coisa com nomes diferentes","is_correct":false}]',
  0
),
(
  '40000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000003',
  'Por que o curso afirma que "arquétipos não existem"?',
  '[{"id":"b1","text":"Porque Jung nunca usou esse termo","is_correct":false},{"id":"b2","text":"Porque são entidades concretas que podem ser observadas diretamente","is_correct":false},{"id":"b3","text":"Porque o arquétipo em si é irrepresentável — o que se manifesta são imagens arquetípicas","is_correct":true},{"id":"b4","text":"Porque a psicologia moderna provou que não existem padrões universais","is_correct":false}]',
  1
),
(
  '40000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000003',
  'O que são as antinomias no contexto da filosofia kantiana discutida no curso?',
  '[{"id":"c1","text":"Técnicas terapêuticas desenvolvidas por Kant","is_correct":false},{"id":"c2","text":"Contradições aparentes da razão ao tentar conhecer o incondicionado","is_correct":true},{"id":"c3","text":"Sinônimo de complexos na teoria junguiana","is_correct":false},{"id":"c4","text":"Métodos de diagnóstico clínico","is_correct":false}]',
  2
),
(
  '40000000-0000-0000-0000-000000000013',
  '10000000-0000-0000-0000-000000000003',
  'O que o curso entende por "irracionalização dos objetivos em terapia"?',
  '[{"id":"d1","text":"Que a terapia deve ser totalmente irracional","is_correct":false},{"id":"d2","text":"Que objetivos racionais pré-definidos podem atrapalhar o processo terapêutico","is_correct":true},{"id":"d3","text":"Que o terapeuta não deve ter nenhum objetivo","is_correct":false},{"id":"d4","text":"Que apenas pacientes racionais devem fazer terapia","is_correct":false}]',
  3
),
(
  '40000000-0000-0000-0000-000000000014',
  '10000000-0000-0000-0000-000000000003',
  'Sobre a individuação e o método dialético, o curso argumenta que:',
  '[{"id":"e1","text":"Individuar-se é seguir cegamente os conteúdos do inconsciente","is_correct":false},{"id":"e2","text":"O inconsciente deve ser completamente ignorado no processo","is_correct":false},{"id":"e3","text":"A individuação envolve um diálogo dialético entre consciência e inconsciente","is_correct":true},{"id":"e4","text":"O método dialético foi abandonado por Jung em seus últimos escritos","is_correct":false}]',
  4
);

-- ============================================================
-- ENROLLMENT (aluno de teste matriculado no curso gratuito)
-- ============================================================
INSERT INTO enrollments (user_id, course_id, status, payment_status) VALUES
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'active', 'free');

-- Aluno também matriculado no curso de Jung
INSERT INTO enrollments (user_id, course_id, status, payment_status) VALUES
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 'active', 'free');

-- ============================================================
-- REVIEWS
-- ============================================================
INSERT INTO reviews (user_id, course_id, rating, comment) VALUES
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 5, 'Excelente curso! Muito didático e com conteúdo de qualidade.');

INSERT INTO reviews (user_id, course_id, rating, comment) VALUES
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', 5, 'Conteúdo riquíssimo! As referências às Obras Completas ajudam muito a aprofundar o estudo.');
