import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireShowroomSession } from '@/lib/auth'

/**
 * GET /api/admin/[slug]/taxonomy — daftar kategori & merek showroom.
 * Dipakai dashboard admin & katalog publik (via endpoint publik).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = requireShowroomSession(req, slug)
  if (!session) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }
  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom) {
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

/**
 * POST /api/admin/[slug]/taxonomy — tambah kategori/merk baru.
 * Body: { kind: 'category' | 'brand', name }
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireShowroomSession(req, slug)
    if (!session) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
    }
    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const kind = String(body.kind ?? '')
    const name = String(body.name ?? '').trim()
    if (kind !== 'category' && kind !== 'brand') {
      return NextResponse.json({ error: 'Jenis filter tidak valid.' }, { status: 400 })
    }
    if (name.length < 2 || name.length > 30) {
      return NextResponse.json(
        { error: 'Nama harus 2–30 karakter.' },
        { status: 400 },
      )
    }

    const exists = await db.taxonomy.findUnique({
      where: { showroomId_kind_name: { showroomId: showroom.id, kind, name } },
    })
    if (exists) {
      return NextResponse.json({ error: `"${name}" sudah ada di daftar.` }, { status: 409 })
    }

    const created = await db.taxonomy.create({
      data: { showroomId: showroom.id, kind, name },
    })
    return NextResponse.json({ ok: true, item: { id: created.id, kind, name } })
  } catch (e) {
    console.error('[taxonomy create] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
