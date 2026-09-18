'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Camera,
  ClipboardCopy,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  MapPin,
  MessageCircle,
  Search,
  Share2,
} from 'lucide-react'
import { Countdown } from '@/components/countdown'
import { HoldDialog } from '@/components/hold-dialog'
import { MarketingGate } from '@/components/marketing-gate'
import { PhotoLightbox } from '@/components/photo-lightbox'
import { StatusBadge } from '@/components/status-badge'
import { VehicleDetailModal } from '@/components/vehicle-detail-modal'
import { VehiclePhoto } from '@/components/vehicle-photo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  buildAdText,
  buildUnitInquiryText,
  copyToClipboard,
  formatDateTimeID,
  formatKm,
  formatRupiah,
  isTaxAlive,
  waLink,
} from '@/lib/format'
import { shareVehicleAd } from '@/lib/share'
import {
  clearMarketingSession,
  loadMarketingSession,
  saveMarketingSession,
} from '@/lib/marketing-session'
import type {
  MarketingSession,
  PublicCatalogResponse,
  PublicVehicle,
  TaxonomyResponse,
} from '@/lib/types'

export type StatusFilter = 'all' | 'available' | 'hold'

export function CatalogClient({
  slug,
  initialData,
}: {
  slug: string
  /** Payload dari server (ISR /s/[slug]) — katalog non-whitelist tampil instan tanpa fetch awal. */
  initialData?: PublicCatalogResponse | null
}) {
  const [data, setData] = useState<PublicCatalogResponse | null>(initialData ?? null)
  const [loading, setLoading] = useState(!initialData)
  const [error, setError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  // Sistem Rekanan Terdaftar: sesi verifikasi WhatsApp marketing
  const [marketing, setMarketing] = useState<MarketingSession | null>(null)
  const [phase, setPhase] = useState<'checking' | 'gate' | 'open'>(
    // initialData non-null = showroom tanpa whitelist → konten sudah ter-render SSR
    initialData ? 'open' : 'checking',
  )
  const marketingRef = useRef<MarketingSession | null>(null)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [brandFilter, setBrandFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [branchFilter, setBranchFilter] = useState<string>('all') // all | main | branchId
  const [q, setQ] = useState('')
  const [holdTarget, setHoldTarget] = useState<PublicVehicle | null>(null)
  const [gallery, setGallery] = useState<{ vehicle: PublicVehicle; index: number } | null>(null)
  /** ID unit yang modal detailnya terbuka — objek unit DIDERIVASI dari data terbaru,
   *  sehingga konten modal ikut segar saat auto-refresh (mis. hold kedaluwarsa → Ready). */
  const [detailId, setDetailId] = useState<string | null>(null)
  /** true = modal sedang memutar animasi keluar (data unit baru dilepas setelah selesai). */
  const [detailClosing, setDetailClosing] = useState(false)
  const detailCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null)

  const refetch = useCallback(
    async (silent = false, session?: MarketingSession | null) => {
      if (!silent) setLoading(true)
      try {
        const mkt = session ?? marketingRef.current
        const res = await fetch(`/api/showrooms/${slug}/vehicles`, {
          cache: 'no-store',
          ...(mkt ? { headers: { 'X-Mkt-Phone': mkt.phone } } : {}),
        })
        if (res.status === 404) {
          setNotFound(true)
          return
        }
        if (res.status === 403) {
          const j = await res.json().catch(() => ({}))
          if (j.code === 'WHITELIST_REQUIRED') {
            // Nomor sesi tidak lagi terdaftar/aktif — paksa verifikasi ulang
            clearMarketingSession(slug)
            marketingRef.current = null
            setMarketing(null)
            setPhase('gate')
            return
          }
          throw new Error(j.error || 'Akses katalog ditolak.')
        }
        if (!res.ok) {
          const j = await res.json().catch(() => ({}))
          throw new Error(j.error || 'Gagal memuat katalog.')
        }
        setData(await res.json())
        setError(null)
        setPhase('open')
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : 'Gagal memuat katalog.')
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [slug],
  )

  useEffect(() => {
    // Baca sesi rekanan dari localStorage — marketing tidak perlu mengetik ulang nomor
    const cached = loadMarketingSession(slug)
    marketingRef.current = cached
    setMarketing(cached)
    // Dengan initialData (ISR) konten sudah tampil → refresh SILENT agar kartu
    // tidak berkedip; status hold terbaru tetap diperbarui di background.
    refetch(Boolean(initialData), cached)
  }, [refetch, slug, initialData])

  // Filter kategori & merek dari konfigurasi showroom (bisa ditambah owner)
  useEffect(() => {
    fetch(`/api/showrooms/${slug}/taxonomy`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTaxonomy(j))
      .catch(() => {})
  }, [slug])

  // Auto-refresh: tahanan kedaluwarsa harus kembali Ready tanpa manual refresh
  useEffect(() => {
    const iv = setInterval(() => refetch(true), 30000)
    const onVis = () => {
      if (document.visibilityState === 'visible') refetch(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [refetch])

  const brands = useMemo(() => {
    // Gabung taxonomy (urutan owner) + nilai faktual di stok (antisipasi data lama)
    const inStock = [...new Set((data?.vehicles ?? []).map((v) => v.brand))].sort()
    const all = [...new Set([...(taxonomy?.brands ?? []), ...inStock])]
    return all
  }, [data, taxonomy])

  const categories = useMemo(() => {
    const inStock = [
      ...new Set((data?.vehicles ?? []).map((v) => v.category).filter((c): c is string => !!c)),
    ].sort()
    return [...new Set([...(taxonomy?.categories ?? []), ...inStock])]
  }, [data, taxonomy])

  // Cabang aktif — UI lokasi (badge, filter, Maps) otomatis hilang bila kosong
  const branches = data?.branches ?? []
  const hasBranches = branches.length > 0

  /** Unit utk modal detail — diambil dari data TERBARU (bukan snapshot lama). */
  const detailTarget = useMemo(
    () => data?.vehicles.find((v) => v.id === detailId) ?? null,
    [data, detailId],
  )

  /** Buka modal detail unit — batal animasi keluar yang masih berjalan (bila ada). */
  function openDetail(id: string) {
    if (detailCloseTimer.current) {
      clearTimeout(detailCloseTimer.current)
      detailCloseTimer.current = null
    }
    setDetailClosing(false)
    setDetailId(id)
  }

  /** Tutup modal — tunggu animasi keluar (±320ms) selesai baru lepas data unit. */
  function closeDetail() {
    setDetailClosing(true)
    detailCloseTimer.current = setTimeout(() => {
      setDetailId(null)
      setDetailClosing(false)
      detailCloseTimer.current = null
    }, 320)
  }

  // Bersihkan timer tutup-modal saat katalog unmount
  useEffect(() => {
    return () => {
      if (detailCloseTimer.current) clearTimeout(detailCloseTimer.current)
    }
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const query = q.trim().toLowerCase()
    return data.vehicles.filter((v) => {
      if (statusFilter === 'available' && v.status !== 'available') return false
      if (statusFilter === 'hold' && v.status !== 'hold') return false
      if (brandFilter !== 'all' && v.brand !== brandFilter) return false
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false
      if (branchFilter === 'main' && v.branch) return false
      if (branchFilter !== 'all' && branchFilter !== 'main' && v.branch?.id !== branchFilter)
        return false
      if (!query) return true
      return [v.brand, v.model, v.licensePlate, String(v.year)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    })
  }, [data, statusFilter, brandFilter, categoryFilter, branchFilter, q])

  async function handleCopy(v: PublicVehicle) {
    if (!data) return
    const ok = await copyToClipboard(buildAdText(v, data.showroom))
    if (ok) toast.success('Iklan disalin! Tinggal paste ke WhatsApp Status / Marketplace.')
    else toast.error('Gagal menyalin. Coba lagi.')
  }

  /** Verifikasi rekanan sukses — simpan sesi di localStorage lalu buka katalog. */
  function handleVerified(s: MarketingSession) {
    saveMarketingSession(slug, s)
    marketingRef.current = s
    setMarketing(s)
    setPhase('open')
    refetch(false, s)
  }

  /** Keluar / ganti nomor WhatsApp. */
  function handleChangeNumber() {
    clearMarketingSession(slug)
    marketingRef.current = null
    setMarketing(null)
    setData(null)
    setPhase('gate')
  }

  if (notFound) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <Camera className="h-10 w-10 text-slate-300" aria-hidden />
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">Katalog tidak ditemukan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Katalog dengan alamat <code className="font-bold">/s/{slug}</code> tidak terdaftar
          atau sudah dinonaktifkan.
        </p>
      </div>
    )
  }

  // ============ Gerbang rekanan: layar verifikasi nomor WhatsApp ============
  if (phase === 'gate') {
    return <MarketingGate slug={slug} onVerified={handleVerified} />
  }

  // Fase checking: skeleton layar penuh (hindari kedipan katalog sebelum gate diputuskan)
  if (phase === 'checking') {
    return (
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 px-4 py-10">
        <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      </div>
    )
  }

  const showroom = data?.showroom

  return (
    <>
      {/* Header katalog */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-3 px-4">
          {showroom?.logoUrl && (
            <img
              src={showroom.logoUrl}
              alt={`Logo ${showroom.name}`}
              className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-extrabold text-slate-900">
              {showroom?.name ?? 'Memuat katalog...'}
            </h1>
            <p className="truncate text-xs text-slate-500">{showroom?.address ?? '\u00A0'}</p>
          </div>
          {showroom?.mapsUrl && (
            <a
              href={showroom.mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-xs font-extrabold text-slate-700 hover:bg-slate-50"
              title="Buka lokasi di Google Maps"
            >
              <MapPin className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Maps</span>
            </a>
          )}
          {showroom && (
            <a
              href={waLink(
                showroom.ownerPhone,
                `Halo ${showroom.name}, saya lihat katalog MotoStock Anda. Ada unit yang menarik.`,
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-xs font-extrabold text-white hover:bg-emerald-800"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Chat Showroom</span>
            </a>
          )}
        </div>
        {/* Foto header katalog (diatur owner di Pengaturan Showroom) */}
        {showroom?.headerUrl && (
          <div className="mx-auto max-h-44 w-full max-w-5xl overflow-hidden sm:max-h-56">
            <img
              src={showroom.headerUrl}
              alt={`Foto header ${showroom.name}`}
              className="h-44 w-full object-cover sm:h-56"
            />
          </div>
        )}
        {/* Sapaan personal rekanan — hanya bila showroom memakai whitelist */}
        {marketing && (
          <div className="mx-auto w-full max-w-5xl border-t border-slate-200 bg-blue-50">
            <div className="flex h-10 items-center justify-between gap-2 px-4">
              <p className="truncate text-xs font-extrabold text-blue-900">
                <BadgeCheck className="mr-1 inline h-3.5 w-3.5 text-blue-700" aria-hidden />
                Halo, {marketing.fullName} ({marketing.addressCity})
              </p>
              <button
                type="button"
                onClick={handleChangeNumber}
                className="shrink-0 text-[11px] font-bold text-blue-700 underline hover:text-blue-900"
              >
                Ganti Nomor
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Filter */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-5xl space-y-2 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari model atau plat nomor..."
                className="h-10 pl-9"
                aria-label="Cari unit di katalog"
              />
            </div>
            {data && (
              <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">
                Diperbarui {formatDateTimeID(data.fetchedAt)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                aria-pressed={statusFilter === 'all'}
                className={`h-9 rounded-md px-3 text-xs font-bold ${
                  statusFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Semua{data ? ` (${data.vehicles.length})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('available')}
                aria-pressed={statusFilter === 'available'}
                className={`h-9 rounded-md px-3 text-xs font-bold ${
                  statusFilter === 'available'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ready{data ? ` (${data.counts.available})` : ''}
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('hold')}
                aria-pressed={statusFilter === 'hold'}
                className={`h-9 rounded-md px-3 text-xs font-bold ${
                  statusFilter === 'hold'
                    ? 'bg-amber-500 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Ditahan{data ? ` (${data.counts.hold})` : ''}
              </button>
            </div>
          </div>

          {/* Chip kategori */}
          {categories.length > 0 && (
            <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1" role="group" aria-label="Filter kategori">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                  categoryFilter === 'all'
                    ? 'border-blue-700 bg-blue-700 text-white'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                Semua Kategori
              </button>
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoryFilter(c)}
                  className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                    categoryFilter === c
                      ? 'border-blue-700 bg-blue-700 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {brands.length > 1 && (
            <div className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setBrandFilter('all')}
                className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                  brandFilter === 'all'
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                Semua Merek
              </button>
              {brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBrandFilter(b)}
                  className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                    brandFilter === b
                      ? 'border-slate-900 bg-slate-900 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          )}

          {/* Chip lokasi cabang — hanya tampil bila showroom punya cabang */}
          {hasBranches && (
            <div
              className="scrollbar-thin flex gap-1.5 overflow-x-auto pb-1"
              role="group"
              aria-label="Filter lokasi cabang"
            >
              <button
                type="button"
                onClick={() => setBranchFilter('all')}
                className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                  branchFilter === 'all'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                Semua Lokasi
              </button>
              <button
                type="button"
                onClick={() => setBranchFilter('main')}
                className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                  branchFilter === 'main'
                    ? 'border-emerald-700 bg-emerald-700 text-white'
                    : 'border-slate-300 bg-white text-slate-600'
                }`}
              >
                Lokasi Utama
              </button>
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBranchFilter(b.id)}
                  className={`h-8 shrink-0 rounded-md border px-3 text-xs font-bold ${
                    branchFilter === b.id
                      ? 'border-emerald-700 bg-emerald-700 text-white'
                      : 'border-slate-300 bg-white text-slate-600'
                  }`}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daftar unit */}
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-4">
        {loading && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white"
              >
                <div className="aspect-[4/3] animate-pulse bg-slate-200" />
                <div className="space-y-2 p-3">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                  <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200" />
                  <div className="h-6 w-2/3 animate-pulse rounded bg-slate-200" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-800">{error}</p>
            <Button
              variant="outline"
              className="mt-3 h-10 border-red-300 text-xs font-bold"
              onClick={() => refetch()}
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {data && !loading && filtered.length === 0 && (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <Search className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm font-bold text-slate-700">
              {data.vehicles.length === 0
                ? 'Belum ada unit di katalog ini.'
                : 'Tidak ada unit yang cocok dengan filter.'}
            </p>
          </div>
        )}

        {data && !loading && filtered.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((v) => (
              <CatalogCard
                key={v.id}
                v={v}
                showroom={data.showroom}
                showLocation={hasBranches}
                fallbackLocName={showroom?.name ?? ''}
                fallbackLocMaps={showroom?.mapsUrl ?? null}
                onCopy={() => handleCopy(v)}
                onHold={() => setHoldTarget(v)}
                onOpenDetail={() => openDetail(v.id)}
                onHoldExpired={() => refetch(true)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialog hold — mode rekanan (konfirmasi identitas otomatis) / mode manual */}
      <HoldDialog
        vehicle={holdTarget}
        open={holdTarget != null}
        onOpenChange={(o) => !o && setHoldTarget(null)}
        onSuccess={() => refetch(true)}
        session={marketing}
      />

      {/* Galeri foto LAYAR PENUH — geser kanan/kiri, simpan foto tunggal per slide */}
      <PhotoLightbox
        open={gallery != null}
        vehicle={gallery?.vehicle ?? null}
        index={gallery?.index ?? 0}
        onIndexChange={(i) => setGallery((g) => (g ? { ...g, index: i } : g))}
        onClose={() => setGallery(null)}
      />

      {/* Modal detail unit — data dari state client (instan, tanpa fetch baru).
          Klik foto di modal → lightbox layar penuh di atasnya (z-[70] > z-[60]).
          Modal dilepas SETELAH animasi keluar selesai (closeDetail). */}
      {detailTarget && (
        <VehicleDetailModal
          vehicle={detailTarget}
          open={!detailClosing}
          showroom={
            data ? { name: data.showroom.name, ownerPhone: data.showroom.ownerPhone } : null
          }
          showLocation={hasBranches}
          suspendEscape={gallery != null}
          onClose={closeDetail}
          onHoldExpired={() => refetch(true)}
          onOpenLightbox={(i) => setGallery({ vehicle: detailTarget, index: i })}
        />
      )}
    </>
  )
}

function CatalogCard({
  v,
  showroom,
  showLocation,
  fallbackLocName,
  fallbackLocMaps,
  onCopy,
  onHold,
  onOpenDetail,
  onHoldExpired,
}: {
  v: PublicVehicle
  /** Data showroom untuk caption materi iklan (Web Share API). */
  showroom: { name: string; address: string; ownerPhone: string }
  /** True hanya bila showroom punya cabang (multi-lokasi). */
  showLocation: boolean
  fallbackLocName: string
  fallbackLocMaps: string | null
  onCopy: () => void
  onHold: () => void
  /** Buka Modal Detail Unit (juga dipicu klik di area kartu manapun). */
  onOpenDetail: () => void
  onHoldExpired: () => void
}) {
  const [sharing, setSharing] = useState(false)
  const taxAlive = isTaxAlive(v.taxStatus)
  const isSold = v.status === 'sold'
  const isHeld = v.status === 'hold'
  const locName = v.branch?.name || fallbackLocName
  const locMaps = v.branch?.mapsUrl ?? fallbackLocMaps
  /** Link WA spesifik unit — prefill nama/tahun/harga agar owner mudah membalas. */
  const unitWaHref = waLink(showroom.ownerPhone, buildUnitInquiryText(v))

  /** Bagikan foto utama + caption spek motor via Web Share API (langsung ke WA/medsos). */
  async function handleShare() {
    setSharing(true)
    try {
      const outcome = await shareVehicleAd(v, showroom)
      if (outcome === 'shared') {
        toast.success('Menu bagikan terbuka — pilih WhatsApp / media sosial tujuan.')
      } else if (outcome === 'copied') {
        toast.info(
          'Perangkat ini belum mendukung kirim foto otomatis. Caption iklan sudah disalin — tinggal lampirkan foto.',
        )
      } else if (outcome === 'failed') {
        toast.error('Gagal menyiapkan materi iklan. Coba lagi.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <article
      onClick={(e) => {
        // Klik kartu membuka modal detail — kecuali klik pada tombol/link aksi
        if ((e.target as HTMLElement | null)?.closest('button, a')) return
        onOpenDetail()
      }}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
    >
      {/* Foto 4:3 — klik juga membuka modal detail (galeri layar penuh ada di dalam modal) */}
      <button
        type="button"
        onClick={onOpenDetail}
        className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100"
        aria-label={`Lihat detail ${v.brand} ${v.model}`}
      >
        <VehiclePhoto
          src={v.photos[0]}
          alt={`Foto ${v.brand} ${v.model} ${v.year}`}
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          className={`absolute inset-0 h-full w-full object-cover ${isSold ? 'opacity-75' : ''}`}
        />
        <span className="absolute left-2 top-2">
          <StatusBadge status={v.status} className="shadow-sm" />
        </span>
        {v.photos.length > 1 && (
          <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded bg-slate-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <Camera className="h-3 w-3" aria-hidden /> {v.photos.length}
          </span>
        )}
      </button>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="text-sm font-extrabold leading-snug text-slate-900">
            {v.brand} {v.model}
          </h3>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">
            {v.year} • {v.licensePlate}
            {v.odometer != null ? ` • ${formatKm(v.odometer)}` : ''}
          </p>
        </div>

        {/* Badge lokasi unit — hanya tampil bila showroom punya cabang */}
        {showLocation && (
          <div className="flex items-center justify-between gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
            <span className="flex min-w-0 items-center gap-1 text-[11px] font-bold text-slate-700">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden />
              <span className="truncate">Lokasi: {locName}</span>
            </span>
            {locMaps && (
              <a
                href={locMaps}
                target="_blank"
                rel="noreferrer"
                className="inline-flex shrink-0 items-center gap-0.5 rounded border border-blue-200 bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700 hover:bg-blue-50"
                title={`Buka lokasi ${locName} di Google Maps`}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink className="h-3 w-3" aria-hidden /> Maps
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1">
          {v.category && (
            <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
              {v.category}
            </span>
          )}
          {v.taxStatus && (
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                taxAlive
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-red-200 bg-red-50 text-red-700'
              }`}
            >
              Pajak: {v.taxStatus}
            </span>
          )}
          {v.documentStatus && (
            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {v.documentStatus}
            </span>
          )}
          {v.color && (
            <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
              {v.color}
            </span>
          )}
        </div>

        <div className="mt-auto">
          <p className="text-xl font-extrabold tracking-tight text-slate-900">
            {formatRupiah(v.sellingPrice)}
          </p>
          {v.commissionAmount != null && !isSold && (
            <p className="text-xs font-extrabold text-emerald-700">
              Komisi: {formatRupiah(v.commissionAmount)}
            </p>
          )}
        </div>

        {isHeld && v.activeHold && (
          <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5">
            <p className="text-[11px] font-bold leading-tight text-amber-800">
              Ditahan oleh {v.activeHold.marketingName} •{' '}
              <Countdown
                expiresAt={v.activeHold.expiresAt}
                className="tabular-nums"
                onDone={onHoldExpired}
              />
            </p>
          </div>
        )}

        {/* Aksi */}
        {!isSold ? (
          <div className="space-y-2">
            {/* CTA utama pembeli: chat WA spesifik unit + lihat detail (modal) */}
            <div className="grid grid-cols-2 gap-2">
              <a
                href={unitWaHref}
                target="_blank"
                rel="noreferrer"
                title="Chat WhatsApp tentang unit ini"
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-emerald-700 text-xs font-extrabold text-white transition-colors hover:bg-emerald-800"
              >
                <MessageCircle className="h-4 w-4" aria-hidden />
                Chat WhatsApp
              </a>
              <Button
                variant="outline"
                className="h-11 border-slate-300 bg-white text-xs font-extrabold text-slate-800 hover:bg-slate-50"
                onClick={onOpenDetail}
              >
                <Info className="mr-1 h-4 w-4" aria-hidden />
                Lihat Detail
              </Button>
            </div>
            {/* Web Share API: foto utama + caption spek motor → langsung ke WA/medsos */}
            <Button
              variant="outline"
              className="h-11 w-full border-blue-200 bg-blue-50 text-xs font-extrabold text-blue-800 hover:bg-blue-100"
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Share2 className="mr-1 h-4 w-4" aria-hidden />
              )}
              Bagikan Materi Iklan
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-11 border-slate-300 bg-white text-xs font-extrabold text-blue-800 hover:bg-blue-50"
                onClick={onCopy}
              >
                <ClipboardCopy className="mr-1 h-4 w-4" /> Salin Iklan
              </Button>
              <Button
                className="h-11 bg-blue-700 text-xs font-extrabold hover:bg-blue-800"
                disabled={isHeld}
                onClick={onHold}
                title={isHeld ? 'Unit sedang ditahan marketing lain' : undefined}
              >
                <Lock className="mr-1 h-4 w-4" />
                {isHeld ? 'Ditahan' : 'Tahan Unit'}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="h-11 w-full border-slate-300 bg-white text-xs font-extrabold text-slate-800 hover:bg-slate-50"
            onClick={onOpenDetail}
          >
            <Info className="mr-1 h-4 w-4" aria-hidden />
            Lihat Detail
          </Button>
        )}
      </div>
    </article>
  )
}
