import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireShowroomSession } from '@/lib/auth'
import { toAdminVehicle } from '@/lib/mappers'
import { dbErrorResponse } from '@/lib/db-errors'

const MAX_PHOTOS = 60 // foto unit tanpa batas praktis (penjaga kesehatan DB)

function toInt(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n) : null
}

function cleanStr(v: unknown, max = 120): string {
  return String(v ?? '').trim().slice(0, max)
}

function toDate(v: unknown): Date | null {
  if (!v || typeof v !== 'string') return null
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * POST /api/admin/[slug]/vehicles
 * Tambah unit baru dengan ENFORCE QUOTA lisensi (max_vehicles).
 * Role owner & admin bisa menambah stok; harga modal hanya owner.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireShowroomSession(req, slug)
    if (!session) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
    }
    const isOwner = session.role === 'owner'

    const showroom = await db.showroom.findUnique({ where: { slug }, include: { license: true } })
    if (!showroom || !showroom.isActive) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))

    const brand = cleanStr(body.brand, 40)
    const model = cleanStr(body.model, 80)
    const licensePlate = cleanStr(body.licensePlate, 20).toUpperCase()
    const year = toInt(body.year)

    if (brand.length < 2) {
      return NextResponse.json({ error: 'Merk motor wajib diisi.' }, { status: 400 })
    }
    if (model.length < 2) {
      return NextResponse.json({ error: 'Model/tipe motor wajib diisi.' }, { status: 400 })
    }
    if (!licensePlate || licensePlate.length < 3) {
      return NextResponse.json({ error: 'Nomor polisi wajib diisi.' }, { status: 400 })
    }
    if (year == null || year < 1980 || year > new Date().getFullYear() + 1) {
      return NextResponse.json({ error: 'Tahun motor tidak valid.' }, { status: 400 })
    }

    // Harga modal hanya boleh diisi owner
    const basePrice = isOwner ? toInt(body.basePrice) : null
    const sellingPrice = toInt(body.sellingPrice)
    const commissionAmount = toInt(body.commissionAmount)
    for (const [label, val] of [
      ['Harga modal', basePrice],
      ['Harga jual', sellingPrice],
      ['Komisi marketing', commissionAmount],
    ] as const) {
      if (val != null && val < 0) {
        return NextResponse.json({ error: `${label} tidak boleh negatif.` }, { status: 400 })
      }
    }

    // ENFORCE QUOTA: unit aktif (tersedia + ditahan) tidak boleh melebihi max_vehicles
    const activeCount = await db.vehicle.count({
      where: { showroomId: showroom.id, status: { in: ['available', 'hold'] } },
    })
    if (activeCount >= showroom.license.maxVehicles) {
      return NextResponse.json(
        {
          error: `Kuota stok penuh (${activeCount}/${showroom.license.maxVehicles} unit aktif). Tandai unit terjual atau upgrade lisensi untuk menambah stok.`,
          quota: { active: activeCount, max: showroom.license.maxVehicles },
        },
        { status: 400 },
      )
    }

    // Lokasi unit (cabang) — validasi milik showroom ini; null = lokasi utama
    let branchId: string | null = null
    if (body.branchId != null && String(body.branchId).trim() !== '') {
      const candidate = String(body.branchId).trim()
      const br = await db.branch.findFirst({
        where: { id: candidate, showroomId: showroom.id },
      })
      if (!br) {
        return NextResponse.json({ error: 'Cabang tidak valid.' }, { status: 400 })
      }
      branchId = candidate
    }

    const photos: string[] = Array.isArray(body.photos)
      ? body.photos.filter((x: unknown): x is string => typeof x === 'string' && x.length < 2048).slice(0, MAX_PHOTOS)
      : []

    const vehicle = await db.vehicle.create({
      data: {
        showroomId: showroom.id,
        brand,
        model,
        category: cleanStr(body.category, 30) || null,
        year,
        licensePlate,
        color: cleanStr(body.color, 40) || null,
        odometer: toInt(body.odometer),
        taxStatus: cleanStr(body.taxStatus, 80) || null,
        documentStatus: cleanStr(body.documentStatus, 80) || null,
        basePrice,
        sellingPrice,
        commissionAmount,
        status: 'available',
        photos: JSON.stringify(photos),
        notes: cleanStr(body.notes, 500) || null,
        branchId,
      },
      include: { branch: true },
    })

    return NextResponse.json({ ok: true, vehicle: toAdminVehicle(vehicle, null, isOwner) })
  } catch (e) {
    // Mode diagnosa: error asli (mis. P2022 kolom tabel vehicles belum sinkron
    // di Supabase) tampil di layar + log server, bukan pesan generik.
    return dbErrorResponse(e, 'admin-create-vehicle')
  }
}
