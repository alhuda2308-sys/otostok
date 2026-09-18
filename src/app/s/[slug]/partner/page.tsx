import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { PartnerClient } from './partner-client'

export const metadata: Metadata = {
  title: 'Portal Kerja Marketing — MotoStock',
  description: 'Alat kerja marketing: tahan unit, materi iklan, dan link toko personal.',
  // Halaman internal alat kerja — jangan diindeks mesin pencari
  robots: { index: false, follow: false },
}

/**
 * Portal Kerja / Pengelolaan Marketing (/s/[slug]/partner).
 *
 * Halaman INTERNAL untuk rekanan marketing (bukan katalog pembeli):
 *  - Tahan Unit (hold 2 jam)
 *  - Bagikan Materi Iklan + Salin Teks Promosi
 *  - Kartu "Toko Online Saya" (link /s/[slug]?ref=<kode> + tombol salin)
 *
 * Identitas = verifikasi nomor WhatsApp rekanan (gerbang whitelist, sesi di
 * localStorage otostok_mkt_<slug>) — sama dengan gerbang katalog. Data tidak
 * di-embed di server karena bergantung sesi; client memuat via API
 * X-Mkt-Phone (GET /partner + /vehicles).
 */
export default async function PartnerPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Validasi showroom untuk pesan 404 yang jelas (client tetap
  // memverifikasi ulang via API setelah marketing masuk).
  const showroom = await db.showroom.findUnique({
    where: { slug },
    select: { name: true, isActive: true },
  })

  return (
    <main className="flex-1">
      <PartnerClient slug={slug} showroomName={showroom?.isActive ? showroom.name : null} />
    </main>
  )
}
