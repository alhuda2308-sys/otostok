import { NextResponse } from 'next/server'
import { requireShowroomSession } from '@/lib/auth'
import { readPrivateFile } from '@/lib/storage'

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

/**
 * GET /api/admin/marketings/ktp/[file]
 * Pratinjau foto KTP — AMAN: hanya bisa diakses Owner/Admin showroom yang sama.
 * Slug showroom tersimpan di nama file dan dicocokkan dengan sesi login.
 * Backend: bucket PRIVATE "otostok-ktp" (produksi) atau disk upload/ktp (lokal).
 */
export async function GET(req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params

  // ktp-<slug>-<uuid>.<ext>
  const m = file.match(/^ktp-([a-z0-9-_]+)-([0-9a-f-]{36})\.(jpg|png|webp)$/i)
  if (!m) {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
  }
  const slug = m[1]

  // Wajib sesi Owner/Admin showroom yang sama
  const session = requireShowroomSession(req, slug)
  if (!session) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 })
  }

  try {
    const buf = await readPrivateFile(file)
    const ext = file.split('.').pop()!.toLowerCase()
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': CONTENT_TYPES[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 })
  }
}
