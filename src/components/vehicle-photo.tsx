'use client'

import Image from 'next/image'
import { useState } from 'react'
import { Bike } from 'lucide-react'

/**
 * Foto unit dengan fallback placeholder rapi kalau URL rusak/kosong.
 *
 * Memakai next/image (fill) sehingga:
 *  - otomatis resize ke lebar nyata di viewport (attribute srcset/sizes)
 *  - dikirim WebP/AVIF + di-cache CDN Vercel → hemat kuota jauh dibanding
 *    foto asli dari Supabase Storage
 *  - lazy-load di luar viewport secara default
 *
 * `fill` butuh parent `position: relative` yang sudah berukuran
 * (aspect-/h-/w- classes di parent) — semua call site sudah begitu.
 * `sizes` di-pass pemanggil sesuai kolom grid masing-masing.
 */
export function VehiclePhoto({
  src,
  alt,
  className = '',
  sizes = '(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw',
}: {
  src?: string
  alt: string
  className?: string
  sizes?: string
}) {
  const [error, setError] = useState(false)

  if (!src || error) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-slate-200 text-slate-400 ${className}`}
      >
        <Bike className="h-10 w-10" aria-hidden />
      </div>
    )
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes={sizes}
      className={`object-cover ${className}`}
      onError={() => setError(true)}
    />
  )
}
