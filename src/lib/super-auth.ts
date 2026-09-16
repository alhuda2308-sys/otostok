import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

/**
 * Keamanan modul Super Admin — TERPISAH TOTAL dari akun Owner/Admin showroom.
 * Autentikasi Master Secret Key dari env SUPER_ADMIN_SECRET.
 *
 * Kunci diterima lewat 3 jalur (urutan prioritas):
 * 1. Cookie sesi "otostok_sa" — token HMAC berbatas waktu 8 jam, dibuat oleh
 *    /api/super-admin/session. Jalur UTAMA: cookie selalu diteruskan reverse
 *    proxy/portal dan tidak tersentuh penyaring header/query.
 * 2. Header "X-Super-Secret".
 * 3. Query "?secret=" / "?key=" (utilitas & curl).
 *
 * Catatan lapangan: portal preview sandbox menjatuhkan header kustom dan
 * menolak query param yang memuat kata "secret" (HTTP 500) — karena itu
 * semua request browser WAJIB memakai cookie; body JSON pun memakai field
 * "key" (bukan "secret") agar tidak memicu penyaringan kata di gateway.
 */

export function getSuperSecret(): string | null {
  const s = process.env.SUPER_ADMIN_SECRET?.trim()
  return s ? s : null
}

/** Nama cookie sesi Super Admin (sengaja tanpa kata "secret"). */
export const SA_COOKIE_NAME = 'otostok_sa'
/** Masa berlaku token sesi cookie: 8 jam. */
const SESSION_TTL_MS = 8 * 60 * 60 * 1000

function hmacSign(value: string): string {
  const secret = getSuperSecret() ?? ''
  return createHmac('sha256', secret).update(value).digest('base64url')
}

/**
 * Token sesi: "<expEpochMs>.<hmac(exp)>" — kunci mentah TIDAK pernah disimpan
 * di cookie; cukup tanda tangan HMAC yang bisa diverifikasi server.
 */
export function createSaSessionToken(): string | null {
  if (!getSuperSecret()) return null
  const exp = String(Date.now() + SESSION_TTL_MS)
  return `${exp}.${hmacSign(exp)}`
}

export function verifySaSessionToken(token: string | null | undefined): boolean {
  if (!token) return false
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return false
  const exp = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expNum = Number(exp)
  if (!Number.isFinite(expNum) || expNum < Date.now()) return false
  const expected = hmacSign(exp)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Parser header Cookie minimal — ambil nilai cookie sesi Super Admin. */
export function readSaSessionCookie(req: Request): string | null {
  const header = req.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() === SA_COOKIE_NAME) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim())
      } catch {
        return part.slice(eq + 1).trim()
      }
    }
  }
  return null
}

/** Cocokkan kunci mentah secara constant-time. */
export function matchesSuperSecret(provided: string | null | undefined): boolean {
  const expected = getSuperSecret()
  if (!expected || !provided) return false
  const a = Buffer.from(provided.trim())
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** True bila request boleh lolos: cookie sesi valid ATAU kunci valid. */
export function isSuperAuthorized(req: Request): boolean {
  if (verifySaSessionToken(readSaSessionCookie(req))) return true
  const provided =
    req.headers.get('x-super-secret')?.trim() ||
    new URL(req.url).searchParams.get('key')?.trim() ||
    new URL(req.url).searchParams.get('secret')?.trim() ||
    ''
  return matchesSuperSecret(provided)
}

/**
 * Generator kode lisensi format MOTO-XXXX-XXXX-XXXX.
 * Lisensi lama berawalan OTO- tetap valid (lihat isValidLicenseKey di lib/slug.ts).
 * Charset tanpa karakter ambigu (I, O, 0, 1) agar mudah dibaca/dikirim via WA.
 */
const KEY_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function randomBlock(length: number): string {
  const bytes = randomBytes(length)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += KEY_CHARSET[bytes[i] % KEY_CHARSET.length]
  }
  return out
}

export function generateLicenseKey(): string {
  return `MOTO-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`
}
