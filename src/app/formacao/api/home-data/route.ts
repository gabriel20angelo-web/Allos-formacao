import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";

export const runtime = "nodejs";
// Allow Next to cache this route; revalidation happens on a 30s TTL or via
// revalidateTag("formacao-home-data") when admin toggles destaque/estruturado.
export const revalidate = 30;

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
type CourseRow = {
  id: string;
  enrollments_count?: number;
  average_rating?: number;
  reviews_count?: number;
  [key: string]: unknown;
};

const getHomeData = unstable_cache(
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

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
      throw new Error(coursesRes.error.message);
    }

    const courses: CourseRow[] = (coursesRes.data as CourseRow[]) ?? [];
    const categories = (categoriesRes.data ?? []).map(
      (c: { name: string }) => c.name
    );

    if (courses.length > 0) {
      const ids = courses.map((c) => c.id);

      // Counts agregados via head:exact por curso — escala sem cap.
      const enrollPromises = ids.map((id) =>
        supabase
          .from("enrollments")
          .select("course_id", { count: "exact", head: true })
          .eq("course_id", id)
          .then(({ count }) => [id, count ?? 0] as const),
      );

      // Reviews ainda por linha (precisamos do rating pra média) mas
      // limitado e com agregação manual.
      const [enrollPairs, revRes] = await Promise.all([
        Promise.all(enrollPromises),
        supabase
          .from("reviews")
          .select("course_id,rating")
          .in("course_id", ids),
      ]);

      const enrollCounts: Record<string, number> = Object.fromEntries(enrollPairs);

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

    return { courses, categories };
  },
  ["formacao-home-data"],
  { revalidate: 30, tags: ["formacao-home-data"] }
);

export async function GET() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { error: "Supabase env vars missing" },
      { status: 500 }
    );
  }

  try {
    const data = await getHomeData();
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "fetch failed" },
      { status: 500 }
    );
  }
}
