import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { AppFooter } from '@/components/app-footer'

export const metadata: Metadata = {
  title: {
    default: 'OtoStok — Stok & Katalog Motor Bekas',
    template: '%s — OtoStok',
  },
  description:
    'Software manajemen stok showroom motor bekas dan katalog marketing freelance. Aktivasi lisensi mandiri, katalog publik mobile-first, fitur tahan unit 2 jam.',
  applicationName: 'OtoStok',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OtoStok',
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
    <html lang="id" suppressHydrationWarning>
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <div className="flex min-h-screen flex-col">
          {children}
          <AppFooter />
        </div>
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
