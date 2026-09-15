import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cleanupExpiredHolds } from '@/lib/holds'

/**
 * GET /api/showrooms/[slug]
 * Info publik showroom: nama, alamat, WA, ringkasan jumlah unit & daftar merek (untuk filter).
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom || !showroom.isActive) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }

  await cleanupExpiredHolds(showroom.id)

  const vehicles = await db.vehicle.findMany({
    where: { showroomId: showroom.id },
    select: { brand: true, status: true },
  })

  const counts = { available: 0, hold: 0, sold: 0 }
  const brandSet = new Set<string>()
  for (const v of vehicles) {
    if (v.status === 'available' || v.status === 'hold' || v.status === 'sold') {
      counts[v.status]++
    }
    brandSet.add(v.brand)
  }

  return NextResponse.json({
    name: showroom.name,
    slug: showroom.slug,
    address: showroom.address,
    ownerPhone: showroom.ownerPhone,
    logoUrl: showroom.logoUrl,
    headerUrl: showroom.headerUrl,
    mapsUrl: showroom.mapsUrl,
    counts,
    brands: [...brandSet].sort(),
  })
}
