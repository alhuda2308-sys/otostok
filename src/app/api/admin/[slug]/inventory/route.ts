import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PRIVATE_STALE_WHILE_REVALIDATE } from '@/lib/http-cache'
import { requireShowroomSession } from '@/lib/auth'
import { cleanupExpiredHolds } from '@/lib/holds'
import { toAdminVehicle } from '@/lib/mappers'
import type { AdminInventoryResponse, PlanType } from '@/lib/types'

/**
 * GET /api/admin/[slug]/inventory
 * Data lengkap dashboard: profil, lisensi, kuota, statistik, seluruh unit
 * (TERMASUK harga modal), dan daftar tahanan aktif.
 * Role admin: lisensi/kuota/harga modal/perputaran modal TIDAK dikirim (403 bila belum login).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
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

  await cleanupExpiredHolds(showroom.id)

  const vehicles = await db.vehicle.findMany({
    where: { showroomId: showroom.id },
    orderBy: { createdAt: 'desc' },
    // Baris vehicle utuh (dipakai toAdminVehicle); relasi branch cukup 4 kolom
    // yang tampil di UI — hemat payload pada stok besar.
    include: { branch: { select: { id: true, name: true, address: true, mapsUrl: true } } },
  })

  // Cabang showroom — dipakai filter dashboard & dropdown lokasi di form unit
  const branches = await db.branch.findMany({
    where: { showroomId: showroom.id },
    orderBy: { createdAt: 'asc' },
    select: { id: true, name: true, address: true, mapsUrl: true },
  })

  const bookings = await db.booking.findMany({
    where: { vehicle: { showroomId: showroom.id } },
    orderBy: { expiresAt: 'desc' },
    select: {
      id: true,
      vehicleId: true,
      marketingId: true,
      marketingName: true,
      marketingPhone: true,
      status: true,
      expiresAt: true,
    },
  })

  const vehicleById = new Map(vehicles.map((v) => [v.id, v]))
  const now = Date.now()
  const holds: AdminInventoryResponse['holds'] = bookings
    .filter((b) => b.status === 'hold' && b.expiresAt.getTime() > now)
    .map((b) => {
      const v = vehicleById.get(b.vehicleId)
      return {
        id: b.id,
        vehicleId: b.vehicleId,
        vehicleLabel: v ? `${v.brand} ${v.model} (${v.year})` : 'Unit',
        marketingName: b.marketingName,
        marketingPhone: b.marketingPhone,
        marketingId: b.marketingId,
        expiresAt: b.expiresAt.toISOString(),
      }
    })

  const stats = {
    available: 0,
    hold: 0,
    sold: 0,
    capitalTurnover: null as number | null,
    stockValue: 0,
  }
  let capital = 0
  for (const v of vehicles) {
    if (v.status === 'available') stats.available++
    else if (v.status === 'hold') stats.hold++
    else if (v.status === 'sold') stats.sold++
    if (v.status !== 'sold') {
      capital += v.basePrice ?? 0
      stats.stockValue += v.sellingPrice ?? 0
    }
  }
  if (isOwner) stats.capitalTurnover = capital

  const holdByVehicle = new Map<string, { marketingName: string; expiresAt: Date }>()
  for (const h of bookings) {
    if (h.status === 'hold' && h.expiresAt.getTime() > now)
      holdByVehicle.set(h.vehicleId, { marketingName: h.marketingName, expiresAt: h.expiresAt })
  }

  // Lisensi kedaluwarsa lazily
  const licenseEffective =
    showroom.license.status === 'active' &&
    showroom.license.expiresAt &&
    showroom.license.expiresAt.getTime() < now
      ? { ...showroom.license, status: 'expired' }
      : showroom.license

  const data: AdminInventoryResponse = {
    showroom: {
      id: showroom.id,
      name: showroom.name,
      slug: showroom.slug,
      address: showroom.address,
      ownerPhone: showroom.ownerPhone,
      logoUrl: showroom.logoUrl,
      headerUrl: showroom.headerUrl,
      mapsUrl: showroom.mapsUrl,
    },
    license: isOwner
      ? {
          licenseKey: licenseEffective.licenseKey,
          planType: licenseEffective.planType as PlanType,
          maxVehicles: licenseEffective.maxVehicles,
          status: licenseEffective.status,
          expiresAt: licenseEffective.expiresAt?.toISOString() ?? null,
        }
      : null,
    quota: isOwner
      ? { active: stats.available + stats.hold, max: showroom.license.maxVehicles }
      : null,
    stats,
    vehicles: vehicles.map((v) => toAdminVehicle(v, holdByVehicle.get(v.id) ?? null, isOwner)),
    holds,
    branches: branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      mapsUrl: b.mapsUrl,
    })),
  }

  return NextResponse.json(data, {
    headers: { 'Cache-Control': PRIVATE_STALE_WHILE_REVALIDATE },
  })
}
