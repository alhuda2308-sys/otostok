import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { supabaseStorageActive } from '@/lib/storage'

export const runtime = 'nodejs'

/**
 * GET /api/health — diagnostik lingkungan produksi (tanpa auth, tanpa rahasia).
 *
 * Dibuka langsung di browser (https://<domain>/api/health) untuk menjawab:
 * - Apakah DATABASE_URL terbaca? protokol apa (postgres vs file)? host mana?
 * - Apakah Supabase Storage aktif (env SUPABASE_URL + SERVICE_ROLE_KEY)?
 * - Apakah koneksi DB sukses? Apakah tabel/kolom sesuai skema aplikasi?
 *
 * Tidak mengekspos password/key — hanya protokol + host + status.
 */

interface DbProbe {
  ok: boolean
  step?: string
  code?: string
  error?: string
}

function errInfo(e: unknown): { code: string; error: string } {
  const err = (e ?? {}) as { code?: unknown; message?: unknown }
  const code = typeof err.code === 'string' && err.code ? err.code : 'UNKNOWN'
  const msg = typeof err.message === 'string' ? err.message : String(e)
  return { code, error: msg.slice(0, 500) }
}

async function probeDb(): Promise<DbProbe> {
  // 1) Koneksi dasar
  try {
    await db.$queryRaw`SELECT 1`
  } catch (e) {
    return { ok: false, step: 'koneksi (SELECT 1)', ...errInfo(e) }
  }
  // 2) Skema: tabel showroom ada? kolom logo_url (migrasi terbaru) ada?
  try {
    await db.showroom.findFirst({ select: { id: true, logoUrl: true } })
  } catch (e) {
    return { ok: false, step: 'skema (tabel/kolom showroom)', ...errInfo(e) }
  }
  return { ok: true }
}

export async function GET() {
  const url = process.env.DATABASE_URL ?? ''

  let protocol = '(kosong)'
  let host = '-'
  if (url) {
    try {
      const u = new URL(url)
      protocol = u.protocol.replace(/:$/, '')
      host = u.host || '(file lokal)'
    } catch {
      protocol = '(format URL tidak valid)'
    }
  }

  const probe = await probeDb()

  return NextResponse.json(
    {
      ok: probe.ok,
      time: new Date().toISOString(),
      runtime: {
        vercel: Boolean(process.env.VERCEL),
        region: process.env.VERCEL_REGION ?? null,
        nodeEnv: process.env.NODE_ENV,
      },
      env: {
        databaseUrl: { present: Boolean(url), protocol, host },
        storage: supabaseStorageActive()
          ? 'supabase (upload foto AKTIF)'
          : 'disk (upload foto TIDAK jalan di Vercel — set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)',
        superAdminSecret: Boolean(process.env.SUPER_ADMIN_SECRET),
      },
      db: probe,
      hint: probe.ok
        ? null
        : 'Solusi umum: (1) Vercel → Settings → Environment Variables: isi DATABASE_URL (Postgres pooler: ...pooler.supabase.com:6543/postgres?pgbouncer=true), SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY utk scope Production, lalu Redeploy. (2) Cek proyek Supabase tidak sedang pause (Dashboard → Restore). (3) Jalankan supabase/migration-sync-existing-db.sql bila tabel/kolom belum sinkron.',
    },
    { status: probe.ok ? 200 : 503 },
  )
}
