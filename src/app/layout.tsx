import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { AppFooter } from '@/components/app-footer'
import { QueryProvider } from '@/components/query-provider'

export const metadata: Metadata = {
  title: {
    default: 'MotoStock — Stok & Katalog Motor Bekas',
    template: '%s — MotoStock',
  },
  description:
    'Software manajemen stok showroom motor bekas dan katalog marketing freelance. Aktivasi lisensi mandiri, katalog publik mobile-first, fitur tahan unit 2 jam.',
  applicationName: 'MotoStock',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'MotoStock',
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4ed8',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id" className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <div className="flex min-h-screen flex-col">
          <QueryProvider>{children}</QueryProvider>
          <AppFooter />
        </div>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
