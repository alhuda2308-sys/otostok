import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'
import { DEFAULT_BRANDS, DEFAULT_CATEGORIES } from '@/lib/constants'
import { isReservedSlug, isValidLicenseKey, slugify } from '@/lib/slug'

/**
 * POST /api/activate
 * Aktivasi lisensi & pembuatan showroom.
 * Validasi: key ada, aktif, belum kedaluwarsa, belum terikat showroom lain, slug unik.
 * Sekalian: buat akun Owner (login dashboard) + kategori & merk default.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const licenseKey = String(body.licenseKey ?? '').trim().toUpperCase()
    const name = String(body.name ?? '').trim()
    const slug = slugify(String(body.slug ?? ''))
    const ownerPhone = String(body.ownerPhone ?? '').replace(/\D/g, '')
    const address = String(body.address ?? '').trim()
    const ownerPassword = String(body.ownerPassword ?? '')

    if (!isValidLicenseKey(licenseKey)) {
      return NextResponse.json(
        { error: 'Format license key tidak valid. Gunakan format MTR-XXXX-XXXX atau OTO-XXXX-XXXX-XXXX.' },
        { status: 400 },
      )
    }
    if (name.length < 3) {
      return NextResponse.json({ error: 'Nama showroom minimal 3 karakter.' }, { status: 400 })
    }
    if (slug.length < 3) {
      return NextResponse.json({ error: 'Slug URL minimal 3 karakter (huruf kecil/angka).' }, { status: 400 })
    }
    if (isReservedSlug(slug)) {
      return NextResponse.json({ error: 'Slug ini dipakai sistem, pilih slug lain.' }, { status: 400 })
    }
    if (ownerPhone.length < 9 || ownerPhone.length > 15) {
      return NextResponse.json({ error: 'Nomor WhatsApp pemilik tidak valid.' }, { status: 400 })
    }
    if (address.length < 5) {
      return NextResponse.json({ error: 'Alamat showroom wajib diisi.' }, { status: 400 })
    }
    if (ownerPassword.length < 6) {
      return NextResponse.json(
        { error: 'Password owner minimal 6 karakter — dipakai untuk login dashboard.' },
        { status: 400 },
      )
    }

    const license = await db.license.findUnique({
      where: { licenseKey },
      include: { _count: { select: { showrooms: true } } },
    })
    if (!license) {
      return NextResponse.json(
        { error: 'Lisensi tidak ditemukan. Periksa kembali license key Anda.' },
        { status: 404 },
      )
    }

    // Kedaluwarsa lazily
    let status = license.status
    if (status === 'active' && license.expiresAt && license.expiresAt.getTime() < Date.now()) {
      status = 'expired'
      await db.license.update({ where: { id: license.id }, data: { status: 'expired' } })
    }
    if (status !== 'active') {
      return NextResponse.json(
        { error: 'Lisensi sudah kedaluwarsa / tidak aktif. Hubungi distributor untuk perpanjangan.' },
        { status: 400 },
      )
    }
    if (license._count.showrooms > 0) {
      return NextResponse.json(
        { error: 'Lisensi ini sudah terikat ke showroom lain. Satu lisensi hanya untuk satu showroom.' },
        { status: 409 },
      )
    }

    const slugTaken = await db.showroom.findUnique({ where: { slug } })
    if (slugTaken) {
      return NextResponse.json(
        { error: `Slug "${slug}" sudah dipakai showroom lain. Coba slug berbeda.` },
        { status: 409 },
      )
    }

    const usernameTaken = await db.staffAccount.findFirst({
      where: { username: ownerPhone },
      // username unik per showroom, tapi hindari kebingungan dengan akun global lain
    })

    const showroom = await db.showroom.create({
      data: {
        licenseId: license.id,
        name,
        slug,
        ownerPhone,
        address,
        isActive: true,
        staff: {
          create: {
            name: 'Owner',
            username: usernameTaken ? `${ownerPhone}-${slug.slice(0, 6)}` : ownerPhone,
            passwordHash: hashPassword(ownerPassword),
            role: 'owner',
            isActive: true,
          },
        },
        taxonomies: {
          create: [
            ...DEFAULT_CATEGORIES.map((c) => ({ kind: 'category', name: c })),
            ...DEFAULT_BRANDS.map((b) => ({ kind: 'brand', name: b })),
          ],
        },
      },
      include: { staff: true },
    })

    const owner = showroom.staff.find((s) => s.role === 'owner')

    return NextResponse.json({
      ok: true,
      showroom: { id: showroom.id, name: showroom.name, slug: showroom.slug },
      ownerUsername: owner?.username ?? ownerPhone,
    })
  } catch (e) {
    console.error('[activate] error:', e)
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 })
  }
}
