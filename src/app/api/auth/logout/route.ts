import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

/** POST /api/auth/logout — hapus cookie sesi. */
export async function POST() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
  return res
}
