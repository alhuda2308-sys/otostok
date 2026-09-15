'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  ClipboardCopy,
  Copy,
  KeyRound,
  Loader2,
  Lock,
  LockOpen,
  MessageCircle,
  PlusCircle,
  RefreshCcw,
  Search,
  ShieldCheck,
  Store,
  Ticket,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PLAN_LABELS, SUPER_PLANS } from '@/lib/constants'
import { copyToClipboard, formatDateID, formatPhoneDisplay, waLink } from '@/lib/format'

/** Sesi Super Admin disimpan di sessionStorage (hilang saat tab ditutup). */
const SESSION_KEY = 'otostok_sa_key'
const DAY_MS = 24 * 60 * 60 * 1000
/** Ambang "segera kedaluwarsa" untuk badge kuning. */
const NEAR_EXPIRY_MS = 7 * DAY_MS

interface SuperLicenseRow {
  id: string
  licenseKey: string
  planType: string
  maxVehicles: number
  status: string
  expiresAt: string | null
  createdAt: string
  showroom: {
    id: string
    name: string
    slug: string
    ownerPhone: string
    isActive: boolean
  } | null
  usedUnits: number
  totalUnits: number
}

type EffectiveStatus = 'active' | 'near_expiry' | 'expired' | 'suspended'

/** Status efektif: raw DB + kedaluwarsa lazily dari expiresAt. */
function effectiveStatus(row: SuperLicenseRow): EffectiveStatus {
  if (row.status === 'suspended') return 'suspended'
  if (row.expiresAt && new Date(row.expiresAt).getTime() < Date.now()) return 'expired'
  if (row.expiresAt && new Date(row.expiresAt).getTime() - Date.now() <= NEAR_EXPIRY_MS)
    return 'near_expiry'
  return 'active'
}

const STATUS_BADGE: Record<EffectiveStatus, { label: string; className: string }> = {
  active: { label: 'Aktif', className: 'bg-emerald-600 text-white' },
  near_expiry: { label: 'Segera Habis', className: 'bg-amber-500 text-white' },
  expired: { label: 'Kedaluwarsa', className: 'bg-red-600 text-white' },
  suspended: { label: 'Suspended', className: 'bg-red-800 text-white' },
}

function expiryLabel(row: SuperLicenseRow): string {
  if (!row.expiresAt) return 'Lifetime'
  return `s/d ${formatDateID(row.expiresAt)}`
}

function planLabel(planType: string): string {
  const plan = SUPER_PLANS.find((p) => p.value === planType)
  return plan?.label ?? PLAN_LABELS[planType] ?? planType
}

/** Template pesan WA siap kirim ke pembeli lisensi. */
function buildBuyerWaMessage(license: SuperLicenseRow): string {
  const lines: string[] = []
  lines.push('*OtoStok — AKTIVASI LISENSI*')
  lines.push('')
  lines.push(`Kode Lisensi : *${license.licenseKey}*`)
  lines.push(`Paket : ${planLabel(license.planType)}`)
  lines.push(`Kuota Unit : ${license.maxVehicles} motor`)
  lines.push(
    license.expiresAt
      ? `Masa Aktif : ${expiryLabel(license)}`
      : 'Masa Aktif : Lifetime (tanpa batas waktu)',
  )
  lines.push('')
  lines.push(`Aktivasi : ${window.location.origin}/activate`)
  lines.push('')
  lines.push('Cara aktivasi:')
  lines.push('1. Buka link di atas')
  lines.push('2. Masukkan kode lisensi')
  lines.push('3. Lengkapi data showroom & buat password owner')
  lines.push('4. Dashboard + katalog marketing langsung siap dipakai')
  lines.push('')
  lines.push('Butuh bantuan? Balas pesan ini.')
  return lines.join('\n')
}

/** Ringkasan data lisensi utk tombol "Salin Info". */
function buildRowSummary(row: SuperLicenseRow): string {
  const st = STATUS_BADGE[effectiveStatus(row)].label
  const lines: string[] = []
  lines.push(`Lisensi: ${row.licenseKey} (${planLabel(row.planType)})`)
  lines.push(`Status: ${st}`)
  lines.push(
    row.showroom
      ? `Showroom: ${row.showroom.name} — /s/${row.showroom.slug}`
      : 'Showroom: belum diaktivasi',
  )
  if (row.showroom) {
    lines.push(`Owner WA: ${formatPhoneDisplay(row.showroom.ownerPhone)}`)
    lines.push(`Kuota: ${row.usedUnits}/${row.maxVehicles} unit (total tercatat ${row.totalUnits})`)
  }
  lines.push(`Masa aktif: ${expiryLabel(row)}`)
  lines.push(`Dibuat: ${formatDateID(row.createdAt)}`)
  return lines.join('\n')
}

