'use client'

import { useEffect, useState } from 'react'
import { BadgeCheck, Bike, Loader2, MessageCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { waLink } from '@/lib/format'
import type { MarketingSession } from '@/lib/types'

interface ShowroomLite {
  name: string
  address: string
  ownerPhone: string
  logoUrl: string | null
}

interface MarketingGateProps {
  slug: string
  /** Dipanggil setelah verifikasi sukses — parent menyimpan sesi & membuka katalog. */
  onVerified: (s: MarketingSession) => void
}

/**
 * Layar verifikasi Sistem Rekanan Terdaftar (Whitelist Nomor WhatsApp).
 * Menggantikan login akun/password yang rumit — marketing cukup memasukkan
 * nomor WhatsApp yang terdaftar sebagai rekanan resmi showroom.
 *
 * - Nomor terdaftar & aktif  -> onVerified (katalog terbuka, sesi disimpan di localStorage)
 * - Belum terdaftar / nonaktif -> pesan + tombol besar "Hubungi Owner / Admin via WA"
 */
export function MarketingGate({ slug, onVerified }: MarketingGateProps) {
  const [showroom, setShowroom] = useState<ShowroomLite | null>(null)
  const [showroomError, setShowroomError] = useState(false)
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)

  // Rejected state: not_found | inactive — tampilkan pesan + tombol WA
  const [rejected, setRejected] = useState<{ phone: string; reason: 'not_found' | 'inactive' } | null>(
    null,
  )

  useEffect(() => {
    let alive = true
    fetch(`/api/showrooms/${slug}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive) return
        if (j) setShowroom(j as ShowroomLite)
        else setShowroomError(true)
      })
      .catch(() => alive && setShowroomError(true))
    return () => {
      alive = false
    }
  }, [slug])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch(`/api/showrooms/${slug}/verify-marketing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.registered && j.marketing) {
        onVerified({
          id: j.marketing.id,
          fullName: j.marketing.fullName,
          addressCity: j.marketing.addressCity,
          // simpan format internasional utk header X-Mkt-Phone
          phone: phone.replace(/\D/g, '').replace(/^0/, '62'),
        })
        return
      }
      if (res.status === 403) {
        setRejected({ phone: phone.replace(/\D/g, ''), reason: 'inactive' })
      } else {
        setRejected({ phone: phone.replace(/\D/g, ''), reason: 'not_found' })
      }
    } catch {
      // jaringan gagal — biarkan user coba lagi
    } finally {
      setBusy(false)
    }
  }

  if (showroomError) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <Bike className="h-10 w-10 text-slate-300" aria-hidden />
        <h1 className="mt-3 text-lg font-extrabold text-slate-900">Katalog tidak ditemukan</h1>
        <p className="mt-1 text-sm text-slate-500">
          Katalog <code className="font-bold">/s/{slug}</code> tidak terdaftar atau sudah
          dinonaktifkan.
        </p>
      </div>
    )
  }

  // ============ Layar ditolak: nomor belum terdaftar / dinonaktifkan ============
  if (rejected) {
    const draftMsg = showroom
      ? `Halo ${showroom.name}, saya ingin mendaftar sebagai rekanan marketing resmi showroom. Mohon informasi cara pendaftarannya. Terima kasih.`
      : 'Halo, saya ingin mendaftar sebagai rekanan marketing resmi showroom. Mohon informasi cara pendaftarannya. Terima kasih.'
    return (
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
        <div className="rounded-lg border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
          {showroom?.logoUrl ? (
            <img
              src={showroom.logoUrl}
              alt={`Logo ${showroom.name}`}
              className="mx-auto h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
              <Bike className="h-7 w-7 text-slate-400" aria-hidden />
            </div>
          )}
          <h1 className="mt-3 text-base font-extrabold text-slate-900">
            {showroom?.name ?? 'Katalog'}
          </h1>

          <div className="mt-5 rounded-md border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-bold leading-relaxed text-amber-900">
              Nomor WhatsApp Anda belum terdaftar sebagai rekanan resmi showroom.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-800">
              Hubungi Owner / Admin untuk mendaftarkan nomor Anda sebagai rekanan.
            </p>
          </div>

          {showroom && (
            <Button
              asChild
              className="mt-4 h-12 w-full bg-emerald-700 text-sm font-extrabold text-white hover:bg-emerald-800"
            >
              <a href={waLink(showroom.ownerPhone, draftMsg)} target="_blank" rel="noreferrer">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Hubungi Owner / Admin via WA
              </a>
            </Button>
          )}

          <button
            type="button"
            onClick={() => {
              setRejected(null)
              setPhone('')
            }}
            className="mt-3 text-xs font-bold text-slate-500 underline hover:text-slate-700"
          >
            Coba nomor lain
          </button>
        </div>
      </div>
    )
  }

  // ============ Layar verifikasi nomor WhatsApp ============
  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="text-center">
          {showroom?.logoUrl ? (
            <img
              src={showroom.logoUrl}
              alt={`Logo ${showroom.name}`}
              className="mx-auto h-14 w-14 rounded-lg object-cover ring-1 ring-slate-200"
            />
          ) : (
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-slate-100">
              <Bike className="h-7 w-7 text-slate-400" aria-hidden />
            </div>
          )}
          <h1 className="mt-3 text-base font-extrabold text-slate-900">
            {showroom?.name ?? 'Memuat...'}
          </h1>
          <p className="mt-1 flex items-center justify-center gap-1 text-xs font-bold text-blue-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Katalog Khusus Rekanan Terdaftar
          </p>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="gate-phone">Nomor WhatsApp Anda</Label>
            <Input
              id="gate-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="cth: 0812 3456 7890"
              className="h-12 text-base"
              required
              autoFocus
            />
            <p className="text-[11px] leading-relaxed text-slate-500">
              Masukkan nomor WhatsApp yang terdaftar sebagai rekanan showroom. Nomor ini juga
              yang akan tercatat saat Anda menahan unit.
            </p>
          </div>

          <Button
            type="submit"
            disabled={busy}
            className="h-12 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
          >
            {busy ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Memeriksa...
              </>
            ) : (
              <>
                <BadgeCheck className="mr-1.5 h-4 w-4" /> Masuk Katalog
              </>
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Nomor belum terdaftar? Hubungi Owner / Admin showroom untuk mendaftar sebagai rekanan.
        </p>
      </div>
    </div>
  )
}
