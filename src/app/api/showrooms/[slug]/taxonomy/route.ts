import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireShowroomSession } from '@/lib/auth'

/**
 * GET /api/showrooms/[slug]/taxonomy — endpoint publik.
 * Daftar kategori & merek untuk filter katalog marketing.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom || !showroom.isActive) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }
  const rows = await db.taxonomy.findMany({
    where: { showroomId: showroom.id },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json({
    categories: rows.filter((r) => r.kind === 'category').map((r) => r.name),
    brands: rows.filter((r) => r.kind === 'brand').map((r) => r.name),
  })
}
