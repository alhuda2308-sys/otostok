'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

/**
 * Cache memori sisi-klien utk seluruh dashboard (pola SWR stale-while-revalidate):
 *  - staleTime 30 dtk  -> pindah antar-tab admin: data tampil INSTAN dari cache,
 *    tanpa skeleton "Memuat..." berulang; refresh background tetap jalan.
 *  - refetchOnWindowFocus false -> sesuai perilaku dashboard yang diminta.
 *  - gcTime 10 menit   -> cache bertahan selagi berpindah halaman.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: 10 * 60_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  )
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
