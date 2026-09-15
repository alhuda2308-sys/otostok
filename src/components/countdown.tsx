'use client'

import { useEffect, useRef, useState } from 'react'
import { formatCountdown } from '@/lib/format'

/**
 * Timer hitung mundur (HH:MM:SS). Memanggil onDone satu kali saat waktu habis.
 * Render placeholder sampai mounted agar tidak hydration mismatch.
 */
export function Countdown({
  expiresAt,
  onDone,
  className = '',
}: {
  expiresAt: string
  onDone?: () => void
  className?: string
}) {
  const [now, setNow] = useState<number | null>(null)
  const doneRef = useRef(false)
  const target = new Date(expiresAt).getTime()

  useEffect(() => {
    // rAF/interval = setState dari callback eksternal, bukan sinkron di body effect
    const tick = () => setNow(Date.now())
    const raf = requestAnimationFrame(tick)
    const t = setInterval(tick, 1000)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(t)
    }
  }, [])

  useEffect(() => {
    if (now != null && target - now <= 0 && !doneRef.current) {
      doneRef.current = true
      onDone?.()
    }
  }, [now, target, onDone])

  if (now == null) return <span className={className}>--:--:--</span>
  return <span className={className}>{formatCountdown(target - now)}</span>
}
