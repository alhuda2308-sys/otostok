import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'

/**
 * GET /api/auth/session — cek sesi login aktif.
 * Mengembalikan role + showroom terkait, atau 401.
 */
export async function GET(req: Request) {
  const session = getSessionFromRequest(req)
  if (!session) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }
  return NextResponse.json({
    ok: true,
    session: {
      role: session.role,
      name: session.name,
      slug: session.slug,
    },
  })
}
