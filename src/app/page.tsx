import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Globe,
  Handshake,
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Printer,
  Smartphone,
  Sparkles,
  XCircle,
} from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Button } from '@/components/ui/button'
import { SALES_WHATSAPP } from '@/lib/constants'
import { waLink } from '@/lib/format'
import { PricingSection, type PricingPlan } from './pricing-section'

/** Link demo — ganti slug bila katalog demo showroom berubah. */
const DEMO_CATALOG_URL = '/s/byan-jaya-motor'
const DEMO_DASHBOARD_URL = '/admin/byan-jaya-motor'

/** CTA WhatsApp konsultasi umum (hero & CTA akhir). */
const WA_CONSULTHref = waLink(
  SALES_WHATSAPP,
  'Halo MotoStock, saya owner showroom motor bekas dan ingin konsultasi paket langganan.',
)

export const metadata: Metadata = {
  description:
    'Aplikasi stok & katalog digital untuk showroom motor bekas: kontrol stok multi-cabang, cetak nota otomatis, katalog instan siap sebar. Mulai Rp99.000/bulan.',
}

const PROBLEMS = [
  'Stok dicatat di buku & chat pribadi — gampang selisih dan lupa harga modal.',
  'Calon pembeli bentrok: satu unit sempat ditawarkan ke dua orang sekaligus.',
  'Nota tulis tangan, uang tanda jadi (DP) sering tidak tercatat rapi.',
  'Komisi makelar dihitung manual dan kerap jadi bahan perdebatan.',
]

const SOLUTIONS = [
  'Semua unit, modal, dan cabang terpantau rapi dari satu dashboard.',
  'Status unit terkunci otomatis saat ditahan — tidak ada lagi unit dobel tawar.',
  'Nota & kuitansi tanda jadi tercetak otomatis dalam sekali klik.',
  'Komisi marketing terrekap otomatis per unit yang deal.',
]

const FEATURES = [
  {
    icon: Globe,
    title: 'Web Katalog Mandiri & Interaktif',
    desc: 'Link mandiri per showroom (/s/[slug]), responsif mobile, filter merek & rentang harga, tombol chat pembeli langsung ke WhatsApp marketing.',
  },
  {
    icon: Building2,
    title: 'Manajemen Multi-Cabang & Staf',
    desc: 'Pantau unit di banyak cabang sekaligus dan atur hak akses kasir/admin cabang tanpa khawatir data keuangan bocor.',
  },
  {
    icon: Handshake,
    title: 'Manajemen Booking & Komisi Marketing',
    desc: 'Catat uang tanda jadi (DP), kunci status unit, dan rekap otomatis komisi makelar/sales.',
  },
  {
    icon: Printer,
    title: 'Laporan Mutasi & Cetak Nota Otomatis',
    desc: 'Cetak invoice/kuitansi transaksi instan dalam sekali klik serta pantau margin laba kotor unit yang terjual.',
  },
]

const SHOWCASE_ITEMS = [
  {
    title: 'Portal Kerja & Toko Online Marketing',
    icon: Smartphone,
    deviceLabel: 'Tampilan Laptop',
    deviceIcon: Monitor,
    src: 'https://imgg.fr/r/mipKFGNL.png',
    alt: 'Tampilan web katalog MotoStock versi desktop: katalog unit motor dengan foto, harga, dan tombol chat WhatsApp',
    points: [
      'Otomatis terhubung ke nomor WhatsApp masing-masing marketing.',
      'Tombol tahan unit (booking) instan, materi iklan, dan salin teks caption promosi.',
      'Optimal dan ringan diakses lewat browser smartphone.',
    ],
  },
  {
    title: 'Dashboard Manajemen Showroom & Katalog Publik',
    icon: LayoutDashboard,
    deviceLabel: 'Tampilan HP',
    deviceIcon: Smartphone,
    src: 'https://imgg.fr/r/wK0XO9xZ.png',
    alt: 'Tampilan web katalog MotoStock versi ponsel: grid unit motor responsif dengan status unit real-time',
    points: [
      'Kontrol stok multi-cabang, mutasi kas, dan laporan laba kotor.',
      'Tampilan katalog motor interaktif dengan foto jernih dan status unit real-time.',
      'Hak akses terpisah antara owner, admin cabang, dan tim marketing.',
    ],
  },
]

