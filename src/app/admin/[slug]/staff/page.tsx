import type { Metadata } from 'next'
import { AdminStaffClient } from './staff-client'

export const metadata: Metadata = {
  title: 'Kelola Akun Admin',
  robots: { index: false, follow: false },
}

export default async function AdminStaffPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  return (
    <main className="flex-1">
      <AdminStaffClient slug={slug} />
    </main>
  )
}
