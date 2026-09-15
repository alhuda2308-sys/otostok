'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Copy, Plus, Trash2, UserRound } from 'lucide-react'
import {
  AdminGate,
  AdminNav,
  AdminSubHeader,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { copyToClipboard, formatDateID } from '@/lib/format'
import type { StaffAccountInfo } from '@/lib/types'

export function AdminStaffClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <StaffPage slug={slug} session={session} />}
    </AdminGate>
  )
}

function StaffPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  const [items, setItems] = useState<StaffAccountInfo[] | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [denied, setDenied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [createOpen, setCreateOpen] = useState(false)
  const [created, setCreated] = useState<{ name: string; username: string; password: string } | null>(
    null,
  )
  const [deleteTarget, setDeleteTarget] = useState<StaffAccountInfo | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${slug}/staff`, { cache: 'no-store' })
      if (res.status === 404) return setNotFound(true)
      if (res.status === 403) return setDenied(true)
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal memuat daftar staf.')
      }
      const j = await res.json()
      setItems(j.items)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat daftar staf.')
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  async function toggleActive(s: StaffAccountInfo) {
    setBusyId(s.id)
    try {
      const res = await fetch(`/api/admin/staff/${s.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !s.isActive }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal mengubah status akun.')
      toast.success(
        !s.isActive
          ? `Akun ${s.name} diaktifkan.`
          : `Akun ${s.name} dinonaktifkan — tidak bisa login.`,
      )
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal mengubah status akun.')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch(`/api/admin/staff/${deleteTarget.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menghapus akun.')
      toast.success(`Akun ${deleteTarget.name} dihapus.`)
      setDeleteTarget(null)
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus akun.')
    } finally {
      setBusyId(null)
    }
  }

  if (notFound) return <ShowroomNotFound slug={slug} />

  if (session.role !== 'owner' || denied) {
    return (
      <>
        <AdminSubHeader slug={slug} title="Kelola Akun Admin" session={session} />
        <AdminNav slug={slug} role={session.role} />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Kelola akun staf hanya bisa dilakukan oleh Owner.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminSubHeader
        slug={slug}
        title="Kelola Akun Admin"
        subtitle="Admin hanya bisa mengelola stok, log unit, dan melihat daftar penjualan — tidak bisa melihat lisensi, harga modal, atau mengelola staf lain."
        session={session}
      />
      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">
            {items ? `${items.length} akun terdaftar` : 'Memuat...'}
          </p>
          <Button
            className="h-10 bg-blue-700 px-4 text-sm font-extrabold hover:bg-blue-800"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="mr-1 h-4 w-4" /> Buat Akun Admin
          </Button>
        </div>

        <div className="space-y-2">
          {items?.map((s) => (
            <div
              key={s.id}
              className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100">
                  <UserRound className="h-5 w-5 text-slate-500" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-slate-900">
                    {s.name}
                    {s.role === 'owner' && (
                      <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-blue-700">
                        Owner
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    @{s.username} • dibuat {formatDateID(s.createdAt)}
                  </p>
                  {!s.isActive && (
                    <p className="mt-0.5 text-[11px] font-bold text-red-700">
                      Dinonaktifkan — tidak bisa login
                    </p>
                  )}
                </div>
              </div>
              {s.role !== 'owner' && (
                <div className="flex shrink-0 items-center gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                    <Switch
                      checked={s.isActive}
                      disabled={busyId === s.id}
                      onCheckedChange={() => toggleActive(s)}
                      aria-label={`Aktifkan/nonaktifkan akun ${s.name}`}
                    />
                    {s.isActive ? 'Aktif' : 'Nonaktif'}
                  </label>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 border-slate-300 hover:bg-red-50"
                    onClick={() => setDeleteTarget(s)}
                    aria-label={`Hapus akun ${s.name}`}
                  >
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Dialog buat akun */}
      <CreateStaffDialog
        slug={slug}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(c) => {
          setCreateOpen(false)
          setCreated(c)
          load()
        }}
      />

      {/* Dialog kredensial baru dibuat */}
      <Dialog open={created != null} onOpenChange={(o) => !o && setCreated(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">Akun Admin Dibuat</DialogTitle>
            <DialogDescription>
              Bagikan kredensial berikut ke staf Anda — password tidak ditampilkan lagi
              setelah ini.
            </DialogDescription>
          </DialogHeader>
          {created && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
              <p>
                Nama: <span className="font-extrabold">{created.name}</span>
              </p>
              <p>
                Username: <code className="font-bold">{created.username}</code>
              </p>
              <p>
                Password: <code className="font-bold">{created.password}</code>
              </p>
              <Button
                variant="outline"
                className="mt-1 h-10 w-full border-slate-300 text-xs font-bold"
                onClick={async () => {
                  const ok = await copyToClipboard(
                    `Nama: ${created.name}\nUsername: ${created.username}\nPassword: ${created.password}`,
                  )
                  if (ok) toast.success('Kredensial disalin — kirim via WA pribadi.')
                  else toast.error('Gagal menyalin.')
                }}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Salin Kredensial
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold">
              Hapus akun ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `Akun "${deleteTarget.name} (@${deleteTarget.username})" akan dihapus permanen dan tidak bisa login lagi.`
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

function CreateStaffDialog({
  slug,
  open,
  onOpenChange,
  onCreated,
}: {
  slug: string
  open: boolean
  onOpenChange: (o: boolean) => void
  onCreated: (c: { name: string; username: string; password: string }) => void
}) {
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setName('')
      setUsername('')
      setPassword('')
      setError(null)
    }
  }, [open])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/${slug}/staff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, password }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal membuat akun.')
      onCreated({ name: name.trim(), username: username.trim().toLowerCase(), password })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat akun.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">Buat Akun Admin Baru</DialogTitle>
          <DialogDescription>
            Akun admin untuk staf internal showroom Anda.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="staff-name">Nama Lengkap *</Label>
            <Input
              id="staff-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth: Budi Santoso"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-username">Username *</Label>
            <Input
              id="staff-username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="cth: budi"
              autoCapitalize="none"
              autoCorrect="off"
              className="h-11"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="staff-password">Password *</Label>
            <Input
              id="staff-password"
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              className="h-11"
              minLength={6}
              required
            />
          </div>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 border-slate-300 font-bold"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={busy}
              className="h-12 flex-1 bg-blue-700 font-extrabold hover:bg-blue-800"
            >
              {busy ? 'Membuat...' : 'Buat Akun'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
