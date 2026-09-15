import type { PublicVehicle } from './types'
import { formatPhoneDisplay, formatRupiah } from './format'

export type BroadcastKind = 'new' | 'sold'

/**
 * Susun teks broadcast WA untuk tim marketing.
 * kind 'new'  : unit baru masuk + komisi + link materi posting.
 * kind 'sold' : unit terjual + ajakan cek stok ready via katalog.
 */
export function buildBroadcastText(
  kind: BroadcastKind,
  v: Pick<
    PublicVehicle,
    'brand' | 'model' | 'year' | 'licensePlate' | 'sellingPrice' | 'commissionAmount' | 'odometer'
  >,
  showroom: { name: string },
  catalogUrl: string,
): string {
  const unit = `${v.brand} ${v.model}`
  if (kind === 'sold') {
    return [
      `*UNIT TERJUAL — ${showroom.name}*`,
      `${unit} (${v.licensePlate}) sudah SOLD. Terima kasih!`,
      '',
      `Stok READY lainnya masih banyak — cek katalog sekarang:`,
      catalogUrl,
    ].join('\n')
  }

  const lines = [
    `*UNIT BARU MASUK — ${showroom.name}*`,
    `${unit} (${v.year}) • Plat ${v.licensePlate}`,
  ]
  if (v.odometer != null) lines.push(`Odometer: ${v.odometer.toLocaleString('id-ID')} km`)
  if (v.sellingPrice != null) lines.push(`Harga: ${formatRupiah(v.sellingPrice)}`)
  if (v.commissionAmount != null)
    lines.push(`Komisi marketing: *${formatRupiah(v.commissionAmount)}* / unit deal`)
  lines.push('')
  lines.push(`Detail & foto lengkap di katalog:`)
  lines.push(catalogUrl)
  lines.push(`Materi posting: silakan ambil foto dari katalog ya.`)
  return lines.join('\n')
}

/** Link WhatsApp share tanpa nomor tujuan — user memilih grup/kontak di WA. */
export function waBroadcastLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** Kredensial akun untuk ditampilkan sekali saat dibuat. */
export function formatCredential(name: string, username: string): string {
  return `Akun: ${name}\nUsername: ${username}`
}

export { formatPhoneDisplay }
