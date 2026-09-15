import type { Metadata } from 'next'
import { AdminSettingsClient } from './settings-client'

export const metadata: Metadata = {
  title: 'Pengaturan Showroom',
  robots: { index: false, follow: false },
}

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminSettingsClient slug={slug} />
    </main>
  )
}
