import fs from 'fs/promises'
import path from 'path'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ALLOWED_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}
const MAX_SIZE = 4 * 1024 * 1024 // 4MB
const MAX_FILES = 8

/**
 * POST /api/upload — upload multi-foto unit motor (multipart/form-data, field "files").
 * Disimpan ke public/uploads dengan nama acak, dikembalikan sebagai URL relatif.
 */
export async function POST(req: Request) {
  try {
    const form = await req.formData()
    const files = form.getAll('files').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      return NextResponse.json({ error: 'Tidak ada file yang diupload.' }, { status: 400 })
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: `Maksimal ${MAX_FILES} foto sekaligus.` },
        { status: 400 },
      )
    }

    const dir = path.join(process.cwd(), 'public', 'uploads')
    await fs.mkdir(dir, { recursive: true })

    const urls: string[] = []
    for (const f of files) {
      const ext = ALLOWED_EXT[f.type]
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
      const name = `${crypto.randomUUID()}.${ext}`
      const buf = Buffer.from(await f.arrayBuffer())
      await fs.writeFile(path.join(dir, name), buf)
      urls.push(`/uploads/${name}`)
    }

    return NextResponse.json({ ok: true, urls })
  } catch (e) {
    console.error('[upload] error:', e)
    return NextResponse.json({ error: 'Upload gagal. Coba lagi.' }, { status: 500 })
  }
}
