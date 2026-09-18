'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Bike,
  ChevronLeft,
  ChevronRight,
  Cog,
  FileCheck2,
  Hash,
  MapPin,
  Maximize2,
  MessageCircle,
  Palette,
  Receipt,
  Wallet,
  X,
} from 'lucide-react'
import { Countdown } from '@/components/countdown'
import { buildUnitInquiryText, formatKm, formatRupiah, isTaxAlive, waLink } from '@/lib/format'
import type { PublicVehicle } from '@/lib/types'

/** Ambang geser (px) untuk pindah foto di galeri modal. */
const SWIPE_THRESHOLD = 56

/** Asumsi simulasi kredit: DP 20%, bunga flat 1,1%/bulan (estimasi kasar, bukan penawaran resmi). */
const DP_RATIO = 0.2
const FLAT_RATE_MONTHLY = 0.011
const TENOR_OPTIONS = [12, 24, 36]

const STATUS_STYLE: Record<PublicVehicle['status'], { label: string; cls: string }> = {
  available: { label: 'Tersedia', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  hold: { label: 'Ter-booking', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  sold: { label: 'Terjual', cls: 'border-red-200 bg-red-50 text-red-700' },
}

function estimateInstallment(price: number, tenor: number): { dp: number; monthly: number } {
  const dp = Math.round((price * DP_RATIO) / 1000) * 1000
  const principal = price - dp
  const total = principal * (1 + FLAT_RATE_MONTHLY * tenor)
  const monthly = Math.round(total / tenor / 1000) * 1000
  return { dp, monthly }
}

/**
 * Modal / Popup Detail Unit Interaktif untuk katalog publik (/s/[slug]).
 *
 * - Mobile  : Bottom Sheet (slide-up dari bawah, rounded atas, handle bar).
 * - Desktop : Center Modal (fade + zoom).
 * - Animasi masuk/kelur via tw-animate-css: parent cukup toggle prop `open`
 *   dan melepas komponen SETELAH animasi keluar selesai (±320ms).
 * - Galeri foto: geser (swipe) / panah / thumbnail; klik foto utama →
 *   lightbox layar penuh milik parent (PhotoLightbox, z lebih tinggi).
 * - Simulasi angsuran ringan (DP 20%, tenor 12/24/36, bunga flat estimasi).
 * - Semua data dari state client yang sudah ada — TANPA fetch API baru,
 *   popup terbuka instan saat diklik.
 * - Body scroll dikunci selama modal terpasang; ESC & klik backdrop menutup.
 */
export function VehicleDetailModal({
  vehicle,
  open,
  waContact,
  showLocation,
  suspendEscape = false,
  onClose,
  onHoldExpired,
  onOpenLightbox,
}: {
  /** Unit yang dilihat (parent hanya merender modal saat ada unit terpilih). */
  vehicle: PublicVehicle
  /** false = sedang memutar animasi keluar (panel tetap terpasang sesaat). */
  open: boolean
  /**
   * Kontak tujuan CTA WA modal — mengikuti logika Personal Store:
   * referral marketing aktif → nomor marketing (template mitra),
   * tanpa referral → nomor resmi showroom (template owner).
   * null menyembunyikan CTA WA.
   */
  waContact: { name: string; phone: string; marketingName?: string | null } | null
  /** True bila showroom multi-cabang → baris lokasi cabang tampil. */
  showLocation: boolean
  /** True saat lightbox layar penuh terbuka di atas modal → listener ESC modal dilepas
   *  (bukan sekadar di-skip saat event) supaya tidak ada ambiguitas urutan listener window. */
  suspendEscape?: boolean
  onClose: () => void
  /** Countdown hold di banner habis → parent segarkan data (unit kembali Ready). */
  onHoldExpired?: () => void
  /** Klik foto utama → buka galeri layar penuh (lightbox) di parent pada index tsb. */
  onOpenLightbox: (index: number) => void
}) {
  const [tenor, setTenor] = useState(24)
  const closeBtnRef = useRef<HTMLButtonElement>(null)

  const isSold = vehicle.status === 'sold'
  const isHeld = vehicle.status === 'hold'
  const taxAlive = isTaxAlive(vehicle.taxStatus)
  const waHref = waContact
    ? waLink(
        waContact.phone,
        buildUnitInquiryText(vehicle, {
          showroomName: waContact.name,
          marketingName: waContact.marketingName,
        }),
      )
    : null
  const installment =
    vehicle.sellingPrice != null && !isSold
      ? estimateInstallment(vehicle.sellingPrice, tenor)
      : null

  // Kunci scroll body sepanjang modal terpasang (termasuk saat animasi keluar)
  useEffect(() => {
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [])

  // ESC menutup modal — listener DILEPAS selagi lightbox layar penuh terbuka di atasnya
  useEffect(() => {
    if (suspendEscape) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, suspendEscape])

  // Fokus awal ke tombol tutup agar navigasi keyboard langsung berada di modal
  useEffect(() => {
    closeBtnRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Detail unit ${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
      aria-hidden={!open}
      inert={!open}
      className={`fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6 ${
        open ? '' : 'pointer-events-none'
      }`}
    >
      {/* Backdrop — klik di luar menutup modal */}
      <div
        aria-hidden
        onClick={onClose}
        className={`absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] ${
          open
            ? 'animate-in fade-in duration-300'
            : 'animate-out fade-out duration-300 fill-mode-forwards'
        }`}
      />

      {/* Panel: bottom sheet (mobile) / center modal (desktop) */}
      <div
        className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-h-[85vh] sm:max-w-2xl sm:rounded-2xl ${
          open
            ? 'animate-in fade-in slide-in-from-bottom duration-300 sm:slide-in-from-bottom-0 sm:zoom-in-95'
            : 'animate-out fade-out slide-out-to-bottom duration-300 fill-mode-forwards sm:slide-out-to-bottom-0 sm:zoom-out-95'
        }`}
      >
        {/* Handle bar bottom sheet (mobile saja) */}
        <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-slate-300 sm:hidden" />

        {/* Tombol tutup — pojok kanan atas, mengambang di atas galeri */}
        <button
          type="button"
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Tutup detail unit"
          className="absolute right-3 top-3 z-20 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-900/60 text-white shadow-md transition-colors hover:bg-slate-900/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>

        {/* ===== Galeri foto ===== */}
        <VehicleGallery vehicle={vehicle} onEnlarge={onOpenLightbox} />

        {/* ===== Konten scrollable ===== */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4">
          {/* Header unit: status + nama + meta */}
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={`rounded-md border px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${STATUS_STYLE[vehicle.status].cls}`}
              >
                {STATUS_STYLE[vehicle.status].label}
              </span>
              {vehicle.category && (
                <span className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                  {vehicle.category}
                </span>
              )}
            </div>
            <h2 className="mt-1.5 text-lg font-extrabold leading-snug text-slate-900">
              {vehicle.brand} {vehicle.model}
            </h2>
            <p className="mt-0.5 text-sm font-semibold text-slate-500">
              {vehicle.year} • {formatKm(vehicle.odometer)}
              {vehicle.color ? ` • ${vehicle.color}` : ''}
            </p>
          </div>

          {/* Banner hold (unit ter-booking) */}
          {isHeld && vehicle.activeHold && (
            <div className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2">
              <p className="text-[11px] font-bold leading-tight text-amber-800">
                Sedang di-booking oleh {vehicle.activeHold.marketingName} •{' '}
                <Countdown
                  expiresAt={vehicle.activeHold.expiresAt}
                  className="tabular-nums"
                  onDone={onHoldExpired}
                />
              </p>
            </div>
          )}

          {/* Harga + simulasi angsuran */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Harga Jual (OTR)
            </p>
            <p className="mt-0.5 text-2xl font-extrabold tracking-tight text-slate-900">
              {formatRupiah(vehicle.sellingPrice)}
            </p>
            {/* Komisi marketing SENGAJA tidak ditampilkan di katalog publik —
                informasi internal ada di Portal Kerja marketing (/s/[slug]/partner) */}

            {installment && vehicle.sellingPrice != null && (
              <div className="mt-3 border-t border-dashed border-slate-300 pt-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-xs font-extrabold text-slate-700">
                    <Wallet className="h-4 w-4 text-slate-400" aria-hidden />
                    Simulasi Angsuran
                  </p>
                  <div
                    className="flex rounded-md border border-slate-300 bg-white p-0.5"
                    role="group"
                    aria-label="Pilih tenor angsuran"
                  >
                    {TENOR_OPTIONS.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTenor(t)}
                        aria-pressed={tenor === t}
                        className={`h-7 rounded px-2 text-[11px] font-bold tabular-nums ${
                          tenor === t
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {t} bln
                      </button>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  DP 20%:{' '}
                  <span className="font-extrabold text-slate-900">
                    {formatRupiah(installment.dp)}
                  </span>{' '}
                  — angsuran ±{' '}
                  <span className="font-extrabold text-blue-700">
                    {formatRupiah(installment.monthly)}/bulan
                  </span>
                </p>
                <p className="mt-1 text-[10px] leading-snug text-slate-400">
                  *Estimasi kasar (bunga flat 1,1%/bulan), bukan penawaran resmi — hubungi
                  showroom untuk skema kredit aktual.
                </p>
              </div>
            )}
          </div>

          {/* Spesifikasi & atribut */}
          <div>
            <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
              Spesifikasi &amp; Atribut
            </h3>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <SpecRow icon={Hash} label="Plat Nomor" value={vehicle.licensePlate} />
              {vehicle.taxStatus && (
                <SpecRow
                  icon={Receipt}
                  label="Pajak"
                  value={vehicle.taxStatus}
                  valueCls={taxAlive ? 'text-emerald-700' : 'text-red-700'}
                />
              )}
              <SpecRow icon={Cog} label="Transmisi" value={vehicle.category ?? '-'} />
              {vehicle.color && <SpecRow icon={Palette} label="Warna" value={vehicle.color} />}
              {vehicle.documentStatus && (
                <SpecRow icon={FileCheck2} label="Dokumen" value={vehicle.documentStatus} />
              )}
              {showLocation && (
                <LocationRow
                  name={vehicle.branch?.name ?? 'Lokasi Utama'}
                  mapsUrl={vehicle.branch?.mapsUrl ?? null}
                />
              )}
            </div>
          </div>

          {/* Deskripsi lengkap */}
          {vehicle.notes && (
            <div>
              <h3 className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">
                Deskripsi Unit
              </h3>
              <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-700">
                {vehicle.notes}
              </p>
            </div>
          )}
        </div>

        {/* ===== Bar aksi ===== */}
        <div className="shrink-0 border-t border-slate-200 bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
          {isSold ? (
            <p className="py-1 text-center text-xs font-bold text-slate-500">
              Unit ini sudah terjual — lihat unit lain di katalog.
            </p>
          ) : waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 text-sm font-extrabold text-white shadow-sm transition-colors hover:bg-emerald-700"
            >
              <MessageCircle className="h-5 w-5" aria-hidden />
              Tanya Unit Ini via WhatsApp
            </a>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/**
 * Galeri foto dalam modal — state index/drag hidup di komponen ini sehingga
 * otomatis reset saat modal ditutup & dibuka utk unit lain (mount baru).
 */
function VehicleGallery({
  vehicle,
  onEnlarge,
}: {
  vehicle: PublicVehicle
  onEnlarge: (index: number) => void
}) {
  const photos = vehicle.photos
  const total = photos.length
  const canSwipe = total > 1

  const [index, setIndex] = useState(0)
  const [dragX, setDragX] = useState(0)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  /** Salinan sinkron dragX utk keputusan threshold di touchend. */
  const dragXRef = useRef(0)
  /** Cegah klik "perbesar" terpicu tepat setelah gesture geser. */
  const suppressClick = useRef(false)

  const goPrev = () => {
    if (canSwipe) setIndex((i) => (i - 1 + total) % total)
  }
  const goNext = () => {
    if (canSwipe) setIndex((i) => (i + 1) % total)
  }

  const activePhoto = total > 0 ? photos[Math.min(index, total - 1)] : undefined

  return (
    <div className="shrink-0 bg-slate-900">
      <div
        role="group"
        aria-label="Galeri foto unit — geser atau ketuk untuk memperbesar"
        className="relative aspect-[4/3] max-h-[32vh] w-full overflow-hidden sm:aspect-auto sm:h-[300px] sm:max-h-none"
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
          if (Math.abs(dx) >= SWIPE_THRESHOLD) {
            suppressClick.current = true
            setTimeout(() => {
              suppressClick.current = false
            }, 350)
          }
          dragXRef.current = 0
          setDragX(0)
          touchStart.current = null
        }}
        onClick={() => {
          if (suppressClick.current) return
          if (activePhoto) onEnlarge(index)
        }}
      >
        {activePhoto ? (
          <div
            className="flex h-full w-full"
            style={{
              transform: `translateX(${dragX}px)`,
              transition: dragX === 0 ? 'transform 180ms ease' : 'none',
            }}
          >
            <img
              key={activePhoto}
              src={activePhoto}
              alt={`Foto ${index + 1} dari ${total} — ${vehicle.brand} ${vehicle.model} ${vehicle.year}`}
              className="h-full w-full select-none object-cover"
              draggable={false}
            />
          </div>
        ) : (
          <div
            role="img"
            aria-label="Foto tidak tersedia"
            className="flex h-full w-full items-center justify-center text-slate-500"
          >
            <Bike className="h-14 w-14" aria-hidden />
          </div>
        )}

        {/* Hint perbesar */}
        {activePhoto && (
          <span className="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
            <Maximize2 className="h-3 w-3" aria-hidden /> Ketuk untuk perbesar
          </span>
        )}

        {/* Counter foto */}
        {total > 1 && (
          <span className="pointer-events-none absolute bottom-2 right-2 rounded bg-slate-900/70 px-2 py-0.5 text-[11px] font-bold tabular-nums text-white">
            {index + 1}/{total}
          </span>
        )}

        {/* Panah navigasi (desktop & tablet) */}
        {canSwipe && (
          <>
            <button
              type="button"
              aria-label="Foto sebelumnya"
              onClick={(e) => {
                e.stopPropagation()
                goPrev()
              }}
              className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow hover:bg-white sm:block"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Foto berikutnya"
              onClick={(e) => {
                e.stopPropagation()
                goNext()
              }}
              className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-900 shadow hover:bg-white sm:block"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail strip */}
      {total > 1 && (
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto p-2">
          {photos.map((p, i) => (
            <button
              key={`${p}-${i}`}
              type="button"
              aria-label={`Tampilkan foto ${i + 1}`}
              aria-current={i === index}
              onClick={() => setIndex(i)}
              className={`relative h-14 w-16 shrink-0 overflow-hidden rounded-md ring-2 transition-all ${
                i === index ? 'ring-blue-500' : 'opacity-60 ring-transparent hover:opacity-100'
              }`}
            >
              <img
                src={p}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                draggable={false}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/** Satu baris spesifikasi (ikon + label + nilai) di grid modal. */
function SpecRow({
  icon: Icon,
  label,
  value,
  valueCls = 'text-slate-800',
}: {
  icon: typeof Hash
  label: string
  value: string
  valueCls?: string
}) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`truncate text-xs font-extrabold ${valueCls}`} title={value}>
          {value}
        </p>
      </div>
    </div>
  )
}

/** Baris lokasi unit — jadi tautan Google Maps bila URL tersedia. */
function LocationRow({ name, mapsUrl }: { name: string; mapsUrl: string | null }) {
  const inner = (
    <>
      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" aria-hidden />
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          Lokasi Unit
        </p>
        <p className="truncate text-xs font-extrabold text-slate-800">
          {name}
          {mapsUrl && <span className="ml-1 font-bold text-blue-700">• Maps</span>}
        </p>
      </div>
    </>
  )
  if (mapsUrl) {
    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noreferrer"
        title={`Buka lokasi ${name} di Google Maps`}
        className="flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50/50 px-2.5 py-2 transition-colors hover:bg-blue-50"
      >
        {inner}
      </a>
    )
  }
  return (
    <div className="flex items-start gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
      {inner}
    </div>
  )
}
