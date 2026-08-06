import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleClient } from '@/lib/supabase/server'
import { ACTIVITY_RANGES, getRangeStart, type ActivityRange } from '@/lib/utils/activity'

// Route is dynamic on searchParams (?period=&type=). `revalidate=300` here
// causes regression in Next 14 (TTFB jumps from ~0.8s → ~3s) because the
// route still resolves dynamically but the cache layer adds overhead.
// Keeping force-dynamic; Cache-Control on each response still hints CDN
// even though Next will append "no-store" — Cloudflare ends up not caching,
// which we accept until the Railway region is moved out of Singapore.
export const dynamic = "force-dynamic";

// A mesma rota atende dois chamadores com vocabulários diferentes: o site
// público manda "week"|"month"|"quarter"|"semester"|"year" (HeroFormacao,
// SyncGroupsSection) e o card do admin manda um ActivityRange
// ("today"|"7d"|...|"all", ver src/lib/utils/activity.ts). Nenhum dos dois
// conjuntos se sobrepõe, então dá pra aceitar os dois sem ambiguidade.
function isActivityRange(period: string): period is ActivityRange {
  return (ACTIVITY_RANGES as readonly string[]).includes(period)
}

// `null` = sem corte de data (caso "all" do admin).
function getSince(period: string): Date | null {
  if (isActivityRange(period)) return getRangeStart(period)

  const now = new Date()
  switch (period) {
    case 'month': return new Date(now.getFullYear(), now.getMonth(), 1)
    case 'quarter': return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
    case 'semester': return new Date(now.getFullYear(), now.getMonth() < 6 ? 0 : 6, 1)
    case 'year': return new Date(now.getFullYear(), 0, 1)
    default: {
      // ISO 8601: domingo (getDay()=0) é o dia 7 da semana anterior.
      // Também é o fallback de period ausente/desconhecido (ex: "week").
      const d = new Date(now)
      const day = d.getDay() || 7
      d.setDate(d.getDate() - day + 1)
      d.setHours(0, 0, 0, 0)
      return d
    }
  }
}

// A chave é interna e NUNCA sai na resposta. Esta rota é pública e cacheada,
// então o payload continua sendo só { nome, count, horas }: a chave existe
// para agrupar certo, não para ser publicada.
type RankEntry = { chave: string; nome: string; count: number; horas: number }

/** O que o público vê. Construído campo a campo, para o e-mail não vazar por descuido. */
const publicar = (r: RankEntry) => ({ nome: r.nome, count: r.count, horas: r.horas })

/**
 * Lê a tabela inteira, de mil em mil.
 *
 * O PostgREST corta em mil linhas e não avisa. Numa rota de ranking o efeito é
 * discreto e por isso pior: o pódio continua plausível, só que calculado sobre
 * um pedaço arbitrário da base.
 */
async function lerTudo<T>(
  sb: Awaited<ReturnType<typeof createServiceRoleClient>>,
  tabela: string,
  colunas: string,
): Promise<T[]> {
  const PAGINA = 1000
  const TETO = 50
  const out: T[] = []
  for (let i = 0; i < TETO; i++) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .order('id', { ascending: true })
      .range(i * PAGINA, i * PAGINA + PAGINA - 1)
    if (error) break
    const lote = (data ?? []) as unknown as T[]
    out.push(...lote)
    if (lote.length < PAGINA) break
  }
  return out
}

/**
 * A chave da pessoa: e-mail quando existe, nome normalizado como último
 * recurso. É a mesma regra de `personKey` no painel, e a divergência entre as
 * duas era o motivo de o pódio mudar ao trocar de aba: aqui agrupava por nome
 * digitado e lá por e-mail, sobre exatamente os mesmos dados. Agrupar por nome
 * erra dos dois lados ao mesmo tempo, fragmentando quem assina de dois jeitos e
 * fundindo homônimos: o ranking chegou a ter 163 nomes para 149 pessoas, com
 * duas das cinco posições erradas.
 */
const chaveDe = (email: string | null | undefined, nome: string) =>
  (email || nome).trim().toLowerCase()

async function getSyncRanking(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, since: Date | null): Promise<RankEntry[]> {
  type SubRow = { nome_completo: string; email: string | null; atividade_nome: string; created_at: string }
  const [subs, ats] = await Promise.all([
    lerTudo<SubRow>(sb, 'certificado_submissions', 'id, nome_completo, email, atividade_nome, created_at'),
    lerTudo<{ nome: string; carga_horaria: number }>(sb, 'certificado_atividades', 'id, nome, carga_horaria'),
  ])

  const horasMap = new Map<string, number>()
  ats.forEach((a) => horasMap.set(a.nome.toLowerCase(), a.carga_horaria))

  // since=null ("all") não corta nada
  const filtered = since ? subs.filter((s) => new Date(s.created_at) >= since) : subs
  const map = new Map<string, { count: number; horas: number; nome: string }>()

  filtered.forEach((s) => {
    const nome = (s.nome_completo || '').trim()
    if (!nome) return
    const chave = chaveDe(s.email, nome)
    const e = map.get(chave) || { count: 0, horas: 0, nome }
    e.count++
    e.horas += horasMap.get(s.atividade_nome?.toLowerCase()) || 2
    // O nome mais longo é o mais completo, e é por ele que a pessoa é
    // reconhecida na lista.
    if (nome.length > e.nome.length) e.nome = nome
    map.set(chave, e)
  })

  return Array.from(map.entries()).map(([chave, d]) => ({ chave, nome: d.nome, count: d.count, horas: d.horas }))
}

