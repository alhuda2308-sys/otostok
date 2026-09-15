import { randomBytes, timingSafeEqual } from 'crypto'

/**
 * Keamanan modul Super Admin — TERPISAH TOTAL dari akun Owner/Admin showroom.
 * Autentikasi memakai Master Secret Key dari env SUPER_ADMIN_SECRET:
 * klien mengirim pada header "X-Super-Secret" (atau query ?secret= untuk utilitas),
 * server membandingkan constant-time. Tidak ada cookie/sesi server —
 * setiap permintaan divalidasi berdiri sendiri (stateless).
 */

export function getSuperSecret(): string | null {
  const s = process.env.SUPER_ADMIN_SECRET?.trim()
  return s ? s : null
}

/** True bila Master Secret Key pada request cocok dengan env SUPER_ADMIN_SECRET. */
export function isSuperAuthorized(req: Request): boolean {
  const expected = getSuperSecret()
  if (!expected) return false
  const provided =
    req.headers.get('x-super-secret')?.trim() ||
    new URL(req.url).searchParams.get('secret')?.trim() ||
    ''
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Generator kode lisensi format OTO-XXXX-XXXX-XXXX.
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
  return `OTO-${randomBlock(4)}-${randomBlock(4)}-${randomBlock(4)}`
}
