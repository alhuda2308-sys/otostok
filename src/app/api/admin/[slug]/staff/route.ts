import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword, requireOwnerSession } from '@/lib/auth'
import type { StaffAccountInfo } from '@/lib/types'

/** GET /api/admin/[slug]/staff — daftar akun admin/staf (owner saja). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = requireOwnerSession(req, slug)
  if (!session) {
    return NextResponse.json({ error: 'Akses ditolak — khusus owner.' }, { status: 403 })
  }
  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }
  const rows = await db.staffAccount.findMany({
    where: { showroomId: showroom.id },
    orderBy: { createdAt: 'asc' },
  })
  const items: StaffAccountInfo[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    username: r.username,
    role: r.role === 'owner' ? 'owner' : 'admin',
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }))
  return NextResponse.json({ items })
}

/**
 * POST /api/admin/[slug]/staff — buat akun admin baru (owner saja).
 * Body: { name, username, password }
 * Hak akses admin: kelola stok, log unit, lihat daftar penjualan.
 * TIDAK bisa: lihat lisensi/harga modal, kelola staf, ubah profil showroom.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireOwnerSession(req, slug)
    if (!session) {
      return NextResponse.json({ error: 'Akses ditolak — khusus owner.' }, { status: 403 })
    }
    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim()
    const username = String(body.username ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    if (name.length < 2 || name.length > 60) {
      return NextResponse.json({ error: 'Nama admin minimal 2 karakter.' }, { status: 400 })
    }
    if (!/^[a-z0-9._@+-]{3,30}$/.test(username)) {
      return NextResponse.json(
        { error: 'Username 3–30 karakter (huruf kecil, angka, . _ @ + -).' },
        { status: 400 },
      )
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Password minimal 6 karakter.' }, { status: 400 })
    }

    const exists = await db.staffAccount.findFirst({
      where: { showroomId: showroom.id, username },
    })
    if (exists) {
      return NextResponse.json({ error: `Username "${username}" sudah dipakai.` }, { status: 409 })
    }

    const created = await db.staffAccount.create({
      data: {
        showroomId: showroom.id,
        name,
        username,
        passwordHash: hashPassword(password),
        role: 'admin',
        isActive: true,
      },
    })

    return NextResponse.json({
      ok: true,
      item: {
        id: created.id,
        name: created.name,
        username: created.username,
        role: 'admin',
        isActive: created.isActive,
        createdAt: created.createdAt.toISOString(),
      } satisfies StaffAccountInfo,
    })
  } catch (e) {
    console.error('[staff create] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
