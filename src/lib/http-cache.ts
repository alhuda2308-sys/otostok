/**
 * Cache-Control untuk respons GET API yang dibaca browser (dashboard admin
 * & katalog publik per-nomor WA — data privat, TIDAK untuk shared/CDN cache).
 *
 * Artinya:
 *  - `private`                  → hanya cache browser pengguna (bukan Vercel CDN).
 *  - `no-cache`                 → tiap pemakaian wajib revalidate (304 murah
 *                                 bila payload ber-ETag — Next otomatis).
 *  - `stale-while-revalidate=30`→ saat navigasi antar-tab/refresh, balasan
 *                                 cache boleh ditampilkan INSTAN sambil
 *                                 revalidasi berjalan di background.
 * Navigasi antar-tab dashboard terasa nol-delay tanpa mengorbankan
 * kebaruan data (maksimal 30 detik setara versi lama di layar).
 */
export const PRIVATE_STALE_WHILE_REVALIDATE = 'private, no-cache, stale-while-revalidate=30'

/** Helper kecil: respons JSON sukses GET + header cache dashboard. */
export function cachedJson(data: unknown, init?: ResponseInit) {
  return Response.json(data, {
    ...init,
    headers: { 'Cache-Control': PRIVATE_STALE_WHILE_REVALIDATE, ...(init?.headers ?? {}) },
  })
}