async function getAsyncRanking(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, since: Date | null): Promise<RankEntry[]> {
  // Get completed lesson progress since the period (since=null / "all" não filtra por data)
  let progressQuery = sb
    .from('lesson_progress')
    .select('user_id, lesson_id, completed_at')
    .eq('completed', true)
  if (since) progressQuery = progressQuery.gte('completed_at', since.toISOString())
  const { data: progressData, error: progressError } = await progressQuery

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

  // O e-mail entra aqui para que a mesma pessoa some com o lado síncrono na
  // aba "Geral". Ele não sai na resposta: ver `publicar`.
  const userIds = Array.from(new Set(progressData.map((p) => p.user_id)))
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const perfilMap = new Map((profiles || []).map((p) => [p.id, p]))

  const map = new Map<string, { count: number; horas: number; nome: string }>()

  progressData.forEach((p) => {
    if (!validLessonIds.has(p.lesson_id)) return
    const perfil = perfilMap.get(p.user_id)
    const nome = (perfil?.full_name || '').trim()
    if (!nome) return

    const lesson = lessonMap.get(p.lesson_id)
    const minutes = lesson?.duration_minutes || 0

    const chave = chaveDe(perfil?.email, nome)
    const e = map.get(chave) || { count: 0, horas: 0, nome }
    e.count++
    e.horas += Math.round(minutes / 60 * 10) / 10 // round to 1 decimal
    map.set(chave, e)
  })

  return Array.from(map.entries()).map(([chave, d]) => ({
    chave,
    nome: d.nome,
    count: d.count,
    horas: Math.round(d.horas),
  }))
}

async function getCurseirosRanking(sb: Awaited<ReturnType<typeof createServiceRoleClient>>, since: Date | null): Promise<RankEntry[]> {
  // Get certificates issued since period (since=null / "all" não filtra por data)
  let certsQuery = sb
    .from('certificates')
    .select('user_id, course_id, issued_at')
  if (since) certsQuery = certsQuery.gte('issued_at', since.toISOString())
  const { data: certs } = await certsQuery

  if (!certs || certs.length === 0) return []

  // Get course info for hours
  const courseIds = Array.from(new Set(certs.map(c => c.course_id)))
  const { data: courses } = await sb
    .from('courses')
    .select('id, certificate_hours, total_duration_minutes')
    .in('id', courseIds)

  const courseMap = new Map((courses || []).map(c => [c.id, c]))

  const userIds = Array.from(new Set(certs.map(c => c.user_id)))
  const { data: profiles } = await sb
    .from('profiles')
    .select('id, full_name, email')
    .in('id', userIds)

  const perfilMap = new Map((profiles || []).map(p => [p.id, p]))

  const map = new Map<string, { count: number; horas: number; nome: string }>()
  certs.forEach(cert => {
    const perfil = perfilMap.get(cert.user_id)
    const nome = (perfil?.full_name || '').trim()
    if (!nome) return
    const course = courseMap.get(cert.course_id)
    const hours = course?.certificate_hours || Math.round((course?.total_duration_minutes || 0) / 60)
    const chave = chaveDe(perfil?.email, nome)
    const e = map.get(chave) || { count: 0, horas: 0, nome }
    e.count++
    e.horas += hours
    map.set(chave, e)
  })

  return Array.from(map.entries()).map(([chave, d]) => ({ chave, nome: d.nome, count: d.count, horas: d.horas }))
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
      return NextResponse.json(ranked.map(publicar), {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      })
    }

    if (type === 'async') {
      const ranked = (await getAsyncRanking(sb, since))
        .sort((a, b) => b.horas - a.horas || b.count - a.count)
        .slice(0, 5)
      return NextResponse.json(ranked.map(publicar), {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
        },
      })
    }

    if (type === 'curseiros') {
      const ranked = (await getCurseirosRanking(sb, since))
        .sort((a, b) => b.count - a.count || b.horas - a.horas)
        .slice(0, 5)
      return NextResponse.json(ranked.map(publicar), {
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

    // A fusão é pela chave, não pelo nome. Antes ela cruzava o nome digitado
    // num formulário com o `full_name` de um perfil, e só casava quando as duas
    // grafias batiam byte a byte: quem estuda e frequenta grupo aparecia duas
    // vezes na mesma lista.
    const combined = new Map<string, { count: number; horas: number; nome: string }>()

    for (const entry of [...syncData, ...asyncData]) {
      const e = combined.get(entry.chave) || { count: 0, horas: 0, nome: entry.nome }
      e.count += entry.count
      e.horas += entry.horas
      if (entry.nome.length > e.nome.length) e.nome = entry.nome
      combined.set(entry.chave, e)
    }

    const ranked = Array.from(combined.entries())
      .map(([chave, d]) => ({ chave, nome: d.nome, count: d.count, horas: d.horas }))
      .sort((a, b) => b.horas - a.horas || b.count - a.count)
      .slice(0, 5)

    return NextResponse.json(ranked.map(publicar), {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=900",
      },
    })
  } catch {
    return NextResponse.json([])
  }
}
