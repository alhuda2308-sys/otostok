'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Bike, Building2, ClipboardList, FileBarChart, LayoutDashboard, LogOut, Megaphone, Settings, Users } from 'lucide-react'
import { toast } from 'sonner'
import { AppIcon } from '@/components/app-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { qk, useSessionQuery, type AdminSession } from '@/lib/queries'
import type { SessionResponse, StaffRole } from '@/lib/types'

export type { AdminSession } from '@/lib/queries'

/**
 * Gate halaman admin: wajib login (owner/admin).
 * Belum login -> tampilkan kartu login inline.
 * Sesi milik showroom lain -> dianggap belum login.
 * Sesi dicek via TanStack Query (cache 5 menit) — pindah antar-tab admin
 * tidak lagi menampilkan skeleton "Memeriksa sesi..." berulang.
 */
export function AdminGate({
  slug,
  children,
}: {
  slug: string
  children: (session: AdminSession) => React.ReactNode
}) {
  const { data, isPending } = useSessionQuery()

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-md flex-1 space-y-3 px-4 py-10">
        <div className="h-40 animate-pulse rounded-lg bg-slate-200" />
      </div>
    )
  }

  const session =
    data?.session && data.session.slug === slug ? (data.session as AdminSession) : null

  if (!session)
    return (
      <LoginCard
        slug={slug}
        onSuccess={() => {
          // Tidak perlu setState — LoginCard sudah menulis sesi ke cache
          // (setQueryData), AdminGate otomatis render ulang dari cache.
        }}
      />
    )

  return <>{children(session)}</>
}

/** Kartu login dashboard (owner & admin/staf). */
function LoginCard({
  slug,
  onSuccess,
}: {
  slug: string
  onSuccess: (s: AdminSession) => void
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const queryClient = useQueryClient()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, username, password }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Login gagal.')
      toast.success(`Selamat bekerja, ${j.session.name}!`)
      // Prime cache: tulis sesi baru dulu (observer aktif langsung render dari
      // cache), LALU buang cache data milik sesi/showroom sebelumnya.
      // Urutan penting: queryClient.clear() menghapus query ['session'] yang
      // sedang di-observe dan membuat gate macet di kartu login.
      queryClient.setQueryData(qk.session, j as SessionResponse)
      queryClient.removeQueries({
        predicate: (q) => q.queryKey[0] !== 'session',
      })
      onSuccess(j.session as AdminSession)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2.5">
          <AppIcon className="h-9 w-9" />
          <div>
            <h1 className="text-base font-extrabold text-slate-900">Login Dashboard</h1>
            <p className="text-xs text-slate-500">
              Showroom <code className="font-bold text-slate-700">{slug}</code>
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="login-username">Username</Label>
            <Input
              id="login-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="cth: owner atau budi"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="login-password">Password</Label>
            <Input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password akun Anda"
              className="h-11"
              required
            />
          </div>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </p>
          )}
          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
          >
            {busy ? 'Memeriksa...' : 'Masuk Dashboard'}
          </Button>
        </form>

        {slug === 'showroom-jaya' && (
          <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-600">
            <p className="font-extrabold text-slate-700">Akun demo:</p>
            <p>
              Owner: <code className="font-bold">owner</code> /{' '}
              <code className="font-bold">demo1234</code>
            </p>
            <p>
              Admin staf: <code className="font-bold">budi</code> /{' '}
              <code className="font-bold">budi1234</code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/** Tombol keluar + nama akun. */
export function SessionBadge({ session }: { session: AdminSession }) {
  const router = useRouter()

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    toast.success('Anda sudah keluar.')
    router.refresh()
    window.location.reload()
  }

  return (
    <div className="flex items-center gap-2">
      <div className="text-right leading-tight">
        <p className="text-[11px] font-extrabold text-slate-900">{session.name}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
          {session.role === 'owner' ? 'Owner' : 'Admin Staf'}
        </p>
      </div>
      <Button
        variant="outline"
        size="icon"
        className="h-9 w-9 border-slate-300"
        onClick={logout}
        aria-label="Keluar"
        title="Keluar"
      >
        <LogOut className="h-4 w-4 text-slate-600" />
      </Button>
    </div>
  )
}

/** Navigasi tab antar halaman admin (Dashboard, Mutasi, Laporan, + owner saja). */
export function AdminNav({ slug, role }: { slug: string; role: StaffRole }) {
  const pathname = usePathname()
  const base = `/admin/${slug}`

  const items = [
    { href: base, label: 'Dashboard', icon: LayoutDashboard },
    { href: `${base}/mutasi`, label: 'Mutasi', icon: ClipboardList },
    { href: `${base}/reports`, label: 'Laporan', icon: FileBarChart },
    { href: `${base}/marketings`, label: 'Marketing', icon: Megaphone },
    ...(role === 'owner'
      ? [
          { href: `${base}/settings`, label: 'Pengaturan', icon: Settings },
          { href: `${base}/branches`, label: 'Cabang', icon: Building2 },
          { href: `${base}/staff`, label: 'Staf', icon: Users },
        ]
      : []),
  ]

  return (
    <nav
      aria-label="Navigasi admin"
      className="scrollbar-thin sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur"
    >
      <div className="mx-auto flex w-full max-w-6xl gap-1 overflow-x-auto px-2 py-2">
        {items.map((it) => {
          const active =
            it.href === base ? pathname === base : pathname.startsWith(it.href)
          return (
            // prefetch penuh rute admin — pindah tab terasa instan
            <Link
              key={it.href}
              href={it.href}
              prefetch={true}
              aria-current={active ? 'page' : undefined}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-extrabold ${
                active
                  ? 'bg-blue-700 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <it.icon className="h-3.5 w-3.5" aria-hidden />
              {it.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

/** Header dasar halaman admin dengan link kembali ke dashboard. */
export function AdminSubHeader({
  slug,
  title,
  subtitle,
  session,
  right,
}: {
  slug: string
  title: string
  subtitle?: string
  session: AdminSession
  right?: React.ReactNode
}) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <AppIcon className="h-8 w-8 shrink-0" />
          <div className="min-w-0 leading-tight">
            <Link
              href={`/admin/${slug}`}
              className="text-[10px] font-extrabold uppercase tracking-wider text-blue-700 hover:underline"
            >
              &larr; Dashboard
            </Link>
            <h1 className="truncate text-sm font-extrabold text-slate-900">{title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {right}
          <SessionBadge session={session} />
        </div>
      </div>
      {subtitle && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-2">
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
      )}
    </header>
  )
}

/** Ilustrasi showroom tidak ditemukan (dipakai ulang di halaman admin). */
export function ShowroomNotFound({ slug }: { slug: string }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <Bike className="h-10 w-10 text-slate-300" aria-hidden />
      <h1 className="mt-3 text-lg font-extrabold text-slate-900">Showroom tidak ditemukan</h1>
      <p className="mt-1 text-sm text-slate-500">
        Katalog dengan slug <code className="font-bold">{slug}</code> tidak terdaftar.
      </p>
      <Button asChild className="mt-4 h-11 bg-blue-700 font-bold hover:bg-blue-800">
        <Link href="/activate">Aktivasi Showroom Baru</Link>
      </Button>
    </div>
  )
}
