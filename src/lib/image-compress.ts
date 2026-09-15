/**
 * Kompresi gambar ringan di sisi client sebelum upload:
 * - Resize sisi terpanjang ke maks 1600px (cukup untuk foto unit & bukti).
 * - Re-encode JPEG kualitas 0.82 — hasil biasanya 5-10x lebih kecil.
 * - Gagal (browser lama/HEIC) -> kembalikan file asli.
 */
const MAX_DIM = 1600
const QUALITY = 0.82

export async function compressImage(file: File): Promise<File> {
  try {
    if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', QUALITY),
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg' })
  } catch {
    return file
  }
}

/** Kompres banyak file sekaligus. */
export async function compressImages(files: File[]): Promise<File[]> {
  return Promise.all(files.map((f) => compressImage(f)))
}
