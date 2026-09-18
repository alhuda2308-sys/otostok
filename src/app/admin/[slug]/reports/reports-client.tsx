'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Download, FileBarChart } from 'lucide-react'
import {
  AdminGate,
  AdminNav,
  AdminSubHeader,
  ShowroomNotFound,
} from '@/components/admin-shell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { downloadCsv, toCsv } from '@/lib/csv'
import { formatDateID, formatDateISO, formatRupiah } from '@/lib/format'
import { useReportsQuery } from '@/lib/queries'

type Preset = 'today' | 'week' | 'month' | 'custom'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'Harian' },
  { key: 'week', label: 'Mingguan' },
  { key: 'month', label: 'Bulanan' },
  { key: 'custom', label: 'Kustom' },
]

/** Rentang tanggal preset (zona lokal). */
function rangeFor(p: Preset, customFrom: string, customTo: string): { from: string; to: string } {
  const now = new Date()
  if (p === 'today') {
    const iso = formatDateISO(now)
    return { from: iso, to: iso }
  }
  if (p === 'week') {
    const d = new Date(now)
    const day = (d.getDay() + 6) % 7 // Senin = 0
    d.setDate(d.getDate() - day)
    const from = formatDateISO(d)
    const to = formatDateISO(now)
    return { from, to }
  }
  if (p === 'month') {
    const from = formatDateISO(new Date(now.getFullYear(), now.getMonth(), 1))
    return { from, to: formatDateISO(now) }
  }
  return { from: customFrom || formatDateISO(now), to: customTo || formatDateISO(now) }
}

export function AdminReportsClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <ReportsPage slug={slug} session={session} />}
    </AdminGate>
  )
}

function ReportsPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  const isOwner = session.role === 'owner'
  const [preset, setPreset] = useState<Preset>('month')
  const [customFrom, setCustomFrom] = useState(formatDateISO(new Date()))
  const [customTo, setCustomTo] = useState(formatDateISO(new Date()))

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo])

  // Data via TanStack Query — keepPreviousData membuat perubahan preset tampil
  // mulus (data rentang lama tetap tampil saat rentang baru dimuat), dan hasil
  // per preset tersimpan di cache (pindah tab tidak memicu skeleton ulang).
  const from = `${range.from}T00:00:00`
  const to = `${range.to}T23:59:59`
  const reportsQuery = useReportsQuery(slug, from, to)
  const data = reportsQuery.data ?? null
  const loading = reportsQuery.isPending && !data
  const error =
    reportsQuery.error instanceof Error && !data ? reportsQuery.error.message : null

  function exportCsv() {
    if (!data) return
    const isOwnerData = data.totals.capital != null
    const headers = isOwnerData
      ? ['Tanggal Laku', 'Merk', 'Model', 'Plat', 'Harga Deal (Rp)', 'Komisi (Rp)', 'Modal (Rp)', 'Margin (Rp)', 'Marketing']
      : ['Tanggal Laku', 'Merk', 'Model', 'Plat', 'Harga Deal (Rp)', 'Komisi (Rp)', 'Marketing']
    const rows = data.items.map((it) =>
      isOwnerData
        ? [
            formatDateISO(it.soldAt),
            it.brand,
            it.model,
            it.licensePlate,
            it.soldPrice,
            it.commissionAmount,
            it.basePrice ?? 0,
            it.margin ?? 0,
            it.soldBy ?? '',
          ]
        : [
            formatDateISO(it.soldAt),
            it.brand,
            it.model,
            it.licensePlate,
            it.soldPrice,
            it.commissionAmount,
            it.soldBy ?? '',
          ],
    )
    // Baris total
    rows.push(
      isOwnerData
        ? ['TOTAL', '', '', '', data.totals.omzet, data.totals.commission, data.totals.capital ?? 0, data.totals.margin ?? 0, '']
        : ['TOTAL', '', '', '', data.totals.omzet, data.totals.commission, ''],
    )
    downloadCsv(
      `laporan-penjualan-${slug}-${range.from}_sd_${range.to}.csv`,
      toCsv(headers, rows),
    )
    toast.success('File CSV laporan penjualan diunduh.')
  }

  return (
    <>
      <AdminSubHeader
        slug={slug}
        title="Laporan Penjualan"
        subtitle="Berdasarkan tanggal unit ditandai terjual (tanggal laku)."
        session={session}
      />
      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 sm:px-6 lg:space-y-6 lg:px-10 lg:py-6">
        {/* Filter rentang waktu */}
        <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center lg:rounded-xl lg:p-4">
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 lg:rounded-xl lg:p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPreset(p.key)}
                className={`h-9 flex-1 whitespace-nowrap rounded-md px-3 text-xs font-bold sm:flex-none lg:h-11 lg:rounded-lg lg:px-5 lg:text-sm lg:font-semibold ${
                  preset === p.key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 rounded-xl text-xs sm:h-10 lg:h-11 lg:text-sm font-medium"
                aria-label="Dari tanggal"
              />
              <span className="text-xs font-bold text-slate-400 lg:text-sm">s/d</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 rounded-xl text-xs sm:h-10 lg:h-11 lg:text-sm font-medium"
                aria-label="Sampai tanggal"
              />
            </div>
          )}
          {preset !== 'custom' && (
            <p className="text-xs font-semibold text-slate-500 lg:text-sm">
              {formatDateID(range.from)} — {formatDateID(range.to)}
            </p>
          )}
          <Button
            variant="outline"
            className="h-9 shrink-0 rounded-lg border-slate-300 text-xs font-bold sm:ml-auto lg:h-12 lg:rounded-xl lg:px-5 lg:text-sm lg:font-bold"
            onClick={exportCsv}
            disabled={!data || data.items.length === 0}
          >
            <Download className="h-3.5 w-3.5 lg:h-4 lg:w-4" /> Ekspor Laporan (CSV)
          </Button>
        </section>

        {loading && <div className="h-48 animate-pulse rounded-lg bg-slate-200" />}

        {error && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-800">{error}</p>
            <Button
              variant="outline"
              className="mt-3 h-10 border-red-300 text-xs font-bold"
              onClick={() => reportsQuery.refetch()}
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {data && !loading && (
          <>
            {/* Metrik */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 lg:text-xs">
                  Unit Terjual
                </p>
                <p className="mt-1 text-2xl font-extrabold text-red-900 lg:mt-2 lg:text-4xl lg:font-black">{data.totals.count}</p>
                <p className="text-[11px] text-red-700 lg:text-sm lg:font-medium">unit deal periode ini</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-2xl lg:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:text-xs">
                  Total Omzet
                </p>
                <p className="mt-1 text-base font-extrabold leading-snug tracking-tight text-slate-900 sm:text-lg lg:mt-2 lg:text-2xl xl:text-3xl xl:font-black">
                  {formatRupiah(data.totals.omzet)}
                </p>
                <p className="text-[11px] text-slate-400 lg:text-sm lg:font-medium">akumulasi harga deal</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 lg:text-xs">
                  Komisi Keluar
                </p>
                <p className="mt-1 text-base font-extrabold leading-snug tracking-tight text-emerald-900 sm:text-lg lg:mt-2 lg:text-2xl xl:text-3xl xl:font-black">
                  {formatRupiah(data.totals.commission)}
                </p>
                <p className="text-[11px] text-emerald-700 lg:text-sm lg:font-medium">komisi marketing</p>
              </div>
              {isOwner ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 lg:text-xs">
                    Margin Laba Bersih
                  </p>
                  <p className="mt-1 text-base font-extrabold leading-snug tracking-tight text-slate-900 sm:text-lg lg:mt-2 lg:text-2xl xl:text-3xl xl:font-black">
                    {formatRupiah(data.totals.margin)}
                  </p>
                  <p className="text-[11px] text-blue-700 lg:text-sm lg:font-medium">
                    omzet − modal ({formatRupiah(data.totals.capital)}) − komisi
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-2xl lg:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:text-xs">
                    Rata-rata Deal
                  </p>
                  <p className="mt-1 text-base font-extrabold leading-snug tracking-tight text-slate-900 sm:text-lg lg:mt-2 lg:text-2xl xl:text-3xl xl:font-black">
                    {formatRupiah(
                      data.totals.count > 0 ? Math.round(data.totals.omzet / data.totals.count) : 0,
                    )}
                  </p>
                  <p className="text-[11px] text-slate-400 lg:text-sm lg:font-medium">per unit terjual</p>
                </div>
              )}
            </section>

            {/* Daftar penjualan */}
            {data.items.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                <FileBarChart className="h-8 w-8 text-slate-300" aria-hidden />
                <p className="mt-2 text-sm font-bold text-slate-700">
                  Tidak ada penjualan pada rentang waktu ini.
                </p>
              </div>
            ) : (
              <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white lg:rounded-xl">
                {/* Desktop: tabel — min-w + scroll, tidak pernah memotong kolom kanan */}
                <table className="hidden w-full min-w-[860px] text-left text-sm md:table lg:min-w-[1020px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500 lg:text-xs">
                      <th className="px-4 py-2.5 font-bold lg:px-6 lg:py-3.5">Tanggal</th>
                      <th className="px-4 py-2.5 font-bold lg:px-6 lg:py-3.5">Unit</th>
                      <th className="px-4 py-2.5 font-bold lg:px-6 lg:py-3.5">Plat</th>
                      <th className="px-4 py-2.5 text-right font-bold lg:px-6 lg:py-3.5">Harga Deal</th>
                      <th className="px-4 py-2.5 text-right font-bold lg:px-6 lg:py-3.5">Komisi</th>
                      {isOwner && <th className="px-4 py-2.5 text-right font-bold lg:px-6 lg:py-3.5">Margin</th>}
                      <th className="px-4 py-2.5 font-bold lg:px-6 lg:py-3.5">Marketing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-100 last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-600 lg:px-6 lg:py-4 lg:text-sm">
                          {formatDateID(it.soldAt)}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900 lg:px-6 lg:py-4 lg:text-base">
                          {it.brand} {it.model}
                        </td>
                        <td className="px-4 py-3 text-xs font-bold text-slate-600 lg:px-6 lg:py-4 lg:text-sm">
                          {it.licensePlate}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-extrabold text-slate-900 lg:px-6 lg:py-4 lg:text-base">
                          {formatRupiah(it.soldPrice)}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-emerald-700 lg:px-6 lg:py-4 lg:text-base">
                          {formatRupiah(it.commissionAmount)}
                        </td>
                        {isOwner && (
                          <td className="whitespace-nowrap px-4 py-3 text-right font-bold text-blue-800 lg:px-6 lg:py-4 lg:text-base">
                            {formatRupiah(it.margin)}
                          </td>
                        )}
                        <td className="px-4 py-3 text-xs font-semibold text-slate-600 lg:px-6 lg:py-4 lg:text-sm">
                          {it.soldBy ?? '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 bg-slate-50">
                      <td className="px-4 py-3 text-xs font-extrabold uppercase text-slate-500 lg:px-6 lg:py-4 lg:text-sm" colSpan={3}>
                        Total ({data.totals.count} unit)
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-slate-900 lg:px-6 lg:py-4 lg:text-base">
                        {formatRupiah(data.totals.omzet)}
                      </td>
                      <td className="px-4 py-3 text-right font-extrabold text-emerald-700 lg:px-6 lg:py-4 lg:text-base">
                        {formatRupiah(data.totals.commission)}
                      </td>
                      {isOwner && (
                        <td className="px-4 py-3 text-right font-extrabold text-blue-800 lg:px-6 lg:py-4 lg:text-base">
                          {formatRupiah(data.totals.margin)}
                        </td>
                      )}
                      <td />
                    </tr>
                  </tfoot>
                </table>

                {/* Mobile: kartu */}
                <ul className="divide-y divide-slate-100 lg:hidden">
                  {data.items.map((it) => (
                    <li key={it.id} className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-extrabold text-slate-900">
                            {it.brand} {it.model}
                          </p>
                          <p className="text-xs text-slate-500">
                            {it.licensePlate} • {formatDateID(it.soldAt)}
                          </p>
                          {it.soldBy && (
                            <p className="mt-0.5 text-[11px] font-bold text-slate-500">
                              Marketing: {it.soldBy}
                            </p>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-extrabold text-slate-900">
                            {formatRupiah(it.soldPrice)}
                          </p>
                          <p className="text-[11px] font-bold text-emerald-700">
                            Komisi {formatRupiah(it.commissionAmount)}
                          </p>
                          {isOwner && it.margin != null && (
                            <p className="text-[11px] font-bold text-blue-800">
                              Margin {formatRupiah(it.margin)}
                            </p>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </>
  )
}
