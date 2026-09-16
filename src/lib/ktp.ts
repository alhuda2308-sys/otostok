import {
  deletePrivateFile,
  extForType,
  savePrivateFile,
} from '@/lib/storage'

/**
 * Penyimpanan foto KTP rekanan — PRIVAT (bukan URL publik).
 * File hanya bisa dilihat lewat endpoint aman yang mewajibkan sesi
 * Owner/Admin showroom yang sama:
 *   GET /api/admin/marketings/ktp/[file]
 * Nama file: ktp-<slug>-<random>.<ext>  (slug ikut disimpan agar verifikasi showroom mudah)
 *
 * Backend mengikuti src/lib/storage.ts:
 *  - Produksi (env Supabase terisi): bucket PRIVATE "otostok-ktp" — file
 *    tidak pernah bisa diakses publik langsung dari Supabase.
 *  - Dev lokal: disk upload/ktp/ (di luar public/).
 */

const KTP_MAX_SIZE = 4 * 1024 * 1024 // 4MB

/** Simpan file KTP, kembalikan URL endpoint aman-nya. */
export async function saveKtpFile(
  file: File,
  showroomSlug: string,
): Promise<string> {
  const ext = extForType(file.type)
  if (!ext) throw new Error('Foto KTP harus JPG/PNG/WebP.')
  if (file.size > KTP_MAX_SIZE) throw new Error('Foto KTP melebihi 4MB.')

  const safeSlug = showroomSlug.replace(/[^a-z0-9-_]/gi, '').slice(0, 40) || 'x'
  const name = `ktp-${safeSlug}-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await savePrivateFile(buf, name, file.type)
  return `/api/admin/marketings/ktp/${name}`
}

/** Nama file KTP dari URL-nya (validasi format ketat); null bila bukan URL KTP. */
export function ktpFileNameFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const m = url.match(/\/api\/admin\/marketings\/ktp\/([^/]+)$/)
  if (!m) return null
  const name = m[1]
  return /^ktp-[a-z0-9-_]+-[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(name) ? name : null
}

/** Hapus file KTP lama berdasarkan URL-nya (best-effort, abaikan error). */
export async function deleteKtpFileByUrl(url: string | null | undefined): Promise<void> {
  const name = ktpFileNameFromUrl(url)
  if (!name) return
  try {
    await deletePrivateFile(name)
  } catch {
    // file mungkin sudah terhapus — abaikan
  }
}
