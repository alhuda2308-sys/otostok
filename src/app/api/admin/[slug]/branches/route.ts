import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnerSession, requireShowroomSession } from '@/lib/auth'
import type { BranchInfo } from '@/lib/types'

function toInfo(b: { id: string; name: string; address: string; mapsUrl: string | null }): BranchInfo {
  return { id: b.id, name: b.name, address: b.address, mapsUrl: b.mapsUrl }
}

/**
 * GET /api/admin/[slug]/branches
 * Daftar cabang showroom. Owner & admin boleh melihat (dipakai dropdown lokasi unit).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = requireShowroomSession(req, slug)
  if (!session) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }

  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }

  const branches = await db.branch.findMany({
    where: { showroomId: showroom.id },
    orderBy: { createdAt: 'asc' },
  })
  return NextResponse.json({ branches: branches.map(toInfo) })
}

/**
 * POST /api/admin/[slug]/branches
 * Tambah cabang baru — KHUSUS OWNER.
 * Cabang dipakai sebagai "Lokasi Unit Berada" di form motor & filter katalog.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireOwnerSession(req, slug)
    if (!session) {
      return NextResponse.json(
        { error: 'Hanya owner yang boleh mengelola cabang.' },
        { status: 403 },
      )
    }

    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom || !showroom.isActive) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim().slice(0, 60)
    const address = String(body.address ?? '').trim().slice(0, 200)
    const mapsUrlRaw = String(body.mapsUrl ?? '').trim().slice(0, 500)

    if (name.length < 3) {
      return NextResponse.json(
        { error: 'Nama cabang minimal 3 karakter.' },
        { status: 400 },
      )
    }
    if (address.length < 5) {
      return NextResponse.json({ error: 'Alamat cabang wajib diisi.' }, { status: 400 })
    }
    if (mapsUrlRaw && !/^https?:\/\//i.test(mapsUrlRaw)) {
      return NextResponse.json(
        { error: 'Link Google Maps harus diawali http:// atau https://.' },
        { status: 400 },
      )
    }

    const dup = await db.branch.findFirst({
      where: { showroomId: showroom.id, name },
    })
    if (dup) {
      return NextResponse.json(
        { error: `Cabang dengan nama "${name}" sudah ada.` },
        { status: 409 },
      )
    }

    const branch = await db.branch.create({
      data: {
        showroomId: showroom.id,
        name,
        address,
        mapsUrl: mapsUrlRaw || null,
      },
    })

    return NextResponse.json({ ok: true, branch: toInfo(branch) })
  } catch (e) {
    console.error('[admin create branch] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
