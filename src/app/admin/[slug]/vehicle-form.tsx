'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { DOCUMENT_OPTIONS } from '@/lib/constants'
import { formatRupiah } from '@/lib/format'
import type { AdminVehicle, BranchInfo, TaxonomyResponse } from '@/lib/types'

interface FormState {
  brand: string
  model: string
  category: string
  branchId: string // '' = Lokasi Utama
  year: string
  licensePlate: string
  color: string
  odometer: string
  taxStatus: string
  documentStatus: string
  basePrice: number | null
  sellingPrice: number | null
  commissionAmount: number | null
  notes: string
  photos: string[]
}

const EMPTY: FormState = {
  brand: '',
  model: '',
  category: '',
  branchId: '',
  year: '',
  licensePlate: '',
  color: '',
  odometer: '',
  taxStatus: '',
  documentStatus: DOCUMENT_OPTIONS[0],
  basePrice: null,
  sellingPrice: null,
  commissionAmount: null,
  notes: '',
  photos: [],
}

interface VehicleFormProps {
  slug: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  editing: AdminVehicle | null
  taxonomy: TaxonomyResponse | null
  /** Owner boleh melihat/mengisi harga modal. */
  canSeeBasePrice: boolean
  /** Daftar cabang showroom — kosong = satu lokasi (dropdown lokasi disembunyikan). */
  branches: BranchInfo[]
  onTaxonomyChanged: (t: TaxonomyResponse) => void
}

