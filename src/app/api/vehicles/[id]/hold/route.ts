import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { cleanupExpiredHolds, HOLD_HOURS } from '@/lib/holds'
import { formatClockID } from '@/lib/format'

/**
 * POST /api/vehicles/[id]/hold
 * Fitur Tahan Unit oleh marketing (publik, tanpa login).
 * Mengunci unit selama 2 jam agar tidak bentrok dengan marketing lain.
 *
 * SISTEM REKANAN TERDAFTAR: bila body menyertakan marketingId, identitas
 * (nama & WA) diambil dari data rekanan di server — bukan dari input klien —
 * dan rekanan wajib milik showroom unit tsb serta berstatus AKTIF.
 * Tanpa marketingId (showroom tanpa rekanan) tetap bisa hold manual.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    let marketingName = String(body.marketingName ?? '').trim()
    let marketingPhone = String(body.marketingPhone ?? '').replace(/\D/g, '')
    const marketingId = String(body.marketingId ?? '').trim()

    let partner: { id: string } | null = null
    if (marketingId) {
      const m = await db.marketing.findUnique({ where: { id: marketingId } })
      if (!m) {
        return NextResponse.json(
          { error: 'Data rekanan tidak ditemukan. Muat ulang halaman lalu coba lagi.' },
          { status: 403 },
        )
      }
      // Cek nanti terhadap showroom unit — dulu simpan dulu
      partner = { id: m.id }
      marketingName = m.fullName
      marketingPhone = m.phoneNumber
    }

    if (marketingName.length < 2 || marketingName.length > 40) {
      return NextResponse.json(
        { error: 'Nama marketing wajib diisi (2-40 karakter).' },
        { status: 400 },
      )
    }
    if (marketingPhone.length < 9 || marketingPhone.length > 15) {
      return NextResponse.json({ error: 'Nomor WhatsApp marketing tidak valid.' }, { status: 400 })
    }

    const vehicle = await db.vehicle.findUnique({ where: { id } })
    if (!vehicle) {
      return NextResponse.json({ error: 'Unit tidak ditemukan.' }, { status: 404 })
    }

    // marketingId wajib milik showroom unit ini dan aktif
    if (partner) {
      const m = await db.marketing.findFirst({
        where: {
          id: partner.id,
          showroomId: vehicle.showroomId,
          isActive: true,
        },
        select: { id: true },
      })
      if (!m) {
        return NextResponse.json(
          { error: 'Rekanan tidak aktif atau bukan bagian dari showroom ini.' },
          { status: 403 },
        )
      }
    }

    await cleanupExpiredHolds(vehicle.showroomId)

    const fresh = await db.vehicle.findUnique({
      where: { id },
      include: {
        bookings: { where: { status: 'hold' }, orderBy: { expiresAt: 'desc' }, take: 1 },
      },
    })
    if (!fresh) {
      return NextResponse.json({ error: 'Unit tidak ditemukan.' }, { status: 404 })
    }
    if (fresh.status === 'sold') {
      return NextResponse.json({ error: 'Unit ini sudah terjual.' }, { status: 409 })
    }
    const activeHold = fresh.bookings[0]
    if (fresh.status === 'hold' && activeHold && activeHold.expiresAt.getTime() > Date.now()) {
      return NextResponse.json(
        {
          error: `Unit sedang ditahan marketing lain sampai ${formatClockID(activeHold.expiresAt)}. Pilih unit lain atau hubungi showroom.`,
          holdExpiresAt: activeHold.expiresAt.toISOString(),
        },
        { status: 409 },
      )
    }

    const expiresAt = new Date(Date.now() + HOLD_HOURS * 60 * 60 * 1000)
    const booking = await db.$transaction(async (tx) => {
      await tx.vehicle.update({ where: { id }, data: { status: 'hold' } })
      return tx.booking.create({
        data: {
          vehicleId: id,
          marketingId: partner?.id ?? null,
          marketingName,
          marketingPhone,
          status: 'hold',
          expiresAt,
        },
      })
    })

    return NextResponse.json({
      ok: true,
      bookingId: booking.id,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (e) {
    console.error('[hold] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
