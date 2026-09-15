import type { Metadata } from 'next'
import { AdminMarketingsClient } from './marketings-client'

export const metadata: Metadata = {
  title: 'Manajemen Tim Marketing',
  robots: { index: false, follow: false },
}

export default async function AdminMarketingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminMarketingsClient slug={slug} />
    </main>
  )
}
