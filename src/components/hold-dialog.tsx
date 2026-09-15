'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { BadgeCheck, Lock } from 'lucide-react'
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
import { formatClockID, formatPhoneDisplay, formatRupiah } from '@/lib/format'
import type { MarketingSession, PublicVehicle } from '@/lib/types'

interface HoldDialogProps {
  vehicle: PublicVehicle | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
  /**
   * Sesi rekanan terverifikasi (whitelist WA). Bila ada, dialog berubah
   * menjadi konfirmasi singkat — identitas otomatis dari sesi, tanpa form.
   * null = mode manual (showroom tanpa rekanan).
   */
  session: MarketingSession | null
}

/**
 * Dialog Tahan Unit.
 * - Mode rekanan: pop-up konfirmasi "Kunci [Merk] selama 2 jam atas nama [Nama]?" —
 *   identitas diambil dari verifikasi WhatsApp dan divalidasi ulang di server.
 * - Mode manual: input nama & WA marketing (showroom belum memakai whitelist).
 */
export function HoldDialog({ vehicle, open, onOpenChange, onSuccess, session }: HoldDialogProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isPartner = !!session

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehicles/${vehicle.id}/hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isPartner
            ? {
                marketingId: session.id,
                marketingName: session.fullName,
                marketingPhone: session.phone,
              }
            : { marketingName: name, marketingPhone: phone },
        ),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menahan unit.')
      toast.success(
        `Unit dikunci 2 jam sampai ${formatClockID(new Date(j.expiresAt))}. Buruan layani calon pembeli!`,
      )
      if (!isPartner) {
        setName('')
        setPhone('')
      }
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menahan unit.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setError(null)
        onOpenChange(o)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">
            {isPartner ? 'Konfirmasi Tahan Unit' : 'Tahan Unit'} —{' '}
            {vehicle ? `${vehicle.brand} ${vehicle.model}` : ''}
          </DialogTitle>
          <DialogDescription>
            Kunci unit selama 2 jam supaya tidak ditawarkan marketing lain saat calon pembeli
            menuju showroom. Setelah waktu habis, unit otomatis kembali Ready.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          {isPartner ? (
            /* Mode rekanan: identitas otomatis dari sesi verifikasi WA */
            <div className="space-y-3">
              <div className="flex items-start gap-2.5 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" aria-hidden />
                <div className="text-sm leading-relaxed text-emerald-900">
                  <p>
                    Kunci <span className="font-extrabold">{vehicle?.brand} {vehicle?.model}</span>{' '}
                    selama 2 jam atas nama{' '}
                    <span className="font-extrabold">{session.fullName}</span>?
                  </p>
                  <p className="mt-0.5 text-xs text-emerald-800">
                    {session.addressCity} • WA {formatPhoneDisplay(session.phone)}
                  </p>
                </div>
              </div>
              {vehicle?.sellingPrice != null && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Harga:{' '}
                  <span className="font-extrabold text-slate-900">
                    {formatRupiah(vehicle.sellingPrice)}
                  </span>
                  {vehicle.commissionAmount != null && (
                    <>
                      {' '}
                      • Komisi kamu:{' '}
                      <span className="font-bold text-emerald-700">
                        {formatRupiah(vehicle.commissionAmount)}
                      </span>
                    </>
                  )}
                </div>
              )}
              {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
              >
                <Lock className="mr-1.5 h-4 w-4" />
                {submitting ? 'Mengunci...' : 'Ya, Kunci Unit (2 Jam)'}
              </Button>
            </div>
          ) : (
            /* Mode manual: showroom belum memakai whitelist rekanan */
            <>
              <div className="space-y-1.5">
                <Label htmlFor="hold-name">Nama Marketing</Label>
                <Input
                  id="hold-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="cth: Pak Deni"
                  required
                  minLength={2}
                  maxLength={40}
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="hold-phone">No. WhatsApp Marketing</Label>
                <Input
                  id="hold-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  placeholder="cth: 0812 3456 7890"
                  required
                  className="h-11"
                />
              </div>
              {vehicle?.sellingPrice != null && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Harga:{' '}
                  <span className="font-extrabold text-slate-900">
                    {formatRupiah(vehicle.sellingPrice)}
                  </span>
                  {vehicle.commissionAmount != null && (
                    <>
                      {' '}
                      • Komisi kamu:{' '}
                      <span className="font-bold text-emerald-700">
                        {formatRupiah(vehicle.commissionAmount)}
                      </span>
                    </>
                  )}
                </div>
              )}
              {error && <p className="text-sm font-semibold text-red-700">{error}</p>}
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 w-full bg-blue-700 text-sm font-extrabold hover:bg-blue-800"
              >
                <Lock className="mr-1.5 h-4 w-4" />
                {submitting ? 'Mengunci...' : 'Kunci Unit (2 Jam)'}
              </Button>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
