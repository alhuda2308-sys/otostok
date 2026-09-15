import type { Metadata } from 'next'
import { SuperAdminClient } from './super-admin-client'

export const metadata: Metadata = {
  title: 'Super Admin',
  robots: { index: false, follow: false },
}

/** Halaman terpisah untuk pengelola platform — bukan bagian dashboard Owner/Admin showroom. */
export default function SuperAdminPage() {
  return <SuperAdminClient />
}
