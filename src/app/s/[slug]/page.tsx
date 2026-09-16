import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { cleanupExpiredHolds } from '@/lib/holds'
import { toPublicVehicle } from '@/lib/mappers'
import type { PublicCatalogResponse } from '@/lib/types'
import { CatalogClient } from './catalog-client'

/**
 * ISR (Incremental Static Regeneration):
 *  - Render pertama per slug dilayani dari server, lalu HTML+data di-cache
 *    di edge Vercel selama 60 detik → refresh berikutnya instan (<200ms),
 *    tidak menunggu cold start + query database lagi.
 *  - TIDAK ADA cookies()/headers() di file ini — penting agar halaman tetap
 *    ISR-cacheable.
 *  - KEAMANAN: data katalog hanya di-embed untuk showroom TANPA whitelist
 *    rekanan. Showroom dengan whitelist mendapat shell ter-cache; datanya
 *    tetap diambil client via API + header X-Mkt-Phone (gate tetap aktif).
 */
export const revalidate = 60

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `Katalog ${slug}`,
    description:
      'Katalog stok motor bekas untuk tim marketing — harga jelas, komisi transparan, siap diposting.',
  }
}

/**
 * Muat payload katalog langsung dari database (tanpa hop HTTP ke API sendiri).
 * Mengembalikan null bila showroom tidak ada / tidak aktif / memakai
 * whitelist rekanan (data per-nomor WA — jangan pernah di-embed di RSC).
 */
async function loadInitialCatalog(slug: string): Promise<PublicCatalogResponse | null> {
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
  if (!showroom || !showroom.isActive || showroom._count.marketings > 0) return null

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

  return {
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
    whitelistEnabled: false,
  }
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const initialData = await loadInitialCatalog(slug)
  return (
    <main className="flex-1">
      <CatalogClient slug={slug} initialData={initialData} />
    </main>
  )
}
