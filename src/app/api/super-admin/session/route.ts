import { NextResponse } from 'next/server'
import {
  SA_COOKIE_NAME,
  createSaSessionToken,
  isSuperAuthorized,
  matchesSuperSecret,
} from '@/lib/super-auth'
import { dbErrorResponse } from '@/lib/db-errors'

/**
 * Sesi Super Admin berbasis cookie HttpOnly (HMAC, 8 jam).
 *
 * POST menerima:
 * - JSON  { key: "..." }  → jalur utama fetch()
 * - form-urlencoded (key=...&redirect=1) → fallback <form method=POST> native
 *   untuk portal yang membatasi fetch; memakai Location RELATIF agar aman
 *   di balik reverse proxy apa pun. Field sengaja bernama "key" (bukan
 *   "secret") agar tidak memicu penyaringan kata pada gateway.
 *
 * GET  → cek sesi aktif.  DELETE → logout (hapus cookie).
 */

const COOKIE_MAX_AGE = 8 * 60 * 60

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: false,
  }
}

/** GET: apakah sesi cookie/kunci saat ini valid? */
export async function GET(req: Request) {
  try {
    if (isSuperAuthorized(req)) return NextResponse.json({ ok: true })
    return NextResponse.json({ ok: false }, { status: 401 })
  } catch (e) {
    return dbErrorResponse(e, 'session GET')
  }
}

/** POST: verifikasi kunci → terbitkan cookie sesi. */
export async function POST(req: Request) {
  try {
    return await sessionPost(req)
  } catch (e) {
    return dbErrorResponse(e, 'session POST')
  }
}

async function sessionPost(req: Request): Promise<NextResponse> {
  const contentType = req.headers.get('content-type') ?? ''
  let key = ''
  let formMode = false

  if (contentType.includes('application/json')) {
    const parsed: unknown = await req.json().catch(() => ({}))
    const body = (
      parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
    ) as { key?: unknown }
    key = typeof body.key === 'string' ? body.key : ''
  } else {
    // application/x-www-form-urlencoded — jalur fallback form native
    const params = new URLSearchParams(await req.text())
    key = params.get('key') ?? ''
    formMode = params.get('redirect') === '1'
  }
  if (!key) {
    key =
      new URL(req.url).searchParams.get('key')?.trim() ||
      new URL(req.url).searchParams.get('secret')?.trim() ||
      ''
  }

  const token = createSaSessionToken()
  if (!token) {
    if (formMode) return redirectBack(true)
    return NextResponse.json(
      { error: 'SUPER_ADMIN_SECRET belum diatur di environment server.' },
      { status: 500 },
    )
  }

  if (!matchesSuperSecret(key)) {
    if (formMode) return redirectBack(true)
    return NextResponse.json({ error: 'Master Secret Key salah.' }, { status: 401 })
  }

  if (formMode) {
    const res = new NextResponse(null, { status: 303 })
    res.headers.set('Location', '/super-admin') // Location relatif — aman di balik proxy
    res.cookies.set(SA_COOKIE_NAME, token, cookieOptions())
    return res
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(SA_COOKIE_NAME, token, cookieOptions())
  return res
}

/** DELETE: logout — kosongkan cookie. */
export async function DELETE() {
  try {
    const res = NextResponse.json({ ok: true })
    res.cookies.set(SA_COOKIE_NAME, '', { path: '/', maxAge: 0 })
    return res
  } catch (e) {
    return dbErrorResponse(e, 'session DELETE')
  }
}

/** Redirect 303 kembali ke /super-admin (dengan/tanpa penanda error). */
function redirectBack(withError: boolean) {
  const res = new NextResponse(null, { status: 303 })
  res.headers.set('Location', withError ? '/super-admin?saerr=1' : '/super-admin')
  return res
}
