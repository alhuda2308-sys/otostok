'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Copy, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { buildBroadcastText, waBroadcastLink, type BroadcastKind } from '@/lib/broadcast'
import { copyToClipboard } from '@/lib/format'

interface WABroadcastDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  slug: string
  showroomName: string
  vehicle: {
    brand: string
    model: string
    year: number
    licensePlate: string
    sellingPrice: number | null
    commissionAmount: number | null
    odometer: number | null
  }
  initialKind?: BroadcastKind
}

/**
 * Dialog broadcast info unit ke WhatsApp:
 * pilih format (Unit Baru / Unit Terjual), edit teks, lalu buka WA
 * (wa.me/?text=...) untuk memilih grup/kontak tujuan — atau salin teks.
 */
export function WABroadcastDialog({
  open,
  onOpenChange,
  slug,
  showroomName,
  vehicle,
  initialKind = 'new',
}: WABroadcastDialogProps) {
  // Dialog di-mount ulang setiap dibuka oleh parent, jadi state cukup diinisialisasi sekali.
  const catalogUrl = useMemo(() => {
    if (typeof window === 'undefined') return `/s/${slug}`
    return `${window.location.origin}/s/${slug}`
  }, [slug])

  const [kind, setKind] = useState<BroadcastKind>(initialKind)
  const [draft, setDraft] = useState(() =>
    buildBroadcastText(initialKind, vehicle, { name: showroomName }, catalogUrl),
  )

  /** Ganti format pesan & reset pratinjau ke teks standar (dipanggil dari klik, bukan effect). */
  function switchKind(k: BroadcastKind) {
    if (k === kind) return
    setKind(k)
    setDraft(buildBroadcastText(k, vehicle, { name: showroomName }, catalogUrl))
  }

  async function copy() {
    const ok = await copyToClipboard(draft)
    if (ok) toast.success('Teks broadcast disalin — tinggal paste ke grup WA.')
    else toast.error('Gagal menyalin teks.')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">Kirim Update ke WhatsApp</DialogTitle>
          <DialogDescription>
            Pilih format pesan, sunting bila perlu, lalu kirim ke grup marketing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Format pesan">
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'new'}
              onClick={() => switchKind('new')}
              className={`h-11 rounded-lg border text-xs font-extrabold ${
                kind === 'new'
                  ? 'border-blue-700 bg-blue-700 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Format Unit Baru
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={kind === 'sold'}
              onClick={() => switchKind('sold')}
              className={`h-11 rounded-lg border text-xs font-extrabold ${
                kind === 'sold'
                  ? 'border-red-700 bg-red-700 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              Format Unit Terjual
            </button>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wa-text">Pratinjau pesan</Label>
            <Textarea
              id="wa-text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={9}
              className="resize-none text-sm"
            />
            <p className="text-[11px] text-slate-400">
              Link katalog otomatis disertakan. Teks bisa Anda sunting sebelum dikirim.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 border-slate-300 font-bold"
              onClick={copy}
            >
              <Copy className="mr-1 h-4 w-4" /> Salin Teks
            </Button>
            <Button
              type="button"
              className="h-12 bg-emerald-700 text-sm font-extrabold hover:bg-emerald-800"
              onClick={() => window.open(waBroadcastLink(draft), '_blank', 'noopener')}
            >
              <ExternalLink className="mr-1 h-4 w-4" /> Buka WhatsApp
            </Button>
          </div>
          <p className="text-center text-[11px] text-slate-400">
            WhatsApp akan terbuka — pilih grup/kontak tujuan, pesan sudah terisi otomatis.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
