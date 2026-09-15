import { db } from '@/lib/db'

/** Durasi hold dalam jam — sinkron dengan lib/constants. */
export const HOLD_HOURS = 2

/**
 * Lepas tahanan yang sudah lewat 2 jam:
 * booking hold -> expired, vehicle hold -> available.
 * Dipanggil lazily setiap kali data katalog/inventory dibaca.
 */
export async function cleanupExpiredHolds(showroomId?: string): Promise<void> {
  const expired = await db.booking.findMany({
    where: {
      status: 'hold',
      expiresAt: { lt: new Date() },
      ...(showroomId ? { vehicle: { showroomId } } : {}),
    },
    select: { id: true, vehicleId: true },
  })
  if (expired.length === 0) return

  await db.booking.updateMany({
    where: { id: { in: expired.map((b) => b.id) } },
    data: { status: 'expired' },
  })
  await db.vehicle.updateMany({
    where: { id: { in: expired.map((b) => b.vehicleId) }, status: 'hold' },
    data: { status: 'available' },
  })
}

/** Ambil booking hold yang masih aktif (belum kedaluwarsa) dari daftar booking. */
export function findActiveHold<
  T extends { status: string; expiresAt: Date },
>(bookings: T[]): T | null {
  const now = Date.now()
  return bookings.find((b) => b.status === 'hold' && b.expiresAt.getTime() > now) ?? null
}

/** photos disimpan sebagai JSON string di kolom text. */
export function parsePhotos(photos: string): string[] {
  try {
    const arr = JSON.parse(photos)
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}
