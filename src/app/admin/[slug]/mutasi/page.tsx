import type { Metadata } from 'next'
import { AdminMutasiClient } from './mutasi-client'

export const metadata: Metadata = {
  title: 'Logbook Mutasi Unit',
  robots: { index: false, follow: false },
}

export default async function AdminMutasiPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminMutasiClient slug={slug} />
    </main>
  )
}
