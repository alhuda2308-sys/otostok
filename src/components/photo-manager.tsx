'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ImagePlus, Loader2, Star, X } from 'lucide-react'
import { VehiclePhoto } from '@/components/vehicle-photo'
import { compressImages } from '@/lib/image-compress'

const UPLOAD_BATCH = 4 // jumlah file per request (server maks 8/request)

interface PhotoManagerProps {
  photos: string[]
  onChange: (photos: string[]) => void
  /** Batas jumlah foto; default tanpa batas praktis. */
  maxPhotos?: number
  label?: string
  hint?: string
  /** Tampilkan penanda & aksi "foto utama" (hanya relevan untuk foto unit). */
  withCover?: boolean
  /**
   * Mode logo: pratinjau persegi besar (w-28 h-28 rounded-2xl) + tombol
   * "Ganti Logo" yang jelas — dipakai tab Pengaturan (logo showroom).
   */
  logoMode?: boolean
}

/**
 * Grid foto reusable: upload TANPA BATAS (batch otomatis), kompresi ringan
 * sebelum kirim, preview grid, set foto utama (cover), dan hapus satuan.
 */
export function PhotoManager({
  photos,
  onChange,
  maxPhotos = 60,
  label = 'Foto',
  hint,
  withCover = true,
  logoMode = false,
}: PhotoManagerProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string>('')

  async function onFilesPicked(files: FileList | null) {
    if (!files || files.length === 0) return
    const room = maxPhotos - photos.length
    if (room <= 0) {
      toast.error(`Maksimal ${maxPhotos} foto.`)
      return
    }
    const picked = Array.from(files).slice(0, room)
    setUploading(true)
    try {
      // 1) Kompresi ringan di browser (resize + JPEG q0.82)
      setProgress(`Mengompres 0/${picked.length}...`)
      const compressed = await compressImages(picked)

      // 2) Upload bertahap agar aman untuk banyak foto sekaligus
      const urls: string[] = []
      for (let i = 0; i < compressed.length; i += UPLOAD_BATCH) {
        const batch = compressed.slice(i, i + UPLOAD_BATCH)
        setProgress(`Mengunggah ${Math.min(i + batch.length, compressed.length)}/${compressed.length}...`)
        const fd = new FormData()
        for (const f of batch) fd.append('files', f)
        const res = await fetch('/api/upload', { method: 'POST', body: fd })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Upload foto gagal.')
        urls.push(...(j.urls as string[]))
      }

      onChange([...photos, ...urls])
      toast.success(`${urls.length} foto ditambahkan & dikompresi.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload foto gagal.')
    } finally {
      setUploading(false)
      setProgress('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function removePhoto(p: string) {
    onChange(photos.filter((x) => x !== p))
  }

  function makeCover(p: string) {
    onChange([p, ...photos.filter((x) => x !== p)])
  }

  const canAdd = photos.length < maxPhotos && !uploading

  // Mode logo: pratinjau persegi besar + tombol ganti/hapus yang mencolok.
  if (logoMode) {
    return (
      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-slate-900">{label}</span>
          {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {photos.length > 0 ? (
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
              <VehiclePhoto
                src={photos[0]}
                alt="Logo"
                sizes="112px"
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex h-28 w-28 shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs font-bold text-slate-500 hover:border-blue-500 hover:text-blue-700"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
              {uploading ? 'Mengunggah...' : 'Upload Logo'}
            </button>
          )}
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {photos.length > 0 ? 'Ganti Logo' : 'Pilih Logo'}
            </button>
            {photos.length > 0 && (
              <button
                type="button"
                onClick={() => onChange(photos.filter((x) => x !== photos[0]))}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-bold text-red-600 hover:bg-red-50"
              >
                <X className="h-4 w-4" /> Hapus Logo
              </button>
            )}
          </div>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => onFilesPicked(e.target.files)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-slate-900">
          {label}
          {photos.length > 0 && (
            <span className="ml-1.5 text-xs font-bold text-slate-400">{photos.length} foto</span>
          )}
        </span>
        {hint && <span className="text-[11px] text-slate-400">{hint}</span>}
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => {
          const isCover = withCover && i === 0
          return (
            <div
              key={p}
              className={`relative aspect-[4/3] w-full overflow-hidden rounded-md border ${
                isCover ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
              }`}
            >
              <VehiclePhoto
                src={p}
                alt={`Foto ${i + 1}`}
                sizes="(max-width: 640px) 33vw, 25vw"
                className="h-full w-full object-cover"
              />
              {isCover && (
                <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-blue-700 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-white">
                  <Star className="h-2.5 w-2.5" /> Utama
                </span>
              )}
              <button
                type="button"
                aria-label={`Hapus foto ${i + 1}`}
                onClick={() => removePhoto(p)}
                className="absolute right-1 top-1 rounded-md border border-slate-200 bg-white p-1 shadow-sm hover:bg-red-50"
              >
                <X className="h-3.5 w-3.5 text-red-600" />
              </button>
              {withCover && !isCover && (
                <button
                  type="button"
                  aria-label={`Jadikan foto utama ${i + 1}`}
                  onClick={() => makeCover(p)}
                  className="absolute bottom-1 left-1 rounded-md border border-slate-200 bg-white/95 p-1 shadow-sm hover:bg-blue-50"
                  title="Jadikan foto utama (cover)"
                >
                  <Star className="h-3.5 w-3.5 text-slate-600" />
                </button>
              )}
            </div>
          )
        })}
        {canAdd && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 px-2 text-center text-xs font-bold text-slate-500 hover:border-blue-500 hover:text-blue-700"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImagePlus className="h-5 w-5" />
            )}
            {uploading ? (
              <span className="text-[10px] leading-tight">{progress || 'Mengunggah...'}</span>
            ) : (
              <span className="leading-tight">
                Tambah Foto
                {photos.length > 0 && (
                  <span className="block text-[10px] font-semibold text-slate-400">
                    {maxPhotos - photos.length} slot lagi
                  </span>
                )}
              </span>
            )}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        hidden
        onChange={(e) => onFilesPicked(e.target.files)}
      />
      <p className="text-[11px] leading-snug text-slate-400">
        Foto dikompresi otomatis di perangkat sebelum dikirim (hemat kuota & cepat). Tidak ada
        batas jumlah foto{withCover ? ' — tandai bintang untuk foto utama katalog' : ''}.
      </p>
    </div>
  )
}
