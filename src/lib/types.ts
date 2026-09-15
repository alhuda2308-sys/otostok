export type VehicleStatus = 'available' | 'hold' | 'sold'
/** Paket lisensi — half_year & yearly khusus lisensi buatan Super Admin. */
export type PlanType = 'trial' | 'monthly' | 'half_year' | 'yearly' | 'lifetime'
export type StaffRole = 'owner' | 'admin'

export interface ActiveHoldInfo {
  marketingName: string
  expiresAt: string
}

/** Lokasi fisik unit (cabang). null = lokasi utama showroom. */
export interface BranchInfo {
  id: string
  name: string
  address: string
  mapsUrl: string | null
}

/** Bentuk vehicle yang AMAN untuk katalog publik — TANPA basePrice (harga modal). */
export interface PublicVehicle {
  id: string
  brand: string
  model: string
  category: string | null
  year: number
  licensePlate: string
  color: string | null
  odometer: number | null
  taxStatus: string | null
  documentStatus: string | null
  sellingPrice: number | null
  commissionAmount: number | null
  status: VehicleStatus
  photos: string[]
  notes: string | null
  createdAt: string
  updatedAt: string
  /** Cabang tempat unit berada — null = lokasi utama. Hanya relevan bila showroom punya cabang. */
  branch: BranchInfo | null
  activeHold: ActiveHoldInfo | null
}

export interface PublicShowroomInfo {
  name: string
  slug: string
  address: string
  ownerPhone: string
  logoUrl: string | null
  headerUrl: string | null
  mapsUrl: string | null
}

export interface PublicCatalogResponse {
  showroom: PublicShowroomInfo
  /** Daftar cabang aktif. Kosong = showroom satu lokasi (sembunyikan UI lokasi). */
  branches: BranchInfo[]
  vehicles: PublicVehicle[]
  counts: { available: number; hold: number; sold: number }
  fetchedAt: string
  /**
   * true = showroom memakai Sistem Rekanan Terdaftar (whitelist WA).
   * Katalog hanya bisa diakses rekanan aktif; UI menampilkan sapaan personal.
   */
  whitelistEnabled: boolean
}

/** Sesi verifikasi rekanan di sisi klien (disimpan di localStorage per showroom). */
export interface MarketingSession {
  id: string
  fullName: string
  addressCity: string
  /** Format internasional 62xxx — dikirim sebagai header X-Mkt-Phone. */
  phone: string
}

/** Rekanan marketing di dashboard owner. */
export interface MarketingPartner {
  id: string
  fullName: string
  /** Format lokal 08xxx untuk tampilan. */
  phoneNumber: string
  addressCity: string
  notes: string | null
  isActive: boolean
  createdAt: string
  /** URL endpoint pratinjau KTP yang aman (butuh sesi Owner/Admin). */
  ktpPhotoUrl: string | null
  hasKtp: boolean
  /** Total unit yang pernah ditahan (hold) oleh rekanan ini. */
  holdCount: number
  /** Total unit yang berhasil terjual melalui rekanan ini. */
  soldCount: number
}

export interface TaxonomyResponse {
  categories: string[]
  brands: string[]
}

/** Bentuk vehicle lengkap untuk dashboard (termasuk data mutasi). */
export interface AdminVehicle extends PublicVehicle {
  basePrice: number | null
  purchasedAt: string | null
  arrivalNotes: string | null
  arrivalPhotos: string[]
  soldAt: string | null
  soldPrice: number | null
  soldBy: string | null
  handoverPhoto: string | null
}

export interface AdminHold {
  id: string
  vehicleId: string
  vehicleLabel: string
  marketingName: string
  marketingPhone: string
  /** Terisi bila pengunci adalah rekanan terdaftar (whitelist). */
  marketingId: string | null
  expiresAt: string
}

export interface AdminLicenseInfo {
  licenseKey: string
  planType: PlanType
  maxVehicles: number
  status: string
  expiresAt: string | null
}

export interface AdminInventoryResponse {
  showroom: PublicShowroomInfo & { id: string }
  /** Hanya role owner — null untuk admin (hak akses terbatas). */
  license: AdminLicenseInfo | null
  quota: { active: number; max: number } | null
  stats: {
    available: number
    hold: number
    sold: number
    capitalTurnover: number | null
    stockValue: number
  }
  vehicles: AdminVehicle[]
  holds: AdminHold[]
  /** Cabang showroom — untuk filter & dropdown lokasi unit. */
  branches: BranchInfo[]
}

export interface StaffAccountInfo {
  id: string
  name: string
  username: string
  role: StaffRole
  isActive: boolean
  createdAt: string
}

export interface SessionResponse {
  ok: boolean
  session: { role: StaffRole; name: string; slug: string }
}

export interface ReportItem {
  id: string
  brand: string
  model: string
  licensePlate: string
  soldAt: string
  soldPrice: number
  commissionAmount: number
  /** Hanya owner. */
  basePrice: number | null
  /** Hanya owner. */
  margin: number | null
  soldBy: string | null
  photo: string | null
}

export interface ReportsResponse {
  from: string
  to: string
  items: ReportItem[]
  totals: {
    count: number
    omzet: number
    commission: number
    /** Hanya owner. */
    capital: number | null
    /** Hanya owner. */
    margin: number | null
  }
}

export interface LicenseCheckResponse {
  found: boolean
  status?: string
  planType?: PlanType
  maxVehicles?: number
  expiresAt?: string | null
  bound?: boolean
}

export interface ActivateResponse {
  ok: boolean
  showroom?: { id: string; name: string; slug: string }
  ownerUsername?: string
  error?: string
}
