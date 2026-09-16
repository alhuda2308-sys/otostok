import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'MotoStock — Stok & Katalog Motor Bekas',
    short_name: 'MotoStock',
    description:
      'Manajemen stok showroom motor bekas & katalog marketing freelance dengan sistem lisensi mandiri.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1d4ed8',
    icons: [
      {
        src: '/icon-1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
