import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isValidLicenseKey } from '@/lib/slug'

/**
 * GET /api/license-check?key=MOTO-XXXX-XXXX-XXXX
 * Cek cepat status lisensi untuk form aktivasi (live feedback).
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const key = (url.searchParams.get('key') ?? '').trim().toUpperCase()
  if (!isValidLicenseKey(key)) {
    return NextResponse.json({ found: false })
  }

  const license = await db.license.findUnique({
    where: { licenseKey: key },
    include: { _count: { select: { showrooms: true } } },
  })
  if (!license) {
    return NextResponse.json({ found: false })
  }

  let status = license.status
  if (status === 'active' && license.expiresAt && license.expiresAt.getTime() < Date.now()) {
    status = 'expired'
    await db.license.update({ where: { id: license.id }, data: { status: 'expired' } })
  }

  return NextResponse.json({
    found: true,
    status,
    planType: license.planType,
    maxVehicles: license.maxVehicles,
    expiresAt: license.expiresAt,
    bound: license._count.showrooms > 0,
  })
}