export function VehicleForm({
  slug,
  open,
  onOpenChange,
  onSaved,
  editing,
  taxonomy,
  canSeeBasePrice,
  branches,
  onTaxonomyChanged,
}: VehicleFormProps) {
  const [form, setForm] = useState<FormState>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Tambah kategori/merk baru langsung dari form
  const [newBrandMode, setNewBrandMode] = useState(false)
  const [newBrand, setNewBrand] = useState('')
  const [newCategoryMode, setNewCategoryMode] = useState(false)
  const [newCategory, setNewCategory] = useState('')

  useEffect(() => {
    if (!open) return
    setError(null)
    setNewBrandMode(false)
    setNewCategoryMode(false)
    if (editing) {
      setForm({
        brand: editing.brand,
        model: editing.model,
        category: editing.category ?? '',
        branchId: editing.branch?.id ?? '',
        year: String(editing.year),
        licensePlate: editing.licensePlate,
        color: editing.color ?? '',
        odometer: editing.odometer != null ? String(editing.odometer) : '',
        taxStatus: editing.taxStatus ?? '',
        documentStatus: editing.documentStatus ?? '',
        basePrice: editing.basePrice,
        sellingPrice: editing.sellingPrice,
        commissionAmount: editing.commissionAmount,
        notes: editing.notes ?? '',
        photos: editing.photos,
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, editing])

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  /** Tambah nilai baru ke taxonomy (kategori/merk) langsung dari form. */
  async function addTaxonomy(kind: 'brand' | 'category', name: string) {
    const res = await fetch(`/api/admin/${slug}/taxonomy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, name }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'Gagal menambah data baru.')
    if (!taxonomy) return
    const updated: TaxonomyResponse =
      kind === 'brand'
        ? { ...taxonomy, brands: [...taxonomy.brands, name].sort() }
        : { ...taxonomy, categories: [...taxonomy.categories, name].sort() }
    onTaxonomyChanged(updated)
    toast.success(`"${name}" ditambahkan ke daftar ${kind === 'brand' ? 'merk' : 'kategori'}.`)
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (form.brand.trim().length < 2) return setError('Merk motor wajib diisi.')
    if (form.model.trim().length < 2) return setError('Model/tipe motor wajib diisi.')
    const year = Number(form.year)
    if (!form.year || Number.isNaN(year) || year < 1980 || year > new Date().getFullYear() + 1)
      return setError('Tahun motor tidak valid.')
    if (form.licensePlate.trim().length < 3) return setError('Nomor polisi wajib diisi.')

    setError(null)
    setSaving(true)
    const payload = {
      brand: form.brand.trim(),
      model: form.model.trim(),
      category: form.category.trim(),
      branchId: form.branchId || null,
      year,
      licensePlate: form.licensePlate.trim(),
      color: form.color.trim(),
      odometer: form.odometer ? Number(form.odometer.replace(/\D/g, '')) : null,
      taxStatus: form.taxStatus.trim(),
      documentStatus: form.documentStatus,
      basePrice: canSeeBasePrice ? form.basePrice : undefined,
      sellingPrice: form.sellingPrice,
      commissionAmount: form.commissionAmount,
      notes: form.notes.trim(),
      photos: form.photos,
    }
    try {
      const res = editing
        ? await fetch(`/api/admin/vehicles/${editing.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/admin/${slug}/vehicles`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'Gagal menyimpan unit.')
      toast.success(
        editing ? 'Perubahan unit tersimpan.' : 'Motor baru masuk stok — status Ready.',
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan unit.')
    } finally {
      setSaving(false)
    }
  }

  const docOptions =
    form.documentStatus && !DOCUMENT_OPTIONS.includes(form.documentStatus)
      ? [form.documentStatus, ...DOCUMENT_OPTIONS]
      : DOCUMENT_OPTIONS

  const brandOptions = taxonomy?.brands ?? []
  const categoryOptions = taxonomy?.categories ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-extrabold">
            {editing ? `Edit Unit — ${editing.brand} ${editing.model}` : 'Tambah Motor Baru'}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? 'Perbarui data unit. Perubahan langsung tampil di katalog marketing.'
              : 'Isi data unit yang masuk stok. Unit baru otomatis berstatus Ready.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div className="space-y-2">
              <Label htmlFor="v-brand" className="font-semibold text-slate-700">Merk *</Label>
              {!newBrandMode ? (
                <div className="flex gap-1.5">
                  <Select
                    value={brandOptions.includes(form.brand) ? form.brand : undefined}
                    onValueChange={(v) => set('brand', v)}
                  >
                    <SelectTrigger id="v-brand" className="h-11! w-full rounded-xl lg:h-12! lg:text-base">
                      <SelectValue
                        placeholder={form.brand || 'Pilih merk'}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {brandOptions.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-slate-300 px-3 lg:h-12"
                    title="Tambah merk baru"
                    onClick={() => {
                      setNewBrandMode(true)
                      setNewBrand('')
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Input
                    id="v-brand"
                    value={newBrand}
                    onChange={(e) => setNewBrand(e.target.value)}
                    placeholder="Nama merk baru (cth: TVS)"
                    className="h-11 rounded-xl lg:h-12 lg:text-base"
                    autoFocus
                  />
                  <Button
                    type="button"
                    className="h-11 shrink-0 rounded-xl bg-blue-700 px-3 text-xs font-bold hover:bg-blue-800"
                    onClick={async () => {
                      const name = newBrand.trim()
                      if (name.length < 2) return
                      try {
                        await addTaxonomy('brand', name)
                      } catch (err) {
                        // Merk sudah terdaftar (409, mis.Honda/Yamaha bawaan) →
                        // tetap PILIH merk itu — intent user sudah jelas.
                        const msg = err instanceof Error ? err.message : ''
                        if (!msg.includes('sudah ada')) {
                          toast.error(msg || 'Gagal menambah merk.')
                          return
                        }
                      }
                      set('brand', name)
                      setNewBrandMode(false)
                    }}
                  >
                    Simpan
                  </Button>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-model" className="font-semibold text-slate-700">Model / Tipe *</Label>
              <Input
                id="v-model"
                value={form.model}
                onChange={(e) => set('model', e.target.value)}
                placeholder="cth: Beat 110 CBS"
                className="h-11 rounded-xl lg:h-12 lg:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-cat" className="font-semibold text-slate-700">Kategori</Label>
              {!newCategoryMode ? (
                <div className="flex gap-1.5">
                  <Select
                    value={form.category || undefined}
                    onValueChange={(v) => set('category', v)}
                  >
                    <SelectTrigger id="v-cat" className="h-11! w-full rounded-xl lg:h-12! lg:text-base">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 shrink-0 rounded-xl border-slate-300 px-3 lg:h-12"
                    title="Tambah kategori baru"
                    onClick={() => {
                      setNewCategoryMode(true)
                      setNewCategory('')
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Input
                    id="v-cat"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="cth: Retro / Cub Pax"
                    className="h-11 rounded-xl lg:h-12 lg:text-base"
                    autoFocus
                  />
                  <Button
                    type="button"
                    className="h-11 shrink-0 rounded-xl bg-blue-700 px-3 text-xs font-bold hover:bg-blue-800"
                    onClick={async () => {
                      const name = newCategory.trim()
                      if (name.length < 2) return
                      try {
                        await addTaxonomy('category', name)
                      } catch (err) {
                        // Kategori sudah terdaftar (409) → tetap pilih kategori itu.
                        const msg = err instanceof Error ? err.message : ''
                        if (!msg.includes('sudah ada')) {
                          toast.error(msg || 'Gagal menambah kategori.')
                          return
                        }
                      }
                      set('category', name)
                      setNewCategoryMode(false)
                    }}
                  >
                    Simpan
                  </Button>
                </div>
              )}
            </div>
            {/* Lokasi unit — hanya muncul bila showroom punya cabang (>1 lokasi) */}
            {branches.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="v-branch" className="font-semibold text-slate-700">Lokasi Unit Berada</Label>
                <Select
                  value={form.branchId || 'main'}
                  onValueChange={(v) => set('branchId', v === 'main' ? '' : v)}
                >
                  <SelectTrigger id="v-branch" className="h-11! w-full rounded-xl lg:h-12! lg:text-base">
                    <SelectValue placeholder="Pilih lokasi unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="main">Lokasi Utama</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500">
                  Lokasi fisik motor — tampil di katalog marketing agar marketing tidak salah antar.
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="v-year" className="font-semibold text-slate-700">Tahun *</Label>
              <Input
                id="v-year"
                value={form.year}
                onChange={(e) => set('year', e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="cth: 2020"
                className="h-11 rounded-xl lg:h-12 lg:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-plate" className="font-semibold text-slate-700">Plat Nomor *</Label>
              <Input
                id="v-plate"
                value={form.licensePlate}
                onChange={(e) => set('licensePlate', e.target.value.toUpperCase())}
                placeholder="cth: B 4521 KZA"
                className="h-11 rounded-xl font-bold uppercase lg:h-12 lg:text-base"
                style={{ textTransform: 'uppercase' }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-color" className="font-semibold text-slate-700">Warna</Label>
              <Input
                id="v-color"
                value={form.color}
                onChange={(e) => set('color', e.target.value)}
                placeholder="cth: Hitam"
                className="h-11 rounded-xl lg:h-12 lg:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-odo" className="font-semibold text-slate-700">Odometer (KM)</Label>
              <Input
                id="v-odo"
                value={form.odometer}
                onChange={(e) => set('odometer', e.target.value.replace(/\D/g, '').slice(0, 7))}
                inputMode="numeric"
                placeholder="cth: 15420"
                className="h-11 rounded-xl lg:h-12 lg:text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-tax" className="font-semibold text-slate-700">Kondisi Pajak</Label>
              <Input
                id="v-tax"
                list="tax-suggestions"
                value={form.taxStatus}
                onChange={(e) => set('taxStatus', e.target.value)}
                placeholder="cth: Hidup s/d 03/2026"
                className="h-11 rounded-xl lg:h-12 lg:text-base"
              />
              <datalist id="tax-suggestions">
                <option value="Pajak panjang (aman lebih dari 6 bulan)" />
                <option value="Mati pajak 1 bulan" />
                <option value="Mati pajak 1 tahun" />
              </datalist>
            </div>
            <div className="space-y-2">
              <Label htmlFor="v-doc" className="font-semibold text-slate-700">Kelengkapan Surat</Label>
              <Select
                value={form.documentStatus || undefined}
                onValueChange={(v) => set('documentStatus', v)}
              >
                <SelectTrigger id="v-doc" className="h-11! w-full rounded-xl lg:h-12! lg:text-base">
                  <SelectValue placeholder="Pilih kelengkapan surat" />
                </SelectTrigger>
                <SelectContent>
                  {docOptions.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Harga — hanya owner */}
          {canSeeBasePrice && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 lg:p-4">
              <p className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
                Angka sensitif — hanya tampil di dashboard owner
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
                <div className="space-y-2">
                  <Label htmlFor="v-base" className="font-semibold text-slate-700">
                    Harga Modal (Rp)
                  </Label>
                  <MoneyInput
                    id="v-base"
                    value={form.basePrice}
                    onChange={(v) => set('basePrice', v)}
                    placeholder="0"
                    className="h-11 rounded-xl text-sm font-bold lg:h-12 lg:text-base"
                  />
                  <p className="text-xs text-red-700">
                    Tidak pernah tampil di katalog marketing.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-sell" className="font-semibold text-slate-700">
                    Harga Jual (Rp)
                  </Label>
                  <MoneyInput
                    id="v-sell"
                    value={form.sellingPrice}
                    onChange={(v) => set('sellingPrice', v)}
                    placeholder="0"
                    className="h-11 rounded-xl text-sm font-bold lg:h-12 lg:text-base"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="v-comm" className="font-semibold text-slate-700">
                    Komisi Marketing (Rp)
                  </Label>
                  <MoneyInput
                    id="v-comm"
                    value={form.commissionAmount}
                    onChange={(v) => set('commissionAmount', v)}
                    placeholder="0"
                    className="h-11 rounded-xl text-sm font-bold lg:h-12 lg:text-base"
                  />
                  {form.commissionAmount != null && (
                    <p className="text-xs font-semibold text-emerald-700">
                      {formatRupiah(form.commissionAmount)} / unit deal
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="v-notes" className="font-semibold text-slate-700">Catatan Unit</Label>
            <Textarea
              id="v-notes"
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="cth: Mesin sehat, bodi mulus, siap pakai tanpa servicing."
              rows={2}
              className="resize-none rounded-xl lg:text-base"
              maxLength={500}
            />
          </div>

          {/* Foto — tanpa batas, kompresi otomatis, pilih cover */}
          <PhotoManager
            photos={form.photos}
            onChange={(photos) => set('photos', photos)}
            label="Foto Unit"
            hint="Foto pertama otomatis jadi cover katalog"
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
              className="h-12 rounded-xl border-slate-300 text-base font-semibold"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="h-12 flex-1 rounded-xl bg-blue-700 text-base font-bold hover:bg-blue-800"
            >
              {saving ? 'Menyimpan...' : editing ? 'Simpan Perubahan' : 'Simpan ke Stok'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
