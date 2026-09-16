import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { dbErrorResponse } from '@/lib/db-errors'
import { hashPassword } from '@/lib/auth'
import { DEFAULT_BRANDS, DEFAULT_CATEGORIES } from '@/lib/constants'
import { isReservedSlug, isValidLicenseKey, slugify } from '@/lib/slug'

/**
 * POST /api/activate
 * Aktivasi lisensi & pembuatan showroom.
 * Validasi: key ada, aktif, belum kedaluwarsa, belum terikat showroom lain, slug unik.
 * Sekalian: buat akun Owner (login dashboard) + kategori & merk default.
 *
 * Urutan yang dijamin:
 *   1. SEMUA input divalidasi dulu (licenseKey, name, slug, phone, address,
 *      password) — sebelum satu pun query database dijalankan.
 *   2. Cek slug memakai findFirst (bukan findUnique) — tidak bergantung pada
 *      index/constraint UNIQUE di database produksi (DB Supabase lama yang
 *      dibuat di luar supabase/schema.sql bisa kekurangan index/kolom →
 *      findUnique({ where: { slug } }) gagal, mis. P2022/P2021).
 *   3. showroom.create memakai licenseId dari lisensi yang SUDAH diverifikasi
 *      (ada, aktif, belum terikat). id showroom TIDAK dikirim manual — Prisma
 *      mengisi dari @default(uuid()) schema Postgres (UUIDv4 utk kolom UUID
 *      Supabase, lihat commit b98ccd8).
 *   4. catch → dbErrorResponse: error Prisma asli (kode + pesan) tampil di
 *      layar aktivasi, bukan disembunyikan di balik "kesalahan server".
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
        { error: 'Format license key tidak valid. Gunakan format MOTO-XXXX-XXXX-XXXX (kode lama OTO-/MTR- tetap valid).' },
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

    // findFirst + select minimal: aman utk DB produksi apa pun kondisi
    // index/kolomnya (lihat komentar header); cukup tahu "ada atau tidak".
    const slugTaken = await db.showroom.findFirst({
      where: { slug },
      select: { id: true },
    })
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

    // licenseId = id lisensi TERVERIKASI di atas (ada, aktif, belum terikat).
    // id showroom diisi Prisma via @default(uuid()) — UUIDv4 konsisten dgn
    // kolom UUID Supabase (jangan kirim cuid/nanoid manual di sini).
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
    // Mode diagnosa (selaras dgn route super-admin): kode error Prisma asli
    // (P2022 kolom tidak cocok, P2021 tabel belum ada, P2002 duplikat, dst.)
    // dikirim apa adanya + pesan ramah — supaya drift DB produksi langsung
    // terlihat di layar /activate tanpa harus buka log server.
    return dbErrorResponse(e, 'activate')
  }
}
