'use client'

import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Building2, ExternalLink, MapPin, Pencil, Plus, Trash2 } from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { ApiError, qk, useBranchesQuery } from '@/lib/queries'
import type { BranchInfo } from '@/lib/types'

export function AdminBranchesClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <BranchesPage slug={slug} session={session} />}
    </AdminGate>
  )
}

interface FormState {
  name: string
  address: string
  mapsUrl: string
}

const EMPTY_FORM: FormState = { name: '', address: '', mapsUrl: '' }

function BranchesPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  // Data via TanStack Query — daftar cabang tampil instan dari cache saat kembali ke tab ini.
  const branchesQuery = useBranchesQuery(slug)
  const queryClient = useQueryClient()
  const branches = branchesQuery.data?.branches ?? []
  const loading = branchesQuery.isPending
  const notFound =
    branchesQuery.error instanceof ApiError && branchesQuery.error.status === 404

  // Dialog tambah/edit
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<BranchInfo | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  // Dialog hapus
  const [deleteTarget, setDeleteTarget] = useState<BranchInfo | null>(null)

  const isOwner = session.role === 'owner'

  // Gagal memuat (selain 404) tetap diberi tahu via toast — perilaku sama seperti dulu.
  useEffect(() => {
    if (branchesQuery.error && !notFound) {
      toast.error(
        branchesQuery.error instanceof Error
          ? branchesQuery.error.message
          : 'Gagal memuat daftar cabang.',
      )
    }
  }, [branchesQuery.error, notFound])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(b: BranchInfo) {
    setEditing(b)
    setForm({ name: b.name, address: b.address, mapsUrl: b.mapsUrl ?? '' })
    setDialogOpen(true)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.name.trim().length < 3) return toast.error('Nama cabang minimal 3 karakter.')
    if (form.address.trim().length < 5) return toast.error('Alamat cabang wajib diisi.')
    const maps = form.mapsUrl.trim()
    if (maps && !/^https?:\/\//i.test(maps))
      return toast.error('Link Google Maps harus diawali http:// atau https://.')

    setSaving(true)
    try {
      const res = editing
        ? await fetch(`/api/admin/branches/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name.trim(),
              address: form.address.trim(),
              mapsUrl: maps,
            }),
          })
        : await fetch(`/api/admin/${slug}/branches`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: form.name.trim(),
              address: form.address.trim(),
              mapsUrl: maps,
            }),
          })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan cabang.')
      toast.success(
        editing
          ? 'Perubahan cabang tersimpan.'
          : `Cabang "${form.name.trim()}" ditambahkan — dropdown lokasi otomatis aktif di form motor.`,
      )
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: qk.branches(slug) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan cabang.')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/admin/branches/${deleteTarget.id}`, { method: 'DELETE' })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menghapus cabang.')
      toast.success(
        j.message || `Cabang "${deleteTarget.name}" dihapus.`,
      )
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: qk.branches(slug) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus cabang.')
    }
  }

  if (notFound) return <ShowroomNotFound slug={slug} />

  if (!isOwner) {
    return (
      <>
        <AdminSubHeader slug={slug} title="Pengaturan Cabang" session={session} />
        <AdminNav slug={slug} role={session.role} />
        <div className="mx-auto w-full max-w-md flex-1 px-4 py-12 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <h2 className="mt-3 text-base font-extrabold text-slate-900">Akses khusus Owner</h2>
          <p className="mt-1 text-sm text-slate-500">
            Hanya owner yang boleh mengelola cabang showroom.
          </p>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminSubHeader
        slug={slug}
        title="Pengaturan Cabang"
        subtitle="Daftarkan lokasi fisik lain tempat unit disimpan selain lokasi utama."
        session={session}
      />
      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-4">
        {/* Info perilaku otomatis */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
          <p className="font-extrabold">Cara kerja cabang di OtoStok:</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>
              <span className="font-bold">Tanpa cabang</span> — semua unit otomatis berada di
              lokasi utama; dropdown lokasi &amp; filter lokasi <span className="font-bold">disembunyikan</span> di
              form motor dan katalog marketing.
            </li>
            <li>
              <span className="font-bold">Punya cabang</span> — form motor menampilkan dropdown
              &ldquo;Lokasi Unit Berada&rdquo;, dan katalog marketing menampilkan badge lokasi +
              filter cabang + tombol Google Maps per unit.
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Daftar Cabang ({branches.length})
            </h2>
            <p className="text-xs text-slate-500">
              Unit di lokasi utama tidak perlu dipilih apa pun — otomatis.
            </p>
          </div>
          <Button
            className="h-11 shrink-0 bg-blue-700 px-4 text-sm font-extrabold hover:bg-blue-800"
            onClick={openCreate}
          >
            <Plus className="mr-1 h-4 w-4" /> Tambah Cabang
          </Button>
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
          </div>
        )}

        {!loading && branches.length === 0 && (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <Building2 className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm font-bold text-slate-700">Belum ada cabang terdaftar.</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Showroom ini saat ini satu lokasi. Tambahkan cabang hanya jika unit benar-benar
              disimpan di tempat lain.
            </p>
            <Button
              className="mt-4 h-11 bg-blue-700 font-bold hover:bg-blue-800"
              onClick={openCreate}
            >
              <Plus className="mr-1 h-4 w-4" /> Tambah Cabang Pertama
            </Button>
          </div>
        )}

        {!loading && branches.length > 0 && (
          <div className="space-y-2.5">
            {branches.map((b) => (
              <article
                key={b.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                      <Building2 className="h-4 w-4 shrink-0 text-blue-700" aria-hidden />
                      {b.name}
                    </h3>
                    <p className="mt-1 flex items-start gap-1 text-xs leading-relaxed text-slate-600">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
                      {b.address}
                    </p>
                    {b.mapsUrl && (
                      <a
                        href={b.mapsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 inline-flex items-center gap-1 text-xs font-extrabold text-blue-700 hover:underline"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Buka Google Maps
                      </a>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-slate-300"
                      onClick={() => openEdit(b)}
                      aria-label={`Edit cabang ${b.name}`}
                    >
                      <Pencil className="h-4 w-4 text-slate-600" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-9 w-9 border-slate-300 hover:bg-red-50"
                      onClick={() => setDeleteTarget(b)}
                      aria-label={`Hapus cabang ${b.name}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Dialog tambah/edit cabang */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {editing ? `Edit Cabang — ${editing.name}` : 'Tambah Cabang Baru'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Perbarui data cabang. Perubahan langsung tampil di katalog marketing.'
                : 'Isi lokasi fisik cabang. Unit motor bisa ditugaskan ke cabang ini di form motor.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="b-name">Nama Cabang *</Label>
              <Input
                id="b-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="cth: Cabang Bekasi"
                className="h-11"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-address">Alamat Lengkap *</Label>
              <Textarea
                id="b-address"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="cth: Jl. Raya Bekasi KM 18, Bekasi Selatan, Jawa Barat"
                rows={2}
                className="resize-none"
                maxLength={200}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="b-maps">Link Google Maps</Label>
              <Input
                id="b-maps"
                value={form.mapsUrl}
                onChange={(e) => setForm((f) => ({ ...f, mapsUrl: e.target.value }))}
                placeholder="https://maps.app.goo.gl/..."
                className="h-11"
                autoCapitalize="none"
                autoCorrect="off"
                inputMode="url"
              />
              <p className="text-[11px] text-slate-500">
                Marketing menekan tombol Maps di kartu unit untuk navigasi antar pembeli —
                isi agar tidak salah alamat.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                className="h-11 border-slate-300 font-bold"
                onClick={() => setDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="h-11 flex-1 bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
              >
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Tambah Cabang'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus cabang */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold">
              Hapus cabang ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.name}" akan dihapus dari daftar lokasi. Unit yang terdaftar di cabang ini otomatis kembali ke Lokasi Utama.`
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
