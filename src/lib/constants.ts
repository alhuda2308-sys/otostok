import type { VehicleStatus } from './types'

/** Durasi tahanan unit (jam). */
export const HOLD_HOURS = 2

export const DOCUMENT_OPTIONS = [
  'STNK & BPKB Lengkap',
  'STNK Saja (BPKB Kreditsi)',
  'STNK + Faktur',
  'STNK + Duplikat BPKB',
  'Surat Lengkap (Notaris)',
]

export const TAX_SUGGESTIONS = [
  'Pajak panjang (aman lebih dari 6 bulan)',
  'Pajak hidup s/d 03/2026',
  'Mati pajak 1 bulan',
  'Mati pajak 1 tahun',
]

export const PLAN_LABELS: Record<string, string> = {
  trial: 'Trial',
  monthly: 'Bulanan',
  half_year: '6 Bulan',
  yearly: '1 Tahun',
  lifetime: 'Lifetime',
}

/** Pilihan paket di Generator Lisensi Super Admin (days = null berarti lifetime). */
export const SUPER_PLANS: { value: PlanTypeValue; label: string; days: number | null }[] = [
  { value: 'trial', label: 'Trial — 7 Hari', days: 7 },
  { value: 'monthly', label: 'Bulanan — 30 Hari', days: 30 },
  { value: 'half_year', label: '6 Bulan — 180 Hari', days: 180 },
  { value: 'yearly', label: '1 Tahun — 365 Hari', days: 365 },
  { value: 'lifetime', label: 'Lifetime — Tanpa Batas Waktu', days: null },
]

type PlanTypeValue = 'trial' | 'monthly' | 'half_year' | 'yearly' | 'lifetime'

export const STATUS_LABELS: Record<VehicleStatus, string> = {
  available: 'Tersedia',
  hold: 'Ditahan',
  sold: 'Terjual',
}

/** Slug yang dipakai sistem, tidak boleh jadi slug showroom. */
export const RESERVED_SLUGS = [
  'admin',
  's',
  'activate',
  'api',
  'public',
  'uploads',
  'settings',
  'staff',
  'reports',
  'mutasi',
  'login',
  'super-admin',
]

/** Kategori default baru saat showroom diaktifkan (bisa ditambah owner). */
export const DEFAULT_CATEGORIES = ['Matic', 'Bebek', 'Sport', 'Trail', 'Cruiser']

/** Merk default baru saat showroom diaktifkan (bisa ditambah owner). */
export const DEFAULT_BRANDS = ['Honda', 'Yamaha', 'Suzuki', 'Kawasaki', 'Vespa']

/** Info lisensi demo (sinkron dengan scripts/seed.ts) untuk onboarding user. */
export const DEMO_LICENSES = [
  { key: 'MTR-BARU-0001', plan: 'Trial', maxVehicles: 5, note: 'Belum terikat — siap dipakai aktivasi' },
  { key: 'MTR-LIFE-8888', plan: 'Lifetime', maxVehicles: 100, note: 'Belum terikat — siap dipakai aktivasi' },
  { key: 'MTR-OLD1-1111', plan: 'Bulanan', maxVehicles: 10, note: 'Sudah kedaluwarsa (uji validasi)' },
]
