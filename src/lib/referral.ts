import type { ReferralSession } from './types'

/**
 * Sesi atribusi referral Personal Store (Katalog Digital Multi-Mitra) di sisi
 * klien — disimpan di localStorage per showroom agar pembeli yang datang lewat
 * link toko seorang marketing tetap ter-atribusi kepadanya pada kunjungan
 * berikutnya (tanpa perlu membuka link referral lagi).
 *
 * Sengaja memakai kunci terpisah dari sesi gate rekanan (otostok_mkt_<slug>):
 * gate = verifikasi "saya marketing ini" (internal), referral = "pembeli ini
 * datang dari marketing X" (eksternal). Kunci lama tidak disentuh.
 */

const keyFor = (slug: string) => `otostok_ref_${slug}`

export function loadReferralSession(slug: string): ReferralSession | null {
  try {
    const raw = localStorage.getItem(keyFor(slug))
    if (!raw) return null
    const j = JSON.parse(raw) as ReferralSession
    if (j && j.id && j.fullName && j.phone) return j
    return null
  } catch {
    return null
  }
}

export function saveReferralSession(slug: string, s: ReferralSession): void {
  try {
    localStorage.setItem(keyFor(slug), JSON.stringify(s))
  } catch {
    // localStorage penuh / private mode — atribusi hanya bertahan di memori
  }
}

export function clearReferralSession(slug: string): void {
  try {
    localStorage.removeItem(keyFor(slug))
  } catch {
    // abaikan
  }
}

/** Baca parameter referral dari URL saat ini (client-only): ?ref=KODE atau ?mkt=ID. */
export function readReferralParam(): { ref?: string; mkt?: string } | null {
  if (typeof window === 'undefined') return null
  const sp = new URLSearchParams(window.location.search)
  const ref = (sp.get('ref') ?? '').trim()
  const mkt = (sp.get('mkt') ?? '').trim()
  if (!ref && !mkt) return null
  return ref ? { ref } : { mkt }
}

/**
 * Validasi parameter referral ke server dan ubah menjadi sesi referral.
 * Mengembalikan null bila parameter tidak ada / kode tidak dikenal / rekanan
 * dinonaktifkan — pemanggil lalu fallback ke sesi tersimpan atau mode Owner.
 */
export async function resolveReferral(
  slug: string,
  param: { ref?: string; mkt?: string },
): Promise<ReferralSession | null> {
  const qs = param.ref
    ? `ref=${encodeURIComponent(param.ref)}`
    : param.mkt
      ? `mkt=${encodeURIComponent(param.mkt)}`
      : ''
  if (!qs) return null
  try {
    const res = await fetch(`/api/showrooms/${slug}/resolve-ref?${qs}`, { cache: 'no-store' })
    if (!res.ok) return null
    const j = (await res.json()) as {
      registered?: boolean
      marketing?: { id: string; fullName: string; phoneNumber: string; code: string | null }
    }
    if (!j?.registered || !j.marketing) return null
    return {
      id: j.marketing.id,
      fullName: j.marketing.fullName,
      phone: String(j.marketing.phoneNumber ?? '').replace(/\D/g, ''),
      code: j.marketing.code ?? null,
    }
  } catch {
    return null
  }
}
