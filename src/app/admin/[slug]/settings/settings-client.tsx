'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { normalizePhone } from '@/lib/format'

interface SettingsData {
  name: string
  slug: string
  address: string
  ownerPhone: string
  logoUrl: string | null
  headerUrl: string | null
  mapsUrl: string | null
}

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
  const [data, setData] = useState<SettingsData | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [ownerPhone, setOwnerPhone] = useState('')
  const [mapsUrl, setMapsUrl] = useState('')
  const [logo, setLogo] = useState<string[]>([])
  const [header, setHeader] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/${slug}/settings`, { cache: 'no-store' })
      if (res.status === 404) {
        setNotFound(true)
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        throw new Error(j.error || 'Gagal memuat pengaturan.')
      }
      const j = (await res.json()) as SettingsData
      setData(j)
      setName(j.name)
      setAddress(j.address)
      setOwnerPhone(j.ownerPhone)
      setMapsUrl(j.mapsUrl ?? '')
      setLogo(j.logoUrl ? [j.logoUrl] : [])
      setHeader(j.headerUrl ? [j.headerUrl] : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal memuat pengaturan.')
    }
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

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

      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">
            {error}
          </div>
        )}

        {!data ? (
          <div className="h-64 animate-pulse rounded-lg bg-slate-200" />
        ) : (
          <form onSubmit={save} className="space-y-4">
            {/* Identitas */}
            <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-extrabold text-slate-900">Identitas Showroom</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="st-name">Nama Showroom *</Label>
                  <Input
                    id="st-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-11"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-slug">Slug Katalog (tetap)</Label>
                  <Input id="st-slug" value={data.slug} disabled className="h-11 bg-slate-50 font-mono" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-address">Alamat Lengkap *</Label>
                <Input
                  id="st-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="cth: Jl. Raya Bekasi KM 25, Cakung, Jakarta Timur"
                  className="h-11"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="st-wa">No. WhatsApp Admin *</Label>
                  <Input
                    id="st-wa"
                    value={ownerPhone}
                    onChange={(e) => setOwnerPhone(e.target.value)}
                    inputMode="tel"
                    placeholder="08xxxxxxxxxx"
                    className="h-11"
                    required
                  />
                  <p className="text-[11px] text-slate-400">
                    Tombol &quot;Chat Showroom&quot; di katalog memakai nomor ini.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-maps">Link Google Maps</Label>
                  <Input
                    id="st-maps"
                    value={mapsUrl}
                    onChange={(e) => setMapsUrl(e.target.value)}
                    placeholder="https://maps.app.goo.gl/..."
                    className="h-11"
                    type="url"
                  />
                  <p className="text-[11px] text-slate-400">
                    Tampil sebagai tombol &quot;Lihat di Google Maps&quot; di katalog.
                  </p>
                </div>
              </div>
            </section>

            {/* Branding */}
            <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4 sm:p-5">
              <h2 className="text-sm font-extrabold text-slate-900">Logo &amp; Foto Header</h2>
              <PhotoManager
                photos={logo}
                onChange={setLogo}
                maxPhotos={1}
                withCover={false}
                label="Logo Showroom"
                hint="Tampil di header katalog & dashboard (rasio persegi disarankan)"
              />
              <PhotoManager
                photos={header}
                onChange={setHeader}
                maxPhotos={1}
                withCover={false}
                label="Foto Header Katalog"
                hint="Banner foto depan showroom / unit andalan (rasio lebar disarankan)"
              />
            </section>

            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={saving}
                className="h-12 w-full bg-blue-700 px-6 text-sm font-extrabold hover:bg-blue-800 sm:w-auto"
              >
                <Save className="mr-1 h-4 w-4" />
                {saving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  )
}
