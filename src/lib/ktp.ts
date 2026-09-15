import fs from 'fs/promises'
import path from 'path'

/**
 * Penyimpanan foto KTP rekanan — PRIVAT (di luar folder public/).
 * File hanya bisa dilihat lewat endpoint aman yang mewajibkan sesi
 * Owner/Admin showroom yang sama:
 *   GET /api/admin/marketings/ktp/[file]
 * Nama file: ktp-<slug>-<random>.<ext>  (slug ikut disimpan agar verifikasi showroom mudah)
 */

const KTP_DIR = path.join(process.cwd(), 'upload', 'ktp')

const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
export const KTP_MAX_SIZE = 4 * 1024 * 1024 // 4MB

/** Simpan buffer KTP, kembalikan URL endpoint aman-nya. */
export async function saveKtpFile(
  file: File,
  showroomSlug: string,
): Promise<string> {
  const ext = ALLOWED_EXT[file.type]
  if (!ext) throw new Error('Foto KTP harus JPG/PNG/WebP.')
  if (file.size > KTP_MAX_SIZE) throw new Error('Foto KTP melebihi 4MB.')

  await fs.mkdir(KTP_DIR, { recursive: true })
  const safeSlug = showroomSlug.replace(/[^a-z0-9-_]/gi, '').slice(0, 40) || 'x'
  const name = `ktp-${safeSlug}-${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(path.join(KTP_DIR, name), buf)
  return `/api/admin/marketings/ktp/${name}`
}

/** Path absolut file KTP dari nama filenya (validasi format ketat, anti path-traversal). */
export function resolveKtpPath(fileName: string): string | null {
  if (!/^ktp-[a-z0-9-_]+-[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(fileName)) return null
  return path.join(KTP_DIR, path.basename(fileName))
}

/** Hapus file KTP lama berdasarkan URL-nya (best-effort, abaikan error). */
export async function deleteKtpFileByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return
  const m = url.match(/\/api\/admin\/marketings\/ktp\/([^/]+)$/)
  if (!m) return
  const p = resolveKtpPath(m[1])
  if (!p) return
  try {
    await fs.unlink(p)
  } catch {
    // file mungkin sudah terhapus — abaikan
  }
}