export function SuperAdminClient() {
  const [phase, setPhase] = useState<'login' | 'ready'>('login')
  const [passkey, setPasskey] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const [rows, setRows] = useState<SuperLicenseRow[]>([])
  const [refreshing, setRefreshing] = useState(false)
  const [q, setQ] = useState('')

  // Generator
  const [planType, setPlanType] = useState<string>('monthly')
  const [maxVehicles, setMaxVehicles] = useState('50')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<SuperLicenseRow | null>(null)

  // Per-baris busy state utk aksi cepat
  const [busyId, setBusyId] = useState<string | null>(null)
  const secretRef = useRef<string | null>(null)

  const refetch = useCallback(async () => {
    setRefreshing(true)
    try {
      // Autentikasi via cookie sesi otostok_sa (diterbitkan /api/super-admin/session)
      // — cookie SELALU diteruskan gateway, berbeda dengan header kustom / query param
      // yang dibuang/ditolak portal preview.
      const res = await fetch('/api/super-admin/licenses', { cache: 'no-store' })
      if (res.status === 401) {
        // Sesi cookie berakhir — paksa login ulang
        sessionStorage.removeItem(SESSION_KEY)
        secretRef.current = null
        setPhase('login')
        setAuthError('Sesi berakhir. Masukkan Master Secret Key.')
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal memuat data lisensi.')
      }
      const j = await res.json()
      setRows(j.licenses)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal memuat data lisensi.')
    } finally {
      setRefreshing(false)
    }
  }, [])

  /**
   * Fallback terakhir bila fetch diblokir portal: kirim kunci via <form
   * method=POST> navigasi native (application/x-www-form-urlencoded) — pola
   * paling standar & kompatibel dengan proxy apa pun. Server menjawab 303
   * kembali ke /super-admin dengan cookie terpasang; sessionStorage
   * bertahan dalam tab yang sama sehingga dashboard otomatis terbuka.
   */
  function submitNativeForm(secret: string) {
    sessionStorage.setItem(SESSION_KEY, secret)
    const form = document.createElement('form')
    form.method = 'POST'
    form.action = '/api/super-admin/session'
    form.style.display = 'none'
    const keyInput = document.createElement('input')
    keyInput.type = 'hidden'
    keyInput.name = 'key'
    keyInput.value = secret
    const redirectInput = document.createElement('input')
    redirectInput.type = 'hidden'
    redirectInput.name = 'redirect'
    redirectInput.value = '1'
    form.append(keyInput, redirectInput)
    document.body.appendChild(form)
    form.submit()
  }

  /** Verifikasi Master Secret Key → server terbitkan cookie sesi → muat data. */
  async function verifyAndLoad(secret: string) {
    setChecking(true)
    setAuthError(null)
    try {
      // Jalur utama: POST JSON { key } (BUKAN header/query "secret" — kata itu
      // memicu penolakan HTTP 500 pada portal preview).
      const res = await fetch('/api/super-admin/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: secret }),
        cache: 'no-store',
      })
      if (res.status === 401) {
        setAuthError('Master Secret Key salah.')
        sessionStorage.removeItem(SESSION_KEY)
        return
      }
      if (!res.ok) {
        // Gateway menolak fetch (5xx) — pakai fallback form native.
        submitNativeForm(secret)
        return
      }
      // Cookie terpasang → masuk dashboard, data dimuat via cookie.
      secretRef.current = secret
      sessionStorage.setItem(SESSION_KEY, secret)
      setRows([])
      setPhase('ready')
      setPasskey('')
      void refetch()
    } catch (e) {
      if (e instanceof TypeError) {
        // fetch gagal di level jaringan — fallback form native.
        submitNativeForm(secret)
        return
      }
      setAuthError(e instanceof Error ? e.message : 'Gagal verifikasi kunci.')
    } finally {
      setChecking(false)
    }
  }

  // Cek sesi cookie saat mount + auto-login dari sessionStorage (sekali per tab)
  useEffect(() => {
    // Kembali dari fallback form dengan penanda error → tampilkan pesan
    if (new URLSearchParams(window.location.search).has('saerr')) {
      history.replaceState(null, '', '/super-admin')
      sessionStorage.removeItem(SESSION_KEY)
      setAuthError('Master Secret Key salah atau portal menolak permintaan. Coba lagi.')
      return
    }
    const saved = sessionStorage.getItem(SESSION_KEY)
    void (async () => {
      try {
        const res = await fetch('/api/super-admin/session', { cache: 'no-store' })
        if (res.ok) {
          // Cookie sesi aktif (mis. hasil fallback form) → langsung dashboard
          if (saved) secretRef.current = saved
          setPhase('ready')
          void refetch()
          return
        }
        if (saved) void verifyAndLoad(saved)
      } catch {
        /* biarkan layar login */
      }
    })()
  }, [])

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const key = passkey.trim()
    if (!key) {
      setAuthError('Masukkan Master Secret Key.')
      return
    }
    void verifyAndLoad(key)
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    secretRef.current = null
    // Hapus cookie sesi di server (best-effort)
    void fetch('/api/super-admin/session', { method: 'DELETE' }).catch(() => {})
    setRows([])
    setResult(null)
    setPasskey('')
    setPhase('login')
  }

  /** Generate lisensi baru 1-klik. */
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    const quota = Number(maxVehicles)
    if (!Number.isInteger(quota) || quota < 1 || quota > 10000) {
      toast.error('Kuota unit harus angka 1 - 10.000.')
      return
    }
    setGenerating(true)
    try {
      // Cookie sesi otentikasi otomatis terkirim; field body "key" sebagai
      // cadangan bila cookie hilang.
      const res = await fetch('/api/super-admin/licenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planType, maxVehicles: quota, key: secretRef.current ?? '' }),
      })
      if (res.status === 401) {
        await refetch()
        return
      }
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Gagal membuat lisensi.')
      const license = { ...(j.license as SuperLicenseRow), showroom: null, usedUnits: 0, totalUnits: 0 }
      setResult(license)
      toast.success(`Lisensi ${license.licenseKey} berhasil dibuat!`)
      await refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal membuat lisensi.')
    } finally {
      setGenerating(false)
    }
  }

  /** Aksi cepat per baris: extend / suspend / unsuspend. */
  async function handleAction(row: SuperLicenseRow, action: 'extend' | 'suspend' | 'unsuspend') {
    setBusyId(`${row.id}-${action}`)
    try {
      const res = await fetch('/api/super-admin/licenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: row.id, action, key: secretRef.current ?? '' }),
      })
      if (res.status === 401) {
        await refetch()
        return
      }
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Aksi gagal.')
      if (action === 'extend') toast.success(`+30 hari — masa aktif kini ${expiryLabel(row)}`)
      if (action === 'suspend') toast.success(`${row.licenseKey} dibekukan (suspend).`)
      if (action === 'unsuspend') toast.success(`${row.licenseKey} dibuka kembali.`)
      await refetch()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Aksi gagal.')
    } finally {
      setBusyId(null)
    }
  }

  async function copy(text: string, okMsg: string) {
    const done = await copyToClipboard(text)
    if (done) toast.success(okMsg)
    else toast.error('Gagal menyalin. Coba lagi.')
  }

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return rows
    return rows.filter((r) =>
      [r.licenseKey, r.showroom?.name ?? '', r.showroom?.slug ?? '', r.showroom?.ownerPhone ?? '']
        .join(' ')
        .toLowerCase()
        .includes(query),
    )
  }, [rows, q])

  const stats = useMemo(() => {
    let active = 0
    let problem = 0
    let showrooms = 0
    let unitsInStock = 0
    for (const r of rows) {
      const st = effectiveStatus(r)
      if (st === 'active' || st === 'near_expiry') active++
      else problem++
      if (r.showroom && r.showroom.isActive) showrooms++
      unitsInStock += r.usedUnits
    }
    return { total: rows.length, active, problem, showrooms, unitsInStock }
  }, [rows])

  // ============ Layar login Master Secret Key ============
  if (phase === 'login') {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-16">
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-700" aria-hidden />
            <h1 className="text-base font-extrabold text-slate-900">OtoStok Super Admin</h1>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Panel pengelola platform. Autentikasi memakai Master Secret Key — terpisah dari akun
            Owner/Admin showroom.
          </p>

          <form onSubmit={handleLogin} className="mt-5 space-y-3">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="password"
                value={passkey}
                onChange={(e) => setPasskey(e.target.value)}
                placeholder="Master Secret Key"
                className="h-11 pl-9 font-mono"
                autoComplete="off"
                aria-label="Master Secret Key"
              />
            </div>
            {authError && <p className="text-xs font-bold text-red-600">{authError}</p>}
            <Button
              type="submit"
              className="h-11 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
              disabled={checking}
            >
              {checking ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <LockOpen className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              Buka Panel
            </Button>
          </form>
        </div>
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Sesi disimpan di sessionStorage per tab — tidak dipakai bersama akun showroom.
        </p>
      </div>
    )
  }

  // ============ Panel Super Admin ============
  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      {/* Bar judul */}
      <div className="flex flex-wrap items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-blue-700" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold text-slate-900">OtoStok — Super Admin</h1>
          <p className="text-xs text-slate-500">
            Generator lisensi & monitoring seluruh klien platform.
          </p>
        </div>
        <Badge className="bg-slate-900 text-white hover:bg-slate-900">MASTER</Badge>
        <Button
          variant="outline"
          size="sm"
          className="h-10 border-slate-300 text-xs font-extrabold"
          onClick={handleLogout}
        >
          Keluar
        </Button>
      </div>

      {/* Kartu statistik */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <Ticket className="h-3.5 w-3.5" aria-hidden /> Total Lisensi
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> Lisensi Aktif
          </div>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{stats.active}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <Store className="h-3.5 w-3.5" aria-hidden /> Showroom Aktif
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.showrooms}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Unit Stok Berjalan
          </div>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{stats.unitsInStock}</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-5">
        {/* Generator lisensi */}
        <section className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-2">
          <h2 className="text-sm font-extrabold text-slate-900">Generator Lisensi</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Buat kode lisensi baru format <span className="font-mono font-bold">OTO-XXXX-XXXX-XXXX</span>.
          </p>
          <form onSubmit={handleGenerate} className="mt-4 space-y-3">
            <div>
              <label
                htmlFor="sa-plan"
                className="mb-1 block text-xs font-bold text-slate-700"
              >
                Durasi / Paket
              </label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger id="sa-plan" className="h-11 w-full text-sm">
                  <SelectValue placeholder="Pilih paket" />
                </SelectTrigger>
                <SelectContent>
                  {SUPER_PLANS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="sa-quota" className="mb-1 block text-xs font-bold text-slate-700">
                Batas Kuota Unit
              </label>
              <Input
                id="sa-quota"
                type="number"
                min={1}
                max={10000}
                value={maxVehicles}
                onChange={(e) => setMaxVehicles(e.target.value)}
                className="h-11"
              />
            </div>
            <Button
              type="submit"
              className="h-11 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden />
              )}
              Generate Lisensi
            </Button>
          </form>

          {/* Kartu hasil generate */}
          {result && (
            <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">
                Lisensi berhasil dibuat
              </p>
              <p className="mt-1 break-all font-mono text-lg font-extrabold text-slate-900">
                {result.licenseKey}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-bold">
                <span className="rounded bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
                  {planLabel(result.planType)}
                </span>
                <span className="rounded bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
                  Kuota {result.maxVehicles} unit
                </span>
                <span className="rounded bg-white px-2 py-0.5 text-slate-700 ring-1 ring-slate-200">
                  {result.expiresAt ? expiryLabel(result) : 'Lifetime'}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-10 border-slate-300 bg-white text-xs font-extrabold"
                  onClick={() => copy(result.licenseKey, 'Kode lisensi disalin.')}
                >
                  <Copy className="mr-1 h-3.5 w-3.5" /> Salin Kode
                </Button>
                <Button
                  className="h-10 bg-emerald-700 text-xs font-extrabold hover:bg-emerald-800"
                  onClick={() =>
                    copy(buildBuyerWaMessage(result), 'Format WA pembeli disalin.')
                  }
                >
                  <MessageCircle className="mr-1 h-3.5 w-3.5" /> Salin Format WA Pembeli
                </Button>
              </div>
            </div>
          )}
        </section>

        {/* Tabel monitoring */}
        <section className="rounded-lg border border-slate-200 bg-white lg:col-span-3">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 p-4">
            <h2 className="min-w-0 flex-1 text-sm font-extrabold text-slate-900">
              Monitoring Klien & Showroom
            </h2>
            <Button
              variant="outline"
              size="sm"
              className="h-9 border-slate-300 text-xs font-extrabold"
              onClick={() => refetch()}
              disabled={refreshing}
            >
              <RefreshCcw
                className={`mr-1 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Muat Ulang
            </Button>
          </div>
          <div className="border-b border-slate-200 px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari kode lisensi, showroom, slug, atau nomor WA..."
                className="h-10 pl-9"
                aria-label="Cari lisensi"
              />
            </div>
          </div>

          {filtered.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm font-bold text-slate-500">
              {rows.length === 0 ? 'Belum ada lisensi terdaftar.' : 'Tidak ada hasil yang cocok.'}
            </p>
          ) : (
            <>
              {/* Tabel desktop */}
              <div className="hidden max-h-[36rem] overflow-y-auto lg:block">
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_#e2e8f0]">
                    <TableRow className="hover:bg-white">
                      <TableHead className="text-xs">Lisensi</TableHead>
                      <TableHead className="text-xs">Showroom</TableHead>
                      <TableHead className="text-xs">Owner WA</TableHead>
                      <TableHead className="text-xs">Kuota</TableHead>
                      <TableHead className="text-xs">Masa Aktif</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-right text-xs">Aksi Cepat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((r) => (
                      <LicenseRowActions
                        key={r.id}
                        row={r}
                        busyId={busyId}
                        onAction={handleAction}
                        onCopy={copy}
                        compact={false}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Kartu mobile */}
              <div className="max-h-[40rem] space-y-3 overflow-y-auto p-4 lg:hidden">
                {filtered.map((r) => (
                  <LicenseRowActions
                    key={r.id}
                    row={r}
                    busyId={busyId}
                    onAction={handleAction}
                    onCopy={copy}
                    compact
                  />
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

/** Satu baris lisensi — mode tabel (desktop) atau kartu (mobile). */
function LicenseRowActions({
  row,
  busyId,
  onAction,
  onCopy,
  compact,
}: {
  row: SuperLicenseRow
  busyId: string | null
  onAction: (row: SuperLicenseRow, action: 'extend' | 'suspend' | 'unsuspend') => void
  onCopy: (text: string, okMsg: string) => void
  compact: boolean
}) {
  const st = effectiveStatus(row)
  const badge = STATUS_BADGE[st]
  const isSuspended = st === 'suspended'
  const isLifetime = !row.expiresAt
  const busy = busyId != null
  const quotaPct = row.maxVehicles > 0 ? Math.min(100, (row.usedUnits / row.maxVehicles) * 100) : 0

  const licenseCell = (
    <div>
      <p className="font-mono text-[13px] font-extrabold tracking-tight text-slate-900">
        {row.licenseKey}
      </p>
      <span className="mt-0.5 inline-block rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
        {planLabel(row.planType)} • {row.maxVehicles} unit
      </span>
    </div>
  )

  const showroomCell = row.showroom ? (
    <div className="min-w-0">
      <p className="truncate text-[13px] font-extrabold text-slate-900">{row.showroom.name}</p>
      <a
        href={`/s/${row.showroom.slug}`}
        target="_blank"
        rel="noreferrer"
        className="text-[11px] font-bold text-blue-700 underline hover:text-blue-900"
      >
        /s/{row.showroom.slug}
      </a>
      {!row.showroom.isActive && (
        <span className="ml-1.5 inline-block rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
          Akses dibekukan
        </span>
      )}
    </div>
  ) : (
    <p className="text-xs italic text-slate-400">Belum diaktivasi</p>
  )

  const waCell = row.showroom ? (
    <a
      href={waLink(
        row.showroom.ownerPhone,
        `Halo ${row.showroom.name}, dari tim OtoStok. Terkait lisensi ${row.licenseKey}...`,
      )}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-xs font-extrabold text-emerald-700 hover:text-emerald-800"
      title="Chat owner via WhatsApp"
    >
      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
      {formatPhoneDisplay(row.showroom.ownerPhone)}
    </a>
  ) : (
    <span className="text-xs text-slate-400">—</span>
  )

  const quotaCell = (
    <div className="w-24">
      <p
        className={`text-xs font-extrabold ${
          row.usedUnits >= row.maxVehicles ? 'text-red-600' : 'text-slate-900'
        }`}
      >
        {row.usedUnits} / {row.maxVehicles} <span className="font-semibold">unit</span>
      </p>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full ${
            row.usedUnits >= row.maxVehicles ? 'bg-red-600' : 'bg-blue-700'
          }`}
          style={{ width: `${quotaPct}%` }}
        />
      </div>
    </div>
  )

  const expiryCell = (
    <div>
      <p
        className={`text-xs font-extrabold ${
          st === 'expired' ? 'text-red-600' : st === 'near_expiry' ? 'text-amber-600' : 'text-slate-900'
        }`}
      >
        {expiryLabel(row)}
      </p>
      {st === 'near_expiry' && row.expiresAt && (
        <p className="text-[10px] font-bold text-amber-600">
          Sisa {Math.max(1, Math.ceil((new Date(row.expiresAt).getTime() - Date.now()) / DAY_MS))} hari
        </p>
      )}
    </div>
  )

  const statusCell = (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-extrabold ${badge.className}`}
    >
      {isSuspended && <Lock className="h-3 w-3" aria-hidden />}
      {badge.label}
    </span>
  )

  const actionCell = (
    <div className={compact ? 'grid grid-cols-3 gap-1.5' : 'flex items-center justify-end gap-1.5'}>
      <Button
        variant="outline"
        size="sm"
        className="h-8 border-slate-300 px-2 text-[11px] font-extrabold"
        disabled={isLifetime || busy}
        title={isLifetime ? 'Lifetime tidak perlu diperpanjang' : 'Tambah 30 hari masa aktif'}
        onClick={() => onAction(row, 'extend')}
      >
        {busyId === `${row.id}-extend` ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          '+30 Hari'
        )}
      </Button>
      {isSuspended ? (
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-emerald-300 bg-emerald-50 px-2 text-[11px] font-extrabold text-emerald-700 hover:bg-emerald-100"
          disabled={busy}
          title="Buka kunci akses showroom"
          onClick={() => onAction(row, 'unsuspend')}
        >
          {busyId === `${row.id}-unsuspend` ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <>
              <LockOpen className="mr-0.5 h-3 w-3" aria-hidden /> Buka
            </>
          )}
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-amber-300 bg-amber-50 px-2 text-[11px] font-extrabold text-amber-700 hover:bg-amber-100"
          disabled={busy}
          title="Bekukan akses showroom (mis. tunggakan pembayaran)"
          onClick={() => onAction(row, 'suspend')}
        >
          {busyId === `${row.id}-suspend` ? (
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          ) : (
            <>
              <Lock className="mr-0.5 h-3 w-3" aria-hidden /> Suspend
            </>
          )}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-2 text-[11px] font-extrabold text-slate-600"
        disabled={busy}
        title="Salin ringkasan lisensi"
        onClick={() => onCopy(buildRowSummary(row), 'Ringkasan lisensi disalin.')}
      >
        <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
        <span className="sr-only">Salin info lisensi {row.licenseKey}</span>
      </Button>
    </div>
  )

  if (!compact) {
    return (
      <TableRow className={isSuspended ? 'bg-red-50/40' : undefined}>
        <TableCell>{licenseCell}</TableCell>
        <TableCell>{showroomCell}</TableCell>
        <TableCell>{waCell}</TableCell>
        <TableCell>{quotaCell}</TableCell>
        <TableCell>{expiryCell}</TableCell>
        <TableCell>{statusCell}</TableCell>
        <TableCell className="text-right">{actionCell}</TableCell>
      </TableRow>
    )
  }

  return (
    <div
      className={`rounded-lg border p-3 ${
        isSuspended ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {licenseCell}
        {statusCell}
      </div>
      <div className="mt-2.5 space-y-2 border-t border-slate-200 pt-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
            <Building2 className="h-3.5 w-3.5" aria-hidden /> Showroom
          </span>
          {showroomCell}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">Owner WA</span>
          {waCell}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">Kuota</span>
          {quotaCell}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-500">Masa Aktif</span>
          {expiryCell}
        </div>
      </div>
      <div className="mt-2.5 border-t border-slate-200 pt-2.5">{actionCell}</div>
    </div>
  )
}
