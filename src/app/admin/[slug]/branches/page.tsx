import type { Metadata } from 'next'
import { AdminBranchesClient } from './branches-client'

export const metadata: Metadata = {
  title: 'Pengaturan Cabang',
  robots: { index: false, follow: false },
}

export default async function AdminBranchesPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminBranchesClient slug={slug} />
    </main>
  )
}
