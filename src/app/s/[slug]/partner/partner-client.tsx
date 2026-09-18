'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Bike,
  Camera,
  ClipboardCopy,
  Copy,
  ExternalLink,
  Info,
  Loader2,
  Lock,
  Share2,
  Store,
} from 'lucide-react'
import { Countdown } from '@/components/countdown'
import { HoldDialog } from '@/components/hold-dialog'
import { MarketingGate } from '@/components/marketing-gate'
import { PhotoLightbox } from '@/components/photo-lightbox'
import { StatusBadge } from '@/components/status-badge'
import { VehicleDetailModal } from '@/components/vehicle-detail-modal'
import { Button } from '@/components/ui/button'
import {
  buildAdText,
  copyToClipboard,
  formatKm,
  formatRupiah,
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
} from '@/lib/types'

interface PartnerInfo {
  id: string
  fullName: string
  addressCity: string
  /** Kode referral Personal Store (MKT-XXXXXX) — bisa null (rekanan lama). */
  code: string | null
  phoneNumber: string
}

/**
 * PORTAL KERJA MARKETING (/s/[slug]/partner) — halaman internal alat kerja.
 * Bukan katalog pembeli: di sini rekanan menahan unit, menyiapkan materi
 * iklan, dan menyalin Link Toko personalnya.
 *
 * Identitas = verifikasi nomor WhatsApp (gerbang whitelist rekanan). Parameter
 * URL ?ref= TIDAK dipercaya di halaman ini karena link toko bersifat publik.
 */
