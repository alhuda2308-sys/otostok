'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ArrowLeft,
  CheckCircle2,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  Store,
} from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DEMO_LICENSES, PLAN_LABELS } from '@/lib/constants'
import { copyToClipboard, formatDateID } from '@/lib/format'
import { slugify } from '@/lib/slug'
import type { LicenseCheckResponse } from '@/lib/types'

interface FormState {
  licenseKey: string
  name: string
  slug: string
  ownerPhone: string
  address: string
  ownerPassword: string
}

export function ActivateClient() {
  const [form, setForm] = useState<FormState>({
    licenseKey: '',
    name: '',
    slug: '',
    ownerPhone: '',
    address: '',
    ownerPassword: '',
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [licenseInfo, setLicenseInfo] = useState<LicenseCheckResponse | null>(null)
  const [checking, setChecking] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<{ name: string; slug: string; ownerUsername: string } | null>(null)

  // Live-check lisensi saat key selesai diketik
  useEffect(() => {
    const key = form.licenseKey.trim().toUpperCase()
    if (!/^(MTR-[A-Z0-9]{4}-[A-Z0-9]{4}|OTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|MOTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/.test(key)) {
      setLicenseInfo(null)
      return
    }
    const t = setTimeout(async () => {
      setChecking(true)
      try {
        const res = await fetch(`/api/license-check?key=${encodeURIComponent(key)}`)
        setLicenseInfo(await res.json())
      } catch {
        setLicenseInfo(null)
      } finally {
        setChecking(false)
      }
    }, 400)
    return () => clearTimeout(t)
  }, [form.licenseKey])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function onNameChange(name: string) {
    setForm((f) => ({
      ...f,
      name,
      slug: slugTouched ? f.slug : slugify(name),
    }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Aktivasi gagal. Coba lagi.')
      setSuccess({
        name: j.showroom.name,
        slug: j.showroom.slug,
        ownerUsername: j.ownerUsername ?? form.ownerPhone.replace(/\D/g, ''),
      })
      toast.success('Showroom berhasil diaktifkan!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktivasi gagal.')
    } finally {
      setSubmitting(false)
    }
  }

  async function copyLink(path: string) {
    const ok = await copyToClipboard(`${window.location.origin}${path}`)
    if (ok) toast.success('Tautan disalin. Simpan di catatan Anda!')
    else toast.error('Gagal menyalin tautan.')
  }

  if (success) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-12">
        <div className="rounded-lg border border-emerald-200 bg-white p-6 shadow-sm">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h1 className="mt-3 text-center text-xl font-extrabold text-slate-900">
            Showroom Aktif!
          </h1>
          <p className="mt-1 text-center text-sm text-slate-600">
            <span className="font-bold text-slate-900">{success.name}</span> berhasil
            teraktivasi dan siap dipakai.
          </p>

          <div className="mt-5 space-y-2">
            <Button
              asChild
              className="h-12 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
            >
              <Link href={`/admin/${success.slug}`}>Login ke Dashboard Owner</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 w-full border-slate-300 bg-white text-sm font-bold text-slate-700"
            >
              <Link href={`/s/${success.slug}`}>Buka Katalog Marketing</Link>
            </Button>
          </div>

          <div className="mt-4 rounded-md border border-blue-200 bg-blue-50 p-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">
              Akun Owner Anda
            </p>
            <p className="mt-1 text-xs text-blue-900">
              Username: <code className="font-bold">{success.ownerUsername}</code> — password:
              pilihan Anda saat aktivasi. Pakai untuk login dashboard.
            </p>
          </div>

          <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              <Link2 className="h-3 w-3" /> Simpan tautan ini
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <code className="truncate text-xs text-slate-700">/admin/{success.slug}</code>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-slate-300 text-xs"
                onClick={() => copyLink(`/admin/${success.slug}`)}
              >
                <Copy className="mr-1 h-3 w-3" /> Salin
              </Button>
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <code className="truncate text-xs text-slate-700">/s/{success.slug}</code>
              <Button
                size="sm"
                variant="outline"
                className="h-8 shrink-0 border-slate-300 text-xs"
                onClick={() => copyLink(`/s/${success.slug}`)}
              >
                <Copy className="mr-1 h-3 w-3" /> Salin
              </Button>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
              Login dashboard dengan akun owner. Tautan dashboard berisi harga modal — jangan
              dibagikan ke marketing, cukup bagikan tautan katalog.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const lic = licenseInfo
  const licKeyValid =
    /^(MTR-[A-Z0-9]{4}-[A-Z0-9]{4}|OTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}|MOTO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})$/.test(
      form.licenseKey.trim().toUpperCase(),
    )

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:py-10">
      <div className="mb-4 flex items-center justify-between">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-9 text-xs font-bold text-slate-600"
        >
          <Link href="/">
            <ArrowLeft className="mr-1 h-4 w-4" /> Beranda
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <AppIcon className="h-7 w-7" />
          <span className="text-xs font-extrabold text-blue-700">MotoStock</span>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-blue-700 text-white">
            <KeyRound className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-slate-900">Aktivasi Lisensi</h1>
            <p className="text-xs text-slate-500">
              Satu lisensi untuk satu showroom. Isi data showroom Anda.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lic">License Key</Label>
            <Input
              id="lic"
              value={form.licenseKey}
              onChange={(e) => set('licenseKey', e.target.value.toUpperCase())}
              placeholder="MOTO-XXXX-XXXX-XXXX / MTR-XXXX-XXXX"
              autoComplete="off"
              className="h-11 font-mono text-sm font-bold tracking-wider"
              required
            />
            {checking && (
              <p className="flex items-center gap-1 text-xs text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Memeriksa lisensi...
              </p>
            )}
            {!checking && lic && licKeyValid && (
              <div
                className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                  lic.found && lic.status === 'active' && !lic.bound
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-red-200 bg-red-50 text-red-800'
                }`}
              >
                {!lic.found && 'Lisensi tidak ditemukan. Periksa kembali key Anda.'}
                {lic.found && lic.status !== 'active' && 'Lisensi sudah kedaluwarsa.'}
                {lic.found && lic.status === 'active' && lic.bound &&
                  'Lisensi sudah terikat ke showroom lain.'}
                {lic.found && lic.status === 'active' && !lic.bound && (
                  <>
                    {PLAN_LABELS[lic.planType ?? ''] ?? lic.planType} • maks{' '}
                    {lic.maxVehicles} unit •{' '}
                    {lic.expiresAt ? `berlaku s/d ${formatDateID(lic.expiresAt)}` : 'Lifetime'}
                  </>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name">Nama Showroom</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="cth: Showroom Jaya Motor"
              className="h-11"
              required
              minLength={3}
              maxLength={60}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="slug">Slug URL Katalog</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 select-none text-sm text-slate-400">
                /s/
              </span>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => {
                  setSlugTouched(true)
                  set('slug', slugify(e.target.value))
                }}
                placeholder="showroom-jaya"
                className="h-11 pl-9 text-sm font-semibold"
                autoComplete="off"
                required
              />
            </div>
            <p className="text-[11px] text-slate-400">
              Alamat katalog marketing Anda. Huruf kecil dan tanda hubung saja.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">No. WhatsApp Pemilik</Label>
            <Input
              id="phone"
              value={form.ownerPhone}
              onChange={(e) => set('ownerPhone', e.target.value)}
              inputMode="tel"
              placeholder="cth: 0812 3456 7890"
              className="h-11"
              required
            />
            <p className="text-[11px] text-slate-400">
              Dipakai juga sebagai username akun owner untuk login dashboard.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="owner-password">Password Owner (login dashboard)</Label>
            <Input
              id="owner-password"
              type="password"
              value={form.ownerPassword}
              onChange={(e) => set('ownerPassword', e.target.value)}
              placeholder="Minimal 6 karakter"
              className="h-11"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="address">Alamat Showroom</Label>
            <Textarea
              id="address"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="cth: Jl. Raya Bekasi KM 25, Cakung, Jakarta Timur"
              rows={2}
              className="min-h-11 resize-none"
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
            disabled={submitting}
            className="h-12 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
          >
            <Store className="mr-1.5 h-4 w-4" />
            {submitting ? 'Mengaktifkan...' : 'Aktifkan Showroom'}
          </Button>
        </form>
      </div>

      {/* Demo keys */}
      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-extrabold text-amber-900">
          Belum punya lisensi? Pakai key demo berikut:
        </p>
        <ul className="mt-2 space-y-1.5">
          {DEMO_LICENSES.map((l) => (
            <li key={l.key}>
              <button
                type="button"
                onClick={() => set('licenseKey', l.key)}
                className="flex w-full flex-wrap items-center gap-2 rounded-md border border-amber-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-amber-400"
              >
                <code className="font-bold text-slate-800">{l.key}</code>
                <span className="font-semibold text-slate-500">
                  {l.plan} • maks {l.maxVehicles} unit — {l.note}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-amber-800">
          Klik salah satu key untuk mengisinya otomatis ke form.
        </p>
      </div>
    </div>
  )
}
