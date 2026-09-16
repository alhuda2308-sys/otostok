import fs from 'fs/promises'
import path from 'path'

/**
 * Penyimpanan file aplikasi — DUA backend otomatis sesuai lingkungan:
 *
 * 1. SUPABASE STORAGE (produksi Vercel) — aktif bila env SUPABASE_URL +
 *    SUPABASE_SERVICE_ROLE_KEY tersedia. Upload dilakukan SERVER-SIDE dengan
 *    service role key (melewati RLS — TIDAK perlu policy insert/select untuk
 *    anon). Bucket dibuat OTOMATIS saat upload pertama:
 *      • "otostok-media" (PUBLIC)  — logo, foto header, foto unit motor.
 *        Dikirim ke klien sebagai URL permanen /storage/v1/object/public/...
 *      • "otostok-ktp" (PRIVATE)   — foto KTP rekanan; hanya dibaca server
 *        lewat endpoint aman /api/admin/marketings/ktp/[file].
 * 2. DISK LOKAL (dev/sandbox, bila env Supabase tidak diisi) — perilaku lama:
 *    media → public/uploads/, KTP → upload/ktp/.
 *
 * Mengapa server route + service key, bukan RLS policy anon?
 * Aplikasi memakai sesi login sendiri (cookie otostok_session), BUKAN
 * Supabase Auth — RLS Supabase tidak bisa diikat ke login aplikasi. Policy
 * insert untuk anon justru membuka upload bebas ke siapa pun. Maka unggah/
 * unduh file privat lewat server route yang WAJIB lolos sesi aplikasi.
 */

const SUPABASE_URL = (
  process.env.SUPABASE_URL ??
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  ''
).replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

export const MEDIA_BUCKET = 'otostok-media' // PUBLIC — logo/header/foto unit
export const KTP_BUCKET = 'otostok-ktp' // PRIVATE — foto KTP rekanan

const MEDIA_DIR = path.join(process.cwd(), 'public', 'uploads')
const KTP_DIR = path.join(process.cwd(), 'upload', 'ktp')

const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/** Ekstensi file utk MIME yang diizinkan; null bila tipe tidak didukung. */
export function extForType(mime: string): string | null {
  return ALLOWED_EXT[mime] ?? null
}

/** Apakah backend Supabase Storage aktif (env lengkap)? */
export function supabaseStorageActive(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

/**
 * Header autentikasi utk Supabase REST/Storage API.
 * PENTING: Supabase hosted butuh DUA header — `Authorization: Bearer <key>`
 * DAN `apikey: <key>`. Tanpa `apikey`, gateway menjawab:
 *   401 {"message":"No API key found in request","hint":"No 'apikey' request
 *   header or url param was found."}
 */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    Authorization: `Bearer ${SERVICE_KEY}`,
    apikey: SERVICE_KEY,
    ...extra,
  }
}

// Bucket yang sudah dipastikan ada — cache per proses server agar tidak
// mengecek bucket pada setiap upload.
const ensuredBuckets = new Set<string>()

/** Pastikan bucket ada — buat otomatis bila belum (idempotent). */
async function ensureBucket(bucket: string, isPublic: boolean): Promise<void> {
  if (ensuredBuckets.has(bucket)) return

  const probe = await fetch(`${SUPABASE_URL}/storage/v1/bucket/${bucket}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (probe.ok) {
    ensuredBuckets.add(bucket)
    return
  }

  const create = await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ name: bucket, public: isPublic }),
  })
  // 400 "Bucket already exists" dianggap sukses (race antar instance)
  if (!create.ok) {
    const body = await create.text().catch(() => '')
    if (!body.toLowerCase().includes('exist')) {
      throw new Error(
        `Gagal membuat bucket Supabase "${bucket}" (${create.status}): ${body.slice(0, 300)}`,
      )
    }
  }
  ensuredBuckets.add(bucket)
}

async function uploadObject(
  bucket: string,
  objectPath: string,
  buf: Buffer,
  contentType: string,
): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': contentType,
      'x-upsert': 'true',
    }),
    body: new Uint8Array(buf),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(
      `Supabase Storage upload gagal (${res.status}): ${body.slice(0, 300)}`,
    )
  }
}

async function downloadObject(bucket: string, objectPath: string): Promise<Buffer> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    headers: authHeaders(),
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`Supabase Storage baca file gagal (${res.status}).`)
  }
  return Buffer.from(await res.arrayBuffer())
}

async function deleteObject(bucket: string, objectPath: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}/${objectPath}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  if (!res.ok) {
    throw new Error(`Supabase Storage hapus file gagal (${res.status}).`)
  }
}

function publicObjectUrl(bucket: string, objectPath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${objectPath}`
}

/**
 * Simpan file MEDIA PUBLIK (logo/header/foto unit).
 * Supabase → URL publik permanen; fallback disk → /uploads/<nama>.
 * Melempar Error dengan pesan jelas bila gagal.
 */
export async function saveMediaFile(file: File): Promise<string> {
  const ext = extForType(file.type)
  if (!ext) throw new Error('File harus foto JPG/PNG/WebP.')
  const name = `${crypto.randomUUID()}.${ext}`
  const buf = Buffer.from(await file.arrayBuffer())

  if (supabaseStorageActive()) {
    await ensureBucket(MEDIA_BUCKET, true)
    const objectPath = `media/${name}`
    await uploadObject(MEDIA_BUCKET, objectPath, buf, file.type)
    return publicObjectUrl(MEDIA_BUCKET, objectPath)
  }

  await fs.mkdir(MEDIA_DIR, { recursive: true })
  await fs.writeFile(path.join(MEDIA_DIR, name), buf)
  return `/uploads/${name}`
}

/**
 * Simpan file PRIVAT (foto KTP). Kembalikan URL endpoint aman aplikasi
 * (BUKAN URL Supabase) — file hanya dibaca lewat /api/admin/marketings/ktp/[file].
 */
export async function savePrivateFile(
  buf: Buffer,
  fileName: string,
  contentType: string,
): Promise<void> {
  if (supabaseStorageActive()) {
    await ensureBucket(KTP_BUCKET, false)
    await uploadObject(KTP_BUCKET, fileName, buf, contentType)
    return
  }
  await fs.mkdir(KTP_DIR, { recursive: true })
  await fs.writeFile(path.join(KTP_DIR, fileName), buf)
}

/** Baca file privat berdasarkan nama filenya (server-side saja). */
export async function readPrivateFile(fileName: string): Promise<Buffer> {
  if (supabaseStorageActive()) {
    return downloadObject(KTP_BUCKET, fileName)
  }
  return fs.readFile(path.join(KTP_DIR, path.basename(fileName)))
}

/** Hapus file privat (best-effort dipakai oleh pemanggil; error dilempar). */
export async function deletePrivateFile(fileName: string): Promise<void> {
  if (supabaseStorageActive()) {
    await deleteObject(KTP_BUCKET, fileName)
    return
  }
  await fs.unlink(path.join(KTP_DIR, path.basename(fileName)))
}