export function PartnerClient({
  slug,
  showroomName,
}: {
  slug: string
  /** Nama showroom dari server (null = tidak ditemukan/nonaktif). */
  showroomName: string | null
}) {
  const [marketing, setMarketing] = useState<MarketingSession | null>(null)
  const [phase, setPhase] = useState<'checking' | 'gate' | 'open'>('checking')
  const marketingRef = useRef<MarketingSession | null>(null)

  const [info, setInfo] = useState<PartnerInfo | null>(null)
  const [data, setData] = useState<PublicCatalogResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [holdTarget, setHoldTarget] = useState<PublicVehicle | null>(null)
  const [origin, setOrigin] = useState('')

  /** Modal Detail Unit — ID di state, objek unit DIDERIVASI dari data terbaru
   *  (tanpa fetch API: modal terbuka instan dari stok yang sudah dimuat). */
  const [detailId, setDetailId] = useState<string | null>(null)
  /** true = modal memutar animasi keluar (data unit dilepas setelah selesai ±320ms). */
  const [detailClosing, setDetailClosing] = useState(false)
  const detailCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Galeri layar penuh dari dalam modal (z-[70] di atas modal z-[60]). */
  const [gallery, setGallery] = useState<{ vehicle: PublicVehicle; index: number } | null>(null)

  useEffect(() => {
    setOrigin(window.location.origin)
    // Sesi rekanan tersimpan — marketing tidak perlu verifikasi ulang
    const cached = loadMarketingSession(slug)
    marketingRef.current = cached
    setMarketing(cached)
    setPhase(cached ? 'open' : 'gate')
  }, [slug])

  const refetch = useCallback(
    async (silent = false, session?: MarketingSession | null) => {
      const mkt = session ?? marketingRef.current
      if (!mkt) return
      if (!silent) setError(null)
      try {
        const [infoRes, vehRes] = await Promise.all([
          fetch(`/api/showrooms/${slug}/partner`, {
            cache: 'no-store',
            headers: { 'X-Mkt-Phone': mkt.phone },
          }),
          fetch(`/api/showrooms/${slug}/vehicles`, {
            cache: 'no-store',
            headers: { 'X-Mkt-Phone': mkt.phone },
          }),
        ])

        if (infoRes.status === 403 || vehRes.status === 403) {
          // Nomor tidak lagi terdaftar/aktif — paksa verifikasi ulang
          clearMarketingSession(slug)
          marketingRef.current = null
          setMarketing(null)
          setPhase('gate')
          return
        }
        if (!infoRes.ok) {
          const j = await infoRes.json().catch(() => ({}))
          throw new Error(j.error || 'Gagal memuat data rekanan.')
        }
        if (!vehRes.ok) {
          const j = await vehRes.json().catch(() => ({}))
          throw new Error(j.error || 'Gagal memuat stok unit.')
        }
        setInfo((await infoRes.json()).marketing as PartnerInfo)
        setData(await vehRes.json())
        setError(null)
        setPhase('open')
      } catch (e) {
        if (!silent) setError(e instanceof Error ? e.message : 'Gagal memuat portal.')
      }
    },
    [slug],
  )

  // Muat data pertama setelah sesi tersedia + auto-refresh (hold kedaluwarsa)
  useEffect(() => {
    if (phase !== 'open' || !marketing) return
    refetch(false, marketing)
    const iv = setInterval(() => refetch(true), 30000)
    const onVis = () => {
      if (document.visibilityState === 'visible') refetch(true)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(iv)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [phase, marketing, refetch])

  function handleVerified(s: MarketingSession) {
    saveMarketingSession(slug, s)
    marketingRef.current = s
    setMarketing(s)
    setPhase('open')
  }

  /** Keluar / ganti nomor WhatsApp — kembali ke gerbang verifikasi. */
  function handleChangeNumber() {
    clearMarketingSession(slug)
    marketingRef.current = null
    setMarketing(null)
    setInfo(null)
    setData(null)
    setPhase('gate')
  }

  /** Link Toko personal — utamakan ?ref=<kode>, fallback ?mkt=<id>. */
  function storeLink(): string {
    const base = `${origin || ''}/s/${slug}`
    if (info?.code) return `${base}?ref=${info.code}`
    if (info?.id) return `${base}?mkt=${info.id}`
    return base
  }

  async function handleCopyStoreLink() {
    if (!info) return
    const ok = await copyToClipboard(storeLink())
    if (ok) {
      toast.success('Link Toko disalin — bagikan ke calon pembeli; chat masuk ke WA Anda.')
    } else {
      toast.error('Gagal menyalin. Coba lagi.')
    }
  }

  async function handleCopyAd(v: PublicVehicle) {
    if (!data) return
    const ok = await copyToClipboard(buildAdText(v, data.showroom))
    if (ok) toast.success('Teks promosi disalin! Tinggal paste ke WA Status / Marketplace.')
    else toast.error('Gagal menyalin. Coba lagi.')
  }

  /** Buka modal detail — batalkan animasi keluar yang masih berjalan (bila ada). */
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

  // Bersihkan timer tutup-modal saat portal unmount
  useEffect(() => {
    return () => {
      if (detailCloseTimer.current) clearTimeout(detailCloseTimer.current)
    }
  }, [])

  /** "Tahan Unit Ini" dari dalam modal — tutup modal dulu, HoldDialog menyusul
   *  setelah animasi keluar selesai (hindari tumpukan dialog). */
  function handleHoldFromModal() {
    const v = data?.vehicles.find((x) => x.id === detailId) ?? null
    if (!v || v.status !== 'available') return
    closeDetail()
    const t = setTimeout(() => setHoldTarget(v), 330)
    // HoldDialog terbuka setelah modal tertutup — timer tak perlu dibatalkan
    void t
  }

  /** Salin info lengkap unit dari dalam modal utk dipaste ke chat calon pembeli. */
  async function handleCopyInfo(v: PublicVehicle) {
    if (!data) return
    const ok = await copyToClipboard(buildAdText(v, data.showroom))
    if (ok) toast.success('Info lengkap unit disalin — paste ke chat calon pembeli.')
    else toast.error('Gagal menyalin. Coba lagi.')
  }

  const name = info?.fullName ?? marketing?.fullName ?? ''
  const showroom = data?.showroom

  /** Unit utk modal detail — diambil dari data TERBARU (modal ikut segar saat auto-refresh). */
  const detailTarget = useMemo(
    () => data?.vehicles.find((v) => v.id === detailId) ?? null,
    [data, detailId],
  )

  // ============ Gerbang verifikasi nomor WhatsApp rekanan ============
  if (phase === 'gate') {
    return (
      <MarketingGate
        slug={slug}
        onVerified={handleVerified}
        contextLabel="Portal Kerja"
        submitLabel="Masuk Portal"
      />
    )
  }

  if (showroomName == null && phase === 'checking') {
    return (
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 px-4 py-10">
        <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      </div>
    )
  }

  return (
    <>
      {/* Header portal */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex min-h-14 w-full max-w-3xl items-center gap-3 px-4 py-2">
          {showroom?.logoUrl && (
            <img
              src={showroom.logoUrl}
              alt={`Logo ${showroom.name}`}
              className="h-10 w-10 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
            />
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-extrabold text-slate-900">
              Portal Kerja Marketing
            </h1>
            <p className="truncate text-xs text-slate-500">
              {showroom?.name ?? showroomName ?? 'Memuat...'}
              {name ? ` • ${name}` : ''}
              {info?.addressCity ? ` (${info.addressCity})` : ''}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0 border-slate-300 text-xs font-bold"
            onClick={handleChangeNumber}
          >
            Ganti Nomor
          </Button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {error && (
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

        {/* Kartu TOKO ONLINE SAYA — link toko personal rekanan */}
        {info && (
          <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <h2 className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-emerald-900">
              <Store className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
              Toko Online Saya
              <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800">
                {info.code ?? 'KODE DALAM PROSES'}
              </span>
            </h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-900">
              Bagikan link ini ke calon pembeli — katalog terbuka dengan nama Anda sebagai
              Mitra Penjualan Resmi dan seluruh tombol chat WhatsApp pembeli masuk ke nomor
              Anda.
            </p>
            <p
              dir="ltr"
              className="mt-2 truncate rounded-md border border-emerald-200 bg-white px-2.5 py-1.5 font-mono text-[11px] text-emerald-900"
              title={storeLink()}
            >
              {storeLink()}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="h-10 bg-emerald-700 px-3 text-xs font-extrabold hover:bg-emerald-800"
                onClick={handleCopyStoreLink}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Salin Link Toko
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-10 border-emerald-300 bg-white px-3 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
              >
                <a href={storeLink()} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Buka Toko Saya
                </a>
              </Button>
            </div>
          </section>
        )}

        {/* Daftar unit + alat kerja */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">
              Stok Unit &amp; Alat Kerja
              {data ? ` (${data.vehicles.length})` : ''}
            </h2>
            {data && (
              <span className="text-[11px] text-slate-400">Sinkron otomatis tiap 30 detik</span>
            )}
          </div>

          {!data && !error && (
            <div className="space-y-2">
              <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-28 animate-pulse rounded-lg bg-slate-200" />
            </div>
          )}

          {data && data.vehicles.length === 0 && (
            <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
              <Bike className="h-8 w-8 text-slate-300" aria-hidden />
              <p className="mt-2 text-sm font-bold text-slate-700">Belum ada unit di stok.</p>
            </div>
          )}

          {data?.vehicles.map((v) => (
            <PartnerVehicleCard
              key={v.id}
              v={v}
              showroom={data.showroom}
              onHold={() => setHoldTarget(v)}
              onCopyAd={() => handleCopyAd(v)}
              onOpenDetail={() => openDetail(v.id)}
              onHoldExpired={() => refetch(true)}
            />
          ))}
        </section>

        <p className="pb-4 text-center text-[11px] leading-relaxed text-slate-400">
          Katalog pembeli bersih dari alat kerja — pembeli hanya melihat foto, spesifikasi,
          dan tombol chat WhatsApp.
        </p>
      </div>

      {/* Dialog Tahan Unit — identitas otomatis dari sesi rekanan */}
      <HoldDialog
        vehicle={holdTarget}
        open={holdTarget != null}
        onOpenChange={(o) => !o && setHoldTarget(null)}
        onSuccess={() => refetch(true)}
        session={marketing}
      />

      {/* Galeri foto layar penuh — dibuka dari dalam modal detail (z-[70] > z-[60]) */}
      <PhotoLightbox
        open={gallery != null}
        vehicle={gallery?.vehicle ?? null}
        index={gallery?.index ?? 0}
        onIndexChange={(i) => setGallery((g) => (g ? { ...g, index: i } : g))}
        onClose={() => setGallery(null)}
      />

      {/* Modal Detail Unit — data dari state client (instan, tanpa fetch).
          MODE MARKETING: CTA WA diganti "Salin Info Lengkap" + "Tahan Unit Ini";
          hold dari modal menutup modal dulu, lalu HoldDialog terbuka. */}
      {detailTarget && (
        <VehicleDetailModal
          vehicle={detailTarget}
          open={!detailClosing}
          waContact={null}
          marketingMode
          showLocation={(data?.branches.length ?? 0) > 0}
          suspendEscape={gallery != null}
          onClose={closeDetail}
          onHoldExpired={() => refetch(true)}
          onOpenLightbox={(i) => setGallery({ vehicle: detailTarget, index: i })}
          onCopyInfo={() => handleCopyInfo(detailTarget)}
          onHold={detailTarget.status === 'available' ? handleHoldFromModal : undefined}
        />
      )}
    </>
  )
}

/** Kartu unit versi PORTAL — alat kerja marketing (bukan tampilan pembeli). */
function PartnerVehicleCard({
  v,
  showroom,
  onHold,
  onCopyAd,
  onOpenDetail,
  onHoldExpired,
}: {
  v: PublicVehicle
  showroom: { name: string; address: string; ownerPhone: string }
  onHold: () => void
  onCopyAd: () => void
  /** Buka Modal Detail Unit (dari tombol Lihat Detail / klik foto). */
  onOpenDetail: () => void
  onHoldExpired: () => void
}) {
  const [sharing, setSharing] = useState(false)
  const isSold = v.status === 'sold'
  const isHeld = v.status === 'hold'

  /** Bagikan foto utama + caption spek motor via Web Share API (langsung ke WA/medsos). */
  async function handleShare() {
    setSharing(true)
    try {
      const outcome = await shareVehicleAd(v, showroom)
      if (outcome === 'shared') {
        toast.success('Menu bagikan terbuka — pilih WhatsApp / media sosial tujuan.')
      } else if (outcome === 'copied') {
        toast.info(
          'Perangkat ini belum mendukung kirim foto otomatis. Teks promosi sudah disalin — tinggal lampirkan foto.',
        )
      } else if (outcome === 'failed') {
        toast.error('Gagal menyiapkan materi iklan. Coba lagi.')
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      {/* ===== BAGIAN ATAS — foto kiri, info kanan (tanpa tombol) ===== */}
      <div className="flex gap-3">
        {/* Foto unit — klik membuka Modal Detail Unit */}
        <button
          type="button"
          onClick={onOpenDetail}
          aria-label={`Lihat detail ${v.brand} ${v.model}`}
          className="relative aspect-[4/3] w-28 shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-200 transition-opacity hover:opacity-90 sm:w-36"
        >
          {v.photos[0] ? (
            <img
              src={v.photos[0]}
              alt={`Foto ${v.brand} ${v.model} ${v.year}`}
              className={`h-full w-full object-cover ${isSold ? 'opacity-60' : ''}`}
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center">
              <Camera className="h-6 w-6 text-slate-300" aria-hidden />
            </span>
          )}
          {v.photos.length > 1 && (
            <span className="absolute bottom-1 right-1 inline-flex items-center gap-0.5 rounded bg-slate-900/70 px-1 py-0.5 text-[9px] font-bold text-white">
              <Camera className="h-2.5 w-2.5" aria-hidden /> {v.photos.length}
            </span>
          )}
        </button>

        {/* Judul, tahun/plat, harga OTR, badge status, komisi */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-extrabold text-slate-900">
                {v.brand} {v.model}
              </h3>
              <p className="mt-0.5 truncate text-xs font-semibold text-slate-500">
                {v.year} • {v.licensePlate}
                {v.odometer != null ? ` • ${formatKm(v.odometer)}` : ''}
                {v.branch ? ` • ${v.branch.name}` : ''}
              </p>
            </div>
            <StatusBadge status={v.status} />
          </div>

          {/* Harga + komisi — flex-wrap agar komisi pindah baris UTUH (angka tak terpotong) */}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="text-base font-extrabold tracking-tight text-slate-900">
              {formatRupiah(v.sellingPrice)}
            </p>
            {v.commissionAmount != null && !isSold && (
              <p className="text-xs font-extrabold text-emerald-700">
                Komisi {formatRupiah(v.commissionAmount)}
              </p>
            )}
          </div>

          {isHeld && v.activeHold && (
            <p className="mt-1 text-[11px] font-bold leading-tight text-amber-800">
              Ditahan oleh {v.activeHold.marketingName} •{' '}
              <Countdown
                expiresAt={v.activeHold.expiresAt}
                className="tabular-nums"
                onDone={onHoldExpired}
              />
            </p>
          )}
        </div>
      </div>

      {/* ===== BAGIAN BAWAH — tombol aksi LEBAR PENUH di bawah foto+info ===== */}
      {!isSold && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Baris 1 mobile: Tahan Unit | Lihat Detail — primer solid utk aksi utama */}
            <Button
              className="h-10 min-h-[40px] bg-blue-700 px-3 text-xs font-semibold hover:bg-blue-800"
              disabled={isHeld}
              onClick={onHold}
              title={isHeld ? 'Unit sedang ditahan' : 'Kunci unit 2 jam atas nama Anda'}
            >
              <Lock aria-hidden />
              {isHeld ? 'Ditahan' : 'Tahan Unit'}
            </Button>
            <Button
              variant="outline"
              className="h-10 min-h-[40px] border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={onOpenDetail}
            >
              <Info aria-hidden />
              Lihat Detail
            </Button>
            {/* Baris 2 mobile: Salin Iklan | Materi Iklan — secondary outline bersih */}
            <Button
              variant="outline"
              className="h-10 min-h-[40px] border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={onCopyAd}
            >
              <ClipboardCopy aria-hidden />
              Salin Iklan
            </Button>
            <Button
              variant="outline"
              className="h-10 min-h-[40px] border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              onClick={handleShare}
              disabled={sharing}
            >
              {sharing ? (
                <Loader2 className="animate-spin" aria-hidden />
              ) : (
                <Share2 aria-hidden />
              )}
              Materi Iklan
            </Button>
          </div>
        </div>
      )}
      {isSold && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <Button
            variant="outline"
            className="h-10 min-h-[40px] w-full border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
            onClick={onOpenDetail}
          >
            <Info aria-hidden />
            Lihat Detail
          </Button>
        </div>
      )}
    </article>
  )
}
