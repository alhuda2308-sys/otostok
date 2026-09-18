'use client'

import { useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import {
  AdminGate,
  AdminNav,
  AdminSubHeader,
  ShowroomNotFound,
} from '@/components/admin-shell'
import { PhotoManager } from '@/components/photo-manager'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { normalizePhone } from '@/lib/format'
import { ApiError, qk, useSettingsQuery } from '@/lib/queries'

export function AdminSettingsClient({ slug }: { slug: string }) {
  return (
    <AdminGate slug={slug}>
      {(session) => <SettingsPage slug={slug} session={session} />}
    </AdminGate>
  )
}

function SettingsPage({
  slug,
  session,
}: {
  slug: string
  session: { role: 'owner' | 'admin'; name: string; slug: string }
}) {
  // Data via TanStack Query — profil showroom tampil instan dari cache saat
  // kembali ke tab Pengaturan.
  const settingsQuery = useSettingsQuery(slug)
  const queryClient = useQueryClient()
  const data = settingsQuery.data ?? null
  const notFound =
    settingsQuery.error instanceof ApiError && settingsQuery.error.status === 404
  const error =
    settingsQuery.error && !notFound
      ? settingsQuery.error instanceof Error
        ? settingsQuery.error.message
        : 'Gagal memuat pengaturan.'
      : null

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [logo, setLogo] = useState<string[]>([])
  const [header, setHeader] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  // One-shot hydration: isi form sekali dari cache pertama, jadi refetch
  // background tidak pernah menimpa editan user yang belum disimpan.
  const hydrated = useRef(false)
  useEffect(() => {
    if (data && !hydrated.current) {
      hydrated.current = true
      setName(data.name)
      setAddress(data.address)
      setOwnerPhone(data.ownerPhone)
      setMapsUrl(data.mapsUrl ?? '')
      setLogo(data.logoUrl ? [data.logoUrl] : [])
      setHeader(data.headerUrl ? [data.headerUrl] : [])
    }
  }, [data])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (name.trim().length < 3) return toast.error('Nama showroom minimal 3 karakter.')
    if (address.trim().length < 5) return toast.error('Alamat showroom wajib diisi.')
    const phone = normalizePhone(ownerPhone)
    if (phone.length < 9) return toast.error('Nomor WhatsApp admin tidak valid.')

    setSaving(true)
    try {
      const res = await fetch(`/api/admin/${slug}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          address: address.trim(),
          ownerPhone: phone,
          mapsUrl: mapsUrl.trim(),
          logoUrl: logo[0] ?? null,
          headerUrl: header[0] ?? null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan pengaturan.')
      // Segarkan cache pengaturan agar data tersimpan dipakai saat kunjungan berikutnya.
      await queryClient.invalidateQueries({ queryKey: qk.settings(slug) })
      toast.success('Pengaturan tersimpan — katalog publik langsung diperbarui.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.')
    } finally {
      setSaving(false)
    }
  }

  if (notFound) return <ShowroomNotFound slug={slug} />

  if (session.role !== 'owner') {
    return (
      <>
        <AdminSubHeader slug={slug} title="Pengaturan Showroom" session={session} />
        <AdminNav slug={slug} role={session.role} />
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-900">
            Pengaturan showroom hanya bisa diakses oleh Owner. Hubungi owner showroom Anda
            untuk perubahan profil.
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <AdminSubHeader
        slug={slug}
        title="Pengaturan Showroom"
        subtitle="Data ini otomatis tampil di katalog publik marketing (/s/slug)."
        session={session}
      />
      <AdminNav slug={slug} role={session.role} />

      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-4 sm:px-6 lg:px-10 lg:py-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            {error}
          </div>
        )}

        {!data ? (
          <div className="h-64 animate-pulse rounded-xl bg-slate-200" />
        ) : (
          <form onSubmit={save} className="space-y-5">
            {/* Layout 2 kolom desktop: Identitas (kiri) + Branding (kanan) */}
            <div className="grid gap-4 lg:grid-cols-2 lg:gap-8">
              {/* Identitas */}
              <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:rounded-2xl lg:p-6">
                <h2 className="text-sm font-extrabold text-slate-900 lg:text-base">Identitas Showroom</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="st-name" className="font-semibold text-slate-700">Nama Showroom *</Label>
                    <Input
                      id="st-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="h-12 rounded-xl px-4 text-base md:text-base"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="st-slug" className="font-semibold text-slate-700">Slug Katalog (tetap)</Label>
                    <Input
                      id="st-slug"
                      value={data.slug}
                      disabled
                      className="h-12 rounded-xl bg-slate-50 px-4 font-mono text-base"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="st-address" className="font-semibold text-slate-700">Alamat Lengkap *</Label>
                  <Textarea
                    id="st-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="cth: Jl. Raya Bekasi KM 25, Cakung, Jakarta Timur"
                    className="min-h-[120px] resize-none rounded-xl p-4 text-base md:text-base"
                    maxLength={300}
                    required
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="st-wa" className="font-semibold text-slate-700">No. WhatsApp Admin *</Label>
                    <Input
                      id="st-wa"
                      value={ownerPhone}
                      onChange={(e) => setOwnerPhone(e.target.value)}
                      inputMode="tel"
                      placeholder="08xxxxxxxxxx"
                      className="h-12 rounded-xl px-4 text-base md:text-base"
                      required
                    />
                    <p className="text-xs text-slate-400">
                      Tombol &quot;Chat Showroom&quot; di katalog memakai nomor ini.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="st-maps" className="font-semibold text-slate-700">Link Google Maps</Label>
                    <Input
                      id="st-maps"
                      value={mapsUrl}
                      onChange={(e) => setMapsUrl(e.target.value)}
                      placeholder="https://maps.app.goo.gl/..."
                      className="h-12 rounded-xl px-4 text-base md:text-base"
                      type="url"
                    />
                    <p className="text-xs text-slate-400">
                      Tampil sebagai tombol &quot;Lihat di Google Maps&quot; di katalog.
                    </p>
                  </div>
                </div>
              </section>

              {/* Branding */}
              <section className="space-y-5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:rounded-2xl lg:p-6">
                <h2 className="text-sm font-extrabold text-slate-900 lg:text-base">Logo &amp; Foto Header</h2>
                <PhotoManager
                  photos={logo}
                  onChange={setLogo}
                  maxPhotos={1}
                  withCover={false}
                  logoMode
                  label="Logo Showroom"
                  hint="Persegi disarankan — tampil di header katalog & dashboard"
                />
                <div className="border-t border-slate-100 pt-4">
                  <PhotoManager
                    photos={header}
                    onChange={setHeader}
                    maxPhotos={1}
                    withCover={false}
                    label="Foto Header Katalog"
                    hint="Banner foto depan showroom / unit andalan (rasio lebar disarankan)"
                  />
                </div>
              </section>
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="h-12 w-full rounded-xl bg-blue-700 px-8 text-base font-extrabold hover:bg-blue-800 lg:w-auto"
              >
                <Save className="h-5 w-5" />
                {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