const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'starter',
    name: 'Starter',
    tagline: 'Showroom Mandiri',
    target: 'Showroom pemula (1 cabang)',
    monthly: 99_000,
    yearly: 990_000,
    features: [
      'Maksimal 30 unit motor aktif',
      '1 Cabang',
      '1 Akun Owner/Admin',
      'Web Katalog Digital & QR Code',
      'Filter Merek & Harga',
    ],
    ctaLabel: 'Pilih Starter',
    ctaHref: waLink(SALES_WHATSAPP, 'Halo MotoStock, saya tertarik langganan Paket Starter'),
  },
  {
    id: 'pro',
    name: 'Pro',
    tagline: 'Showroom Berkembang',
    target: 'Showroom aktif dengan tim penjualan',
    monthly: 199_000,
    yearly: 1_990_000,
    popular: true,
    features: [
      'Unit motor aktif UNLIMITED',
      'Hingga 3 Cabang Showroom',
      'Multi-Akun Staf & Hak Akses Terpisah',
      'Manajemen Booking & Komisi Marketing',
      'Cetak Nota/Tanda Jadi Otomatis',
      'Prioritas Dukungan WhatsApp',
    ],
    ctaLabel: 'Pilih Paket Pro',
    ctaHref: waLink(SALES_WHATSAPP, 'Halo MotoStock, saya tertarik langganan Paket Pro'),
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Jaringan Dealer',
    target: 'Jaringan showroom skala besar / multi-kota',
    monthly: 399_000,
    yearly: 3_990_000,
    features: [
      'Semua fitur Paket Pro',
      'Cabang Showroom Unlimited',
      'Dukungan Kustom Domain (katalog.namashowroom.com)',
      'Pendampingan Setup Awal Database Unit',
      'Backup Data Mingguan Otomatis',
    ],
    ctaLabel: 'Hubungi Sales',
    ctaHref: waLink(SALES_WHATSAPP, 'Halo MotoStock, saya ingin konsultasi Paket Enterprise'),
  },
]

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* ============ Navbar ============ */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/95 text-white backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Beranda MotoStock">
            <AppIcon className="h-8 w-8" />
            <span className="text-sm font-extrabold tracking-tight text-white">MotoStock</span>
          </Link>
          <nav aria-label="Navigasi utama" className="hidden items-center gap-6 text-xs font-bold text-slate-300 md:flex">
            <a href="#fitur" className="transition-colors hover:text-white">Fitur</a>
            <a href="#harga" className="transition-colors hover:text-white">Harga</a>
            <Link href={DEMO_CATALOG_URL} className="transition-colors hover:text-white">
              Contoh Katalog
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              className="hidden h-9 border-white/20 bg-white/5 px-3.5 text-xs font-bold text-white hover:bg-white/15 hover:text-white sm:inline-flex"
            >
              <Link href={DEMO_DASHBOARD_URL}>Login Owner</Link>
            </Button>
            <Button
              asChild
              className="h-9 bg-blue-600 px-3.5 text-xs font-extrabold text-white hover:bg-blue-500"
            >
              <Link href="/activate">Aktivasi Lisensi</Link>
            </Button>
          </div>
        </div>
        {/* Baris link mobile (tanpa JS — scroll horizontal) */}
        <nav
          aria-label="Navigasi halaman"
          className="flex gap-1.5 overflow-x-auto border-t border-white/10 px-4 py-2 md:hidden"
        >
          {[
            { href: '#fitur', label: 'Fitur' },
            { href: '#harga', label: 'Harga' },
            { href: DEMO_CATALOG_URL, label: 'Contoh Katalog' },
            { href: DEMO_DASHBOARD_URL, label: 'Login Owner' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="whitespace-nowrap rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold text-slate-200"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </header>

      {/* ============ Hero ============ */}
      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
          <div className="absolute right-[-6rem] top-32 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />
        </div>
        <div className="relative mx-auto grid w-full max-w-6xl gap-10 px-4 pb-14 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-20">
          <div>
            <p className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-300">
              <Sparkles className="h-3 w-3" aria-hidden /> Platform Manajemen Showroom Motor Bekas
            </p>
            <h1 className="mt-4 text-3xl font-extrabold leading-[1.15] tracking-tight sm:text-4xl lg:text-[2.7rem]">
              Kelola Stok Motor Bekas Lebih Rapi, Jual Lebih Cepat Lewat{' '}
              <span className="bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
                Web Katalog Modern.
              </span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
              Tinggalkan catatan manual dan grup WA yang berantakan. Satu sistem untuk kontrol
              stok multi-cabang, cetak nota otomatis, dan katalog digital instan siap sebar.
            </p>
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <Button
                asChild
                className="h-12 bg-blue-600 px-6 text-sm font-extrabold text-white hover:bg-blue-500"
              >
                <Link href={DEMO_CATALOG_URL}>
                  Lihat Contoh Katalog <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                className="h-12 bg-emerald-600 px-6 text-sm font-extrabold text-white hover:bg-emerald-500"
              >
                <a href={WA_CONSULTHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> Konsultasi Sales via
                  WhatsApp
                </a>
              </Button>
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[11px] font-semibold text-slate-400">
              {['Tanpa install aplikasi', 'Katalog siap sebar dalam menit', 'Nota & komisi otomatis'].map(
                (t) => (
                  <li key={t} className="inline-flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden /> {t}
                  </li>
                ),
              )}
            </ul>
          </div>

          {/* Mockup katalog (thumbnail foto unit asli dari katalog demo — aset statis lokal, ringan) */}
          <div aria-hidden className="hidden lg:block">
            <div className="relative mx-auto w-full max-w-md">
              <div className="rounded-2xl border border-white/10 bg-white shadow-2xl shadow-blue-950/60">
                <div className="flex items-center gap-1.5 border-b border-slate-100 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 truncate rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-500">
                    motostock.id/s/byan-jaya-motor
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div className="flex gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src="/hero/unit-1.jpg"
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-2.5 w-3/4 rounded bg-slate-200" />
                      <div className="h-2 w-1/2 rounded bg-slate-100" />
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-xs font-extrabold text-blue-700">Rp 18.500.000</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-extrabold text-emerald-700">
                          Ready
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-200 p-3">
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src="/hero/unit-2.jpg"
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-2.5 w-2/3 rounded bg-slate-200" />
                      <div className="h-2 w-2/5 rounded bg-slate-100" />
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-xs font-extrabold text-blue-700">Rp 24.000.000</span>
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-extrabold text-amber-700">
                          Ditahan 01:59:32
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 opacity-70">
                    <div className="relative h-16 w-20 shrink-0 overflow-hidden rounded-lg">
                      <Image
                        src="/hero/unit-3.jpg"
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-2.5 w-3/5 rounded bg-slate-200" />
                      <div className="h-2 w-1/3 rounded bg-slate-100" />
                      <div className="flex items-center justify-between pt-0.5">
                        <span className="text-xs font-extrabold text-slate-500 line-through">
                          Rp 15.000.000
                        </span>
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-extrabold text-slate-600">
                          Terjual
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 -left-6 rounded-xl border border-white/10 bg-slate-900 px-3.5 py-2.5 shadow-xl">
                <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                  Komisi Marketing
                </p>
                <p className="text-sm font-extrabold text-emerald-400">Rp 750.000 / unit</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Masalah vs Solusi + Fitur ============ */}
      <section id="fitur" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">
              Masalah vs Solusi
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Berhenti Kelola Stok Pakai Cara Lama
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Catatan manual dan grup WA memicu unit bentrok, DP tak tercatat, dan komisi
              diperdebatkan. MotoStock merapikan semuanya dalam satu sistem.
            </p>
          </div>

          {/* Perbandingan */}
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
              <p className="flex items-center gap-2 text-sm font-extrabold text-red-700">
                <XCircle className="h-4 w-4" aria-hidden /> Tanpa MotoStock
              </p>
              <ul className="mt-3 space-y-2.5">
                {PROBLEMS.map((p) => (
                  <li key={p} className="flex items-start gap-2 text-xs leading-relaxed text-red-900/80">
                    <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" aria-hidden />
                    <span className="font-semibold">{p}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5">
              <p className="flex items-center gap-2 text-sm font-extrabold text-blue-700">
                <CheckCircle2 className="h-4 w-4" aria-hidden /> Dengan MotoStock
              </p>
              <ul className="mt-3 space-y-2.5">
                {SOLUTIONS.map((s) => (
                  <li key={s} className="flex items-start gap-2 text-xs leading-relaxed text-blue-900/80">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                    <span className="font-semibold">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Grid fitur */}
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <f.icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="mt-3.5 text-sm font-extrabold leading-snug text-slate-900">
                  {f.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{f.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Preview Tampilan (Showcase Screenshot) ============ */}
      <section id="preview" className="scroll-mt-20">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">
              Preview Sistem
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Tampilan Antarmuka Modern, Cepat, dan Siap Pakai di HP Maupun Laptop
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Dirancang khusus agar pemilik showroom dan tim marketing bisa mengelola stok serta
              membagikan katalog semudah menggunakan aplikasi chat.
            </p>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:gap-8">
            {SHOWCASE_ITEMS.map((item) => (
              <article
                key={item.title}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                    <item.icon className="h-5 w-5" aria-hidden />
                  </div>
                  <h3 className="text-sm font-extrabold leading-snug text-slate-900 sm:text-base">
                    {item.title}
                  </h3>
                </div>

                {/* Frame mockup ala jendela browser/device */}
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl md:p-3">
                  <div aria-hidden className="flex items-center gap-1.5 px-1.5 pb-2">
                    <span className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="ml-1.5 truncate rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 sm:text-[10px]">
                      motostock.id/s/byan-jaya-motor
                    </span>
                  </div>
                  <div className="relative h-64 overflow-hidden rounded-xl border border-slate-100 bg-slate-50 sm:h-72 lg:h-80">
                    <Image
                      src={item.src}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 1024px) 45vw, 100vw"
                      className="object-cover object-top"
                    />
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-slate-950/80 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-white backdrop-blur sm:text-[10px]">
                      <item.deviceIcon className="h-3 w-3" aria-hidden /> {item.deviceLabel}
                    </span>
                  </div>
                </div>

                <ul className="mt-4 space-y-2.5">
                  {item.points.map((p) => (
                    <li
                      key={p}
                      className="flex items-start gap-2 text-xs leading-relaxed text-slate-600 sm:text-sm"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                      <span className="font-medium">{p}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ============ Harga ============ */}
      <section id="harga" className="scroll-mt-20 bg-slate-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:py-16">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">
              Harga Paket
            </p>
            <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
              Pilih Paket Sesuai Skala Showroom Anda
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Semua paket sudah termasuk web katalog digital. Naik atau turun paket kapan saja —
              tanpa biaya tersembunyi.
            </p>
          </div>
          <div className="mt-8">
            <PricingSection plans={PRICING_PLANS} />
          </div>
        </div>
      </section>

      {/* ============ CTA Akhir ============ */}
      <section className="mx-auto w-full max-w-6xl px-4 pb-14 sm:pb-16">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-10 text-center text-white sm:px-10">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -bottom-24 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-blue-600/25 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              Rapikan Stok Showroom Anda Hari Ini
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
              Mulai dari paket Starter Rp99.000/bulan — web katalog digital langsung siap sebar
              ke pembeli. Konsultasikan dulu jika masih ragu.
            </p>
            <div className="mt-6 flex flex-col justify-center gap-2.5 sm:flex-row">
              <Button
                asChild
                className="h-12 bg-blue-600 px-6 text-sm font-extrabold text-white hover:bg-blue-500"
              >
                <Link href="/activate">
                  Aktivasi Lisensi <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden />
                </Link>
              </Button>
              <Button
                asChild
                className="h-12 bg-emerald-600 px-6 text-sm font-extrabold text-white hover:bg-emerald-500"
              >
                <a href={WA_CONSULTHref} target="_blank" rel="noreferrer">
                  <MessageCircle className="mr-1.5 h-4 w-4" aria-hidden /> Chat Sales WhatsApp
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
