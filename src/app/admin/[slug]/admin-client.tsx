'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  Copy,
  Inbox,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Share2,
  Trash2,
} from 'lucide-react'
import { Countdown } from '@/components/countdown'
import { AppIcon } from '@/components/app-icon'
import { StatusBadge } from '@/components/status-badge'
import { VehiclePhoto } from '@/components/vehicle-photo'
import { Input } from '@/components/ui/input'
import {
  AdminGate,
  AdminNav,
  SessionBadge,
  ShowroomNotFound,
} from '@/components/admin-shell'
import { SellDialog } from '@/components/sell-dialog'
import { WABroadcastDialog } from '@/components/wa-broadcast-dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PLAN_LABELS, STATUS_LABELS } from '@/lib/constants'
import {
  copyToClipboard,
  formatKm,
  formatPhoneDisplay,
  formatRupiah,
  isTaxAlive,
  waLink,
} from '@/lib/format'
import type {
  AdminInventoryResponse,
  AdminVehicle,
  TaxonomyResponse,
  VehicleStatus,
} from '@/lib/types'
import { VehicleForm } from './vehicle-form'

const STATUS_TONE: Record<VehicleStatus, string> = {
  available: 'bg-emerald-600 text-white',
  hold: 'bg-amber-500 text-white',
  sold: 'bg-red-700 text-white',
}

export function AdminClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <Dashboard slug={slug} session={session} />}
    </AdminGate>
  )
}

