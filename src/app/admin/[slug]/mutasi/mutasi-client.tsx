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

function MutasiPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  const [tab, setTab] = useState<'in' | 'out'>('in')
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

  const masukList = useMemo(
    () =>
      (vehicles ?? [])
        .slice()
        .sort(
          (a, b) =>
            new Date(b.purchasedAt ?? b.createdAt).getTime() -
            new Date(a.purchasedAt ?? a.createdAt).getTime(),
        ),
    [vehicles],
  )

  const keluarList = useMemo(
    () =>
      (vehicles ?? [])
        .filter((v) => v.status === 'sold')
        .sort(
          (a, b) => new Date(b.soldAt ?? 0).getTime() - new Date(a.soldAt ?? 0).getTime(),
        ),
    [vehicles],
  )

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

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-4">
        {/* Tab */}
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setTab('in')}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold ${
              tab === 'in' ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowDownToLine className="h-4 w-4" /> Unit Masuk
            {vehicles && <span className="opacity-80">({masukList.length})</span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('out')}
            className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md text-xs font-extrabold ${
              tab === 'out' ? 'bg-red-700 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ArrowUpFromLine className="h-4 w-4" /> Unit Keluar
            {vehicles && <span className="opacity-80">({keluarList.length})</span>}
          </button>
        </div>

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

        {vehicles && tab === 'in' && (
          <section className="space-y-2">
            {masukList.length === 0 ? (
              <EmptyLog text="Belum ada unit masuk." />
            ) : (
              masukList.map((v) => (
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
                          {v.licensePlate} • Masuk {formatDateID(v.purchasedAt ?? v.createdAt)}
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
            )}
          </section>
        )}

        {vehicles && tab === 'out' && (
          <section className="space-y-2">
            {keluarList.length === 0 ? (
              <EmptyLog text="Belum ada unit keluar (terjual)." />
            ) : (
              keluarList.map((v) => (
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
              ))
            )}
          </section>
        )}
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
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">
            {tab === 'in' ? 'Info Unit Masuk' : 'Info Unit Keluar'}
          </DialogTitle>
          <DialogDescription>
            {vehicle.brand} {vehicle.model} • {vehicle.licensePlate}
          </DialogDescription>
        </DialogHeader>

        {tab === 'in' ? (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="mut-date">Tanggal Masuk / Pembelian *</Label>
              <Input
                id="mut-date"
                type="date"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mut-notes">Catatan Kondisi Fisik Saat Datang</Label>
              <Textarea
                id="mut-notes"
                value={arrivalNotes}
                onChange={(e) => setArrivalNotes(e.target.value)}
                placeholder="cth: Strip kanan lecet, mesin normal, ban depan baru"
                rows={3}
                className="resize-none"
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
                <Label htmlFor="mut-sold-date">Tanggal Laku *</Label>
                <Input
                  id="mut-sold-date"
                  type="date"
                  value={soldAt}
                  onChange={(e) => setSoldAt(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mut-sold-price">Harga Deal Akhir (Rp)</Label>
                <MoneyInput id="mut-sold-price" value={soldPrice} onChange={setSoldPrice} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mut-sold-by">Nama Marketing yang Tembus</Label>
              <Input
                id="mut-sold-by"
                value={soldBy}
                onChange={(e) => setSoldBy(e.target.value)}
                placeholder="cth: Bu Rina"
                className="h-11"
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
            className="h-12 flex-1 border-slate-300 font-bold"
            onClick={() => onOpenChange(false)}
          >
            Batal
          </Button>
          <Button
            className="h-12 flex-1 bg-blue-700 font-extrabold hover:bg-blue-800"
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
