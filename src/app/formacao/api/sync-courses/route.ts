import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Não usar unstable_cache aqui: o estado "ao vivo agora" muda a cada
// minuto. Cliente faz polling de 60s; servidor só responde sem cache CDN.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /formacao/api/sync-courses
 *
 * Retorna todos os cursos `course_type='sync'` publicados com:
 *   - is_live_now (booleano calculado servidor-side)
 *   - current_meeting (se vivo agora, qual encontro está rodando)
 *   - next_meeting (próximo encontro futuro)
 *   - total_recordings (count de lessons com video_url)
 *
 * O componente cliente escolhe Zona 1 (banner AGORA) ou Zona 2 (showcase)
 * baseado em is_live_now. Polling de 60s mantém ao vivo.
 */

type CourseRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  thumbnail_url: string | null;
  category: string | null;
  whatsapp_group_url: string | null;
  meet_url: string | null;
  instructor_bio: string | null;
  live_session_duration_minutes: number | null;
  show_instructor: boolean | null;
  instructor: { id: string; full_name: string; avatar_url: string | null } | null;
};

type MeetingRow = {
  id: string;
  course_id: string;
  starts_at: string;
  title: string | null;
  meet_url_override: string | null;
};

type LessonCountPair = readonly [string, number];

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Supabase env vars missing" }, { status: 500 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data: coursesData, error: coursesErr } = await supabase
      .from("courses")
      .select(
        `id, title, slug, description, thumbnail_url, category,
         whatsapp_group_url, meet_url, instructor_bio,
         live_session_duration_minutes, show_instructor,
         instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url)`,
      )
      .eq("status", "published")
      .eq("course_type", "sync")
      .or("is_discontinued.is.null,is_discontinued.eq.false")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (coursesErr) throw new Error(coursesErr.message);

    const courses = (coursesData ?? []) as unknown as CourseRow[];
    if (courses.length === 0) return NextResponse.json({ courses: [] });

    const ids = courses.map((c) => c.id);
    const nowIso = new Date().toISOString();

    // Janela: pega encontros que estão acontecendo agora ou no futuro próximo.
    // Pra detectar "ao vivo", precisamos também dos starts_at <= now() recentes.
    // 24h pra trás cobre o caso de duration_minutes alto (até 1440min).
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [meetingsRes, lessonsRes] = await Promise.all([
      supabase
        .from("course_meetings")
        .select("id, course_id, starts_at, title, meet_url_override")
        .in("course_id", ids)
        .gte("starts_at", past24h)
        .order("starts_at", { ascending: true }),
      // Count de gravações (lessons com video_url) por curso
      Promise.all(
        ids.map((id) =>
          supabase
            .from("lessons")
            .select("id, sections!inner(course_id)", { count: "exact", head: true })
            .eq("sections.course_id", id)
            .not("video_url", "is", null)
            .then(({ count }) => [id, count ?? 0] as LessonCountPair),
        ),
      ),
    ]);

    if (meetingsRes.error) throw new Error(meetingsRes.error.message);

    const meetings = (meetingsRes.data ?? []) as MeetingRow[];
    const recordingsByCourse: Record<string, number> = Object.fromEntries(lessonsRes);

    const now = Date.now();

    type Enriched = CourseRow & {
      is_live_now: boolean;
      current_meeting: MeetingRow | null;
      next_meeting: MeetingRow | null;
      total_recordings: number;
      live_ends_at: string | null;
    };

    const enriched: Enriched[] = courses.map((c) => {
      const courseMeetings = meetings.filter((m) => m.course_id === c.id);
      const durationMin = c.live_session_duration_minutes ?? 120;
      const durationMs = durationMin * 60 * 1000;

      let currentMeeting: MeetingRow | null = null;
      let nextMeeting: MeetingRow | null = null;

      for (const m of courseMeetings) {
        const startMs = new Date(m.starts_at).getTime();
        const endMs = startMs + durationMs;
        if (startMs <= now && now < endMs) {
          currentMeeting = m;
        } else if (startMs > now) {
          if (!nextMeeting || startMs < new Date(nextMeeting.starts_at).getTime()) {
            nextMeeting = m;
          }
        }
      }

      const liveEndsAt = currentMeeting
        ? new Date(new Date(currentMeeting.starts_at).getTime() + durationMs).toISOString()
        : null;

      return {
        ...c,
        is_live_now: currentMeeting !== null,
        current_meeting: currentMeeting,
        next_meeting: nextMeeting,
        total_recordings: recordingsByCourse[c.id] ?? 0,
        live_ends_at: liveEndsAt,
      };
    });

    // Ordena: vivos primeiro, depois com próximo encontro mais próximo
    enriched.sort((a, b) => {
      if (a.is_live_now && !b.is_live_now) return -1;
      if (!a.is_live_now && b.is_live_now) return 1;
      const aNext = a.next_meeting ? new Date(a.next_meeting.starts_at).getTime() : Infinity;
      const bNext = b.next_meeting ? new Date(b.next_meeting.starts_at).getTime() : Infinity;
      return aNext - bNext;
    });

    return NextResponse.json(
      { courses: enriched },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 500 },
    );
  }
}
