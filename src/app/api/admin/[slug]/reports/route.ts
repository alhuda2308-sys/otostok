import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { requireShowroomSession } from '@/lib/auth'
import { parsePhotos } from '@/lib/holds'
import type { ReportItem, ReportsResponse } from '@/lib/types'

/**
 * GET /api/admin/[slug]/reports?from=ISO&to=ISO
 * Laporan penjualan dalam rentang waktu (berdasarkan soldAt).
 * Role admin TIDAK menerima basePrice/margin (hak akses terbatas).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireShowroomSession(req, slug)
    if (!session) {
      return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
    }
    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const url = new URL(req.url)
    const fromRaw = url.searchParams.get('from')
    const toRaw = url.searchParams.get('to')
    const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - 30 * 86400000)
    const to = toRaw ? new Date(toRaw) : new Date()
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
      return NextResponse.json({ error: 'Rentang tanggal tidak valid.' }, { status: 400 })
    }
    // "to" adalah akhir hari -> geser ke 23:59:59.999
    const toEnd = new Date(to)
    toEnd.setHours(23, 59, 59, 999)

    const vehicles = await db.vehicle.findMany({
      where: {
        showroomId: showroom.id,
        status: 'sold',
        soldAt: { gte: from, lte: toEnd },
      },
      orderBy: { soldAt: 'desc' },
    })

    const isOwner = session.role === 'owner'
    const items: ReportItem[] = vehicles.map((v) => {
      const base = v.basePrice ?? 0
      const deal = v.soldPrice ?? v.sellingPrice ?? 0
      const commission = v.commissionAmount ?? 0
      return {
        id: v.id,
        brand: v.brand,
        model: v.model,
        licensePlate: v.licensePlate,
        soldAt: (v.soldAt ?? v.createdAt).toISOString(),
        soldPrice: deal,
        commissionAmount: commission,
        basePrice: isOwner ? base : null,
        margin: isOwner ? deal - base - commission : null,
        soldBy: v.soldBy,
        photo: parsePhotos(v.photos)[0] ?? null,
      }
    })

    let omzet = 0
    let commission = 0
    let capital = 0
    for (const it of items) {
      omzet += it.soldPrice
      commission += it.commissionAmount
      capital += it.basePrice ?? 0
    }

    const data: ReportsResponse = {
      from: from.toISOString(),
      to: toEnd.toISOString(),
      items,
      totals: {
        count: items.length,
        omzet,
        commission,
        capital: isOwner ? capital : null,
        margin: isOwner ? omzet - capital - commission : null,
      },
    }
    return NextResponse.json(data)
  } catch (e) {
    console.error('[reports] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
