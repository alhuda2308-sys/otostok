'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
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
import { MoneyInput } from '@/components/money-input'
import { PhotoManager } from '@/components/photo-manager'
import type { AdminVehicle } from '@/lib/types'
import { formatDateISO } from '@/lib/format'

interface SellDialogProps {
  vehicle: AdminVehicle | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dipanggil setelah tersimpan — parent membuka dialog broadcast WA. */
  onSold: (v: AdminVehicle) => void
}

/** Dialog "Catat Penjualan": tanggal laku, harga deal akhir, nama marketing, foto serah terima. */
export function SellDialog({ vehicle, open, onOpenChange, onSold }: SellDialogProps) {
  const [soldAt, setSoldAt] = useState(formatDateISO(new Date()))
  const [soldPrice, setSoldPrice] = useState<number | null>(null)
  const [soldBy, setSoldBy] = useState('')
  const [handoverPhoto, setHandoverPhoto] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !vehicle) return
    setSoldAt(formatDateISO(vehicle.soldAt ? new Date(vehicle.soldAt) : new Date()))
    setSoldPrice(vehicle.soldPrice ?? vehicle.sellingPrice)
    setSoldBy(vehicle.soldBy ?? vehicle.activeHold?.marketingName ?? '')
    setHandoverPhoto(vehicle.handoverPhoto ? [vehicle.handoverPhoto] : [])
    setError(null)
  }, [open, vehicle])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!vehicle) return
    if (!soldAt) return setError('Tanggal laku wajib diisi.')
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/vehicles/${vehicle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'sold',
          soldAt: new Date(`${soldAt}T09:00:00`).toISOString(),
          soldPrice,
          soldBy: soldBy.trim(),
          handoverPhoto: handoverPhoto[0] ?? null,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal mencatat penjualan.')
      toast.success(`"${vehicle.brand} ${vehicle.model}" tercatat TERJUAL.`)
      onOpenChange(false)
      onSold((j.vehicle as AdminVehicle) ?? vehicle)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat penjualan.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-extrabold">Catat Penjualan</DialogTitle>
          <DialogDescription>
            {vehicle
              ? `${vehicle.brand} ${vehicle.model} • ${vehicle.licensePlate}`
              : 'Data masuk laporan penjualan & mutasi unit keluar.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sell-date">Tanggal Laku *</Label>
              <Input
                id="sell-date"
                type="date"
                value={soldAt}
                onChange={(e) => setSoldAt(e.target.value)}
                className="h-11"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sell-price">Harga Deal Akhir (Rp)</Label>
              <MoneyInput id="sell-price" value={soldPrice} onChange={setSoldPrice} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sell-by">Nama Marketing yang Tembus</Label>
            <Input
              id="sell-by"
              value={soldBy}
              onChange={(e) => setSoldBy(e.target.value)}
              placeholder="cth: Bu Rina"
              className="h-11"
            />
          </div>
          <PhotoManager
            photos={handoverPhoto}
            onChange={setHandoverPhoto}
            maxPhotos={1}
            withCover={false}
            label="Foto Bukti Serah Terima (opsional)"
          />
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {error}
            </p>
          )}
          <div className="flex items-center gap-2">
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
              className="h-12 flex-1 bg-red-700 text-sm font-extrabold hover:bg-red-800"
            >
              {busy ? 'Menyimpan...' : 'Simpan & Tandai Terjual'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
