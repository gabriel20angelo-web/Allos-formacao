import { NextResponse } from 'next/server'

const ALLOS_SITE_URL = process.env.NEXT_PUBLIC_ALLOS_SITE_URL || 'https://allos.org.br'

export async function GET() {
  try {
    const res = await fetch(
      `${ALLOS_SITE_URL}/api/certificados/formacao?type=cronograma_publico`,
      { next: { revalidate: 60 } } // cache 1 min
    )
    if (!res.ok) {
      return NextResponse.json({ visivel: false, horarios: [], slots: [], atividades: [] })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ visivel: false, horarios: [], slots: [], atividades: [] })
  }
}
