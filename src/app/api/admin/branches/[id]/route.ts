import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireOwnerSession } from '@/lib/auth'
import type { BranchInfo } from '@/lib/types'

/**
 * PATCH /api/admin/branches/[id] — edit cabang (KHUSUS OWNER).
 * DELETE /api/admin/branches/[id] — hapus cabang (KHUSUS OWNER).
 * Unit yang terdaftar di cabang ini otomatis kembali ke Lokasi Utama (SetNull).
 */
async function loadOwnedBranch(req: Request, id: string) {
  const branch = await db.branch.findUnique({ where: { id } })
  if (!branch) return { error: 'Cabang tidak ditemukan.', status: 404 as const }
  const showroom = await db.showroom.findUnique({ where: { id: branch.showroomId } })
  if (!showroom) return { error: 'Showroom tidak ditemukan.', status: 404 as const }
  const session = requireOwnerSession(req, showroom.slug)
  if (!session) {
    return { error: 'Hanya owner yang boleh mengelola cabang.', status: 403 as const }
  }
  return { branch, showroomSlug: showroom.slug }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loaded = await loadOwnedBranch(req, id)
    if ('error' in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const body = await req.json().catch(() => ({}))
    const name = String(body.name ?? '').trim().slice(0, 60)
    const address = String(body.address ?? '').trim().slice(0, 200)
    const mapsUrlRaw = String(body.mapsUrl ?? '').trim().slice(0, 500)

    if (name.length < 3) {
      return NextResponse.json({ error: 'Nama cabang minimal 3 karakter.' }, { status: 400 })
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
      where: { showroomId: loaded.branch.showroomId, name, id: { not: id } },
    })
    if (dup) {
      return NextResponse.json(
        { error: `Cabang dengan nama "${name}" sudah ada.` },
        { status: 409 },
      )
    }

    const updated = await db.branch.update({
      where: { id },
      data: { name, address, mapsUrl: mapsUrlRaw || null },
    })
    const info: BranchInfo = {
      id: updated.id,
      name: updated.name,
      address: updated.address,
      mapsUrl: updated.mapsUrl,
    }
    return NextResponse.json({ ok: true, branch: info })
  } catch (e) {
    console.error('[admin update branch] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const loaded = await loadOwnedBranch(req, id)
    if ('error' in loaded) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status })
    }

    const unitCount = await db.vehicle.count({ where: { branchId: id } })
    await db.branch.delete({ where: { id } }) // vehicles.branchId otomatis null (SetNull)

    return NextResponse.json({
      ok: true,
      movedUnits: unitCount,
      message:
        unitCount > 0
          ? `${unitCount} unit di cabang ini otomatis kembali ke Lokasi Utama.`
          : undefined,
    })
  } catch (e) {
    console.error('[admin delete branch] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
