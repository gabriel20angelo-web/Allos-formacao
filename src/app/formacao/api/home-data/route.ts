import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /formacao/api/home-data
 *
 * Returns the published courses + categories for the home page, fetched
 * server-side via service role (no RLS applied). The browser calls this
 * same-origin endpoint instead of hitting syiaushvzhgyhvsmoegt.supabase.co
 * directly — important for users whose network / adblock / Private Relay
 * blocks the raw Supabase domain, which otherwise made the home render
 * the "Em breve novos cursos" empty state even though 20+ courses exist.
 */
export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const [coursesRes, categoriesRes] = await Promise.all([
    supabase
      .from("courses")
      .select(
        `*, instructor:profiles!courses_instructor_id_fkey(id, full_name, avatar_url)`
      )
      .eq("status", "published")
      .or("is_discontinued.is.null,is_discontinued.eq.false")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("name,position").order("position"),
  ]);

  if (coursesRes.error) {
    return NextResponse.json(
      { error: coursesRes.error.message },
      { status: 500 }
    );
  }

  const courses = coursesRes.data ?? [];
  const categories = (categoriesRes.data ?? []).map(
    (c: { name: string }) => c.name
  );

  // Enrich with enrollments + reviews aggregates.
  if (courses.length > 0) {
    const ids = courses.map((c: { id: string }) => c.id);
    const [enrRes, revRes] = await Promise.all([
      supabase.from("enrollments").select("course_id").in("course_id", ids),
      supabase
        .from("reviews")
        .select("course_id,rating")
        .in("course_id", ids),
    ]);

    const enrollCounts: Record<string, number> = {};
    (enrRes.data ?? []).forEach((e: { course_id: string }) => {
      enrollCounts[e.course_id] = (enrollCounts[e.course_id] || 0) + 1;
    });

    const reviewAgg: Record<string, { sum: number; count: number }> = {};
    (revRes.data ?? []).forEach(
      (r: { course_id: string; rating: number }) => {
        if (!reviewAgg[r.course_id]) {
          reviewAgg[r.course_id] = { sum: 0, count: 0 };
        }
        reviewAgg[r.course_id].sum += r.rating;
        reviewAgg[r.course_id].count += 1;
      }
    );

    for (const c of courses) {
      c.enrollments_count = enrollCounts[c.id] || 0;
      c.average_rating = reviewAgg[c.id]
        ? reviewAgg[c.id].sum / reviewAgg[c.id].count
        : 0;
      c.reviews_count = reviewAgg[c.id]?.count || 0;
    }
  }

  return NextResponse.json(
    { courses, categories },
    {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    }
  );
}
