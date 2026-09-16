'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import type {
  AdminInventoryResponse,
  BranchInfo,
  MarketingPartner,
  ReportsResponse,
  SessionResponse,
  StaffAccountInfo,
  StaffRole,
  TaxonomyResponse,
} from '@/lib/types'

/** Sesi login dashboard (isi cookie otostok_session). */
export interface AdminSession {
  role: StaffRole
  name: string
  slug: string
}

/** Error fetch API dengan status HTTP — dipakai halaman utk membedakan 404/401/403. */
export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseError(res: Response): Promise<ApiError> {
  const j = (await res.json().catch(() => ({}))) as { error?: string }
  return new ApiError(j.error || `Gagal memuat data (${res.status}).`, res.status)
}

/**
 * Fetcher data dashboard (bukan endpoint sesi).
 * 401 = sesi berakhir di tengah pemakaian -> muat ulang halaman agar gate
 * login tampil (perilaku sama seperti implementasi lama).
 */
export async function fetchJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, { cache: 'no-store' })
  } catch {
    throw new ApiError('Tidak dapat terhubung ke server.', 0)
  }
  if (res.status === 401) {
    if (typeof window !== 'undefined') window.location.reload()
    throw new ApiError('Sesi berakhir — silakan login kembali.', 401)
  }
  if (!res.ok) throw await parseError(res)
  return (await res.json()) as T
}

/** Kumpulan query key — satu sumber kebenaran utk invalidate & setQueryData. */
export const qk = {
  session: ['session'] as const,
  inventory: (slug: string) => ['admin', slug, 'inventory'] as const,
  taxonomy: (slug: string) => ['admin', slug, 'taxonomy'] as const,
  settings: (slug: string) => ['admin', slug, 'settings'] as const,
  staff: (slug: string) => ['admin', slug, 'staff'] as const,
  branches: (slug: string) => ['admin', slug, 'branches'] as const,
  marketings: (slug: string) => ['admin', slug, 'marketings'] as const,
  reports: (slug: string, from: string, to: string) =>
    ['admin', slug, 'reports', from, to] as const,
}

/** Profil showroom utk halaman Pengaturan. */
export interface SettingsData {
  name: string
  slug: string
  address: string
  ownerPhone: string
  logoUrl: string | null
  headerUrl: string | null
  mapsUrl: string | null
}

/** Sesi utk AdminGate — 401 dianggap "belum login", bukan error. */
export function useSessionQuery() {
  return useQuery({
    queryKey: qk.session,
    queryFn: async (): Promise<SessionResponse> => {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          // SessionResponse.session di tipe bersifat non-null, tapi runtime API
          // mengembalikan null saat belum login — pakai cast agar typecheck lolos.
          return { ok: false, session: null } as unknown as SessionResponse
        }
        throw await parseError(res)
      }
      return (await res.json()) as SessionResponse
    },
    staleTime: 5 * 60_000,
    retry: false,
  })
}

/** Data lengkap dashboard (inventory) — SHARED cache antara Dashboard & Mutasi. */
export function useInventoryQuery(slug: string) {
  return useQuery({
    queryKey: qk.inventory(slug),
    queryFn: () => fetchJson<AdminInventoryResponse>(`/api/admin/${slug}/inventory`),
  })
}

/** Kategori & merk — jarang berubah, boleh stale lebih lama. */
export function useTaxonomyQuery(slug: string) {
  return useQuery({
    queryKey: qk.taxonomy(slug),
    queryFn: () => fetchJson<TaxonomyResponse>(`/api/admin/${slug}/taxonomy`),
    staleTime: 5 * 60_000,
  })
}

export function useSettingsQuery(slug: string) {
  return useQuery({
    queryKey: qk.settings(slug),
    queryFn: () => fetchJson<SettingsData>(`/api/admin/${slug}/settings`),
  })
}

export function useStaffQuery(slug: string) {
  return useQuery({
    queryKey: qk.staff(slug),
    queryFn: () => fetchJson<{ items: StaffAccountInfo[] }>(`/api/admin/${slug}/staff`),
  })
}

export function useBranchesQuery(slug: string) {
  return useQuery({
    queryKey: qk.branches(slug),
    queryFn: () => fetchJson<{ branches: BranchInfo[] }>(`/api/admin/${slug}/branches`),
  })
}

export function useMarketingsQuery(slug: string) {
  return useQuery({
    queryKey: qk.marketings(slug),
    queryFn: () => fetchJson<{ marketings: MarketingPartner[] }>(`/api/admin/${slug}/marketings`),
  })
}

/** Laporan per rentang tanggal — perubahan preset tampil mulus (data lama saat loading). */
export function useReportsQuery(slug: string, from: string, to: string) {
  return useQuery({
    queryKey: qk.reports(slug, from, to),
    queryFn: () => fetchJson<ReportsResponse>(`/api/admin/${slug}/reports?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  })
}
