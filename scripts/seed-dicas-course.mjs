// Seed ONLY the "Dicas para a Avaliação Clínica" course
// Usage: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/seed-dicas-course.mjs
//
// This script checks if the course already exists (by slug) and skips if so.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://syiaushvzhgyhvsmoegt.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const INSTRUCTOR_ID = process.env.INSTRUCTOR_ID || "50edd22c-a797-4ca0-af37-7377299c6db0";

if (!SUPABASE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY is required.\nUsage: SUPABASE_SERVICE_ROLE_KEY=your_key node scripts/seed-dicas-course.mjs");
  process.exit(1);
}

const headers = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function supaSelect(table, query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`Failed to select from ${table}: ${await res.text()}`);
  return res.json();
}

async function supaInsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Failed to insert into ${table}: ${await res.text()}`);
  return res.json();
}

function ytThumb(videoId) {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

const course = {
  title: "Dicas para a Avaliação Clínica",
  slug: "dicas-avaliacao-clinica",
  description: "Orientações práticas para avaliação clínica, escuta terapêutica e manejo de sessões.",
  category: "Prática Clínica",
  thumbnail_video: "NJBRCNbPc3Q",
  lessons: [
    { title: "Meu paciente está PRONTO? - Estágios de Mudança", id: "NJBRCNbPc3Q", duration: 1141 },
    { title: "Como fazer Intervenções Clínicas mais POTENTES?", id: "u1uOyDlyjUU", duration: 1236 },
    { title: "Comecei na clínica, E AGORA?", id: "JTso5qJYMNU", duration: 1083 },
    { title: "Máximas para a PERFORMANCE CLÍNICA", id: "TkaAFt7menY", duration: 1201 },
    { title: "Como treinar sua escuta clínica? Esquema de aprofundamento", id: "pbCStH1GWgY", duration: 737 },
    { title: "Dicas para quem tem medo de começar a atender", id: "RPVjdqdzcMY", duration: 1100 },
    { title: "Abertura e Encerramento de Sessão Clínica", id: "t1vRYiBKZFY", duration: 1592 },
    { title: "Construção de Frases na Psicanálise", id: "EQ15ZGuigog", duration: 969 },
    { title: "Entrevistas Preliminares: Como Conduzir uma Primeira Sessão", id: "UygS_g0ipl0", duration: 1193 },
    { title: "Primeira Sessão em TCC: O que devo evitar?", id: "zG7e2OoxWXU", duration: 2110 },
    { title: "Como entrar na Allos", id: "HlYGLPwRMFc", duration: 2170 },
    { title: "Como funciona o Instrumento de Avaliação", id: "jYbUiWwmF2I", duration: 2154 },
    { title: "Como estruturar uma devolutiva clínica", id: "08PygIYaAP4", duration: 1637 },
    { title: "Bacon causa câncer? O padrão-ouro da Psicologia", id: "3rJ2OGfqYkQ", duration: 1664 },
  ],
};

async function main() {
  // Check if course already exists
  const existing = await supaSelect("courses", `slug=eq.${course.slug}&select=id`);
  if (existing.length > 0) {
    console.log(`⚠️  Course "${course.title}" already exists (id: ${existing[0].id}). Skipping.`);
    return;
  }

  const totalMinutes = Math.round(course.lessons.reduce((sum, l) => sum + l.duration, 0) / 60);
  console.log(`Creating course: ${course.title} (${course.lessons.length} aulas, ${totalMinutes}min)`);

  const [courseRow] = await supaInsert("courses", {
    title: course.title,
    slug: course.slug,
    description: course.description,
    thumbnail_url: ytThumb(course.thumbnail_video),
    instructor_id: INSTRUCTOR_ID,
    is_free: true,
    price_cents: null,
    status: "published",
    category: course.category,
    total_duration_minutes: totalMinutes,
    certificate_enabled: false,
    exam_enabled: false,
    exam_passing_score: 70,
  });

  console.log(`  → Course ID: ${courseRow.id}`);

  const [section] = await supaInsert("sections", {
    course_id: courseRow.id,
    title: course.title,
    position: 0,
  });

  console.log(`  → Section ID: ${section.id}`);

  for (let i = 0; i < course.lessons.length; i++) {
    const lesson = course.lessons[i];
    await supaInsert("lessons", {
      section_id: section.id,
      title: lesson.title,
      video_url: `https://www.youtube.com/watch?v=${lesson.id}`,
      video_source: "youtube",
      duration_minutes: Math.round(lesson.duration / 60),
      position: i,
      is_preview: i === 0,
    });
    console.log(`    Aula ${i + 1}: ${lesson.title.substring(0, 50)}...`);
  }

  console.log(`\n✅ Course "${course.title}" seeded successfully!`);
  console.log(`   URL: /formacao/curso/${course.slug}`);
}

main().catch((err) => {
  console.error("❌ Error:", err.message);
  process.exit(1);
});
