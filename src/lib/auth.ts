import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto'

/**
 * Auth ringan OtoStok:
 * - Password di-hash scrypt (salt acak, format "salt:hex").
 * - Sesi = cookie HttpOnly berisi payload JSON + tanda tangan HMAC-SHA256.
 * - Payload sesi terikat ke showroom (sid/slug) + role (owner|admin).
 */

export type StaffRole = 'owner' | 'admin'

export interface SessionPayload {
  uid: string
  sid: string
  slug: string
  role: StaffRole
  name: string
  exp: number // epoch ms
}

export const SESSION_COOKIE = 'otostok_session'
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 hari
const SECRET = process.env.AUTH_SECRET ?? 'otostok-local-dev-secret-2025'

// ---------- Password ----------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const candidate = scryptSync(password, salt, 64)
  const expected = Buffer.from(hash, 'hex')
  if (candidate.length !== expected.length) return false
  return timingSafeEqual(candidate, expected)
}

// ---------- Sesi (sign / verify) ----------

function sign(data: string): string {
  return createHmac('sha256', SECRET).update(data).digest('hex')
}

export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const full: SessionPayload = { ...payload, exp: Date.now() + SESSION_TTL_MS }
  const body = Buffer.from(JSON.stringify(full)).toString('base64url')
  return `${body}.${sign(body)}`
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null
  const dot = token.lastIndexOf('.')
  if (dot <= 0) return null
  const body = token.slice(0, dot)
  const sig = token.slice(dot + 1)
  const expected = sign(body)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as SessionPayload
    if (!payload?.uid || !payload?.sid || !payload?.exp) return null
    if (payload.exp < Date.now()) return null
    return payload
  } catch {
    return null
  }
}

// ---------- Helper Request / Response ----------

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const header = req.headers.get('cookie') ?? ''
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === SESSION_COOKIE) {
      return verifySessionToken(decodeURIComponent(rest.join('=')))
    }
  }
  return null
}

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: Math.floor(SESSION_TTL_MS / 1000),
}

/** Guard API admin: sesi valid & terikat ke showroom slug tersebut. */
export function requireShowroomSession(req: Request, slug: string): SessionPayload | null {
  const s = getSessionFromRequest(req)
  if (!s) return null
  if (s.slug !== slug) return null
  return s
}

/** Guard khusus owner. */
export function requireOwnerSession(req: Request, slug: string): SessionPayload | null {
  const s = requireShowroomSession(req, slug)
  if (!s || s.role !== 'owner') return null
  return s
}