function Dashboard({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  const [data, setData] = useState<AdminInventoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [taxonomy, setTaxonomy] = useState<TaxonomyResponse | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | VehicleStatus>('all')
  const [brandFilter, setBrandFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [branchFilter, setBranchFilter] = useState('all') // all | main | branchId
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdminVehicle | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdminVehicle | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  // Dialog terjual & broadcast
  const [sellTarget, setSellTarget] = useState<AdminVehicle | null>(null)
  const [waTarget, setWaTarget] = useState<{ vehicle: AdminVehicle; kind: 'new' | 'sold' } | null>(
    null,
  )

  const isOwner = session.role === 'owner'

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${slug}/inventory`, { cache: 'no-store' })
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (res.status === 401) {
        window.location.reload()
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal memuat data.')
      }
      setData(await res.json())
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Gagal memuat data.')
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => {
    refetch()
  }, [refetch])

  useEffect(() => {
    fetch(`/api/admin/${slug}/taxonomy`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setTaxonomy(j))
      .catch(() => {})
  }, [slug])

  const filtered = useMemo(() => {
    if (!data) return []
    const q = search.trim().toLowerCase()
    return data.vehicles.filter((v) => {
      if (statusFilter !== 'all' && v.status !== statusFilter) return false
      if (brandFilter !== 'all' && v.brand !== brandFilter) return false
      if (categoryFilter !== 'all' && v.category !== categoryFilter) return false
      if (branchFilter === 'main' && v.branch) return false
      if (branchFilter !== 'all' && branchFilter !== 'main' && v.branch?.id !== branchFilter)
        return false
      if (!q) return true
      return [v.brand, v.model, v.licensePlate, v.color ?? '', String(v.year)]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [data, search, statusFilter, brandFilter, categoryFilter, branchFilter])

  async function setVehicleStatusDirect(v: AdminVehicle, status: VehicleStatus) {
    setBusyId(v.id)
    try {
      const res = await fetch(`/api/admin/vehicles/${v.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal mengubah status.')
      toast.success(`"${v.brand} ${v.model}" sekarang ${STATUS_LABELS[status].toLowerCase()}.`)
      await refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah status.')
    } finally {
      setBusyId(null)
    }
  }

  /** Quick-action status. Terjual lewat dialog pencatatan penjualan. */
  function handleStatus(v: AdminVehicle, s: VehicleStatus) {
    if (s === 'sold') {
      setSellTarget(v)
      return
    }
    setVehicleStatusDirect(v, s)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch(`/api/admin/vehicles/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal menghapus unit.')
      }
      toast.success(`"${deleteTarget.brand} ${deleteTarget.model}" dihapus dari stok.`)
      setDeleteTarget(null)
      await refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus unit.')
    } finally {
      setBusyId(null)
    }
  }

  async function copyCatalogLink() {
    const ok = await copyToClipboard(`${window.location.origin}/s/${slug}`)
    if (ok) toast.success('Link katalog disalin — bagikan ke tim marketing!')
    else toast.error('Gagal menyalin link.')
  }

  async function setHoldStatusById(vehicleId: string, status: VehicleStatus) {
    const v = data?.vehicles.find((x) => x.id === vehicleId)
    if (v) handleStatus(v, status)
  }

  if (notFound) return <ShowroomNotFound slug={slug} />

  const quotaFull = data?.quota ? data.quota.active >= data.quota.max : false
  const licenseExpired = data?.license ? data.license.status !== 'active' : false

  return (
    <>
      {/* Header */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {data?.showroom.logoUrl ? (
              <img
                src={data.showroom.logoUrl}
                alt={`Logo ${data.showroom.name}`}
                className="h-8 w-8 shrink-0 rounded-md object-cover ring-1 ring-slate-200"
              />
            ) : (
              <AppIcon className="h-8 w-8 shrink-0" />
            )}
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700">
                {isOwner ? 'Dashboard Owner' : 'Dashboard Admin'}
              </p>
              <h1 className="truncate text-sm font-extrabold text-slate-900">
                {data?.showroom.name ?? 'Memuat...'}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-300 text-xs font-bold"
              onClick={copyCatalogLink}
            >
              <Copy className="mr-1 h-3.5 w-3.5" />
              <span className="hidden sm:inline">Salin Link Katalog</span>
              <span className="sm:hidden">Salin</span>
            </Button>
            <Button
              asChild
              size="sm"
              className="h-9 bg-blue-700 text-xs font-bold hover:bg-blue-800"
            >
              <Link href={`/s/${slug}`} target="_blank">
                Lihat Katalog
              </Link>
            </Button>
            <div className="hidden sm:block">
              <SessionBadge session={session} />
            </div>
          </div>
        </div>
      </header>

      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-6xl flex-1 space-y-4 px-4 py-4">
        {loading && (
          <div className="space-y-3">
            <div className="h-20 animate-pulse rounded-lg bg-slate-200" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
          </div>
        )}

        {loadError && !loading && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-bold text-red-800">{loadError}</p>
            <Button
              variant="outline"
              className="mt-3 h-10 border-red-300 text-xs font-bold"
              onClick={() => {
                setLoading(true)
                refetch()
              }}
            >
              Coba Lagi
            </Button>
          </div>
        )}

        {data && (
          <>
            {isOwner && licenseExpired && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm font-bold text-red-800">
                Lisensi kedaluwarsa — perbarui ke distributor agar stok bisa ditambah.
              </div>
            )}

            {/* Lisensi & kuota — hanya owner (admin tidak berhak melihat lisensi) */}
            {isOwner && data.license && data.quota && (
              <section className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Lisensi{' '}
                      <span className="font-mono">{data.license.licenseKey}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Plan {PLAN_LABELS[data.license.planType] ?? data.license.planType} •{' '}
                      {data.license.expiresAt
                        ? `berlaku s/d ${new Date(data.license.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'Lifetime'}
                    </p>
                  </div>
                  <p className="text-xs font-extrabold text-slate-700">
                    {data.quota.active}/{data.quota.max} unit aktif
                  </p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${quotaFull ? 'bg-red-600' : 'bg-blue-700'}`}
                    style={{
                      width: `${Math.min(100, (data.quota.active / Math.max(1, data.quota.max)) * 100)}%`,
                    }}
                  />
                </div>
              </section>
            )}

            {/* Statistik */}
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Stok Aktif
                </p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900">
                  {data.stats.available}
                </p>
                <p className="text-[11px] text-slate-400">unit siap jual</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700">
                  Ditahan
                </p>
                <p className="mt-1 text-2xl font-extrabold text-amber-900">{data.stats.hold}</p>
                <p className="text-[11px] text-amber-700">unit di-hold marketing</p>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-700">
                  Terjual
                </p>
                <p className="mt-1 text-2xl font-extrabold text-red-900">{data.stats.sold}</p>
                <p className="text-[11px] text-red-700">unit deal</p>
              </div>
              {isOwner ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                    Perputaran Modal
                  </p>
                  <p className="mt-1 text-base font-extrabold leading-snug text-slate-900">
                    {formatRupiah(data.stats.capitalTurnover)}
                  </p>
                  <p className="text-[11px] text-blue-700">
                    Nilai jual stok: {formatRupiah(data.stats.stockValue)}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700">
                    Nilai Jual Stok
                  </p>
                  <p className="mt-1 text-base font-extrabold leading-snug text-slate-900">
                    {formatRupiah(data.stats.stockValue)}
                  </p>
                  <p className="text-[11px] text-blue-700">total harga jual unit aktif</p>
                </div>
              )}
            </section>

            {/* Tahanan aktif */}
            {data.holds.length > 0 && (
              <section className="rounded-lg border border-amber-300 bg-amber-50 p-4">
                <h2 className="text-sm font-extrabold text-amber-900">
                  Tahanan Aktif ({data.holds.length})
                </h2>
                <div className="mt-2 space-y-2">
                  {data.holds.map((h) => (
                    <div
                      key={h.id}
                      className="flex flex-col gap-2 rounded-md border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {h.vehicleLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600">
                          Ditahan oleh{' '}
                          <span className="font-bold text-slate-900">{h.marketingName}</span>
                          {h.marketingId && (
                            <span className="ml-1.5 rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[10px] font-extrabold text-blue-700">
                              Rekanan
                            </span>
                          )}{' '}
                          •{' '}
                          <a
                            href={waLink(h.marketingPhone)}
                            target="_blank"
                            rel="noreferrer"
                            className="font-bold text-emerald-700 underline"
                          >
                            {formatPhoneDisplay(h.marketingPhone)}
                          </a>
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-extrabold tabular-nums text-amber-800">
                          <Countdown expiresAt={h.expiresAt} onDone={() => refetch()} />
                        </span>
                        <Button
                          size="sm"
                          disabled={busyId === h.vehicleId}
                          className="h-9 bg-emerald-700 text-xs font-bold hover:bg-emerald-800"
                          onClick={() => setHoldStatusById(h.vehicleId, 'sold')}
                        >
                          Deal (Terjual)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === h.vehicleId}
                          className="h-9 border-slate-300 text-xs font-bold"
                          onClick={() => setHoldStatusById(h.vehicleId, 'available')}
                        >
                          Lepas
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Toolbar */}
            <section className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari merk, model, atau plat..."
                  className="h-10 bg-white pl-9"
                  aria-label="Cari unit"
                />
              </div>
              <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
                {(['all', 'available', 'hold', 'sold'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`h-9 flex-1 whitespace-nowrap rounded-md px-3 text-xs font-bold sm:flex-none ${
                      statusFilter === s
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {s === 'all' ? 'Semua' : STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
              {/* Filter kategori & merek dari taxonomy showroom */}
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-10 w-full bg-white text-xs font-bold sm:w-40" aria-label="Filter kategori">
                  <SelectValue placeholder="Semua Kategori" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Kategori</SelectItem>
                  {(taxonomy?.categories ?? []).map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger className="h-10 w-full bg-white text-xs font-bold sm:w-36" aria-label="Filter merek">
                  <SelectValue placeholder="Semua Merek" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Merek</SelectItem>
                  {(taxonomy?.brands ?? []).map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Filter lokasi cabang — hanya tampil bila showroom punya cabang */}
              {data.branches.length > 0 && (
                <Select value={branchFilter} onValueChange={setBranchFilter}>
                  <SelectTrigger
                    className="h-10 w-full bg-white text-xs font-bold sm:w-44"
                    aria-label="Filter lokasi cabang"
                  >
                    <SelectValue placeholder="Semua Lokasi" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Lokasi</SelectItem>
                    <SelectItem value="main">Lokasi Utama</SelectItem>
                    {data.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                className="h-10 bg-blue-700 px-4 text-sm font-extrabold hover:bg-blue-800"
                disabled={quotaFull}
                title={quotaFull ? 'Kuota lisensi penuh' : undefined}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah Motor
              </Button>
            </section>

            {/* Inventaris */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
                <Package className="h-8 w-8 text-slate-300" aria-hidden />
                <p className="mt-2 text-sm font-bold text-slate-700">
                  {data.vehicles.length === 0
                    ? 'Belum ada unit di showroom ini.'
                    : 'Tidak ada unit yang cocok dengan filter.'}
                </p>
                {data.vehicles.length === 0 && (
                  <Button
                    className="mt-4 h-11 bg-blue-700 font-bold hover:bg-blue-800"
                    disabled={quotaFull}
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Tambah Motor Pertama
                  </Button>
                )}
              </div>
            ) : (
              <section className="grid gap-3 md:grid-cols-2">
                {filtered.map((v) => (
                  <AdminVehicleCard
                    key={v.id}
                    v={v}
                    isOwner={isOwner}
                    showLocation={data.branches.length > 0}
                    busy={busyId === v.id}
                    onStatus={(s) => handleStatus(v, s)}
                    onEdit={() => {
                      setEditing(v)
                      setFormOpen(true)
                    }}
                    onDelete={() => setDeleteTarget(v)}
                    onBroadcast={(kind) => setWaTarget({ vehicle: v, kind })}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {/* Form tambah/edit */}
      {data && (
        <VehicleForm
          slug={slug}
          open={formOpen}
          onOpenChange={setFormOpen}
          onSaved={refetch}
          editing={editing}
          taxonomy={taxonomy}
          canSeeBasePrice={isOwner}
          branches={data.branches}
          onTaxonomyChanged={setTaxonomy}
        />
      )}

      {/* Dialog catat penjualan */}
      <SellDialog
        vehicle={sellTarget}
        open={sellTarget != null}
        onOpenChange={(o) => !o && setSellTarget(null)}
        onSold={(v) => {
          setSellTarget(null)
          refetch()
          setWaTarget({ vehicle: v, kind: 'sold' })
        }}
      />

      {/* Dialog broadcast WA */}
      {waTarget && data && (
        <WABroadcastDialog
          open
          onOpenChange={(o) => !o && setWaTarget(null)}
          slug={slug}
          showroomName={data.showroom.name}
          vehicle={waTarget.vehicle}
          initialKind={waTarget.kind}
        />
      )}

      {/* Konfirmasi hapus */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold">
              Hapus unit ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.brand} ${deleteTarget.model} (${deleteTarget.licensePlate})" beserta riwayat tahanannya akan dihapus permanen.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-10">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-10 bg-red-700 font-bold hover:bg-red-800"
              onClick={(e) => {
                e.preventDefault()
                confirmDelete()
              }}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function AdminVehicleCard({
  v,
  isOwner,
  showLocation,
  busy,
  onStatus,
  onEdit,
  onDelete,
  onBroadcast,
}: {
  v: AdminVehicle
  isOwner: boolean
  showLocation: boolean
  busy: boolean
  onStatus: (s: VehicleStatus) => void
  onEdit: () => void
  onDelete: () => void
  onBroadcast: (kind: 'new' | 'sold') => void
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex gap-3">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100 sm:h-24 sm:w-24">
          <VehiclePhoto
            src={v.photos[0]}
            alt={`Foto ${v.brand} ${v.model}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-1 left-1">
            <StatusBadge status={v.status} />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-extrabold text-slate-900">
            {v.brand} {v.model}
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            {v.year} • {v.licensePlate} • {formatKm(v.odometer)}
            {v.color ? ` • ${v.color}` : ''}
          </p>
          {showLocation && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-600">
              <MapPin className="h-3 w-3 shrink-0 text-blue-700" aria-hidden />
              {v.branch ? v.branch.name : 'Lokasi Utama'}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {v.category && (
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800">
                {v.category}
              </span>
            )}
            {v.taxStatus && (
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${
                  isTaxAlive(v.taxStatus)
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
          </div>
          <div className={`mt-2 grid gap-2 ${isOwner ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Harga Jual
              </p>
              <p className="text-sm font-extrabold text-slate-900">
                {formatRupiah(v.sellingPrice)}
              </p>
            </div>
            {isOwner && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                  Modal
                </p>
                <p className="text-sm font-bold text-slate-700">{formatRupiah(v.basePrice)}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Komisi
              </p>
              <p className="text-sm font-bold text-emerald-700">
                {formatRupiah(v.commissionAmount)}
              </p>
            </div>
          </div>
          {v.activeHold && (
            <p className="mt-1.5 rounded bg-amber-50 px-1.5 py-1 text-[11px] font-bold text-amber-800">
              Ditahan oleh {v.activeHold.marketingName} •{' '}
              <Countdown
                expiresAt={v.activeHold.expiresAt}
                className="tabular-nums"
              />
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex flex-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
          {(['available', 'hold', 'sold'] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onStatus(s)}
              className={`h-8 flex-1 rounded-md text-[11px] font-extrabold disabled:opacity-50 ${
                v.status === s ? STATUS_TONE[s] : 'text-slate-500 hover:bg-white'
              }`}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 border-slate-300 hover:bg-emerald-50"
          onClick={() => onBroadcast(v.status === 'sold' ? 'sold' : 'new')}
          aria-label={`Broadcast WA ${v.brand} ${v.model}`}
          title="Kirim update ke grup WA"
        >
          <Share2 className="h-4 w-4 text-emerald-700" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 border-slate-300"
          onClick={onEdit}
          aria-label={`Edit ${v.brand} ${v.model}`}
        >
          <Pencil className="h-4 w-4 text-slate-600" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 border-slate-300 hover:bg-red-50"
          onClick={onDelete}
          aria-label={`Hapus ${v.brand} ${v.model}`}
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </article>
  )
}
