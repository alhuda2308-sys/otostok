import { NextResponse } from 'next/server'
import type { Booking } from '@prisma/client'
import { db } from '@/lib/db'
import { cleanupExpiredHolds } from '@/lib/holds'
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
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const showroom = await db.showroom.findUnique({
    where: { slug },
    include: { marketings: { select: { id: true } } },
  })
  if (!showroom || !showroom.isActive) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }

  const whitelistEnabled = showroom.marketings.length > 0
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
    include: { branch: true },
  })

  // Cabang aktif — katalog hanya menampilkan lokasi bila showroom punya cabang
  const branches = await db.branch.findMany({
    where: { showroomId: showroom.id, isActive: true },
    orderBy: { createdAt: 'asc' },
  })

  const activeBookings = await db.booking.findMany({
    where: { vehicleId: { in: vehicles.map((v) => v.id) }, status: 'hold' },
  })

  const holdMap = new Map<string, Booking>()
  const now = Date.now()
  for (const b of activeBookings) {
    if (b.expiresAt.getTime() > now) {
      holdMap.set(b.vehicleId, b)
    }
  }

  const counts = { available: 0, hold: 0, sold: 0 }
  for (const v of vehicles) {
    if (v.status === 'available' || v.status === 'hold' || v.status === 'sold') {
      counts[v.status]++
    }
  }

  return NextResponse.json({
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
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      mapsUrl: b.mapsUrl,
    })),
    counts,
    fetchedAt: new Date().toISOString(),
    // true = showroom memakai whitelist rekanan (UI menampilkan sapaan personal)
    whitelistEnabled,
  })
}
