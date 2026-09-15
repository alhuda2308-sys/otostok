'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Bike, ChevronLeft, ChevronRight, Download, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatKm } from '@/lib/format'
import { buildPhotoFilename, savePhotoToDevice } from '@/lib/share'
import type { PublicVehicle } from '@/lib/types'

/** Ambang geser (px) untuk pindah foto. */
const SWIPE_THRESHOLD = 56

/**
 * Galeri foto LAYAR PENUH (modal lightbox) untuk katalog marketing:
 * - Ketuk foto di kartu → galeri layar penuh, geser kanan/kiri untuk pindah.
 * - Tombol "Simpan Foto Ini" di setiap slide → unduh file JPG tunggal
 *   langsung ke perangkat (TANPA .zip). Di iOS otomatis buka tab baru
 *   agar bisa long-press → simpan ke galeri HP.
 */
export function PhotoLightbox({
  open,
  vehicle,
  index,
  onIndexChange,
  onClose,
}: {
  open: boolean
  vehicle: PublicVehicle | null
  index: number
  onIndexChange: (i: number) => void
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [dragX, setDragX] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  /** Salinan sinkron dragX utk keputusan threshold di touchend (state bisa stale). */
  const dragXRef = useRef(0)

  const photos = vehicle?.photos ?? []
  const total = photos.length
  const url = total > 0 ? photos[Math.min(index, total - 1)] : undefined

  const goPrev = useCallback(() => {
    if (total > 1) onIndexChange((index - 1 + total) % total)
  }, [index, total, onIndexChange])

  const goNext = useCallback(() => {
    if (total > 1) onIndexChange((index + 1) % total)
  }, [index, total, onIndexChange])

  // Kunci scroll body + navigasi keyboard saat lightbox terbuka
  useEffect(() => {
    if (!open) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'ArrowRight') goNext()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, goPrev, goNext])

  /** Simpan foto slide aktif sebagai file JPG tunggal. */
  async function handleSave() {
    if (!vehicle || !url) return
    setSaving(true)
    const outcome = await savePhotoToDevice(url, buildPhotoFilename(vehicle, index))
    setSaving(false)
    if (outcome === 'downloaded') {
      toast.success(`Foto ${index + 1}/${total} tersimpan sebagai file JPG.`)
    } else if (outcome === 'opened') {
      toast.info(
        'Foto dibuka di tab baru — tahan lama (long-press) foto, lalu pilih "Simpan ke Foto/Galeri".',
      )
    } else {
      toast.error('Gagal menyimpan foto. Coba lagi.')
    }
  }

  if (!open || !vehicle) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Galeri foto ${vehicle.brand} ${vehicle.model}`}
      className="fixed inset-0 z-[70] flex flex-col bg-black"
    >
      {/* Bar atas: judul unit + tutup */}
      <div className="flex h-14 shrink-0 items-center gap-3 px-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-extrabold text-white">
            {vehicle.brand} {vehicle.model}
          </p>
          <p className="truncate text-[11px] text-slate-300">
            {vehicle.year} • {vehicle.licensePlate}
            {vehicle.odometer != null ? ` • ${formatKm(vehicle.odometer)}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup galeri"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white hover:bg-white/10"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Panggung foto — geser kanan/kiri untuk pindah foto */}
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        role="group"
        aria-label="Foto unit — geser kanan/kiri untuk pindah foto"
        onTouchStart={(e) => {
          const t = e.touches[0]
          if (t) touchStart.current = { x: t.clientX, y: t.clientY }
        }}
        onTouchMove={(e) => {
          const start = touchStart.current
          const t = e.touches[0]
          if (start && t) {
            const dx = t.clientX - start.x
            dragXRef.current = dx
            setDragX(dx)
          }
        }}
        onTouchEnd={() => {
          const dx = dragXRef.current
          if (dx <= -SWIPE_THRESHOLD) goNext()
          else if (dx >= SWIPE_THRESHOLD) goPrev()
          dragXRef.current = 0
          setDragX(0)
          touchStart.current = null
        }}
      >
        <div
          className="flex h-full w-full items-center justify-center px-1"
          style={{
            transform: `translateX(${dragX}px)`,
            transition: dragX === 0 ? 'transform 180ms ease' : 'none',
          }}
        >
          {url ? (
            <LightboxImage
              key={url}
              src={url}
              alt={`Foto ${index + 1} dari ${total} — ${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
            />
          ) : (
            <div
              role="img"
              aria-label="Foto tidak tersedia"
              className="flex h-40 w-40 items-center justify-center rounded-lg bg-slate-800 text-slate-500"
            >
              <Bike className="h-10 w-10" aria-hidden />
            </div>
          )}
        </div>

        {total > 1 && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={goPrev}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.92)] p-2.5 text-slate-900 shadow hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={goNext}
              onTouchStart={(e) => e.stopPropagation()}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-[rgba(255,255,255,0.92)] p-2.5 text-slate-900 shadow hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <span className="absolute bottom-3 right-3 rounded bg-[rgba(15,23,42,0.88)] px-2 py-0.5 text-xs font-bold tabular-nums text-white">
              {index + 1}/{total}
            </span>
          </>
        )}
      </div>

      {/* Titik indikator foto */}
      {total > 1 && (
        <div className="scrollbar-thin flex shrink-0 justify-center gap-1.5 overflow-x-auto px-4 py-2">
          {photos.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              aria-label={`Buka foto ${i + 1}`}
              aria-current={i === index}
              onClick={() => onIndexChange(i)}
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                i === index ? 'bg-white' : 'bg-[rgba(255,255,255,0.45)]'
              }`}
            />
          ))}
        </div>
      )}

      {/* Bar bawah: simpan foto tunggal (.jpg) — tanpa ZIP */}
      <div className="shrink-0 border-t border-[rgba(255,255,255,0.12)] px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
        <Button
          type="button"
          className="h-11 w-full bg-white text-xs font-extrabold text-slate-900 hover:bg-slate-200"
          onClick={handleSave}
          disabled={saving || !url}
        >
          {saving ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Download className="mr-1.5 h-4 w-4" aria-hidden />
          )}
          Simpan Foto Ini (.jpg)
        </Button>
        <p className="mt-2 text-center text-[11px] leading-snug text-slate-400">
          File JPG tunggal, tanpa ZIP. Bisa juga tahan lama (long-press) foto untuk menyimpan
          langsung ke galeri HP.
        </p>
      </div>
    </div>
  )
}

/** Gambar slide dengan placeholder gelap bila URL rusak — state error ter-reset otomatis via key={url}. */
function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false)

  if (error) {
    return (
      <div
        role="img"
        aria-label="Foto tidak tersedia"
        className="flex h-40 w-40 items-center justify-center rounded-lg bg-slate-800 text-slate-500"
      >
        <Bike className="h-10 w-10" aria-hidden />
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={alt}
      className="max-h-full max-w-full select-none object-contain"
      draggable={false}
      onError={() => setError(true)}
    />
  )
}
