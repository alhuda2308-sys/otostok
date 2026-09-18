'use client'

import { useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, Pencil } from 'lucide-react'
import {
  AdminGate,
  AdminNav,
  AdminSubHeader,
  ShowroomNotFound,
} from '@/components/admin-shell'
import { MoneyInput } from '@/components/money-input'
import { PhotoManager } from '@/components/photo-manager'
import { StatusBadge } from '@/components/status-badge'
import { VehiclePhoto } from '@/components/vehicle-photo'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDateID, formatDateISO, formatRupiah } from '@/lib/format'
import { ApiError, qk, useInventoryQuery } from '@/lib/queries'
import type { AdminVehicle } from '@/lib/types'

export function AdminMutasiClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <MutasiPage slug={slug} session={session} />}
    </AdminGate>
  )
}

type PeriodRange = { from: Date | null; to: Date | null }

/** Cek apakah tanggal ISO masuk rentang periode (null = tanpa batas). */
function inPeriod(d: string | null | undefined, r: PeriodRange): boolean {
  if (!r.from && !r.to) return true
  if (!d) return false
  const t = new Date(d).getTime()
  if (r.from && t < r.from.getTime()) return false
  if (r.to && t > r.to.getTime()) return false
  return true
}

function MutasiPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  const [tab, setTab] = useState<'in' | 'out'>('in')
  // Filter periode riwayat (client-side, data tetap dari cache inventory).
  const [period, setPeriod] = useState<'all' | '7d' | '30d' | 'month' | 'custom'>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  // Shared cache dengan Dashboard — pindah tab menampilkan data instan.
  const inventoryQuery = useInventoryQuery(slug)
  const queryClient = useQueryClient()
  const vehicles = inventoryQuery.data?.vehicles ?? null
  const notFound =
    inventoryQuery.error instanceof ApiError && inventoryQuery.error.status === 404
  const error =
    inventoryQuery.error && !notFound
      ? inventoryQuery.error instanceof Error
        ? inventoryQuery.error.message
        : 'Gagal memuat data mutasi.'
      : null
  const [editTarget, setEditTarget] = useState<AdminVehicle | null>(null)

  // Rentang waktu filter periode (null = tanpa batas).
  const periodRange = useMemo((): PeriodRange => {
    const now = new Date()
    if (period === 'all') return { from: null, to: null }
    if (period === '7d' || period === '30d') {
      const days = period === '7d' ? 7 : 30
      return { from: new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1), to: null }
    }
    if (period === 'month')
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: null }
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`) : null,
      to: customTo ? new Date(`${customTo}T23:59:59`) : null,
    }
  }, [period, customFrom, customTo])

  const isOwner = session.role === 'owner'

  const masukList = useMemo(
    () =>
      (vehicles ?? [])
        .filter((v) => inPeriod(v.purchasedAt ?? v.createdAt, periodRange))
        .sort(
          (a, b) =>
            new Date(b.purchasedAt ?? b.createdAt).getTime() -
            new Date(a.purchasedAt ?? a.createdAt).getTime(),
        ),
    [vehicles, periodRange],
  )

  const keluarList = useMemo(
    () =>
      (vehicles ?? [])
        .filter((v) => v.status === 'sold' && inPeriod(v.soldAt, periodRange))
        .sort(
          (a, b) => new Date(b.soldAt ?? 0).getTime() - new Date(a.soldAt ?? 0).getTime(),
        ),
    [vehicles, periodRange],
  )

  const activeList = tab === 'in' ? masukList : keluarList

  if (notFound) return <ShowroomNotFound slug={slug} />

  return (
    <>
      <AdminSubHeader
        slug={slug}
        title="Logbook Mutasi Unit"
        subtitle="Riwayat unit masuk (pembelian & kondisi datang) dan unit keluar (deal & serah terima)."
        session={session}
      />
      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 sm:px-6 lg:space-y-5 lg:px-10 lg:py-6">
        {/* Tab */}
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 lg:rounded-xl lg:p-1">
          <button
            type="button"
            onClick={() => setTab('in')}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold lg:h-12 lg:rounded-lg lg:text-base lg:font-semibold ${
              tab === 'in' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowDownToLine className="h-4 w-4 lg:h-5 lg:w-5" /> Unit Masuk
            {vehicles && <span className="opacity-80">({masukList.length})</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('out')}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold lg:h-12 lg:rounded-lg lg:text-base lg:font-semibold ${
              tab === 'out' ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpFromLine className="h-4 w-4 lg:h-5 lg:w-5" /> Unit Keluar
            {vehicles && <span className="opacity-80">({keluarList.length})</span>}
          </button>
        </div>

        {/* Filter periode */}
        <section className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center lg:rounded-xl lg:p-4">
          <Select value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
            <SelectTrigger
              className="h-11! w-full rounded-xl bg-white text-sm font-medium sm:w-48 lg:h-12! lg:text-base"
              aria-label="Filter periode riwayat"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Periode</SelectItem>
              <SelectItem value="7d">7 Hari Terakhir</SelectItem>
              <SelectItem value="30d">30 Hari Terakhir</SelectItem>
              <SelectItem value="month">Bulan Ini</SelectItem>
              <SelectItem value="custom">Kustom Rentang</SelectItem>
            </SelectContent>
          </Select>
          {period === 'custom' && (
            <div className="flex flex-1 items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-11 rounded-xl text-sm font-medium lg:h-12 lg:text-base"
                aria-label="Dari tanggal"
              />
              <span className="text-xs font-bold text-slate-400 lg:text-sm">s/d</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-11 rounded-xl text-sm font-medium lg:h-12 lg:text-base"
                aria-label="Sampai tanggal"
              />
            </div>
          )}
          {period !== 'custom' && (
            <p className="text-xs font-semibold text-slate-500 sm:ml-auto lg:text-sm">
              Menampilkan {activeList.length} riwayat mutasi
            </p>
          )}
        </section>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-800">{error}</p>
            <Button
              variant="outline"
              className="mt-3 h-10 border-red-300 text-xs font-bold"
              onClick={() => inventoryQuery.refetch()}
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {!vehicles && !error && <div className="h-64 animate-pulse rounded-lg bg-slate-200" />}

        {vehicles &&
          (activeList.length === 0 ? (
            <EmptyLog
              text={
                tab === 'in'
                  ? 'Belum ada unit masuk pada periode ini.'
                  : 'Belum ada unit keluar (terjual) pada periode ini.'
              }
            />
          ) : (
            <>
              {/* Desktop (lg+): tabel riwayat mutasi — baris lega, nominal berwarna */}
              <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                      <th className="px-6 py-3.5 font-bold">Tanggal &amp; Unit</th>
                      <th className="px-4 py-3.5 font-bold">Tipe Mutasi</th>
                      <th className="px-4 py-3.5 text-right font-bold">Nominal</th>
                      <th className="px-6 py-3.5 text-right font-bold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeList.map((v) => (
                      <tr key={v.id} className="border-b border-slate-100 last:border-0">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                              <VehiclePhoto
                                sizes="64px"
                                src={
                                  tab === 'in'
                                    ? (v.arrivalPhotos[0] ?? v.photos[0])
                                    : v.photos[0]
                                }
                                alt={`Foto ${v.brand} ${v.model}`}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-base font-bold text-slate-900">
                                {v.brand} {v.model}
                              </p>
                              <p className="mt-0.5 text-sm font-medium text-slate-500">
                                {v.licensePlate} •{' '}
                                {tab === 'in'
                                  ? `Masuk ${formatDateID(v.purchasedAt ?? v.createdAt)}`
                                  : v.soldAt
                                    ? `Laku ${formatDateID(v.soldAt)}`
                                    : 'Laku: tanggal belum dicatat'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center rounded-lg px-3.5 py-1.5 text-xs font-semibold sm:text-sm ${
                              tab === 'in'
                                ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                : 'bg-red-50 text-red-700 ring-1 ring-red-200'
                            }`}
                          >
                            {tab === 'in' ? 'Masuk' : 'Terjual'}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          {tab === 'in' ? (
                            isOwner && v.basePrice != null ? (
                              <>
                                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  Modal
                                </p>
                                <p className="whitespace-nowrap text-base font-bold text-red-600">
                                  {formatRupiah(v.basePrice)}
                                </p>
                              </>
                            ) : (
                              <span className="text-sm text-slate-400">—</span>
                            )
                          ) : (
                            <>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                Deal
                              </p>
                              <p className="whitespace-nowrap text-base font-bold text-emerald-600">
                                {formatRupiah(v.soldPrice)}
                              </p>
                              {isOwner && v.basePrice != null && (
                                <p className="whitespace-nowrap text-xs font-bold text-emerald-600">
                                  Laba{' '}
                                  {formatRupiah(
                                    (v.soldPrice ?? 0) -
                                      v.basePrice -
                                      (v.commissionAmount ?? 0),
                                  )}
                                </p>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="outline"
                            className="h-10 rounded-lg border-slate-300 px-3.5 text-sm font-semibold"
                            onClick={() => setEditTarget(v)}
                          >
                            <Pencil className="size-4" /> Kelola Info{' '}
                            {tab === 'in' ? 'Masuk' : 'Keluar'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile & tablet (<lg): kartu riwayat */}
              <div className="space-y-2 lg:hidden">
                {tab === 'in'
                  ? masukList.map((v) => (
                      <article
                        key={v.id}
                        className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          <VehiclePhoto
                            sizes="80px"
                            src={v.arrivalPhotos[0] ?? v.photos[0]}
                            alt={`Foto ${v.brand} ${v.model}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-extrabold text-slate-900">
                                {v.brand} {v.model}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {v.licensePlate} • Masuk{' '}
                                {formatDateID(v.purchasedAt ?? v.createdAt)}
                              </p>
                            </div>
                            <StatusBadge status={v.status} />
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">
                            {v.arrivalNotes || 'Belum ada catatan kondisi fisik saat datang.'}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-2">
                            {v.arrivalPhotos.length > 0 && (
                              <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                                {v.arrivalPhotos.length} foto kondisi
                              </span>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-slate-300 px-2.5 text-[11px] font-bold"
                              onClick={() => setEditTarget(v)}
                            >
                              <Pencil className="mr-1 h-3 w-3" /> Kelola Info Masuk
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))
                  : keluarList.map((v) => (
                      <article
                        key={v.id}
                        className="flex gap-3 rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                          <VehiclePhoto
                            sizes="80px"
                            src={v.photos[0]}
                            alt={`Foto ${v.brand} ${v.model}`}
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-sm font-extrabold text-slate-900">
                                {v.brand} {v.model}
                              </h3>
                              <p className="text-xs text-slate-500">
                                {v.licensePlate} • Laku{' '}
                                {v.soldAt ? formatDateID(v.soldAt) : 'tanggal belum dicatat'}
                              </p>
                            </div>
                            <StatusBadge status={v.status} />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="font-extrabold text-slate-900">
                              Deal: {formatRupiah(v.soldPrice)}
                            </span>
                            <span className="font-bold text-slate-600">
                              Marketing: {v.soldBy || 'belum dicatat'}
                            </span>
                            {v.handoverPhoto && (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                                Bukti serah terima ada
                              </span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-1.5 h-8 border-slate-300 px-2.5 text-[11px] font-bold"
                            onClick={() => setEditTarget(v)}
                          >
                            <Pencil className="mr-1 h-3 w-3" /> Kelola Info Keluar
                          </Button>
                        </div>
                      </article>
                    ))}
              </div>
            </>
          ))}
      </div>

      {/* Dialog kelola info mutasi */}
      {editTarget && (
        <MutasiEditDialog
          slug={slug}
          tab={tab}
          vehicle={editTarget}
          isOwner={session.role === 'owner'}
          open
          onOpenChange={(o) => !o && setEditTarget(null)}
          onSaved={() => {
            setEditTarget(null)
            // Invalidate cache inventory — Dashboard & Mutasi sama-sama diperbarui.
            queryClient.invalidateQueries({ queryKey: qk.inventory(slug) })
          }}
        />
      )}
    </>
  )
}

function EmptyLog({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
      <ClipboardList className="h-8 w-8 text-slate-300" aria-hidden />
      <p className="mt-2 text-sm font-bold text-slate-700">{text}</p>
    </div>
  )
}

function MutasiEditDialog({
  slug,
  tab,
  vehicle,
  isOwner,
  open,
  onOpenChange,
  onSaved,
}: {
  slug: string
  tab: 'in' | 'out'
  vehicle: AdminVehicle
  isOwner: boolean
  open: boolean
  onOpenChange: (o: boolean) => void
  onSaved: () => void
}) {
  const [purchasedAt, setPurchasedAt] = useState(
    formatDateISO(vehicle.purchasedAt ?? vehicle.createdAt),
  )
  const [arrivalNotes, setArrivalNotes] = useState(vehicle.arrivalNotes ?? '')
  const [arrivalPhotos, setArrivalPhotos] = useState<string[]>(vehicle.arrivalPhotos)
  const [soldAt, setSoldAt] = useState(formatDateISO(vehicle.soldAt ?? new Date()))
  const [soldPrice, setSoldPrice] = useState<number | null>(
    vehicle.soldPrice ?? vehicle.sellingPrice,
  )
  const [soldBy, setSoldBy] = useState(vehicle.soldBy ?? '')
  const [handoverPhoto, setHandoverPhoto] = useState<string[]>(
    vehicle.handoverPhoto ? [vehicle.handoverPhoto] : [],
  )
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const payload: Record<string, unknown> =
        tab === 'in'
          ? {
              purchasedAt: new Date(`${purchasedAt}T09:00:00`).toISOString(),
              arrivalNotes: arrivalNotes.trim(),
              arrivalPhotos,
            }
          : {
              soldAt: new Date(`${soldAt}T15:00:00`).toISOString(),
              soldPrice,
              soldBy: soldBy.trim(),
              handoverPhoto: handoverPhoto[0] ?? null,
            }
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan info mutasi.')
      toast.success('Info mutasi tersimpan.')
      onOpenChange(false)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menyimpan info mutasi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md lg:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold lg:text-lg">
            {tab === 'in' ? 'Info Unit Masuk' : 'Info Unit Keluar'}
          </DialogTitle>
          <DialogDescription>
            {vehicle.brand} {vehicle.model} • {vehicle.licensePlate}
          </DialogDescription>
        </DialogHeader>

        {tab === 'in' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mut-date" className="font-semibold text-slate-700">Tanggal Masuk / Pembelian *</Label>
              <Input
                id="mut-date"
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="h-12 rounded-xl px-4 text-base md:text-base"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mut-notes" className="font-semibold text-slate-700">Catatan Kondisi Fisik Saat Datang</Label>
              <Textarea
                id="mut-notes"
                value={arrivalNotes}
                onChange={(e) => setArrivalNotes(e.target.value)}
                placeholder="cth: Strip kanan lecet, mesin normal, ban depan baru"
                rows={3}
                className="resize-none rounded-xl p-4 text-base md:text-base"
                maxLength={500}
              />
            </div>
            <PhotoManager
              photos={arrivalPhotos}
              onChange={setArrivalPhotos}
              label="Foto Kondisi Saat Datang"
              withCover={false}
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mut-sold-date" className="font-semibold text-slate-700">Tanggal Laku *</Label>
                <Input
                  id="mut-sold-date"
                  type="date"
                  value={soldAt}
                  onChange={(e) => setSoldAt(e.target.value)}
                  className="h-12 rounded-xl px-4 text-base md:text-base"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mut-sold-price" className="font-semibold text-slate-700">Harga Deal Akhir (Rp)</Label>
                <MoneyInput
                  id="mut-sold-price"
                  value={soldPrice}
                  onChange={setSoldPrice}
                  className="h-12 rounded-xl px-4 text-base md:text-base font-bold"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mut-sold-by" className="font-semibold text-slate-700">Nama Marketing yang Tembus</Label>
              <Input
                id="mut-sold-by"
                value={soldBy}
                onChange={(e) => setSoldBy(e.target.value)}
                placeholder="cth: Bu Rina"
                className="h-12 rounded-xl px-4 text-base md:text-base"
              />
            </div>
            <PhotoManager
              photos={handoverPhoto}
              onChange={setHandoverPhoto}
              maxPhotos={1}
              withCover={false}
              label="Foto Bukti Serah Terima (opsional)"
            />
            {isOwner && vehicle.basePrice != null && soldPrice != null && (
              <p className="rounded-md bg-blue-50 px-3 py-2 text-xs font-bold text-blue-800">
                Estimasi margin: {formatRupiah(soldPrice - vehicle.basePrice - (vehicle.commissionAmount ?? 0))}
              </p>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-12 flex-1 rounded-xl border-slate-300 font-semibold"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="h-12 flex-1 rounded-xl bg-blue-700 text-base font-extrabold hover:bg-blue-800"
            disabled={busy}
            onClick={save}
          >
            {busy ? 'Menyimpan...' : 'Simpan'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
