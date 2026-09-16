import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { PRIVATE_STALE_WHILE_REVALIDATE } from '@/lib/http-cache'
import { requireOwnerSession, requireShowroomSession } from '@/lib/auth'

/** Bentuk rekanan yang dikirim ke dashboard — URL KTP adalah endpoint aman ber-sesi. */
function toInfo(
  m: {
    id: string
    fullName: string
    phoneNumber: string
    addressCity: string
    notes: string | null
    isActive: boolean
    createdAt: Date
    ktpPhotoUrl: string | null
    holdCount: number
    soldCount: number
  },
) {
  return {
    id: m.id,
    fullName: m.fullName,
    // tampil format lokal 08xxx di dashboard
    phoneNumber: m.phoneNumber.startsWith('62')
      ? `0${m.phoneNumber.slice(2)}`
      : m.phoneNumber,
    addressCity: m.addressCity,
    notes: m.notes,
    isActive: m.isActive,
    createdAt: m.createdAt.toISOString(),
    // URL endpoint aman — hanya terbuka utk Owner/Admin showroom ini
    ktpPhotoUrl: m.ktpPhotoUrl,
    hasKtp: !!m.ktpPhotoUrl,
    holdCount: m.holdCount,
    soldCount: m.soldCount,
  }
}

/**
 * GET /api/admin/[slug]/marketings
 * Daftar rekanan marketing + statistik performa (total ditahan & total terjual).
 * Owner & admin boleh melihat (pratinjau KTP juga terbuka utk keduanya).
 *
 * Statistik:
 *  - holdCount = semua booking yang pernah dibuat rekanan (status apa pun)
 *  - soldCount = booking rekanan yang unitnya akhirnya TERJUAL
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const session = requireShowroomSession(req, slug)
  if (!session) {
    return NextResponse.json({ error: 'Belum login.' }, { status: 401 })
  }

  const showroom = await db.showroom.findUnique({ where: { slug } })
  if (!showroom) {
    return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
  }

  const marketings = await db.marketing.findMany({
    where: { showroomId: showroom.id },
    orderBy: { createdAt: 'desc' },
    include: {
      bookings: {
        select: { status: true, vehicle: { select: { status: true } } },
      },
    },
  })

  return NextResponse.json(
    {
    marketings: marketings.map((m) => {
      const holdCount = m.bookings.length
      const soldCount = m.bookings.filter((b) => b.vehicle.status === 'sold').length
      return toInfo({
        id: m.id,
        fullName: m.fullName,
        phoneNumber: m.phoneNumber,
        addressCity: m.addressCity,
        notes: m.notes,
        isActive: m.isActive,
        createdAt: m.createdAt,
        ktpPhotoUrl: m.ktpPhotoUrl,
        holdCount,
        soldCount,
      })
    }),
    },
    { headers: { 'Cache-Control': PRIVATE_STALE_WHILE_REVALIDATE } },
  )
}

/**
 * POST /api/admin/[slug]/marketings
 * Tambah rekanan marketing baru — KHUSUS OWNER.
 * Nomor WA wajib format Indonesia 08xxx (atau 628xxx), unik per showroom.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const session = requireOwnerSession(req, slug)
    if (!session) {
      return NextResponse.json(
        { error: 'Hanya owner yang boleh mengelola rekanan marketing.' },
        { status: 403 },
      )
    }

    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom || !showroom.isActive) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const body = await req.json().catch(() => ({}))
    const fullName = String(body.fullName ?? '').trim().slice(0, 60)
    const rawPhone = String(body.phoneNumber ?? '').replace(/\D/g, '')
    const addressCity = String(body.addressCity ?? '').trim().slice(0, 60)
    const notes = String(body.notes ?? '').trim().slice(0, 300)
    const ktpPhotoUrl = String(body.ktpPhotoUrl ?? '').trim().slice(0, 500)

    if (fullName.length < 2) {
      return NextResponse.json({ error: 'Nama lengkap wajib diisi (min. 2 karakter).' }, { status: 400 })
    }

    // Normalisasi ke 62xxx untuk disimpan
    const phone = rawPhone.startsWith('62')
      ? rawPhone
      : rawPhone.startsWith('0')
        ? `62${rawPhone.slice(1)}`
        : rawPhone
    // Validasi format standar Indonesia: 08xx / 628xx, 10-14 digit lokal
    const localDigits = phone.startsWith('62') ? `0${phone.slice(2)}` : phone
    if (!localDigits.startsWith('08') || localDigits.length < 10 || localDigits.length > 14) {
      return NextResponse.json(
        { error: 'Nomor WhatsApp wajib format Indonesia 08xxx (10-14 digit).' },
        { status: 400 },
      )
    }

    if (addressCity.length < 2) {
      return NextResponse.json({ error: 'Domisili / kota asal wajib diisi.' }, { status: 400 })
    }
    if (ktpPhotoUrl && !ktpPhotoUrl.startsWith('/api/admin/')) {
      return NextResponse.json(
        { error: 'URL foto KTP tidak valid. Upload dulu melalui tombol Upload KTP.' },
        { status: 400 },
      )
    }

    const dup = await db.marketing.findFirst({
      where: { showroomId: showroom.id, phoneNumber: phone },
    })
    if (dup) {
      return NextResponse.json(
        { error: `Nomor ${localDigits} sudah terdaftar atas nama "${dup.fullName}".` },
        { status: 409 },
      )
    }

    const marketing = await db.marketing.create({
      data: {
        showroomId: showroom.id,
        fullName,
        phoneNumber: phone,
        addressCity,
        notes: notes || null,
        ktpPhotoUrl: ktpPhotoUrl || null,
        isActive: true,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[admin create marketing] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
