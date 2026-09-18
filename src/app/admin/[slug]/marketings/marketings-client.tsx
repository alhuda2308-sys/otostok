'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Copy,
  ExternalLink,
  FileImage,
  IdCard,
  Link2,
  Lock,
  Megaphone,
  MessageCircle,
  Pencil,
  Plus,
  Store,
  Trash2,
} from 'lucide-react'
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
import { Textarea } from '@/components/ui/textarea'
import { copyToClipboard, formatDateID, formatPhoneDisplay, waLink } from '@/lib/format'
import { compressImage } from '@/lib/image-compress'
import { ApiError, qk, useMarketingsQuery } from '@/lib/queries'
import type { MarketingPartner } from '@/lib/types'

export function AdminMarketingsClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <MarketingsPage slug={slug} session={session} />}
    </AdminGate>
  )
}

interface FormState {
  fullName: string
  phoneNumber: string
  addressCity: string
  notes: string
  ktpUrl: string // '' = tidak ada; 'REMOVED' = dihapus saat edit
  ktpChanged: boolean
}

const EMPTY_FORM: FormState = {
  fullName: '',
  phoneNumber: '',
  addressCity: '',
  notes: '',
  ktpUrl: '',
  ktpChanged: false,
}

function MarketingsPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  // Data via TanStack Query — daftar rekanan tampil instan dari cache saat kembali ke tab ini.
  const marketingsQuery = useMarketingsQuery(slug)
  const queryClient = useQueryClient()
  const partners = marketingsQuery.data?.marketings ?? []
  const loading = marketingsQuery.isPending
  const notFound =
    marketingsQuery.error instanceof ApiError && marketingsQuery.error.status === 404

  // Dialog tambah/edit
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MarketingPartner | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [uploadingKtp, setUploadingKtp] = useState(false)
  const ktpInputRef = useRef<HTMLInputElement>(null)

  // Dialog hapus & pratinjau KTP
  const [deleteTarget, setDeleteTarget] = useState<MarketingPartner | null>(null)
  const [ktpPreview, setKtpPreview] = useState<MarketingPartner | null>(null)

  // Sakelar aktif/nonaktif yang sedang diproses
  const [togglingId, setTogglingId] = useState<string | null>(null)

  // Nama showroom utk pesan WA "kirim link toko" + origin absolut utk link katalog
  const [showroomName, setShowroomName] = useState('')
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(window.location.origin)
    let alive = true
    fetch(`/api/showrooms/${slug}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (alive && j?.name) setShowroomName(j.name as string)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [slug])

  const isOwner = session.role === 'owner'

  // Gagal memuat (selain 404) tetap diberi tahu via toast — perilaku sama seperti dulu.
  useEffect(() => {
    if (marketingsQuery.error && !notFound) {
      toast.error(
        marketingsQuery.error instanceof Error
          ? marketingsQuery.error.message
          : 'Gagal memuat daftar rekanan.',
      )
    }
  }, [marketingsQuery.error, notFound])

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(m: MarketingPartner) {
    setEditing(m)
    setForm({
      fullName: m.fullName,
      phoneNumber: m.phoneNumber,
      addressCity: m.addressCity,
      notes: m.notes ?? '',
      ktpUrl: m.ktpPhotoUrl ?? '',
      ktpChanged: false,
    })
    setDialogOpen(true)
  }

  async function handleKtpUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // reset supaya file sama bisa dipilih ulang
    if (!file) return
    if (!isOwner) return
    setUploadingKtp(true)
    try {
      const compressed = await compressImage(file)
      const fd = new FormData()
      fd.append('file', compressed)
      const res = await fetch(`/api/admin/${slug}/marketings/ktp`, {
        method: 'POST',
        body: fd,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Upload KTP gagal.')
      setForm((f) => ({ ...f, ktpUrl: j.url, ktpChanged: true }))
      toast.success('Foto KTP siap. Tekan Simpan untuk menetapkannya.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload KTP gagal.')
    } finally {
      setUploadingKtp(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.fullName.trim().length < 2) return toast.error('Nama lengkap wajib diisi.')
    const phoneDigits = form.phoneNumber.replace(/\D/g, '')
    if (!phoneDigits.startsWith('08') || phoneDigits.length < 10 || phoneDigits.length > 14) {
      return toast.error('Nomor WhatsApp wajib format Indonesia 08xxx (10-14 digit).')
    }
    if (form.addressCity.trim().length < 2) return toast.error('Domisili / kota asal wajib diisi.')

    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        fullName: form.fullName.trim(),
        phoneNumber: phoneDigits,
        addressCity: form.addressCity.trim(),
        notes: form.notes.trim(),
      }
      if (!editing || form.ktpChanged) {
        payload.ktpPhotoUrl = form.ktpUrl === 'REMOVED' ? '' : form.ktpUrl
      }
      const res = editing
        ? await fetch(`/api/admin/marketings/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/${slug}/marketings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan rekanan.')
      toast.success(
        editing
          ? 'Data rekanan diperbarui.'
          : `"${form.fullName.trim()}" terdaftar — nomor itu sekarang bisa membuka katalog.`,
      )
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: qk.marketings(slug) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan rekanan.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(m: MarketingPartner) {
    setTogglingId(m.id)
    try {
      const res = await fetch(`/api/admin/marketings/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !m.isActive }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal mengubah status.')
      toast.success(
        !m.isActive
          ? `${m.fullName} AKTIF — bisa akses katalog & tahan unit.`
          : `${m.fullName} dinonaktifkan — akses katalog nomornya diblokir.`,
      )
      await queryClient.invalidateQueries({ queryKey: qk.marketings(slug) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status.')
    } finally {
      setTogglingId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    try {
      const res = await fetch(`/api/admin/marketings/${deleteTarget.id}`, {
        method: 'DELETE',
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menghapus rekanan.')
      toast.success(j.message || `Rekanan "${deleteTarget.fullName}" dihapus.`)
      setDeleteTarget(null)
      await queryClient.invalidateQueries({ queryKey: qk.marketings(slug) })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus rekanan.')
    }
  }

  /**
   * Link Toko personal marketing — katalog publik dgn parameter referral.
   * Utamakan ?ref=<kode> (ringkas & stabil walau data rekanan berubah);
   * fallback ?mkt=<id> bila kode belum terbentuk (rekanan lama).
   */
  function buildStoreLink(m: { code: string | null; id: string }): string {
    const base = `${origin}/s/${slug}`
    return m.code ? `${base}?ref=${m.code}` : `${base}?mkt=${m.id}`
  }

  async function handleCopyStoreLink(m: MarketingPartner) {
    if (!origin) return toast.error('Menyiapkan link... coba sesaat lagi.')
    const ok = await copyToClipboard(buildStoreLink(m))
    if (ok) {
      toast.success(
        `Link Toko ${m.fullName} disalin — bagikan ke pembeli; semua chat masuk ke WA-nya.`,
      )
    } else {
      toast.error('Gagal menyalin. Coba lagi.')
    }
  }

  async function handleCopyMainLink() {
    if (!origin) return toast.error('Menyiapkan link... coba sesaat lagi.')
    const ok = await copyToClipboard(`${origin}/s/${slug}`)
    if (ok) {
      toast.success('Link Katalog Utama disalin — chat pembeli masuk ke WA resmi showroom.')
    } else {
      toast.error('Gagal menyalin. Coba lagi.')
    }
  }

  /** Buka WhatsApp mitra dgn pesan berisi Link Toko personalnya. */
  function sendStoreLinkViaWa(m: MarketingPartner): string {
    const link = buildStoreLink(m)
    const name = showroomName || 'showroom'
    const msg = `Halo ${m.fullName}, ini Link Toko personal Anda untuk katalog ${name}:\n\n${link}\n\nBagikan link tersebut ke pembeli — semua chat WhatsApp dari pembeli langsung masuk ke nomor ini, lengkap dengan info unit yang mereka tanyakan. Terima kasih.`
    return waLink(m.phoneNumber, msg)
  }

  if (notFound) return <ShowroomNotFound slug={slug} />

  return (
    <>
      <AdminSubHeader
        slug={slug}
        title="Manajemen Tim Marketing"
        subtitle="Daftar rekanan resmi — nomor WhatsApp yang boleh membuka katalog & menahan unit."
        session={session}
      />
      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-4 px-4 py-4">
        {/* Kartu utama: Link Katalog Utama Showroom (Khusus Owner)
            — salin & bagikan langsung ke pembeli tanpa perantara marketing. */}
        {isOwner && (
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="flex flex-wrap items-center gap-1.5 text-sm font-extrabold text-slate-900">
                  <Store className="h-4 w-4 shrink-0 text-blue-700" aria-hidden />
                  Link Katalog Utama Showroom
                  <span className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700">
                    KHUSUS OWNER
                  </span>
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Link resmi katalog tanpa perantara marketing — semua chat WhatsApp pembeli
                  langsung masuk ke nomor resmi showroom.
                </p>
                <p
                  dir="ltr"
                  className="mt-2 truncate rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-700"
                >
                  {origin ? `${origin}/s/${slug}` : `/s/${slug}`}
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                className="h-10 bg-blue-700 px-3 text-xs font-extrabold hover:bg-blue-800"
                onClick={handleCopyMainLink}
              >
                <Copy className="mr-1 h-3.5 w-3.5" /> Salin Link Katalog
              </Button>
              <Button
                variant="outline"
                asChild
                className="h-10 border-slate-300 px-3 text-xs font-extrabold"
              >
                <a href={`/s/${slug}`} target="_blank" rel="noreferrer">
                  <ExternalLink className="mr-1 h-3.5 w-3.5" /> Buka Katalog
                </a>
              </Button>
            </div>
          </div>
        )}

        {/* Info cara kerja whitelist */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
          <p className="font-extrabold">Sistem Rekanan Terdaftar (Whitelist WhatsApp):</p>
          <ul className="mt-1.5 list-disc space-y-1 pl-4">
            <li>
              Hanya nomor yang terdaftar di sini (status <span className="font-bold">Aktif</span>)
              yang bisa membuka katalog <code className="font-bold">/s/{slug}</code> — tanpa
              password.
            </li>
            <li>
              Nonaktifkan rekanan untuk langsung memblokir akses nomornya ke katalog.
            </li>
            <li>
              Identitas rekanan otomatis tercatat di setiap tahanan unit (hold 2 jam).
            </li>
            <li>
              Bagikan <span className="font-bold">Link Toko</span> per rekanan — pembeli yang
              membukanya melihat katalog dgn nama mitra &amp; semua tombol WA mengarah ke nomor
              mitra (Personal Store).
            </li>
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              Daftar Rekanan Marketing ({partners.length})
            </h2>
            <p className="text-xs text-slate-500">
              {partners.length === 0
                ? 'Belum ada rekanan — katalog masih terbuka untuk umum.'
                : 'Katalog terkunci: hanya nomor rekanan aktif yang bisa masuk.'}
            </p>
          </div>
          {isOwner && (
            <Button
              className="h-11 shrink-0 bg-blue-700 px-4 text-sm font-extrabold hover:bg-blue-800"
              onClick={openCreate}
            >
              <Plus className="mr-1 h-4 w-4" /> Tambah Rekanan
            </Button>
          )}
        </div>

        {loading && (
          <div className="space-y-2">
            <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
            <div className="h-24 animate-pulse rounded-lg bg-slate-200" />
          </div>
        )}

        {!loading && partners.length === 0 && (
          <div className="flex flex-col items-center rounded-lg border border-dashed border-slate-300 bg-white px-4 py-12 text-center">
            <Megaphone className="h-8 w-8 text-slate-300" aria-hidden />
            <p className="mt-2 text-sm font-bold text-slate-700">Belum ada rekanan terdaftar.</p>
            <p className="mt-1 max-w-xs text-xs text-slate-500">
              Daftarkan marketing pertama agar katalog hanya bisa diakses rekanan resmi showroom.
            </p>
            {isOwner && (
              <Button
                className="mt-4 h-11 bg-blue-700 font-bold hover:bg-blue-800"
                onClick={openCreate}
              >
                <Plus className="mr-1 h-4 w-4" /> Tambah Rekanan Pertama
              </Button>
            )}
          </div>
        )}

        {/* Tabel desktop */}
        {!loading && partners.length > 0 && (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-extrabold">Nama</th>
                    <th className="px-3 py-2.5 font-extrabold">WhatsApp</th>
                    <th className="px-3 py-2.5 font-extrabold">Domisili</th>
                    <th className="px-3 py-2.5 text-center font-extrabold">Performa</th>
                    <th className="px-3 py-2.5 font-extrabold">Status</th>
                    <th className="px-3 py-2.5 font-extrabold">Terdaftar</th>
                    <th className="px-3 py-2.5 text-center font-extrabold">KTP</th>
                    <th className="px-3 py-2.5 font-extrabold">Link Toko</th>
                    <th className="px-4 py-2.5 text-right font-extrabold">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((m) => (
                    <tr key={m.id} className="border-b border-slate-100 last:border-0">
                      <td className="max-w-[180px] px-4 py-3">
                        <p className="truncate font-extrabold text-slate-900">{m.fullName}</p>
                        {m.notes && (
                          <p className="mt-0.5 truncate text-[11px] text-slate-500" title={m.notes}>
                            {m.notes}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 font-bold text-slate-700">
                        {formatPhoneDisplay(m.phoneNumber)}
                      </td>
                      <td className="px-3 py-3 text-slate-700">{m.addressCity}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-center text-xs">
                        <span className="font-bold text-amber-700">Tahan {m.holdCount}</span>
                        <span className="mx-1 text-slate-300">•</span>
                        <span className="font-bold text-emerald-700">Laku {m.soldCount}</span>
                      </td>
                      <td className="px-3 py-3">
                        {isOwner ? (
                          <Switch
                            checked={m.isActive}
                            disabled={togglingId === m.id}
                            onCheckedChange={() => toggleActive(m)}
                            aria-label={`Aktifkan/nonaktifkan ${m.fullName}`}
                          />
                        ) : (
                          <span
                            className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                              m.isActive
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-slate-200 text-slate-600'
                            }`}
                          >
                            {m.isActive ? 'Aktif' : 'Nonaktif'}
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                        {formatDateID(m.createdAt)}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {m.hasKtp ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-300 px-2 text-xs font-bold"
                            onClick={() => setKtpPreview(m)}
                          >
                            <FileImage className="mr-1 h-3.5 w-3.5" /> Lihat
                          </Button>
                        ) : (
                          <span className="text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-slate-300 px-2 text-[11px] font-extrabold"
                            onClick={() => handleCopyStoreLink(m)}
                            title={`Salin link katalog referral ${m.fullName}`}
                          >
                            <Link2 className="mr-1 h-3.5 w-3.5" /> Salin Link Toko
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-emerald-200 bg-emerald-50 px-2 text-[11px] font-extrabold text-emerald-800 hover:bg-emerald-100"
                            asChild
                          >
                            <a
                              href={sendStoreLinkViaWa(m)}
                              target="_blank"
                              rel="noreferrer"
                              title={`Kirim link toko via WhatsApp ke ${m.fullName}`}
                            >
                              <MessageCircle className="mr-1 h-3.5 w-3.5" /> Kirim Link via WA
                            </a>
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {isOwner ? (
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-slate-300"
                              onClick={() => openEdit(m)}
                              aria-label={`Edit data ${m.fullName}`}
                            >
                              <Pencil className="h-3.5 w-3.5 text-slate-600" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              className="h-8 w-8 border-slate-300 hover:bg-red-50"
                              onClick={() => setDeleteTarget(m)}
                              aria-label={`Hapus ${m.fullName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-red-600" />
                            </Button>
                          </div>
                        ) : (
                          <span className="block text-right text-[11px] text-slate-400">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Kartu mobile */}
            <div className="space-y-2.5 md:hidden">
              {partners.map((m) => (
                <article
                  key={m.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="flex items-center gap-1.5 text-sm font-extrabold text-slate-900">
                        <Megaphone className="h-4 w-4 shrink-0 text-blue-700" aria-hidden />
                        {m.fullName}
                      </h3>
                      <p className="mt-1 text-xs font-bold text-slate-700">
                        WA {formatPhoneDisplay(m.phoneNumber)} • {m.addressCity}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        Terdaftar {formatDateID(m.createdAt)}
                      </p>
                      {m.notes && (
                        <p className="mt-1 rounded bg-slate-50 px-2 py-1 text-[11px] italic text-slate-600">
                          &ldquo;{m.notes}&rdquo;
                        </p>
                      )}
                    </div>
                    {isOwner && (
                      <Switch
                        checked={m.isActive}
                        disabled={togglingId === m.id}
                        onCheckedChange={() => toggleActive(m)}
                        aria-label={`Aktifkan/nonaktifkan ${m.fullName}`}
                      />
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                        m.isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {m.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                    <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                      Pernah tahan {m.holdCount} unit
                    </span>
                    <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      Terjual {m.soldCount} unit
                    </span>
                    {m.hasKtp && (
                      <button
                        type="button"
                        onClick={() => setKtpPreview(m)}
                        className="rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-extrabold text-blue-700"
                      >
                        Pratinjau KTP
                      </button>
                    )}
                  </div>

                  {isOwner && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="h-10 border-slate-300 text-xs font-extrabold"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="mr-1 h-3.5 w-3.5" /> Edit Data
                      </Button>
                      <Button
                        variant="outline"
                        className="h-10 border-red-200 text-xs font-extrabold text-red-700 hover:bg-red-50"
                        onClick={() => setDeleteTarget(m)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Hapus
                      </Button>
                    </div>
                  )}

                  {/* Link Toko personal — salin utk dibagikan pembeli / kirim via WA ke mitra */}
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-10 border-slate-300 text-xs font-extrabold"
                      onClick={() => handleCopyStoreLink(m)}
                    >
                      <Link2 className="mr-1 h-3.5 w-3.5" /> Salin Link Toko
                    </Button>
                    <Button
                      variant="outline"
                      className="h-10 border-emerald-200 bg-emerald-50 text-xs font-extrabold text-emerald-800 hover:bg-emerald-100"
                      asChild
                    >
                      <a href={sendStoreLinkViaWa(m)} target="_blank" rel="noreferrer">
                        <MessageCircle className="mr-1 h-3.5 w-3.5" /> Kirim Link via WA
                      </a>
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Dialog tambah/edit rekanan */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              {editing ? `Edit Rekanan — ${editing.fullName}` : 'Tambah Rekanan Marketing'}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? 'Perbarui data rekanan. Nomor aktif otomatis bisa akses katalog.'
                : 'Nomor WhatsApp yang didaftarkan di sini langsung bisa membuka katalog showroom.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="m-name">Nama Lengkap *</Label>
              <Input
                id="m-name"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="cth: Deni Prasetyo"
                className="h-11"
                autoFocus
                required
                minLength={2}
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-phone">Nomor WhatsApp Aktif *</Label>
              <Input
                id="m-phone"
                value={form.phoneNumber}
                onChange={(e) =>
                  setForm((f) => ({ ...f, phoneNumber: e.target.value.replace(/[^\d+ ]/g, '') }))
                }
                inputMode="tel"
                placeholder="cth: 0812 3456 7890"
                className="h-11"
                required
              />
              <p className="text-[11px] text-slate-500">
                Format standar Indonesia 08xxx. Nomor ini yang dipakai verifikasi katalog.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-city">Domisili / Kota Asal *</Label>
              <Input
                id="m-city"
                value={form.addressCity}
                onChange={(e) => setForm((f) => ({ ...f, addressCity: e.target.value }))}
                placeholder="cth: Bekasi"
                className="h-11"
                required
                maxLength={60}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="m-notes">Catatan Khusus Owner</Label>
              <Textarea
                id="m-notes"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="cth: Rekomendasi Mas Budi — spesialis motor sport"
                rows={2}
                className="resize-none"
                maxLength={300}
              />
            </div>

            {/* Upload KTP — OPSIONAL */}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Label htmlFor="m-ktp" className="text-xs">
                    Foto KTP (Opsional)
                  </Label>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
                    Disimpan privat — pratinjau hanya bisa dibuka Owner/Admin showroom ini.
                    Umumnya untuk rekanan yang memegang DP fisik / unit bernilai tinggi.
                  </p>
                </div>
                <IdCard className="h-6 w-6 shrink-0 text-slate-400" aria-hidden />
              </div>

              {isOwner ? (
                <>
                  <input
                    ref={ktpInputRef}
                    id="m-ktp"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="sr-only"
                    onChange={handleKtpUpload}
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 border-slate-300 text-xs font-bold"
                      disabled={uploadingKtp}
                      onClick={() => ktpInputRef.current?.click()}
                    >
                      {uploadingKtp ? 'Mengunggah...' : 'Upload Foto KTP'}
                    </Button>
                    {form.ktpUrl && form.ktpUrl !== 'REMOVED' && (
                      <>
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                          <FileImage className="h-3.5 w-3.5" /> Foto siap
                        </span>
                        <button
                          type="button"
                          className="text-xs font-bold text-red-600 underline"
                          onClick={() => setForm((f) => ({ ...f, ktpUrl: 'REMOVED', ktpChanged: true }))}
                        >
                          Hapus
                        </button>
                      </>
                    )}
                    {form.ktpUrl === 'REMOVED' && (
                      <span className="text-xs font-bold text-red-600">
                        Foto akan dihapus saat disimpan
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="mt-2 flex items-center gap-1 text-[11px] text-slate-500">
                  <Lock className="h-3 w-3" /> Hanya owner yang boleh mengubah foto KTP.
                </p>
              )}
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
                {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Daftarkan Rekanan'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog pratinjau KTP (aman — hanya Owner/Admin showroom ini) */}
      <Dialog open={ktpPreview != null} onOpenChange={(o) => !o && setKtpPreview(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold">
              Foto KTP — {ktpPreview?.fullName ?? ''}
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1">
              <Lock className="h-3 w-3" /> Dokumen privat — hanya Owner/Admin showroom ini yang
              bisa membuka.
            </DialogDescription>
          </DialogHeader>
          {ktpPreview?.ktpPhotoUrl && (
            <img
              src={ktpPreview.ktpPhotoUrl}
              alt={`Foto KTP ${ktpPreview.fullName}`}
              className="w-full rounded-md border border-slate-200 bg-slate-50 object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Konfirmasi hapus rekanan */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base font-extrabold">
              Hapus rekanan ini?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `"${deleteTarget.fullName}" (${formatPhoneDisplay(deleteTarget.phoneNumber)}) akan dihapus dari whitelist. Nomornya langsung tidak bisa membuka katalog. Riwayat tahanan & penjualan tetap tersimpan.`
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
