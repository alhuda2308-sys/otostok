'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useQueryClient } from '@tanstack/react-query'
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
import { ApiError, qk, useInventoryQuery, useTaxonomyQuery } from '@/lib/queries'
import type { AdminVehicle, VehicleStatus } from '@/lib/types'

// Komponen berat dimuat terpisah (code-split) — JS form/modal tidak
// memblokir render pertama dashboard.
const VehicleForm = dynamic(
  () => import('./vehicle-form').then((m) => ({ default: m.VehicleForm })),
  { ssr: false },
)
const SellDialog = dynamic(
  () => import('@/components/sell-dialog').then((m) => ({ default: m.SellDialog })),
  { ssr: false },
)
const WABroadcastDialog = dynamic(
  () => import('@/components/wa-broadcast-dialog').then((m) => ({ default: m.WABroadcastDialog })),
  { ssr: false },
)

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
  // Data via TanStack Query — cache dibagi dengan halaman Mutasi, jadi pindah
  // tab menampilkan data instan dari memori (stale-while-revalidate).
  const inventoryQuery = useInventoryQuery(slug)
  const taxonomyQuery = useTaxonomyQuery(slug)
  const queryClient = useQueryClient()

  const data = inventoryQuery.data ?? null
  const loading = inventoryQuery.isPending
  const notFound =
    inventoryQuery.error instanceof ApiError && inventoryQuery.error.status === 404
  const loadError =
    inventoryQuery.error && !notFound
      ? inventoryQuery.error instanceof Error
        ? inventoryQuery.error.message
        : 'Gagal memuat data.'
      : null
  const taxonomy = taxonomyQuery.data ?? null

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

  // Refresh = invalidate cache inventory (refetch background, data lama tetap tampil).
  const refreshInventory = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: qk.inventory(slug) })
  }, [queryClient, slug])

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
      await refreshInventory()
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
      await refreshInventory()
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
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:h-20 lg:px-10">
          <div className="flex min-w-0 items-center gap-2.5 lg:gap-3.5">
            {data?.showroom.logoUrl ? (
              <img
                src={data.showroom.logoUrl}
                alt={`Logo ${data.showroom.name}`}
                className="h-9 w-9 shrink-0 rounded-md object-cover ring-1 ring-slate-200 lg:h-12 lg:w-12 lg:rounded-xl"
              />
            ) : (
              <AppIcon className="h-9 w-9 shrink-0 lg:h-12 lg:w-12" />
            )}
            <div className="min-w-0 leading-tight">
              <p className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 lg:text-xs">
                {isOwner ? 'Dashboard Owner' : 'Dashboard Admin'}
              </p>
              <h1 className="truncate text-sm font-extrabold text-slate-900 sm:text-base lg:text-2xl">
                {data?.showroom.name ?? 'Memuat...'}
              </h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              className="h-10 rounded-lg border-slate-300 px-3! text-xs font-bold lg:h-11 lg:rounded-xl lg:px-5! lg:text-sm"
              onClick={copyCatalogLink}
            >
              <Copy className="size-4 lg:size-5" />
              <span className="hidden sm:inline">Salin Link Katalog</span>
              <span className="sm:hidden">Salin</span>
            </Button>
            <Button
              asChild
              className="h-10 rounded-lg bg-blue-700 px-3 text-xs font-bold hover:bg-blue-800 lg:h-11 lg:rounded-xl lg:px-5 lg:text-sm"
            >
              <Link href={`/s/${slug}?owner=1`} target="_blank">
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

      <div className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-4 sm:px-6 lg:space-y-6 lg:px-10 lg:py-6">
        {loading && (
          <div className="space-y-3 lg:space-y-4">
            <div className="h-20 animate-pulse rounded-lg bg-slate-200 lg:h-28 lg:rounded-2xl" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-lg bg-slate-200 lg:h-28 lg:rounded-2xl" />
              ))}
            </div>
            <div className="h-40 animate-pulse rounded-lg bg-slate-200 lg:rounded-2xl" />
          </div>
        )}

        {loadError && !loading && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center lg:p-5">
            <p className="text-sm font-bold text-red-800 lg:text-base">{loadError}</p>
            <Button
              variant="outline"
              className="mt-3 h-10 border-red-300 text-xs font-bold lg:h-11 lg:text-sm"
              onClick={() => refreshInventory()}
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
              <section className="rounded-xl border border-slate-200 bg-white p-4 lg:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Lisensi{' '}
                      <span className="font-mono">{data.license.licenseKey}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 lg:text-sm">
                      Plan {PLAN_LABELS[data.license.planType] ?? data.license.planType} •{' '}
                      {data.license.expiresAt
                        ? `berlaku s/d ${new Date(data.license.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : 'Lifetime'}
                    </p>
                  </div>
                  <p className="text-sm font-extrabold text-slate-700">
                    {data.quota.active}/{data.quota.max} unit aktif
                  </p>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
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
            <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:rounded-2xl lg:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:text-xs">
                  Stok Aktif
                </p>
                <p className="mt-1 text-2xl font-extrabold text-slate-900 lg:mt-2 lg:text-4xl lg:font-black">
                  {data.stats.available}
                </p>
                <p className="text-[11px] text-slate-400 lg:text-sm lg:font-medium">unit siap jual</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-700 lg:text-xs">
                  Ditahan
                </p>
                <p className="mt-1 text-2xl font-extrabold text-amber-900 lg:mt-2 lg:text-4xl lg:font-black">{data.stats.hold}</p>
                <p className="text-[11px] text-amber-700 lg:text-sm lg:font-medium">unit di-hold marketing</p>
              </div>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                <p className="text-[10px] font-bold uppercase tracking-wide text-red-700 lg:text-xs">
                  Terjual
                </p>
                <p className="mt-1 text-2xl font-extrabold text-red-900 lg:mt-2 lg:text-4xl lg:font-black">{data.stats.sold}</p>
                <p className="text-[11px] text-red-700 lg:text-sm lg:font-medium">unit deal</p>
              </div>
              {isOwner ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 lg:text-xs">
                    Perputaran Modal
                  </p>
                  <p className="mt-1 text-base font-extrabold leading-snug text-slate-900 lg:mt-2 lg:text-2xl lg:font-black">
                    {formatRupiah(data.stats.capitalTurnover)}
                  </p>
                  <p className="text-[11px] text-blue-700 lg:text-sm lg:font-medium">
                    Nilai jual stok: {formatRupiah(data.stats.stockValue)}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 shadow-sm lg:rounded-2xl lg:p-6">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 lg:text-xs">
                    Nilai Jual Stok
                  </p>
                  <p className="mt-1 text-base font-extrabold leading-snug text-slate-900 lg:mt-2 lg:text-2xl lg:font-black">
                    {formatRupiah(data.stats.stockValue)}
                  </p>
                  <p className="text-[11px] text-blue-700 lg:text-sm lg:font-medium">total harga jual unit aktif</p>
                </div>
              )}
            </section>

            {/* Tahanan aktif */}
            {data.holds.length > 0 && (
              <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 lg:p-5">
                <h2 className="text-base font-extrabold text-amber-900 lg:text-lg">
                  Tahanan Aktif ({data.holds.length})
                </h2>
                <div className="mt-2 space-y-2">
                  {data.holds.map((h) => (
                    <div
                      key={h.id}
                      className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between lg:px-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900">
                          {h.vehicleLabel}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 lg:text-sm">
                          Ditahan oleh{' '}
                          <span className="font-bold text-slate-900">{h.marketingName}</span>
                          {h.marketingId && (
                            <span className="ml-1.5 rounded border border-blue-200 bg-blue-50 px-1 py-0.5 text-[10px] font-extrabold text-blue-700 lg:text-xs">
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
                        <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold tabular-nums text-amber-800 lg:text-sm">
                          <Countdown expiresAt={h.expiresAt} onDone={() => refreshInventory()} />
                        </span>
                        <Button
                          size="sm"
                          disabled={busyId === h.vehicleId}
                          className="h-10 rounded-lg bg-emerald-700 px-3.5 text-xs font-bold hover:bg-emerald-800 lg:text-sm"
                          onClick={() => setHoldStatusById(h.vehicleId, 'sold')}
                        >
                          Deal (Terjual)
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === h.vehicleId}
                          className="h-10 rounded-lg border-slate-300 px-3.5 text-xs font-bold lg:text-sm"
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
            <section className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:gap-3">
              <div className="relative min-w-0 flex-1 sm:min-w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 lg:left-4 lg:h-5 lg:w-5" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari merk, model, atau plat..."
                  className="h-11 bg-white pl-9 text-sm lg:h-12 lg:pl-10 lg:text-base"
                  aria-label="Cari unit"
                />
              </div>
              <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 lg:rounded-xl lg:p-1">
                {(['all', 'available', 'hold', 'sold'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatusFilter(s)}
                    className={`h-10 flex-1 whitespace-nowrap rounded-md px-3 text-xs font-bold sm:flex-none lg:h-11 lg:rounded-lg lg:px-4 lg:text-sm ${
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
                <SelectTrigger className="h-11! w-full bg-white text-xs font-bold sm:w-40 lg:h-12! lg:w-44 lg:text-sm" aria-label="Filter kategori">
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
                <SelectTrigger className="h-11! w-full bg-white text-xs font-bold sm:w-36 lg:h-12! lg:w-40 lg:text-sm" aria-label="Filter merek">
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
                    className="h-11! w-full bg-white text-xs font-bold sm:w-44 lg:h-12! lg:w-48 lg:text-sm"
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
                className="h-11 rounded-lg bg-blue-700 px-5! text-sm font-extrabold hover:bg-blue-800 sm:ml-auto lg:h-12 lg:rounded-xl lg:text-base lg:font-bold"
                disabled={quotaFull}
                title={quotaFull ? 'Kuota lisensi penuh' : undefined}
                onClick={() => {
                  setEditing(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="size-4 lg:size-5" /> Tambah Motor
              </Button>
            </section>

            {/* Inventaris */}
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center rounded-xl border border-dashed border-slate-300 bg-white px-4 py-12 text-center lg:py-16">
                <Package className="h-8 w-8 text-slate-300 lg:h-10 lg:w-10" aria-hidden />
                <p className="mt-2 text-sm font-bold text-slate-700 lg:text-base">
                  {data.vehicles.length === 0
                    ? 'Belum ada unit di showroom ini.'
                    : 'Tidak ada unit yang cocok dengan filter.'}
                </p>
                {data.vehicles.length === 0 && (
                  <Button
                    className="mt-4 h-11 rounded-lg bg-blue-700 px-5! font-bold hover:bg-blue-800 lg:h-12 lg:rounded-xl lg:text-base"
                    disabled={quotaFull}
                    onClick={() => {
                      setEditing(null)
                      setFormOpen(true)
                    }}
                  >
                    <Plus className="size-4 lg:size-5" /> Tambah Motor Pertama
                  </Button>
                )}
              </div>
            ) : (
              <section className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-6 xl:grid-cols-4">
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
          onSaved={refreshInventory}
          editing={editing}
          taxonomy={taxonomy}
          canSeeBasePrice={isOwner}
          branches={data.branches}
          onTaxonomyChanged={(t) => queryClient.setQueryData(qk.taxonomy(slug), t)}
        />
      )}

      {/* Dialog catat penjualan */}
      <SellDialog
        vehicle={sellTarget}
        open={sellTarget != null}
        onOpenChange={(o) => !o && setSellTarget(null)}
        onSold={(v) => {
          setSellTarget(null)
          refreshInventory()
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
            <AlertDialogTitle className="text-lg font-extrabold">
              Hapus unit ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.brand} ${deleteTarget.model} (${deleteTarget.licensePlate})" beserta riwayat tahanannya akan dihapus permanen.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-11 rounded-lg">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-11 rounded-lg bg-red-700 font-bold hover:bg-red-800"
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
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm lg:rounded-2xl lg:p-4">
      <div className="flex gap-3 xl:flex-col">
        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-slate-100 sm:h-24 sm:w-24 lg:h-28 lg:w-28 xl:h-auto xl:w-full xl:aspect-[4/3] xl:rounded-xl">
          <VehiclePhoto
            sizes="(min-width: 1280px) 250px, (min-width: 1024px) 112px, 96px"
            src={v.photos[0]}
            alt={`Foto ${v.brand} ${v.model}`}
            className="h-full w-full object-cover"
          />
          <div className="absolute bottom-1 left-1">
            <StatusBadge
              status={v.status}
              className="rounded-lg px-2 py-0.5 text-[10px] lg:px-3 lg:py-1.5 lg:text-xs"
            />
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-slate-900 lg:text-lg">
            {v.brand} {v.model}
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500 lg:text-sm">
            {v.year} • {v.licensePlate} • {formatKm(v.odometer)}
            {v.color ? ` • ${v.color}` : ''}
          </p>
          {showLocation && (
            <p className="mt-1 flex items-center gap-1 text-[11px] font-bold text-slate-600 lg:text-sm">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-700" aria-hidden />
              {v.branch ? v.branch.name : 'Lokasi Utama'}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap gap-1">
            {v.category && (
              <span className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-800 lg:px-2 lg:text-xs">
                {v.category}
              </span>
            )}
            {v.taxStatus && (
              <span
                className={`rounded border px-1.5 py-0.5 text-[10px] font-bold lg:px-2 lg:text-xs ${
                  isTaxAlive(v.taxStatus)
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                Pajak: {v.taxStatus}
              </span>
            )}
            {v.documentStatus && (
              <span className="rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 lg:px-2 lg:text-xs">
                {v.documentStatus}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5 lg:mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:text-xs">
                Harga Jual
              </p>
              <p className="text-sm font-extrabold text-slate-900 lg:text-base">
                {formatRupiah(v.sellingPrice)}
              </p>
            </div>
            {isOwner && (
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 lg:text-xs">
                  Modal
                </p>
                <p className="text-sm font-bold text-slate-700 lg:text-base lg:font-extrabold">{formatRupiah(v.basePrice)}</p>
              </div>
            )}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-emerald-50 px-2 py-1 ring-1 ring-emerald-100">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-600 lg:text-xs">
                Komisi
              </p>
              <p className="text-sm font-bold text-emerald-700 lg:text-base">
                {formatRupiah(v.commissionAmount)}
              </p>
            </div>
          </div>
          {v.activeHold && (
            <p className="mt-1.5 rounded-lg bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-800 lg:text-xs">
              Ditahan oleh {v.activeHold.marketingName} •{' '}
              <Countdown
                expiresAt={v.activeHold.expiresAt}
                className="tabular-nums"
              />
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 lg:mt-4 lg:gap-2.5">
        <div className="flex flex-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5 xl:basis-full xl:p-1 lg:rounded-xl">
          {(['available', 'hold', 'sold'] as const).map((s) => (
            <button
              key={s}
              type="button"
              disabled={busy}
              onClick={() => onStatus(s)}
              className={`h-9 flex-1 rounded-md text-[11px] font-extrabold disabled:opacity-50 lg:h-10 lg:rounded-lg lg:text-sm ${
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
          className="h-10 w-10 shrink-0 border-slate-300 hover:bg-emerald-50"
          onClick={() => onBroadcast(v.status === 'sold' ? 'sold' : 'new')}
          aria-label={`Broadcast WA ${v.brand} ${v.model}`}
          title="Kirim update ke grup WA"
        >
          <Share2 className="h-4 w-4 text-emerald-700" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 border-slate-300"
          onClick={onEdit}
          aria-label={`Edit ${v.brand} ${v.model}`}
        >
          <Pencil className="h-4 w-4 text-slate-600" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 border-slate-300 hover:bg-red-50"
          onClick={onDelete}
          aria-label={`Hapus ${v.brand} ${v.model}`}
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>
    </article>
  )
}
