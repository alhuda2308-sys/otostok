import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireShowroomSession } from '@/lib/auth'
import { cleanupExpiredHolds, HOLD_HOURS } from '@/lib/holds'
import { toAdminVehicle } from '@/lib/mappers'
import { dbErrorResponse } from '@/lib/db-errors'

const MAX_PHOTOS = 60 // foto unit tanpa batas praktis

function toInt(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function toDate(v: unknown): Date | null {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/** String null-safe: null/undefined -> "", bukan "null". */
function safeStr(v: unknown): string {
  return v == null ? '' : String(v)
}

function toPhotoArray(v: unknown): string[] | null {
  if (v === undefined) return null
  if (!Array.isArray(v)) return []
  return v
    .filter((x: unknown): x is string => typeof x === 'string' && x.length < 2048)
    .slice(0, MAX_PHOTOS)
}

/**
 * PATCH /api/admin/vehicles/[id]
 * Update data unit (edit form / info mutasi masuk-keluar) ATAU quick-action ganti status:
 * - available -> lepas semua tahanan aktif
 * - hold      -> buat booking hold 2 jam (jika belum ada yang aktif)
 * - sold      -> konfirmasi booking aktif + set soldAt/soldPrice otomatis bila kosong
 * Hak akses: owner & admin (harga modal hanya owner).
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))

    const vehicle = await db.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Unit tidak ditemukan.' }, { status: 404 })
    }
    const showroom = await db.showroom.findUnique({ where: { id: vehicle.showroomId } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }
    const session = requireShowroomSession(req, showroom.slug)
    if (!session) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
    }
    const isOwner = session.role === 'owner'

    await cleanupExpiredHolds(vehicle.showroomId)

    const data: Record<string, unknown> = {}

    if (body.brand !== undefined) data.brand = String(body.brand).trim().slice(0, 40)
    if (body.model !== undefined) data.model = String(body.model).trim().slice(0, 80)
    if (body.category !== undefined) data.category = safeStr(body.category).trim().slice(0, 30) || null
    if (body.licensePlate !== undefined)
      data.licensePlate = String(body.licensePlate).trim().toUpperCase().slice(0, 20)
    if (body.color !== undefined) data.color = safeStr(body.color).trim().slice(0, 40) || null
    if (body.odometer !== undefined) data.odometer = toInt(body.odometer)
    if (body.taxStatus !== undefined)
      data.taxStatus = safeStr(body.taxStatus).trim().slice(0, 80) || null
    if (body.documentStatus !== undefined)
      data.documentStatus = safeStr(body.documentStatus).trim().slice(0, 80) || null
    // Harga modal: hanya owner boleh lihat/ubah
    if (isOwner && body.basePrice !== undefined) data.basePrice = toInt(body.basePrice)
    if (body.sellingPrice !== undefined) data.sellingPrice = toInt(body.sellingPrice)
    if (body.commissionAmount !== undefined) data.commissionAmount = toInt(body.commissionAmount)
    if (body.notes !== undefined) data.notes = safeStr(body.notes).trim().slice(0, 500) || null

    // Lokasi unit (cabang) — validasi milik showroom ini; null = lokasi utama
    if (body.branchId !== undefined) {
      const raw = body.branchId == null ? '' : String(body.branchId).trim()
      if (raw === '') {
        data.branchId = null
      } else {
        const br = await db.branch.findFirst({
          where: { id: raw, showroomId: showroom.id },
        })
        if (!br) {
          return NextResponse.json({ error: 'Cabang tidak valid.' }, { status: 400 })
        }
        data.branchId = raw
      }
    }

    const photos = toPhotoArray(body.photos)
    if (photos !== null) data.photos = JSON.stringify(photos)

    // --- Mutasi unit masuk ---
    if (body.purchasedAt !== undefined) {
      const d = toDate(body.purchasedAt)
      if (body.purchasedAt && !d) {
        return NextResponse.json({ error: 'Tanggal masuk tidak valid.' }, { status: 400 })
      }
      data.purchasedAt = d
    }
    if (body.arrivalNotes !== undefined)
      data.arrivalNotes = safeStr(body.arrivalNotes).trim().slice(0, 500) || null
    const arrivalPhotos = toPhotoArray(body.arrivalPhotos)
    if (arrivalPhotos !== null) data.arrivalPhotos = JSON.stringify(arrivalPhotos)

    // --- Mutasi unit keluar / penjualan ---
    if (body.soldBy !== undefined) data.soldBy = safeStr(body.soldBy).trim().slice(0, 60) || null
    if (body.soldPrice !== undefined) data.soldPrice = toInt(body.soldPrice)
    if (body.soldAt !== undefined) {
      const d = toDate(body.soldAt)
      if (body.soldAt && !d) {
        return NextResponse.json({ error: 'Tanggal laku tidak valid.' }, { status: 400 })
      }
      data.soldAt = d
    }
    if (body.handoverPhoto !== undefined)
      data.handoverPhoto = safeStr(body.handoverPhoto).trim().slice(0, 500) || null

    let nextStatus: string | null = null
    if (body.status !== undefined) {
      const s = String(body.status)
      if (s !== 'available' && s !== 'hold' && s !== 'sold') {
        return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 })
      }
      nextStatus = s
    }

    if (nextStatus && nextStatus !== vehicle.status) {
      if (nextStatus === 'available') {
        // Lepas tahanan + reset data penjualan
        await db.booking.updateMany({
          where: { vehicleId: id, status: 'hold' },
          data: { status: 'expired' },
        })
        data.soldAt = null
        data.soldPrice = null
        data.soldBy = null
        data.handoverPhoto = null
      } else if (nextStatus === 'sold') {
        // Konfirmasi deal: booking aktif -> confirmed
        await db.booking.updateMany({
          where: { vehicleId: id, status: 'hold' },
          data: { status: 'confirmed' },
        })
        // Isi data penjualan otomatis bila tidak dikirim
        if (data.soldAt === undefined && vehicle.soldAt == null) {
          data.soldAt = new Date()
        }
        if (data.soldPrice === undefined && vehicle.soldPrice == null) {
          data.soldPrice = vehicle.sellingPrice
        }
        if (data.soldBy === undefined && vehicle.soldBy == null) {
          const activeHold = await db.booking.findFirst({
            where: { vehicleId: id, status: 'confirmed' },
            orderBy: { createdAt: 'desc' },
          })
          if (activeHold) data.soldBy = activeHold.marketingName
        }
      } else if (nextStatus === 'hold') {
        // Hold manual oleh owner/admin (jika belum ada tahanan aktif)
        const active = await db.booking.findFirst({
          where: { vehicleId: id, status: 'hold', expiresAt: { gt: new Date() } },
        })
        if (!active) {
          await db.booking.create({
            data: {
              vehicleId: id,
              marketingName: String(body.marketingName ?? '').trim() || 'Owner',
              marketingPhone:
                String(body.marketingPhone ?? '').replace(/\D/g, '') ||
                showroom.ownerPhone ||
                '-',
              status: 'hold',
              expiresAt: new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000),
            },
          })
        }
      }
      data.status = nextStatus
    }

    const updated = await db.vehicle.update({ where: { id }, data, include: { branch: true } })

    const hold = await db.booking.findFirst({
      where: { vehicleId: id, status: 'hold', expiresAt: { gt: new Date() } },
    })

    return NextResponse.json({ ok: true, vehicle: toAdminVehicle(updated, hold, isOwner) })
  } catch (e) {
    // Mode diagnosa: error asli (mis. P2022 kolom belum sinkron di Supabase)
    // tampil di layar + log server, bukan pesan generik.
    return dbErrorResponse(e, 'admin-update-vehicle')
  }
}

/** DELETE /api/admin/vehicles/[id] — hapus unit (booking ikut terhapus via cascade). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const vehicle = await db.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Unit tidak ditemukan.' }, { status: 404 })
    }
    const showroom = await db.showroom.findUnique({ where: { id: vehicle.showroomId } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }
    const session = requireShowroomSession(req, showroom.slug)
    if (!session) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
    }
    await db.vehicle.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return dbErrorResponse(e, 'admin-delete-vehicle')
  }
}
