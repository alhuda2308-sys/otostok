import type { MarketingSession } from './types'

/**
 * Sesi verifikasi rekanan di sisi klien — disimpan di localStorage per showroom
 * agar marketing tidak perlu mengetik nomor setiap buka link katalog.
 */

const keyFor = (slug: string) => `otostok_mkt_${slug}`

export function loadMarketingSession(slug: string): MarketingSession | null {
  try {
    const raw = localStorage.getItem(keyFor(slug))
    if (!raw) return null
    const j = JSON.parse(raw) as MarketingSession
    if (j && j.id && j.fullName && j.phone) return j
    return null
  } catch {
    return null
  }
}

export function saveMarketingSession(slug: string, s: MarketingSession): void {
  try {
    localStorage.setItem(keyFor(slug), JSON.stringify(s))
  } catch {
    // localStorage penuh / private mode — sesi hanya bertahan di memori
  }
}

export function clearMarketingSession(slug: string): void {
  try {
    localStorage.removeItem(keyFor(slug))
  } catch {
    // abaikan
  }
}
