import Link from 'next/link'
import {
  ArrowRight,
  ClipboardCopy,
  LayoutDashboard,
  Lock,
  Megaphone,
  Timer,
} from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Button } from '@/components/ui/button'
import { CatalogLookupForm } from './catalog-lookup-form'
import { DEMO_LICENSES } from '@/lib/constants'

const FEATURES = [
  {
    icon: LayoutDashboard,
    title: 'Dashboard Stok Owner',
    desc: 'Input unit lengkap: modal, harga jual, komisi, pajak, surat, foto. Pantau perputaran modal dan status tiap motor (Ready / Hold / Terjual).',
  },
  {
    icon: Megaphone,
    title: 'Katalog Marketing',
    desc: 'Link katalog ringkas tanpa login. Salin iklan siap-posting ke WhatsApp Status & Marketplace dalam satu ketukan.',
  },
  {
    icon: Timer,
    title: 'Tahan Unit 2 Jam',
    desc: 'Kunci unit saat calon pembeli sedang di jalan. Timer hitung mundur mencegah marketing saling bentrok unit.',
  },
]

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* Top bar */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <AppIcon className="h-8 w-8" />
            <div className="leading-tight">
              <span className="text-sm font-extrabold text-blue-700">MotoStock</span>
            </div>
          </div>
          <Button
            asChild
            className="h-9 bg-blue-700 px-4 text-xs font-bold hover:bg-blue-800"
          >
            <Link href="/activate">Aktivasi Lisensi</Link>
          </Button>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-2 pt-8 sm:pt-12">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600">
          <Lock className="h-3 w-3" /> Sistem lisensi mandiri — sekali bayar, showroom sendiri
        </p>
        <h1 className="max-w-2xl text-2xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          Kelola stok showroom motor bekas. Bagikan katalog ke tim marketing.
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600 sm:text-base">
          Satu aplikasi kerja: owner memantau modal &amp; perputaran stok, marketing freelance
          dapat link katalog siap bagikan — lengkap dengan tombol salin iklan dan tahan unit 2
          jam.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            className="h-12 bg-blue-700 px-6 text-sm font-extrabold hover:bg-blue-800"
          >
            <Link href="/activate">
              Aktivasi Software <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 border-slate-300 bg-white px-6 text-sm font-bold text-slate-700"
          >
            <Link href="/s/showroom-jaya">Lihat Contoh Katalog</Link>
          </Button>
        </div>
      </section>

      {/* Lookup katalog */}
      <section className="mx-auto w-full max-w-5xl px-4 pt-6">
        <CatalogLookupForm />
      </section>

      {/* Fitur */}
      <section className="mx-auto grid w-full max-w-5xl gap-3 px-4 pt-6 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-50 text-blue-700">
              <f.icon className="h-5 w-5" aria-hidden />
            </div>
            <h2 className="mt-3 text-sm font-extrabold text-slate-900">{f.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-600">{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Demo */}
      <section className="mx-auto w-full max-w-5xl px-4 pb-10 pt-6">
        <div className="rounded-lg border border-slate-300 bg-white p-4 sm:p-6">
          <div className="flex items-start gap-2">
            <ClipboardCopy className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            <div>
              <h2 className="text-sm font-extrabold text-slate-900">
                Coba Demo (Data Contoh)
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Semua data di bawah tersedia langsung untuk mencoba alur kerja aplikasi.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Katalog publik marketing
              </p>
              <Link
                href="/s/showroom-jaya"
                className="mt-1 block text-sm font-extrabold text-blue-700 hover:underline"
              >
                /s/showroom-jaya
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">
                10 unit motor contoh berfoto, siap uji salin iklan &amp; tahan unit.
              </p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                Dashboard owner
              </p>
              <Link
                href="/admin/showroom-jaya"
                className="mt-1 block text-sm font-extrabold text-blue-700 hover:underline"
              >
                /admin/showroom-jaya
              </Link>
              <p className="mt-0.5 text-xs text-slate-500">
                Kelola stok, lihat modal, quick-action status &amp; kuota lisensi.
              </p>
            </div>
          </div>

          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              License key untuk uji aktivasi
            </p>
            <ul className="mt-2 space-y-1.5">
              {DEMO_LICENSES.map((l) => (
                <li key={l.key} className="flex flex-wrap items-center gap-2 text-xs">
                  <code className="rounded bg-slate-100 px-1.5 py-0.5 font-bold text-slate-800">
                    {l.key}
                  </code>
                  <span className="font-semibold text-slate-600">
                    {l.plan} • maks {l.maxVehicles} unit — {l.note}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  )
}
