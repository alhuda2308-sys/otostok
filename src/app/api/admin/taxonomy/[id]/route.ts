import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireShowroomSession } from '@/lib/auth'

/**
 * DELETE /api/admin/taxonomy/[id] — hapus kategori/merk.
 * Ditolak bila masih dipakai unit di showroom (agar filter konsisten).
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const item = await db.taxonomy.findUnique({ where: { id } })
    if (!item) {
      return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 })
    }
    const showroom = await db.showroom.findUnique({ where: { id: item.showroomId } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }
    const session = requireShowroomSession(req, showroom.slug)
    if (!session) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
    }

    const used =
      item.kind === 'brand'
        ? await db.vehicle.count({ where: { showroomId: item.showroomId, brand: item.name } })
        : await db.vehicle.count({ where: { showroomId: item.showroomId, category: item.name } })
    if (used > 0) {
      return NextResponse.json(
        { error: `"${item.name}" masih dipakai ${used} unit. Ubah dulu unit terkait.` },
        { status: 409 },
      )
    }

    await db.taxonomy.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[taxonomy delete] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
