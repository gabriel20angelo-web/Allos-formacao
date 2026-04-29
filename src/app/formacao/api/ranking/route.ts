import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'

// Route is dynamic on searchParams (?period=&type=). `revalidate=300` here
// causes regression in Next 14 (TTFB jumps from ~0.8s → ~3s) because the
// route still resolves dynamically but the cache layer adds overhead.
// Keeping force-dynamic; Cache-Control on each response still hints CDN
// even though Next will append "no-store" — Cloudflare ends up not caching,
// which we accept until the Railway region is moved out of Singapore.
export const dynamic = "force-dynamic";

function getSince(period: string): Date {
  const now = new Date()
  switch (period) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'semester': return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1)
    case 'year': return new Date(now.getFullYear(), 0, 1)
    default: {
      // ISO 8601: domingo (getDay()=0) é o dia 7 da semana anterior.
      const d = new Date(now)
      const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
}

type RankEntry = { nome: string; count: number; horas: number }

async function getSyncRanking(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, since: Date): Promise<RankEntry[]> {
  const [subsRes, atRes] = await Promise.all([
    sb.from('certificado_submissions').select('nome_completo, atividade_nome, created_at'),
    sb.from('certificado_atividades').select('nome, carga_horaria'),
  ])

  if (subsRes.error || !Array.isArray(subsRes.data)) return []

  const horasMap = new Map<string, number>()
  if (Array.isArray(atRes.data)) {
    atRes.data.forEach((a: { nome: string; carga_horaria: number }) =>
      horasMap.set(a.nome.toLowerCase(), a.carga_horaria)
    )
  }

  const filtered = subsRes.data.filter((s: { created_at: string }) => new Date(s.created_at) >= since)
  const map = new Map<string, { count: number; horas: number }>()

  filtered.forEach((s: { nome_completo: string; atividade_nome: string }) => {
    const nome = s.nome_completo.trim()
    const e = map.get(nome) || { count: 0, horas: 0 }
    e.count++
    e.horas += horasMap.get(s.atividade_nome?.toLowerCase()) || 2
    map.set(nome, e)
  })

  return Array.from(map.entries()).map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
}

async function getAsyncRanking(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, since: Date): Promise<RankEntry[]> {
  // Get completed lesson progress since the period
  const { data: progressData, error: progressError } = await sb
    .from('lesson_progress')
    .select('user_id, lesson_id, completed_at')
    .eq('completed', true)
    .gte('completed_at', since.toISOString())

  if (progressError || !progressData || progressData.length === 0) return []

  // Get lesson durations
  const lessonIds = Array.from(new Set(progressData.map((p) => p.lesson_id)))
  const { data: lessonsData } = await sb
    .from('lessons')
    .select('id, duration_minutes, section_id')
    .in('id', lessonIds)

  if (!lessonsData || lessonsData.length === 0) return []

  // Get sections to find which course they belong to, filter out sync courses
  const sectionIds = Array.from(new Set(lessonsData.map((l) => l.section_id)))
  const { data: sectionsData } = await sb
    .from('sections')
    .select('id, course_id')
    .in('id', sectionIds)

  if (!sectionsData) return []

  const courseIds = Array.from(new Set(sectionsData.map((s) => s.course_id)))
  const { data: coursesData } = await sb
    .from('courses')
    .select('id, course_type')
    .in('id', courseIds)
    .neq('course_type', 'sync')

  if (!coursesData) return []

  // Build lookup maps
  const validCourseIds = new Set(coursesData.map((c) => c.id))
  const sectionToCourse = new Map(sectionsData.map((s) => [s.id, s.course_id]))
  const lessonMap = new Map(lessonsData.map((l) => [l.id, l]))

  // Filter lessons that belong to non-sync courses
  const validLessonIds = new Set(
    lessonsData
      .filter((l) => {
        const courseId = sectionToCourse.get(l.section_id)
        return courseId && validCourseIds.has(courseId)
      })
      .map((l) => l.id)
  )

  // Get user profiles for names
  const userIds = Array.from(new Set(progressData.map((p) => p.user_id)))
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)

  const nameMap = new Map((profiles || []).map((p) => [p.id, p.full_name]))

  // Aggregate per user
  const map = new Map<string, { count: number; horas: number }>()

  progressData.forEach((p) => {
    if (!validLessonIds.has(p.lesson_id)) return
    const nome = nameMap.get(p.user_id)
    if (!nome) return

    const lesson = lessonMap.get(p.lesson_id)
    const minutes = lesson?.duration_minutes || 0

    const e = map.get(nome) || { count: 0, horas: 0 }
    e.count++
    e.horas += Math.round(minutes / 60 * 10) / 10 // round to 1 decimal
    map.set(nome, e)
  })

  return Array.from(map.entries()).map(([nome, d]) => ({
    nome,
    count: d.count,
    horas: Math.round(d.horas),
  }))
}

