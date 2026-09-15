import type { Metadata } from 'next'
import { ActivateClient } from './activate-client'

export const metadata: Metadata = {
  title: 'Aktivasi Lisensi',
  description:
    'Aktifkan software OtoStok untuk showroom motor bekas Anda dengan license key.',
}

export default function ActivatePage() {
  return (
    <main className="flex-1">
      <ActivateClient />
    </main>
  )
}
