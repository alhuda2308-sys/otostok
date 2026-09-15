import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * POST /api/showrooms/[slug]/verify-marketing
 * Verifikasi Sistem Rekanan Terdaftar (Whitelist Nomor WhatsApp).
 *
 * Body: { phone: "0812..." }
 * Respons:
 *  - 200 { registered: true, marketing: { id, fullName, addressCity } }  -> nomor terdaftar & AKTIF
 *  - 403 { registered: false, reason: 'inactive' }                       -> terdaftar tapi DINONAKTIFKAN
 *  - 404 { registered: false, reason: 'not_found' }                      -> belum terdaftar
 *
 * Nomor dinormalisasi ke format internasional 62xxx sebelum dicocokkan.
 */
export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const raw = String(body.phone ?? '')
    const digits = raw.replace(/\D/g, '')
    // Terima 08xxx (lokal) atau 628xxx (internasional)
    const intl = digits.startsWith('62')
      ? digits
      : digits.startsWith('0')
        ? `62${digits.slice(1)}`
        : digits

    if (intl.length < 9 || intl.length > 15) {
      return NextResponse.json(
        { registered: false, reason: 'invalid', error: 'Nomor WhatsApp tidak valid. Gunakan format 08xxx.' },
        { status: 400 },
      )
    }

    const showroom = await db.showroom.findUnique({ where: { slug } })
    if (!showroom || !showroom.isActive) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const marketing = await db.marketing.findUnique({
      where: { showroomId_phoneNumber: { showroomId: showroom.id, phoneNumber: intl } },
    })

    if (!marketing) {
      return NextResponse.json(
        { registered: false, reason: 'not_found' },
        { status: 404 },
      )
    }
    if (!marketing.isActive) {
      return NextResponse.json(
        { registered: false, reason: 'inactive' },
        { status: 403 },
      )
    }

    return NextResponse.json({
      registered: true,
      marketing: {
        id: marketing.id,
        fullName: marketing.fullName,
        addressCity: marketing.addressCity,
      },
    })
  } catch (e) {
    console.error('[verify-marketing] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