async function getCurseirosRanking(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, since: Date): Promise<RankEntry[]> {
  // Get certificates issued since period
  const { data: certs } = await sb
    .from('certificates')
    .select('user_id, course_id, issued_at')
    .gte('issued_at', since.toISOString())

  if (!certs || certs.length === 0) return []

  // Get course info for hours
  const courseIds = Array.from(new Set(certs.map(c => c.course_id)))
  const { data: courses } = await sb
    .from('courses')
    .select('id, certificate_hours, total_duration_minutes')
    .in('id', courseIds)

  const courseMap = new Map((courses || []).map(c => [c.id, c]))

  // Get user names
  const userIds = Array.from(new Set(certs.map(c => c.user_id)))
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name')
    .in('id', userIds)

  const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]))

  // Aggregate
  const map = new Map<string, { count: number; horas: number }>()
  certs.forEach(cert => {
    const nome = nameMap.get(cert.user_id)
    if (!nome) return
    const course = courseMap.get(cert.course_id)
    const hours = course?.certificate_hours || Math.round((course?.total_duration_minutes || 0) / 60)
    const e = map.get(nome) || { count: 0, horas: 0 }
    e.count++
    e.horas += hours
    map.set(nome, e)
  })

  return Array.from(map.entries()).map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
}

export async function GET(req: NextRequest) {
  try {
    const period = req.nextUrl.searchParams.get('period') || 'week'
    const type = req.nextUrl.searchParams.get('type') || 'all'
    const sb = await createServiceRoleClient()
    const since = getSince(period)

    if (type === 'sync') {
      const ranked = (await getSyncRanking(sb, since))
        .sort((a, b) => b.horas - a.horas || b.count - a.count)
        .slice(0, 5)
      return NextResponse.json(ranked, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      })
    }

    if (type === 'async') {
      const ranked = (await getAsyncRanking(sb, since))
        .sort((a, b) => b.horas - a.horas || b.count - a.count)
        .slice(0, 5)
      return NextResponse.json(ranked, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      })
    }

    if (type === 'curseiros') {
      const ranked = (await getCurseirosRanking(sb, since))
        .sort((a, b) => b.count - a.count || b.horas - a.horas)
        .slice(0, 5)
      return NextResponse.json(ranked, {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      })
    }

    // type === 'all': combine both
    const [syncData, asyncData] = await Promise.all([
      getSyncRanking(sb, since),
      getAsyncRanking(sb, since),
    ])

    const combined = new Map<string, { count: number; horas: number }>()

    for (const entry of [...syncData, ...asyncData]) {
      const e = combined.get(entry.nome) || { count: 0, horas: 0 }
      e.count += entry.count
      e.horas += entry.horas
      combined.set(entry.nome, e)
    }

    const ranked = Array.from(combined.entries())
      .map(([nome, d]) => ({ nome, count: d.count, horas: d.horas }))
      .sort((a, b) => b.horas - a.horas || b.count - a.count)
      .slice(0, 5)

    return NextResponse.json(ranked, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    })
  } catch {
    return NextResponse.json([])
  }
}
