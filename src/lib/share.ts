/**
 * Utilitas berbagi materi iklan & penyimpanan foto unit (client-only).
 *
 * Revisi fitur unduh gambar — TANPA file .zip:
 * - Web Share API (`navigator.share`) untuk mengirim FOTO UTAMA + caption spek
 *   motor langsung ke WhatsApp / media sosial dari HP marketing (tanpa ekstrak file).
 * - Simpan per-foto: file JPG tunggal langsung dari galeri layar penuh
 *   (fallback iOS: buka tab baru agar bisa long-press → "Simpan ke Foto/Galeri").
 */

import { buildAdText, copyToClipboard } from '@/lib/format'
import type { AdContact } from '@/lib/format'
import type { PublicVehicle } from '@/lib/types'

export type ShareAdOutcome =
  /** Sheet bagikan native terbuka & selesai (atau user memilih tujuan). */
  | 'shared'
  /** Perangkat tidak mendukung share file — caption disalin ke clipboard. */
  | 'copied'
  /** User menutup sheet bagikan tanpa memilih tujuan. */
  | 'cancelled'
  | 'failed'

export type SavePhotoOutcome =
  /** File JPG diunduh langsung ke perangkat. */
  | 'downloaded'
  /** Dibuka di tab baru (iOS) — user long-press untuk menyimpan. */
  | 'opened'
  | 'failed'

/** Rapikan teks jadi nama file yang aman: "Honda-BeAT-DK-1234" */
function sanitizeFilename(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48) || 'motor'
  )
}

/** Nama file foto tunggal, mis: motostock-honda-beat-dk-1234-foto-2.jpg */
export function buildPhotoFilename(
  v: Pick<PublicVehicle, 'brand' | 'model' | 'licensePlate'>,
  photoIndex: number,
): string {
  const base = sanitizeFilename(`${v.brand}-${v.model}-${v.licensePlate}`)
  return `motostock-${base}-foto-${photoIndex + 1}.jpg`
}

/** Ambil gambar (same-origin /uploads) sebagai File siap-share. */
async function fetchImageAsFile(url: string, filename: string): Promise<File | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg'
    return new File([blob], filename.replace(/\.(jpg|jpeg|png|webp)$/i, `.${ext}`), {
      type: blob.type,
    })
  } catch {
    return null
  }
}

/**
 * Bagikan materi iklan lewat Web Share API: foto utama + caption spek motor.
 * Caption memakai kontak marketing aktif (AdContact) — bukan kontak showroom.
 * Urutan percobaan: share file+teks → share teks saja → salin teks ke clipboard.
 * WAJIB dipanggil dari klik tombol (butuh user gesture + secure context).
 */
export async function shareVehicleAd(
  v: PublicVehicle,
  contact: AdContact,
): Promise<ShareAdOutcome> {
  const text = buildAdText(v, contact)
  const title = `${v.brand} ${v.model} (${v.year})`

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    // 1) Kirim foto utama + caption (Android Chrome / iOS Safari 15+)
    const photo = v.photos[0]
    if (photo) {
      const file = await fetchImageAsFile(photo, buildPhotoFilename(v, 0))
      if (file && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text, title })
          return 'shared'
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
          // gagal kirim file → jatuh ke share teks
        }
      }
    }
    // 2) Perangkat tak mendukung share file → share caption saja
    try {
      await navigator.share({ text, title })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
    }
  }

  // 3) Fallback universal: salin caption — marketing tinggal paste + lampirkan foto
  const ok = await copyToClipboard(text)
  return ok ? 'copied' : 'failed'
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iP(hone|ad|od)/.test(ua) ||
    (/Macintosh/.test(ua) && typeof document !== 'undefined' && 'ontouchend' in document)
  )
}

/**
 * Simpan SATU foto (.jpg) langsung ke perangkat.
 * - Android/desktop: unduh via blob + atribut download (masuk folder unduhan/galeri).
 * - iOS Safari tidak mendukung atribut download untuk gambar → foto dibuka di
 *   tab baru supaya marketing bisa long-press → "Add to Photos / Simpan Gambar".
 */
export async function savePhotoToDevice(url: string, filename: string): Promise<SavePhotoOutcome> {
  if (isIos()) {
    try {
      window.open(url, '_blank', 'noopener')
      return 'opened'
    } catch {
      return 'failed'
    }
  }
  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 4000)
    return 'downloaded'
  } catch {
    // fetch gagal (mis. foto luar origin) — coba buka tab baru agar bisa long-press
    try {
      window.open(url, '_blank', 'noopener')
      return 'opened'
    } catch {
      return 'failed'
    }
  }
}
