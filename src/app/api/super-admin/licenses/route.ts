import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import {
  generateLicenseKey,
  getSuperSecret,
  isSuperAuthorized,
  matchesSuperSecret,
} from '@/lib/super-auth'
import { SUPER_PLANS } from '@/lib/constants'
import { dbErrorResponse, safeJsonBody } from '@/lib/db-errors'

/**
 * API Super Admin — manajemen lisensi platform MotoStock.
 * Autentikasi: cookie sesi otostok_sa (utama, dari /api/super-admin/session),
 * atau header X-Super-Secret, atau query ?key= / ?secret=, atau field body
 * "key" utk POST/PATCH. Terpisah total dari sesi Owner/Admin showroom.
 *
 * JAMINAN RESPONS: setiap handler membungkus seluruh logika dalam try-catch
 * dan SELALU mengembalikan JSON valid — bahkan saat database gagal
 * (tabel belum dibuat, kredensial salah, Prisma Client tidak cocok) —
 * sehingga klien tidak pernah menerima body kosong/HTML error page.
 */

const EXTEND_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

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

/** GET: seluruh lisensi + showroom terikat + agregasi jumlah unit (aktif vs total). */
export async function GET(req: Request) {
  try {
    if (!getSuperSecret()) return envMissing()
    if (!isSuperAuthorized(req)) return unauthorized()

    const licenses = await db.license.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        showrooms: {
          select: { id: true, name: true, slug: true, ownerPhone: true, isActive: true },
        },
      },
    })

    const rows = await Promise.all(
      licenses.map(async (l) => {
        const showroom = l.showrooms[0] ?? null
        let usedUnits = 0
        let totalUnits = 0
        if (showroom) {
          const grouped = await db.vehicle.groupBy({
            by: ['status'],
            where: { showroomId: showroom.id },
            _count: { _all: true },
          })
          for (const g of grouped) {
            totalUnits += g._count._all
            if (g.status !== 'sold') usedUnits += g._count._all
          }
        }
        return {
          id: l.id,
          licenseKey: l.licenseKey,
          planType: l.planType,
          maxVehicles: l.maxVehicles,
          status: l.status,
          expiresAt: l.expiresAt?.toISOString() ?? null,
          createdAt: l.createdAt.toISOString(),
          showroom: showroom
            ? {
                id: showroom.id,
                name: showroom.name,
                slug: showroom.slug,
                ownerPhone: showroom.ownerPhone,
                isActive: showroom.isActive,
              }
            : null,
          usedUnits,
          totalUnits,
        }
      }),
    )

    return NextResponse.json({ licenses: rows, fetchedAt: new Date().toISOString() })
  } catch (e) {
    return dbErrorResponse(e, 'licenses GET')
  }
}

