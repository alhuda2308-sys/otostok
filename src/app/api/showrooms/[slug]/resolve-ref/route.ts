import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

/**
 * GET /api/showrooms/[slug]/resolve-ref?ref=KODE | ?mkt=ID
 * Validasi parameter referral "Link Toko" Personal Store (Katalog Digital
 * Multi-Mitra). Dipanggil client katalog saat visitor membuka
 * /s/[slug]?ref=<kode_marketing> atau /s/[slug]?mkt=<id>.
 *
 * Respons:
 *  - 200 { registered: true, marketing: { id, fullName, addressCity, phoneNumber, code } }
 *      -> rekanan ditemukan & AKTIF di showroom ini (phoneNumber format 62xxx,
 *         siap dipakai sebagai tujuan wa.me sekaligus header X-Mkt-Phone)
 *  - 404 { registered: false, reason: 'not_found' }  -> kode/id tidak dikenal,
 *      showroom tidak ada, ATAU rekanan dinonaktifkan (client fallback ke mode Owner)
 *
 * Endpoint publik tanpa sesi: informasi yang dibuka memang ditujukan untuk
 * pembeli (nama + nomor WA mitra adalah tujuan fitur Personal Store).
 */
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await params
    const url = new URL(req.url)
    const ref = (url.searchParams.get('ref') ?? '').trim().slice(0, 40)
    const mkt = (url.searchParams.get('mkt') ?? '').trim().slice(0, 40)
    if (!ref && !mkt) {
      return NextResponse.json({ registered: false, reason: 'no_param' }, { status: 400 })
    }

    const showroom = await db.showroom.findUnique({
      where: { slug },
      select: { id: true },
    })
    if (!showroom) {
      return NextResponse.json({ registered: false, reason: 'not_found' }, { status: 404 })
    }

    const select = {
      id: true,
      fullName: true,
      addressCity: true,
      phoneNumber: true,
      code: true,
    } as const

    // ?ref= cocokkan ke kode referral; ?mkt= cocokkan langsung ke id rekanan.
    const marketing = ref
      ? await db.marketing.findFirst({
          where: { showroomId: showroom.id, code: ref, isActive: true },
          select,
        })
      : await db.marketing.findFirst({
          where: { showroomId: showroom.id, id: mkt, isActive: true },
          select,
        })

    if (!marketing) {
      return NextResponse.json({ registered: false, reason: 'not_found' }, { status: 404 })
    }

    return NextResponse.json(
      {
        registered: true,
        marketing: {
          id: marketing.id,
          fullName: marketing.fullName,
          addressCity: marketing.addressCity,
          // format 62xxx (disimpan ternormalisasi) — langsung utk wa.me & X-Mkt-Phone
          phoneNumber: marketing.phoneNumber,
          code: marketing.code,
        },
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[resolve-ref] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
