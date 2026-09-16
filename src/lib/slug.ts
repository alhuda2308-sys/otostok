import { RESERVED_SLUGS } from './constants'

/** "Showroom Jaya 2!" -> "showroom-jaya-2" */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug)
}

export function isValidLicenseKey(key: string): boolean {
  const k = key.trim().toUpperCase()
  // MTR-XXXX-XXXX (lisensi awal/demo), OTO-XXXX-XXXX-XXXX (generator lama — tetap valid)
  // atau MOTO-XXXX-XXXX-XXXX (generator Super Admin terbaru, rebranding MotoStock)
  return /^(MTR-[A-Z0-9]{4}-[A-Z0-9]{4}|OTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|MOTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/.test(k)
}
