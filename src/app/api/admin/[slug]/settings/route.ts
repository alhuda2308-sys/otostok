import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnerSession } from '@/lib/auth'

/** String null-safe: null/undefined -> "", bukan "null". */
function safeStr(v: unknown): string {
  return v == null ? '' : String(v)
}

/** GET /api/admin/[slug]/settings — profil showroom (owner saja). */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = requireOwnerSession(req, slug)
  if (!session) {
    return NextResponse.json({ error: 'Akses ditolak — khusus owner.' }, { status: 403 })
  }
  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }
  return NextResponse.json({
    name: showroom.name,
    slug: showroom.slug,
    address: showroom.address,
    ownerPhone: showroom.ownerPhone,
    logoUrl: showroom.logoUrl,
    headerUrl: showroom.headerUrl,
    mapsUrl: showroom.mapsUrl,
  })
}

/**
 * PATCH /api/admin/[slug]/settings — simpan profil showroom (owner saja).
 * Semua perubahan otomatis tampil di katalog publik /s/[slug].
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireOwnerSession(req, slug)
    if (!session) {
      return NextResponse.json({ error: 'Akses ditolak — khusus owner.' }, { status: 403 })
    }
    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const data: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()
      if (name.length < 3) {
        return NextResponse.json({ error: 'Nama showroom minimal 3 karakter.' }, { status: 400 })
      }
      data.name = name.slice(0, 80)
    }
    if (body.address !== undefined) {
      const address = String(body.address).trim()
      if (address.length < 5) {
        return NextResponse.json({ error: 'Alamat showroom wajib diisi.' }, { status: 400 })
      }
      data.address = address.slice(0, 200)
    }
    if (body.ownerPhone !== undefined) {
      const phone = String(body.ownerPhone).replace(/\D/g, '')
      if (phone.length < 9 || phone.length > 15) {
        return NextResponse.json({ error: 'Nomor WhatsApp admin tidak valid.' }, { status: 400 })
      }
      data.ownerPhone = phone
    }
    if (body.mapsUrl !== undefined) {
      const url = safeStr(body.mapsUrl).trim()
      if (url && !/^https?:\/\//i.test(url)) {
        return NextResponse.json(
          { error: 'Link Google Maps harus dimulai dengan http:// atau https://' },
          { status: 400 },
        )
      }
      data.mapsUrl = url ? url.slice(0, 500) : null
    }
    if (body.logoUrl !== undefined) {
      data.logoUrl = safeStr(body.logoUrl).trim().slice(0, 500) || null
    }
    if (body.headerUrl !== undefined) {
      data.headerUrl = safeStr(body.headerUrl).trim().slice(0, 500) || null
    }

    await db.showroom.update({ where: { id: showroom.id }, data })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[settings] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
