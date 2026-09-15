'use client'

import { useState } from 'react'
import { Bike } from 'lucide-react'

/** Foto unit dengan fallback placeholder rapi kalau URL rusak/kosong. */
export function VehiclePhoto({
  src,
  alt,
  className = '',
}: {
  src?: string
  alt: string
  className?: string
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
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className={className}
      onError={() => setError(true)}
    />
  )
}
