/** Helper format angka/tanggal Indonesia — aman dipakai di client & server. */

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('id-ID').format(n)
}

export function formatRupiah(n?: number | null): string {
  if (n == null) return '-'
  return `Rp ${formatNumber(n)}`
}

export function formatKm(n?: number | null): string {
  if (n == null) return 'KM -'
  return `${formatNumber(n)} km`
}

export function formatDateID(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTimeID(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleString('id-ID', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatClockID(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

/** Date -> string "YYYY-MM-DD" untuk input type=date (zona waktu lokal). */
export function formatDateISO(d: string | Date): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 0812... / 62812... -> 62812... (format internasional wa.me) */
export function normalizePhone(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.startsWith('62')) return digits
  if (digits.startsWith('0')) return `62${digits.slice(1)}`
  return digits
}

/** 6281234567890 -> 0812-3456-7890 */
export function formatPhoneDisplay(phone: string): string {
  const digits = normalizePhone(phone)
  const local = digits.startsWith('62') ? `0${digits.slice(2)}` : digits
  if (local.length <= 8) return local
  return `${local.slice(0, 4)}-${local.slice(4, 8)}-${local.slice(8)}`
}

export function waLink(phone: string, text?: string): string {
  const base = `https://wa.me/${normalizePhone(phone)}`
  return text ? `${base}?text=${encodeURIComponent(text)}` : base
}

/**
 * Kode unit (brand/model/tahun) untuk template WA — dipakai kartu & modal.
 */
interface UnitInquiryVehicle {
  brand: string
  model: string
  year: number
}

interface InquiryContext {
  /** Nama showroom (selalu tampil di kedua template). */
  showroomName: string
  /** Terisi = mode Personal Store (referral marketing aktif) → template mitra. */
  marketingName?: string | null
}

/**
 * Template pesan WA "tanya unit ini" — dipakai tombol Chat WhatsApp di kartu
 * katalog & tombol utama di Modal Detail Unit.
 *
 * - Mode Marketing (?ref/?mkt valid): "Halo <Nama Marketing>, saya tertarik dengan
 *   unit <Motor> <Tahun> di katalog Anda (Showroom <Nama Showroom>). Apakah unit ini masih ada?"
 * - Mode Owner (direct): "Halo <Nama Showroom>, saya tertarik dengan unit <Motor> <Tahun>
 *   di katalog resmi MotoStock Anda. Apakah unit ini masih ada?"
 */
export function buildUnitInquiryText(
  v: UnitInquiryVehicle,
  ctx: InquiryContext,
): string {
  if (ctx.marketingName) {
    return `Halo ${ctx.marketingName}, saya tertarik dengan unit ${v.brand} ${v.model} ${v.year} di katalog Anda (Showroom ${ctx.showroomName}). Apakah unit ini masih ada?`
  }
  return `Halo ${ctx.showroomName}, saya tertarik dengan unit ${v.brand} ${v.model} ${v.year} di katalog resmi MotoStock Anda. Apakah unit ini masih ada?`
}

/**
 * Template pesan WA umum (bukan per-unit) untuk tombol chat di header katalog.
 * - Mode Marketing: sapa mitra + minta info unit yang tersedia.
 * - Mode Owner: teks sapaan resmi yang sudah ada.
 */
export function buildCatalogGreetingText(ctx: InquiryContext): string {
  if (ctx.marketingName) {
    return `Halo ${ctx.marketingName}, saya melihat katalog (Showroom ${ctx.showroomName}). Bisa dibantu info unit yang tersedia?`
  }
  return `Halo ${ctx.showroomName}, saya lihat katalog MotoStock Anda. Ada unit yang menarik.`
}

/** Pajak dianggap "hidup" kalau teksnya tidak mengandung kata "mati". */
export function isTaxAlive(tax?: string | null): boolean {
  if (!tax) return true
  return !/mati/i.test(tax)
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = String(Math.floor(s / 3600)).padStart(2, '0')
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${h}:${m}:${sec}`
}

/** Salin teks ke clipboard dengan fallback untuk browser lama / non-secure context. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      return true
    } catch {
      return false
    }
  }
}

/** Susun teks iklan siap-posting untuk WhatsApp Status / Facebook Marketplace. */
export function buildAdText(
  v: Pick<
    PublicVehicleLike,
    'brand' | 'model' | 'year' | 'licensePlate' | 'odometer' | 'color' | 'taxStatus' | 'documentStatus' | 'sellingPrice' | 'notes'
  >,
  showroom: { name: string; address: string; ownerPhone: string },
): string {
  const lines: string[] = []
  lines.push(`DIJUAL — ${v.brand} ${v.model} (${v.year})`)
  const spec: string[] = []
  if (v.licensePlate) spec.push(`Plat ${v.licensePlate}`)
  if (v.odometer != null) spec.push(`KM ${formatNumber(v.odometer)}`)
  if (v.color) spec.push(`Warna ${v.color}`)
  if (spec.length) lines.push(spec.join(' | '))
  if (v.taxStatus) lines.push(`Pajak: ${v.taxStatus}`)
  if (v.documentStatus) lines.push(`Surat: ${v.documentStatus}`)
  if (v.sellingPrice != null) lines.push(`Harga: ${formatRupiah(v.sellingPrice)} (nego halus)`)
  if (v.notes) {
    lines.push('')
    lines.push(v.notes)
  }
  lines.push('')
  lines.push(`Showroom: ${showroom.name}`)
  if (showroom.address) lines.push(`Alamat: ${showroom.address}`)
  lines.push(`Chat WA: ${formatPhoneDisplay(showroom.ownerPhone)}`)
  return lines.join('\n')
}

interface PublicVehicleLike {
  brand: string
  model: string
  year: number
  licensePlate: string
  odometer: number | null
  color: string | null
  taxStatus: string | null
  documentStatus: string | null
  sellingPrice: number | null
  notes: string | null
}
