import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cleanupExpiredHolds } from '@/lib/holds'
import { PRIVATE_STALE_WHILE_REVALIDATE } from '@/lib/http-cache'
import { toPublicVehicle } from '@/lib/mappers'

/**
 * GET /api/showrooms/[slug]/vehicles
 * Katalog publik tim marketing.
 * GARIS BESAR KEAMANAN: endpoint ini secara struktural TIDAK PERNAH
 * mengembalikan basePrice (harga modal) — hanya harga jual + komisi.
 *
 * SISTEM REKANAN TERDAFTAR: bila showroom sudah mendaftarkan minimal 1
 * rekanan marketing, katalog hanya dilayani untuk nomor WhatsApp rekanan
 * AKTIF (header X-Mkt-Phone). Showroom tanpa rekanan tetap terbuka.
 *
 * PERFORMA:
 *  - `select` spesifik: kolom berat yang tak dipakai kartu (basePrice,
 *    arrivalPhotos, sold*, handoverPhoto) tidak pernah keluar dari DB.
 *  - Cache-Control private SWR: refresh/navigasi browser instan (stale 30s
 *    ditampilkan sambil revalidasi di background).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const showroom = await db.showroom.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      ownerPhone: true,
      logoUrl: true,
      headerUrl: true,
      mapsUrl: true,
      isActive: true,
      _count: { select: { marketings: true } },
    },
  })
  if (!showroom || !showroom.isActive) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }

  const whitelistEnabled = showroom._count.marketings > 0
  if (whitelistEnabled) {
    const phone = (req.headers.get('X-Mkt-Phone') ?? '').replace(/\D/g, '')
    const allowed = phone
      ? await db.marketing.findFirst({
          where: {
            showroomId: showroom.id,
            phoneNumber: phone,
            isActive: true,
          },
          select: { id: true },
        })
      : null
    if (!allowed) {
      return NextResponse.json(
        { error: 'Katalog hanya untuk rekanan terdaftar.', code: 'WHITELIST_REQUIRED' },
        { status: 403 },
      )
    }
  }

  // Lepas otomatis tahanan yang sudah lewat 2 jam
  await cleanupExpiredHolds(showroom.id)

  const vehicles = await db.vehicle.findMany({
    where: { showroomId: showroom.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      brand: true,
      model: true,
      category: true,
      year: true,
      licensePlate: true,
      color: true,
      odometer: true,
      taxStatus: true,
      documentStatus: true,
      sellingPrice: true,
      commissionAmount: true,
      status: true,
      photos: true,
      notes: true,
      createdAt: true,
      updatedAt: true,
      branch: { select: { id: true, name: true, address: true, mapsUrl: true } },
    },
  })

  // Cabang aktif — katalog hanya menampilkan lokasi bila showroom punya cabang
  const branches = await db.branch.findMany({
    where: { showroomId: showroom.id, isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, address: true, mapsUrl: true },
  })

  const activeBookings = await db.booking.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) }, status: 'hold' },
    select: { vehicleId: true, marketingName: true, expiresAt: true },
  })

  const holdMap = new Map<string, { marketingName: string; expiresAt: Date }>()
  const now = Date.now()
  for (const b of activeBookings) {
    if (b.expiresAt.getTime() > now) {
      holdMap.set(b.vehicleId, { marketingName: b.marketingName, expiresAt: b.expiresAt })
    }
  }

  const counts = { available: 0, hold: 0, sold: 0 }
  for (const v of vehicles) {
    if (v.status === 'available' || v.status === 'hold' || v.status === 'sold') {
      counts[v.status]++
    }
  }

  return NextResponse.json(
    {
      showroom: {
        name: showroom.name,
        slug: showroom.slug,
        address: showroom.address,
        ownerPhone: showroom.ownerPhone,
        logoUrl: showroom.logoUrl,
        headerUrl: showroom.headerUrl,
        mapsUrl: showroom.mapsUrl,
      },
      vehicles: vehicles.map((v) => toPublicVehicle(v, holdMap.get(v.id) ?? null)),
      branches,
      counts,
      fetchedAt: new Date().toISOString(),
      // true = showroom memakai whitelist rekanan (UI menampilkan sapaan personal)
      whitelistEnabled,
    },
    { headers: { 'Cache-Control': PRIVATE_STALE_WHILE_REVALIDATE } },
  )
}
