import type { Branch, Vehicle } from '@prisma/client'
import type { AdminVehicle, PublicVehicle } from './types'
import { parsePhotos } from './holds'

type HoldInfo = { marketingName: string; expiresAt: Date } | null
/**
 * Vehicle + relasi branch yang DIPERSEMPIT ke 4 kolom yang tampil di UI.
 * Kompatibel untuk baris penuh (include: { branch: true }) maupun
 * include dengan select bersarang (id/name/address/mapsUrl saja).
 */
type VehicleWithBranch = Vehicle & {
  branch?: Pick<Branch, 'id' | 'name' | 'address' | 'mapsUrl'> | null
}

/**
 * Bentuk minimal yang dibutuhkan kartu katalog publik.
 * API publik memakai `select` persis seperti ini supaya kolom berat yang
 * tidak perlu (basePrice, arrivalPhotos, sold*, handoverPhoto, showroomId)
 * tidak pernah ditarik dari database.
 */
export type PublicVehicleSource = Pick<
  Vehicle,
  | 'id'
  | 'brand'
  | 'model'
  | 'category'
  | 'year'
  | 'licensePlate'
  | 'color'
  | 'odometer'
  | 'taxStatus'
  | 'documentStatus'
  | 'sellingPrice'
  | 'commissionAmount'
  | 'status'
  | 'photos'
  | 'notes'
  | 'createdAt'
  | 'updatedAt'
> & { branch?: Pick<Branch, 'id' | 'name' | 'address' | 'mapsUrl'> | null }

function toBranchInfo(b: Pick<Branch, 'id' | 'name' | 'address' | 'mapsUrl'> | null | undefined): PublicVehicle['branch'] {
  return b ? { id: b.id, name: b.name, address: b.address, mapsUrl: b.mapsUrl } : null
}

/**
 * Mapper vehicle -> bentuk publik.
 * PENTING: basePrice (harga modal) SENGAJA tidak dipetakan —
 * katalog publik tidak boleh pernah membocorkannya.
 */
export function toPublicVehicle(v: PublicVehicleSource, activeHold: HoldInfo): PublicVehicle {
  return {
    id: v.id,
    brand: v.brand,
    model: v.model,
    category: v.category,
    year: v.year,
    licensePlate: v.licensePlate,
    color: v.color,
    odometer: v.odometer,
    taxStatus: v.taxStatus,
    documentStatus: v.documentStatus,
    sellingPrice: v.sellingPrice,
    commissionAmount: v.commissionAmount,
    status: v.status as PublicVehicle['status'],
    photos: parsePhotos(v.photos),
    notes: v.notes,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    branch: toBranchInfo(v.branch),
    activeHold: activeHold
      ? {
          marketingName: activeHold.marketingName,
          expiresAt: activeHold.expiresAt.toISOString(),
        }
      : null,
  }
}

/**
 * Mapper vehicle -> bentuk admin/dashboard (lengkap termasuk harga modal & mutasi).
 * `withSensitive=false` untuk role admin: modal disembunyikan.
 */
export function toAdminVehicle(
  v: VehicleWithBranch,
  activeHold: HoldInfo,
  withSensitive = true,
): AdminVehicle {
  return {
    ...toPublicVehicle(v, activeHold),
    basePrice: withSensitive ? v.basePrice : null,
    purchasedAt: (v.purchasedAt ?? v.createdAt).toISOString(),
    arrivalNotes: v.arrivalNotes,
    arrivalPhotos: parsePhotos(v.arrivalPhotos ?? '[]'),
    soldAt: v.soldAt?.toISOString() ?? null,
    soldPrice: v.soldPrice,
    soldBy: v.soldBy,
    handoverPhoto: v.handoverPhoto,
  }
}
