import { db } from '@/lib/db'
import { generateMarketingCode } from '@/lib/super-auth'

/**
 * Cari kode referral marketing yang BELUM terpakai (kolom marketings.code unik global).
 * Maksimal 10 percobaan acak; fallback time-based untuk kasus ultra-jarang.
 * Hanya dipakai di server (route handler / script).
 */
export async function uniqueMarketingCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateMarketingCode()
    const clash = await db.marketing.findUnique({ where: { code }, select: { id: true } })
    if (!clash) return code
  }
  return `MKT-${Date.now().toString(36).toUpperCase()}`
}
