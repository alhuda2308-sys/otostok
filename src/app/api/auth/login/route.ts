import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  SESSION_COOKIE,
  SESSION_COOKIE_OPTIONS,
  createSessionToken,
  verifyPassword,
} from '@/lib/auth'

/**
 * POST /api/auth/login
 * Body: { slug, username, password }
 * Sukses: cookie sesi HttpOnly + data sesi.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug ?? '').trim()
    const username = String(body.username ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')

    if (!slug || !username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi.' },
        { status: 400 },
      )
    }

    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom || !showroom.isActive) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const staff = await db.staffAccount.findFirst({
      where: { showroomId: showroom.id, username },
    })
    if (!staff || !staff.isActive || !verifyPassword(password, staff.passwordHash)) {
      return NextResponse.json(
        { error: 'Username atau password salah. Akun mungkin dinonaktifkan.' },
        { status: 401 },
      )
    }

    const token = createSessionToken({
      uid: staff.id,
      sid: showroom.id,
      slug: showroom.slug,
      role: staff.role === 'owner' ? 'owner' : 'admin',
      name: staff.name,
    })

    const res = NextResponse.json({
      ok: true,
      session: {
        role: staff.role,
        name: staff.name,
        username: staff.username,
        slug: showroom.slug,
      },
    })
    res.cookies.set(SESSION_COOKIE, token, SESSION_COOKIE_OPTIONS)
    return res
  } catch (e) {
    console.error('[auth login] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
