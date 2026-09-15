/**
 * Seed OtoStok
 * - Lisensi demo (trial, bulanan, lifetime, expired)
 * - Showroom demo "Showroom Jaya Motor" (slug: showroom-jaya) dengan 10 unit motor
 *   (kategori & merk dari taxonomy, data mutasi masuk/keluar, 2 unit terjual utk laporan)
 * - Akun owner + admin demo, 1 booking hold aktif utk demo countdown 2 jam
 *
 * Idempotent: aman dijalankan berulang. Set SEED_FORCE=1 untuk reset data demo showroom.
 * Jalankan: bun run scripts/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync } from 'crypto'
import fs from 'fs'
import path from 'path'

const db = new PrismaClient()

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function loadVehicleImages(): Record<string, string[]> {
  try {
    const p = path.join(process.cwd(), 'agent-ctx', 'vehicle-images.json')
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return raw
  } catch {
    console.warn('⚠ agent-ctx/vehicle-images.json tidak ditemukan, seed tanpa foto.')
    return {}
  }
}

const DEMO_SLUG = 'showroom-jaya'

const DEFAULT_CATEGORIES = ['Matic', 'Bebek', 'Sport', 'Trail', 'Cruiser']
const DEFAULT_BRANDS = ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Vespa']

async function main() {
  const now = new Date()
  const images = loadVehicleImages()
  const photos = (slug: string, extra: string[] = []): string =>
    JSON.stringify([...(images[slug] ?? []), ...extra])

  // ============ LICENSES ============
  const licJaya = await db.license.upsert({
    where: { licenseKey: 'MTR-JAYA-0001' },
    update: { status: 'active', expiresAt: new Date(now.getTime() + 21 * DAY) },
    create: {
      licenseKey: 'MTR-JAYA-0001',
      planType: 'monthly',
      maxVehicles: 25,
      status: 'active',
      expiresAt: new Date(now.getTime() + 21 * DAY),
    },
  })

  await db.license.upsert({
    where: { licenseKey: 'MTR-BARU-0001' },
    update: { status: 'active', expiresAt: new Date(now.getTime() + 7 * DAY) },
    create: {
      licenseKey: 'MTR-BARU-0001',
      planType: 'trial',
      maxVehicles: 5,
      status: 'active',
      expiresAt: new Date(now.getTime() + 7 * DAY),
    },
  })

  await db.license.upsert({
    where: { licenseKey: 'MTR-LIFE-8888' },
    update: { status: 'active', expiresAt: null },
    create: {
      licenseKey: 'MTR-LIFE-8888',
      planType: 'lifetime',
      maxVehicles: 100,
      status: 'active',
      expiresAt: null,
    },
  })

  await db.license.upsert({
    where: { licenseKey: 'MTR-OLD1-1111' },
    update: { status: 'expired', expiresAt: new Date(now.getTime() - 10 * DAY) },
    create: {
      licenseKey: 'MTR-OLD1-1111',
      planType: 'monthly',
      maxVehicles: 10,
      status: 'expired',
      expiresAt: new Date(now.getTime() - 10 * DAY),
    },
  })

  console.log('✔ 4 lisensi demo siap (MTR-JAYA-0001 aktif, MTR-BARU-0001 trial, MTR-LIFE-8888 lifetime, MTR-OLD1-1111 expired)')

  // ============ SHOWROOM DEMO ============
  const existing = await db.showroom.findUnique({ where: { slug: DEMO_SLUG } })

  const showroom =
    existing ??
    (await db.showroom.create({
      data: {
        licenseId: licJaya.id,
        name: 'Showroom Jaya Motor',
        slug: DEMO_SLUG,
        ownerPhone: '6281234567890',
        address: 'Jl. Raya Bekasi KM 25, Cakung, Jakarta Timur',
        isActive: true,
        logoUrl: '/icon-1024.png',
        mapsUrl: 'https://maps.app.goo.gl/contoh-lokasi-showroom-jaya',
      },
    }))

  // Profil showroom demo: logo + maps (idempotent)
  if (!showroom.logoUrl || !showroom.mapsUrl) {
    await db.showroom.update({
      where: { id: showroom.id },
      data: {
        logoUrl: showroom.logoUrl ?? '/icon-1024.png',
        mapsUrl: showroom.mapsUrl ?? 'https://maps.app.goo.gl/contoh-lokasi-showroom-jaya',
      },
    })
  }

  console.log(`✔ Showroom demo: ${showroom.name} (/s/${showroom.slug})`)

  // ============ CABANG DEMO (lokasi unit dinamis) ============
  const demoBranches = [
    {
      key: 'bekasi',
      name: 'Cabang Bekasi',
      address: 'Jl. Raya Bekasi KM 18, Bekasi Selatan, Jawa Barat',
      mapsUrl: 'https://maps.app.goo.gl/cabang-bekasi-demo',
    },
    {
      key: 'depok',
      name: 'Cabang Depok',
      address: 'Jl. Margonda Raya No. 45, Depok, Jawa Barat',
      mapsUrl: 'https://maps.app.goo.gl/cabang-depok-demo',
    },
  ]
  const branchIds: Record<string, string> = {}
  for (const b of demoBranches) {
    const exists = await db.branch.findFirst({
      where: { showroomId: showroom.id, name: b.name },
    })
    if (exists) {
      branchIds[b.key] = exists.id
    } else {
      const created = await db.branch.create({
        data: {
          showroomId: showroom.id,
          name: b.name,
          address: b.address,
          mapsUrl: b.mapsUrl,
        },
      })
      branchIds[b.key] = created.id
    }
  }
  console.log(`✔ ${demoBranches.length} cabang demo siap (Cabang Bekasi & Cabang Depok).`)

  // ============ REKANAN MARKETING DEMO (Whitelist WhatsApp) ============
  const demoMarketings = [
    {
      key: 'deni',
      fullName: 'Deni Prasetyo',
      phoneNumber: '6281299312210', // sama dgn nomor hold demo (Pak Deni)
      addressCity: 'Jakarta Timur',
      notes: 'Spesialis motor sport — rekomendasi Mas Budi',
      isActive: true,
    },
    {
      key: 'rina',
      fullName: 'Rina Marlina',
      phoneNumber: '6281200000001',
      addressCity: 'Bekasi',
      notes: null as string | null,
      isActive: true,
    },
    {
      key: 'andi',
      fullName: 'Andi Saputra',
      phoneNumber: '6281255500777',
      addressCity: 'Depok',
      notes: 'Nonaktif sementara — kelengkapan data belum lengkap',
      isActive: false,
    },
  ]
  const marketingIds: Record<string, string> = {}
  const PARTNER_PHONES: Record<string, string> = {}
  for (const m of demoMarketings) {
    const exists = await db.marketing.findFirst({
      where: { showroomId: showroom.id, phoneNumber: m.phoneNumber },
    })
    if (exists) {
      await db.marketing.update({
        where: { id: exists.id },
        data: {
          fullName: m.fullName,
          addressCity: m.addressCity,
          notes: m.notes,
          isActive: m.isActive,
        },
      })
      marketingIds[m.key] = exists.id
    } else {
      const created = await db.marketing.create({
        data: {
          showroomId: showroom.id,
          fullName: m.fullName,
          phoneNumber: m.phoneNumber,
          addressCity: m.addressCity,
          notes: m.notes,
          isActive: m.isActive,
        },
      })
      marketingIds[m.key] = created.id
    }
    PARTNER_PHONES[m.key] = m.phoneNumber
  }
  console.log(
    `✔ ${demoMarketings.length} rekanan marketing demo siap (Deni & Rina aktif, Andi nonaktif).`,
  )

  // Hubungkan booking lama yang nomornya cocok dgn rekanan (idempotent,
  // sekalian memperbaiki data demo lama agar statistik performa akurat)
  const unlinked = await db.booking.findMany({
    where: { marketingId: null, vehicle: { showroomId: showroom.id } },
    select: { id: true, marketingPhone: true },
  })
  for (const b of unlinked) {
    const m = await db.marketing.findFirst({
      where: { showroomId: showroom.id, phoneNumber: b.marketingPhone },
      select: { id: true },
    })
    if (m) {
      await db.booking.update({ where: { id: b.id }, data: { marketingId: m.id } })
    }
  }

  // ============ AKUN STAFF DEMO ============
  const demoStaff = [
    { name: 'Owner Showroom Jaya', username: 'owner', password: 'demo1234', role: 'owner' },
    { name: 'Budi Santoso', username: 'budi', password: 'budi1234', role: 'admin' },
  ]
  for (const s of demoStaff) {
    const exists = await db.staffAccount.findFirst({
      where: { showroomId: showroom.id, username: s.username },
    })
    if (!exists) {
      await db.staffAccount.create({
        data: {
          showroomId: showroom.id,
          name: s.name,
          username: s.username,
          passwordHash: hashPassword(s.password),
          role: s.role,
          isActive: true,
        },
      })
      console.log(`✔ Akun ${s.role} demo: ${s.username} / ${s.password}`)
    }
  }

  // ============ TAXONOMY DEMO ============
  const taxonomyCount = await db.taxonomy.count({ where: { showroomId: showroom.id } })
  if (taxonomyCount === 0) {
    await db.taxonomy.createMany({
      data: [
        ...DEFAULT_CATEGORIES.map((c) => ({ showroomId: showroom.id, kind: 'category', name: c })),
        ...DEFAULT_BRANDS.map((b) => ({ showroomId: showroom.id, kind: 'brand', name: b })),
      ],
    })
    console.log('✔ Taxonomy demo: 5 kategori + 5 merk default')
  }

  // ============ UNIT MOTOR DEMO ============
  const vehicleCount = await db.vehicle.count({ where: { showroomId: showroom.id } })
  if (vehicleCount > 0 && process.env.SEED_FORCE !== '1') {
    console.log(`ℕ Showroom sudah punya ${vehicleCount} unit, skip seeding unit (pakai SEED_FORCE=1 untuk reset).`)
  } else {
    if (vehicleCount > 0) {
      await db.vehicle.deleteMany({ where: { showroomId: showroom.id } })
      console.log(`↻ SEED_FORCE: menghapus ${vehicleCount} unit lama.`)
    }

    type V = {
      slug: string
      brand: string
      model: string
      category: string
      year: number
      licensePlate: string
      color: string
      odometer: number
      taxStatus: string
      documentStatus: string
      basePrice: number
      sellingPrice: number
      commissionAmount: number
      status: 'available' | 'hold' | 'sold'
      notes: string
      arrivalNotes: string
      // lokasi unit (cabang) — undefined = lokasi utama
      branch?: 'bekasi' | 'depok'
      // rekanan marketing (whitelist WA) yang menangani unit ini
      partner?: 'deni' | 'rina'
      // penjualan (untuk laporan & mutasi keluar)
      soldDaysAgo?: number
      soldPrice?: number
      soldBy?: string
    }

    const units: V[] = [
      {
        slug: 'honda-beat-110', brand: 'Honda', model: 'Beat 110 CBS', category: 'Matic', year: 2020,
        licensePlate: 'B 4521 KZA', color: 'Hitam', odometer: 15420,
        taxStatus: 'Hidup s/d 03/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 13200000, sellingPrice: 15750000, commissionAmount: 500000,
        status: 'available', notes: 'Mesin sehat, bodi mulus, kelistrikan normal, siap pakai tanpa servicing.',
        arrivalNotes: 'Bodi mulus tanpa lecet, mesin normal, ban masih bagus.',
      },
      {
        slug: 'honda-vario-125', brand: 'Honda', model: 'Vario 125 eSP', category: 'Matic', year: 2021,
        licensePlate: 'B 3187 XYZ', color: 'Merah', odometer: 21300,
        taxStatus: 'Hidup s/d 08/2026', documentStatus: 'STNK Saja (BPKB Kreditsi)',
        basePrice: 16000000, sellingPrice: 19250000, commissionAmount: 600000,
        status: 'available', notes: 'Keyless, kondisi mulus, ban belakang baru ganti.',
        arrivalNotes: 'Kondisi istimewa, keyless lengkap, ada baret tipis di cover tengah.',
      },
      {
        slug: 'yamaha-nmax-155', brand: 'Yamaha', model: 'NMAX 155 Connected ABS', category: 'Matic', year: 2022,
        licensePlate: 'B 6721 JKA', color: 'Biru Doof', odometer: 12800,
        taxStatus: 'Hidup s/d 11/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 24500000, sellingPrice: 28500000, commissionAmount: 900000,
        status: 'available', notes: 'Full original, belum pernah tabrak, servis record teratur.',
        arrivalNotes: 'Full original, rangka & mesin belum pernah bongkar.',
        branch: 'bekasi',
      },
      {
        slug: 'yamaha-aerox-155', brand: 'Yamaha', model: 'Aerox 155 VVA S-Version', category: 'Matic', year: 2021,
        licensePlate: 'B 4902 KRS', color: 'Hitam Doff', odometer: 18900,
        taxStatus: 'Hidup s/d 05/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 23000000, sellingPrice: 26750000, commissionAmount: 850000,
        status: 'available', notes: 'Knalpot standar, mesin halus, cocok daily use.',
        arrivalNotes: 'Knalpot masih standar, baret kecil di fender belakang.',
      },
      {
        slug: 'honda-pcx-160', brand: 'Honda', model: 'PCX 160 ABS', category: 'Matic', year: 2023,
        licensePlate: 'B 1540 MRT', color: 'Silver', odometer: 6450,
        taxStatus: 'Hidup s/d 09/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 30500000, sellingPrice: 34900000, commissionAmount: 1100000,
        status: 'available', notes: 'KM rendah, seperti baru, aksesori lengkap dari dealer.',
        arrivalNotes: 'Seperti baru, KM 6 ribu, kelengkapan dealer lengkap.',
        branch: 'bekasi',
      },
      {
        slug: 'suzuki-satria-f150', brand: 'Suzuki', model: 'Satria F150', category: 'Sport', year: 2019,
        licensePlate: 'B 7213 GAN', color: 'Putih', odometer: 23700,
        taxStatus: 'Mati pajak 2 bulan', documentStatus: 'STNK Saja (BPKB Kreditsi)',
        basePrice: 12500000, sellingPrice: 15000000, commissionAmount: 550000,
        status: 'available', notes: 'Mesin standar tap, rangka original, peminat motor racing wajib lihat.',
        arrivalNotes: 'Mesin standar tap, ada baret di fairing kanan.',
        branch: 'depok',
      },
      {
        slug: 'honda-cb150-verza', brand: 'Honda', model: 'CB150 Verza', category: 'Sport', year: 2019,
        licensePlate: 'B 5308 KJD', color: 'Hitam', odometer: 26100,
        taxStatus: 'Hidup s/d 01/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 15800000, sellingPrice: 18600000, commissionAmount: 650000,
        status: 'available', notes: 'Cocok touring, kondisi mesin top, gir chain baru.',
        arrivalNotes: 'Gir chain baru diganti, mesin sehat, tidak ada rembes.',
        branch: 'depok',
      },
      {
        slug: 'yamaha-mio-sporty', brand: 'Yamaha', model: 'Mio Sporty', category: 'Matic', year: 2019,
        licensePlate: 'B 6499 DZE', color: 'Merah Maroon', odometer: 19750,
        taxStatus: 'Hidup s/d 04/2026', documentStatus: 'STNK Saja (BPKB Kreditsi)',
        basePrice: 9800000, sellingPrice: 12100000, commissionAmount: 400000,
        status: 'available', notes: 'Motor irit bahan bakar, cocok untuk pemula dan Ojol.',
        arrivalNotes: 'Kondisi baik, stang standard, mesin halus.',
      },
      {
        slug: 'honda-supra-gtr-150', brand: 'Honda', model: 'Supra GTR 150', category: 'Sport', year: 2018,
        licensePlate: 'B 3871 LMO', color: 'Abu-abu', odometer: 31200,
        taxStatus: 'Hidup s/d 06/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 16900000, sellingPrice: 20400000, commissionAmount: 700000,
        status: 'sold', notes: 'Terjual ke pelanggan lama showroom.',
        arrivalNotes: 'Mesin normal, keluhan kelistrikan sudah diperbaiki.',
        soldDaysAgo: 0, soldPrice: 20000000, soldBy: 'Rina Marlina', partner: 'rina',
      },
      {
        slug: 'kawasaki-w175', brand: 'Kawasaki', model: 'W175 TR', category: 'Cruiser', year: 2020,
        licensePlate: 'B 6892 KTR', color: 'Hijau Kawasaki', odometer: 14300,
        taxStatus: 'Hidup s/d 12/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 21500000, sellingPrice: 24800000, commissionAmount: 800000,
        status: 'sold', notes: 'Klasik retro, kondisi kolektor item, jarang dipakai.',
        arrivalNotes: 'Kondisi kolektor, cat original semua, tidak ada baret.',
        soldDaysAgo: 12, soldPrice: 24500000, soldBy: 'Deni Prasetyo', partner: 'deni',
      },
      {
        slug: 'yamaha-lexi-125', brand: 'Yamaha', model: 'Lexi 125 S-ABS', category: 'Matic', year: 2020,
        licensePlate: 'B 4106 PQX', color: 'Hitam', odometer: 17300,
        taxStatus: 'Hidup s/d 07/2026', documentStatus: 'STNK & BPKB Lengkap',
        basePrice: 15100000, sellingPrice: 17900000, commissionAmount: 550000,
        status: 'hold', notes: 'Kondisi istimewa, pajak panjang.',
        arrivalNotes: 'Kondisi istimewa, seperti baru, kelengkapan lengkap.',
      },
    ]

    let holdBookingId = ''
    for (const u of units) {
      const purchasedAt = new Date(now.getTime() - (14 + Math.floor(Math.random() * 30)) * DAY)
      const v = await db.vehicle.create({
        data: {
          showroomId: showroom.id,
          brand: u.brand,
          model: u.model,
          category: u.category,
          year: u.year,
          licensePlate: u.licensePlate,
          color: u.color,
          odometer: u.odometer,
          taxStatus: u.taxStatus,
          documentStatus: u.documentStatus,
          basePrice: u.basePrice,
          sellingPrice: u.sellingPrice,
          commissionAmount: u.commissionAmount,
          status: u.status,
          photos: photos(u.slug),
          notes: u.notes,
          purchasedAt,
          arrivalNotes: u.arrivalNotes,
          arrivalPhotos: JSON.stringify([]),
          branchId: u.branch ? (branchIds[u.branch] ?? null) : null,
          ...(u.status === 'sold'
            ? {
                soldAt: new Date(now.getTime() - (u.soldDaysAgo ?? 0) * DAY),
                soldPrice: u.soldPrice ?? u.sellingPrice,
                soldBy: u.soldBy ?? null,
              }
            : {}),
        },
      })
      if (u.status === 'hold') {
        const b = await db.booking.create({
          data: {
            vehicleId: v.id,
            marketingId: marketingIds['deni'] ?? null,
            marketingName: 'Deni Prasetyo',
            marketingPhone: '6281299312210',
            status: 'hold',
            expiresAt: new Date(Date.now() + 2 * HOUR),
          },
        })
        holdBookingId = b.id
      }
      if (u.status === 'sold') {
        const partnerKey = u.partner ?? null
        await db.booking.create({
          data: {
            vehicleId: v.id,
            marketingId: partnerKey ? (marketingIds[partnerKey] ?? null) : null,
            marketingName: u.soldBy ?? 'Marketing',
            marketingPhone: partnerKey ? (PARTNER_PHONES[partnerKey] ?? '6281200000000') : '6281200000000',
            status: 'confirmed',
            expiresAt: new Date(now.getTime() - (u.soldDaysAgo ?? 0) * DAY),
          },
        })
      }
    }
    console.log(
      `✔ ${units.length} unit motor di-seed (8 ready, 1 hold w/ booking ${holdBookingId ? 'aktif' : '-'}, 2 terjual utk demo laporan). Lokasi: 4 unit di cabang, sisanya lokasi utama.`,
    )
  }

  console.log('✅ Seed selesai.')
}

main()
  .catch((e) => {
    console.error('❌ Seed gagal:', e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
