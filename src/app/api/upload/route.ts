import { NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { extForType, saveMediaFile, supabaseStorageActive } from '@/lib/storage'

export const runtime = 'nodejs'

const MAX_SIZE = 4 * 1024 * 1024 // 4MB per file (klien sudah kompres sebelum kirim)
const MAX_FILES = 8 // PhotoManager mengirim batch maks 4/request

/**
 * POST /api/upload — unggah foto MEDIA PUBLIK (multipart/form-data, field "files").
 * Dipakai PhotoManager: logo showroom, foto header, foto unit motor.
 *
 * Penyimpanan otomatis dua backend (lihat src/lib/storage.ts):
 * - Produksi (env SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY terisi):
 *   Supabase Storage bucket "otostok-media" (PUBLIC) → URL publik permanen.
 * - Dev lokal (tanpa env): disk public/uploads/ → URL relatif /uploads/<nama>.
 *
 * Wajib sesi login showroom (owner/admin) — tidak terbuka untuk publik.
 */
export async function POST(req: Request) {
  try {
    // Di Vercel filesystem read-only — tanpa env Supabase upload mustahil jalan.
    // Beri pesan eksplisit, jangan biarkan gagal dengan EROFS yang membingungkan.
    if (process.env.VERCEL && !supabaseStorageActive()) {
      return NextResponse.json(
        {
          error:
            'Server produksi belum siap menerima upload: env SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY belum diisi di Vercel. Buka Vercel → Project → Settings → Environment Variables, tambahkan keduanya (ambil dari Supabase Dashboard → Project Settings → API), lalu Redeploy.',
        },
        { status: 500 },
      )
    }

    const session = getSessionFromRequest(req)
    if (!session) {
      return NextResponse.json(
        { error: 'Akses ditolak — silakan login sebagai owner/admin showroom.' },
        { status: 401 },
      )
    }

    const form = await req.formData()
    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diupload.' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maksimal ${MAX_FILES} foto sekaligus.` }, { status: 400 })
    }

    const urls: string[] = []
    for (const f of files) {
      const ext = extForType(f.type)
      if (!ext) {
        return NextResponse.json(
          { error: `"${f.name}" bukan foto JPG/PNG/WebP yang valid.` },
          { status: 400 },
        )
      }
      if (f.size > MAX_SIZE) {
        return NextResponse.json(
          { error: `"${f.name}" melebihi 4MB. Kompres dulu fotonya.` },
          { status: 400 },
        )
      }
      // saveMediaFile melempar Error dengan pesan jelas bila storage gagal
      urls.push(await saveMediaFile(f))
    }

    return NextResponse.json({ ok: true, urls })
  } catch (e) {
    console.error('[upload] error:', e)
    const msg = e instanceof Error && e.message ? e.message : 'Upload gagal. Coba lagi.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
