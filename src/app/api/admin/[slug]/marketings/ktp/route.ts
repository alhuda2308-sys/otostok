import { NextResponse } from 'next/server'
import { requireOwnerSession } from '@/lib/auth'
import { saveKtpFile } from '@/lib/ktp'

/**
 * POST /api/admin/[slug]/marketings/ktp
 * Upload foto KTP rekanan (multipart/form-data, field "file", 1 file) — KHUSUS OWNER.
 * Disimpan PRIVAT di luar folder public/ — pratinjau hanya lewat endpoint aman.
 * Respons: { ok: true, url: "/api/admin/marketings/ktp/ktp-<slug>-<uuid>.jpg" }
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireOwnerSession(req, slug)
    if (!session) {
      return NextResponse.json(
        { error: 'Hanya owner yang boleh mengelola foto KTP rekanan.' },
        { status: 403 },
      )
    }

    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Tidak ada file yang diupload.' }, { status: 400 })
    }

    const url = await saveKtpFile(file, slug)
    return NextResponse.json({ ok: true, url })
  } catch (e) {
    if (e instanceof Error && (e.message.includes('JPG') || e.message.includes('4MB'))) {
      return NextResponse.json({ error: e.message }, { status: 400 })
    }
    console.error('[ktp upload] error:', e)
    return NextResponse.json({ error: 'Upload gagal. Coba lagi.' }, { status: 500 })
  }
}
