import type { Metadata } from 'next'
import { AdminReportsClient } from './reports-client'

export const metadata: Metadata = {
  title: 'Laporan Penjualan',
  robots: { index: false, follow: false },
}

export default async function AdminReportsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminReportsClient slug={slug} />
    </main>
  )
}
