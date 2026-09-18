import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/showrooms/[slug]/partner
 * Info rekanan marketing untuk PORTAL KERJA (/s/[slug]/partner) — butuh
 * verifikasi nomor WhatsApp via header X-Mkt-Phone (sama dengan API katalog).
 *
 * Respons:
 *  - 200 { marketing: { id, fullName, addressCity, code, phoneNumber } }
 *      -> nomor terdaftar & AKTIF; `code` = kode referral Personal Store
 *         (MKT-XXXXXX) untuk kartu "Toko Online Saya" di portal.
 *  - 403 { code: 'PARTNER_REQUIRED' } -> nomor tidak terdaftar/aktif di showroom ini
 *  - 404 -> showroom tidak ditemukan
 *
 * Identitas portal SENGAJA HANYA dari sesi verifikasi (X-Mkt-Phone) — BUKAN
 * dari parameter ?ref=/?mkt= yang bersifat publik (link toko dibagikan ke
 * pembeli, tidak boleh membuka alat operasional marketing).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params

    const rawPhone = req.headers.get('x-mkt-phone') ?? ''
    const phone = rawPhone.replace(/\D/g, '')
    if (!phone) {
      return NextResponse.json(
        { code: 'PARTNER_REQUIRED', error: 'Verifikasi nomor WhatsApp diperlukan.' },
        { status: 403 },
      )
    }

    const showroom = await db.showroom.findUnique({
      where: { slug },
      select: { id: true, isActive: true },
    })
    if (!showroom || !showroom.isActive) {
      return NextResponse.json({ error: 'Showroom tidak ditemukan.' }, { status: 404 })
    }

    const marketing = await db.marketing.findUnique({
      where: { showroomId_phoneNumber: { showroomId: showroom.id, phoneNumber: phone } },
      select: {
        id: true,
        fullName: true,
        addressCity: true,
        code: true,
        phoneNumber: true,
        isActive: true,
      },
    })
    if (!marketing || !marketing.isActive) {
      return NextResponse.json(
        { code: 'PARTNER_REQUIRED', error: 'Nomor WhatsApp tidak terdaftar sebagai rekanan aktif.' },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        marketing: {
          id: marketing.id,
          fullName: marketing.fullName,
          addressCity: marketing.addressCity,
          // kode referral utk link toko personal (?ref=KODE) — bisa null
          // (rekanan lama; portal fallback ke ?mkt=<id>)
          code: marketing.code,
          phoneNumber: marketing.phoneNumber,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[partner info] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
