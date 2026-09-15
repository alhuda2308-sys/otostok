import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnerSession } from '@/lib/auth'

/**
 * PATCH /api/admin/staff/[id] — nonaktifkan/aktifkan akun admin (owner saja).
 * Body: { isActive: boolean }
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const staff = await db.staffAccount.findUnique({ where: { id } })
    if (!staff) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 })
    }
    const showroom = await db.showroom.findUnique({ where: { id: staff.showroomId } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }
    const session = requireOwnerSession(req, showroom.slug)
    if (!session) {
      return NextResponse.json({ error: 'Akses ditolak — khusus owner.' }, { status: 403 })
    }
    if (staff.role === 'owner') {
      return NextResponse.json({ error: 'Akun owner tidak bisa diubah.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const isActive = Boolean(body.isActive)
    await db.staffAccount.update({ where: { id }, data: { isActive } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[staff patch] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}

/** DELETE /api/admin/staff/[id] — hapus akun admin (owner saja). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const staff = await db.staffAccount.findUnique({ where: { id } })
    if (!staff) {
      return NextResponse.json({ error: 'Akun tidak ditemukan.' }, { status: 404 })
    }
    const showroom = await db.showroom.findUnique({ where: { id: staff.showroomId } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }
    const session = requireOwnerSession(req, showroom.slug)
    if (!session) {
      return NextResponse.json({ error: 'Akses ditolak — khusus owner.' }, { status: 403 })
    }
    if (staff.role === 'owner') {
      return NextResponse.json({ error: 'Akun owner tidak bisa dihapus.' }, { status: 400 })
    }

    await db.staffAccount.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[staff delete] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
