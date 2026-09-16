import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSuperSecret, isSuperAuthorized, matchesSuperSecret } from '@/lib/super-auth'
import { dbErrorResponse, safeJsonBody } from '@/lib/db-errors'

/**
 * DELETE /api/super-admin/licenses/[id]
 * Hapus lisensi PERMANEN dari panel Super Admin.
 *
 * - Lisensi belum terikat showroom → hanya baris lisensi yang dihapus.
 * - Lisensi terikat showroom (akun aktif) → hard delete cascade: showroom
 *   beserta SELURUH data relasinya (unit kendaraan, booking/hold, akun
 *   staff, cabang, kategori/merek, rekanan marketing) dihapus bersih.
 *
 * Autentikasi: cookie sesi otostok_sa (utama), fallback header X-Super-Secret,
 * query ?key=, atau body { key } — konsisten dgn route licenses utama.
 *
 * Penghapusan dilakukan leaf-first dalam SATU transaksi (booking → vehicle →
 * staff → branch → taxonomy → marketing → showroom → license) sehingga AMAN
 * apa pun definisi ON DELETE pada foreign key database produksi (Supabase)
 * yang dibuat di luar kontrol aplikasi. Jaminan respons: SELALU JSON valid.
 */

function unauthorized() {
  return NextResponse.json(
    { error: 'Master Secret Key tidak valid atau tidak dikirim.' },
    { status: 401 },
  )
}

function envMissing() {
  return NextResponse.json(
    { error: 'SUPER_ADMIN_SECRET belum diatur di environment server.' },
    { status: 500 },
  )
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await safeJsonBody(req)
    if (!getSuperSecret()) return envMissing()
    if (!isSuperAuthorized(req) && !matchesSuperSecret(String(body.key ?? ''))) {
      return unauthorized()
    }

    if (!id) {
      return NextResponse.json({ error: 'ID lisensi wajib disertakan.' }, { status: 400 })
    }

    const license = await db.license.findUnique({
      where: { id },
      include: { showrooms: { select: { id: true, name: true, slug: true } } },
    })
    if (!license) {
      return NextResponse.json({ error: 'Lisensi tidak ditemukan.' }, { status: 404 })
    }

    const showroom = license.showrooms[0] ?? null

    const deleted = await db.$transaction(async (tx) => {
      let units = 0
      let bookings = 0
      let staff = 0
      let branches = 0
      let taxonomies = 0
      let marketings = 0

      if (showroom) {
        // 1) Booking/hold merujuk vehicle & marketing — hapus paling awal
        const vehicleIds = (
          await tx.vehicle.findMany({
            where: { showroomId: showroom.id },
            select: { id: true },
          })
        ).map((v) => v.id)
        if (vehicleIds.length) {
          bookings = await tx.booking
            .deleteMany({ where: { vehicleId: { in: vehicleIds } } })
            .then((r) => r.count)
          // 2) Unit kendaraan showroom
          units = await tx.vehicle
            .deleteMany({ where: { showroomId: showroom.id } })
            .then((r) => r.count)
        }
        // 3) Akun staff (owner/admin) — hash password ikut hilang
        staff = await tx.staffAccount
          .deleteMany({ where: { showroomId: showroom.id } })
          .then((r) => r.count)
        // 4) Cabang
        branches = await tx.branch
          .deleteMany({ where: { showroomId: showroom.id } })
          .then((r) => r.count)
        // 5) Kategori & merek custom
        taxonomies = await tx.taxonomy
          .deleteMany({ where: { showroomId: showroom.id } })
          .then((r) => r.count)
        // 6) Rekanan marketing (whitelist WA)
        marketings = await tx.marketing
          .deleteMany({ where: { showroomId: showroom.id } })
          .then((r) => r.count)
        // 7) Showroom (membuka ikatan ke lisensi)
        await tx.showroom.delete({ where: { id: showroom.id } })
      }

      // 8) Lisensi itu sendiri
      await tx.license.delete({ where: { id } })

      return {
        showroom: showroom ? { id: showroom.id, name: showroom.name, slug: showroom.slug } : null,
        units,
        bookings,
        staff,
        branches,
        taxonomies,
        marketings,
      }
    })

    console.log(
      `[super-admin/licenses DELETE] ${license.licenseKey} dihapus` +
        (showroom ? ` + showroom ${showroom.slug} (cascade)` : '') +
        ` — unit:${deleted.units} booking:${deleted.bookings} staff:${deleted.staff}`,
    )

    return NextResponse.json({ ok: true, deletedLicenseKey: license.licenseKey, ...deleted })
  } catch (e) {
    // P2003 (FK constraint) / kegagalan lain → JSON rapi + detail di log server
    return dbErrorResponse(e, 'licenses DELETE')
  }
}
