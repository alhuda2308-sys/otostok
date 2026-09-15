import type { Metadata } from 'next'
import { AdminClient } from './admin-client'

export const metadata: Metadata = {
  title: 'Dashboard Owner',
  description: 'Kelola stok showroom motor bekas: unit, harga modal, komisi, dan tahanan.',
  robots: { index: false, follow: false },
}

export default async function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminClient slug={slug} />
    </main>
  )
}