/** POST: generate 1 lisensi baru (format MOTO-XXXX-XXXX-XXXX) dengan status active. */
export async function POST(req: Request) {
  try {
    const body = await safeJsonBody(req)
    if (!getSuperSecret()) return envMissing()
    if (!isSuperAuthorized(req) && !matchesSuperSecret(String(body.key ?? ''))) {
      return unauthorized()
    }

    const planType = String(body.planType ?? '')
    const plan = SUPER_PLANS.find((p) => p.value === planType)
    if (!plan) {
      return NextResponse.json({ error: 'Paket lisensi tidak dikenal.' }, { status: 400 })
    }

    const maxVehicles = Number(body.maxVehicles ?? 50)
    if (!Number.isInteger(maxVehicles) || maxVehicles < 1 || maxVehicles > 10000) {
      return NextResponse.json(
        { error: 'Kuota unit harus angka bulat 1 - 10.000.' },
        { status: 400 },
      )
    }

    const expiresAt = plan.days != null ? new Date(Date.now() + plan.days * DAY_MS) : null

    // Cegah tabrakan kode (charset 32^12 — tabrakan nyaris mustahil, tetap dijaga)
    for (let attempt = 0; attempt < 5; attempt++) {
      const licenseKey = generateLicenseKey()
      const exists = await db.license.findUnique({ where: { licenseKey }, select: { id: true } })
      if (exists) continue
      const created = await db.license.create({
        data: { licenseKey, planType, maxVehicles, status: 'active', expiresAt },
      })
      return NextResponse.json(
        {
          ok: true,
          license: {
            id: created.id,
            licenseKey: created.licenseKey,
            planType: created.planType,
            maxVehicles: created.maxVehicles,
            status: created.status,
            expiresAt: created.expiresAt?.toISOString() ?? null,
            createdAt: created.createdAt.toISOString(),
          },
        },
        { status: 201 },
      )
    }

    return NextResponse.json(
      { error: 'Gagal membuat kode unik setelah beberapa percobaan. Coba lagi.' },
      { status: 500 },
    )
  } catch (e) {
    // Contoh kegagalan nyata: P2021 (tabel licenses belum dibuat di Supabase),
    // P1000/P1001 (DATABASE_URL/kredensial salah) — semuanya tercatat di log.
    return dbErrorResponse(e, 'licenses POST')
  }
}

/** PATCH: aksi cepat — perpanjang +30 hari, suspend, atau unsuspend. */
export async function PATCH(req: Request) {
  try {
    const body = await safeJsonBody(req)
    if (!getSuperSecret()) return envMissing()
    if (!isSuperAuthorized(req) && !matchesSuperSecret(String(body.key ?? ''))) {
      return unauthorized()
    }

    const id = String(body.id ?? '')
    const action = String(body.action ?? '')
    if (!id || !['extend', 'suspend', 'unsuspend'].includes(action)) {
      return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
    }

    const license = await db.license.findUnique({
      where: { id },
      include: { showrooms: { select: { id: true } } },
    })
    if (!license) {
      return NextResponse.json({ error: 'Lisensi tidak ditemukan.' }, { status: 404 })
    }
    const showroomId = license.showrooms[0]?.id ?? null

    if (action === 'extend') {
      if (!license.expiresAt) {
        return NextResponse.json(
          { error: 'Lisensi Lifetime tanpa batas waktu — tidak perlu diperpanjang.' },
          { status: 400 },
        )
      }
      // Dari sisa masa aktif, atau dari sekarang bila sudah kedaluwarsa
      const base = Math.max(license.expiresAt.getTime(), Date.now())
      const newExpires = new Date(base + EXTEND_DAYS * DAY_MS)
      const newStatus = license.status === 'expired' ? 'active' : license.status
      const updated = await db.license.update({
        where: { id },
        data: { expiresAt: newExpires, status: newStatus },
      })
      return NextResponse.json({
        ok: true,
        action,
        license: {
          id: updated.id,
          status: updated.status,
          expiresAt: updated.expiresAt?.toISOString() ?? null,
        },
      })
    }

    if (action === 'suspend') {
      if (license.status === 'suspended') {
        return NextResponse.json({ error: 'Lisensi sudah suspend.' }, { status: 409 })
      }
      await db.license.update({ where: { id }, data: { status: 'suspended' } })
      if (showroomId) {
        await db.showroom.update({ where: { id: showroomId }, data: { isActive: false } })
      }
      return NextResponse.json({ ok: true, action, status: 'suspended' })
    }

    // unsuspend — kembali aktif (atau expired bila masa berlaku sudah lewat)
    const effective =
      license.expiresAt && license.expiresAt.getTime() < Date.now() ? 'expired' : 'active'
    await db.license.update({ where: { id }, data: { status: effective } })
    if (showroomId && effective === 'active') {
      await db.showroom.update({ where: { id: showroomId }, data: { isActive: true } })
    }
    return NextResponse.json({ ok: true, action, status: effective })
  } catch (e) {
    return dbErrorResponse(e, 'licenses PATCH')
  }
}
