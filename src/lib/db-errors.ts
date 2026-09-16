import { NextResponse } from 'next/server'

/**
 * Pembungkus error database untuk route handler — menjamin respons SELALU
 * JSON valid (tidak pernah body kosong) dan mencatat detail error ke log
 * server (terlihat di Vercel Runtime Logs / dev.log).
 *
 * Dipicu misalnya saat:
 * - tabel belum dibuat (P2021) → migrasi SQL Supabase / db push belum jalan
 * - kredensial DATABASE_URL salah (P1000) / host tidak terjangkau (P1001)
 * - Prisma Client belum di-generate dgn schema yang cocok dgn provider DB
 */

interface PrismaLikeError {
  code?: string
  message?: string
  meta?: { target?: string[] | string; column?: string }
}

/** Pesan ramah utk kode error Prisma yang umum; null bila bukan Prisma terkenal. */
function mapPrismaCode(err: PrismaLikeError): { status: number; message: string } | null {
  const target = Array.isArray(err.meta?.target)
    ? err.meta?.target.join(', ')
    : err.meta?.target ?? err.meta?.column ?? ''

  switch (err.code) {
    // --- Kegagalan koneksi / kredensial ---
    case 'P1001':
      return {
        status: 503,
        message:
          'Database tidak dapat dihubungi. Kemungkinan: (1) host DATABASE_URL salah — di Vercel pakai host pooler.supabase.com:6543 dengan ?pgbouncer=true; (2) proyek Supabase sedang pause (free tier) — buka Supabase Dashboard → Restore.',
      }
    case 'P1000':
      return {
        status: 503,
        message: 'Autentikasi database gagal. Periksa user/password pada DATABASE_URL.',
      }
    // --- Skema tidak sinkron ---
    case 'P2021':
      return {
        status: 500,
        message:
          'Tabel database belum dibuat. Jalankan migrasi: SQL di supabase/schema.sql (Supabase SQL Editor) atau `bun run db:push`.',
      }
    case 'P2022':
      return {
        status: 500,
        message: `Kolom database tidak cocok dengan skema aplikasi${target ? ` (${target})` : ''}. Jalankan ulang migrasi skema.`,
      }
    case 'P2003':
      return {
        status: 409,
        message: `Data terkait tidak ditemukan (relasi melanggar)${target ? `: ${target}` : '.'}`,
      }
    case 'P2002':
      return {
        status: 409,
        message: `Data sudah ada (duplikat)${target ? `: ${target}` : '.'}`,
      }
    default:
      return null
  }
}

/**
 * Petunjuk solusi utk pola pesan PrismaClientInitializationError yang umum.
 * Null bila polanya tidak dikenal (pesan asli tetap dikirim ke klien).
 */
function initErrorHint(msg: string): string | null {
  if (msg.includes('must start with the protocol `file:`')) {
    return (
      'Prisma Client SQLite terpakai di server dengan DATABASE_URL Postgres. ' +
      'Build produksi gagal menjalankan scripts/prisma-generate.sh dengan DATABASE_URL ' +
      'Postgres — periksa env DATABASE_URL di Vercel (scope Production) lalu Redeploy.'
    )
  }
  if (msg.includes('Environment variable not found: DATABASE_URL')) {
    return (
      'DATABASE_URL belum terbaca di server. Vercel → Project → Settings → ' +
      'Environment Variables → tambahkan DATABASE_URL (Postgres Supabase) utk ' +
      'scope Production, lalu Redeploy (perubahan env tidak berlaku pd deployment lama).'
    )
  }
  if (msg.includes('Unable to open the database file')) {
    return (
      'Prisma Client SQLite mencoba membuka file database di server produksi ' +
      '(filesystem Vercel read-only). Set DATABASE_URL ke Postgres Supabase ' +
      '(pooler.supabase.com:6543 + ?pgbouncer=true) di Vercel lalu Redeploy.'
    )
  }
  return null
}

/**
 * Ubah error apa pun menjadi NextResponse JSON. SELALU mengembalikan JSON —
 * dipakai di blok catch semua route handler supaya klien tidak pernah
 * menerima body kosong / HTML error page.
 *
 * MODE DIAGNOSA: pesan error ASLI dari Prisma (err.message) dan kode error
 * (err.code) dikirim langsung ke klien — tidak disembunyikan di balik pesan
 * generik — supaya masalah produksi (tabel belum dibuat, DATABASE_URL salah,
 * provider tidak cocok, dll.) langsung terlihat di layar /super-admin.
 * Payload: { error: err.message, code: err.code, detail?, context }
 */
export function dbErrorResponse(e: unknown, context: string): NextResponse {
  // Log detail lengkap utk Vercel Runtime Logs / dev.log
  console.error(`[api:${context}]`, e)

  const err = (e ?? {}) as PrismaLikeError
  const rawMsg =
    typeof err.message === 'string' && err.message.trim()
      ? err.message.trim()
      : 'Error tidak dikenal (tanpa pesan).'
  const code = typeof err.code === 'string' && err.code ? err.code : 'UNKNOWN'

  // Prisma Client belum di-generate (mis. build tanpa `prisma generate`)
  if (rawMsg.includes('@prisma/client did not initialize yet')) {
    return NextResponse.json(
      {
        error: 'Prisma Client belum di-generate. Jalankan `prisma generate` lalu deploy ulang.',
        code,
        detail: rawMsg,
        context,
      },
      { status: 500 },
    )
  }

  // PrismaClientInitializationError tanpa kode terkenal — petakan pola pesan
  // yang paling sering muncul di produksi supaya langsung ada petunjuk solusi.
  if (code === 'UNKNOWN') {
    const hint = initErrorHint(rawMsg)
    if (hint) {
      return NextResponse.json(
        { error: hint, code, detail: rawMsg, context },
        { status: 500 },
      )
    }
  }

  const mapped = mapPrismaCode(err)
  if (mapped) {
    // Pesan ramah utk kode terkenal, ditambah pesan asli & kode utk diagnosa
    return NextResponse.json(
      { error: mapped.message, code, detail: rawMsg, context },
      { status: mapped.status },
    )
  }

  // Error generik/ tak-terpetakan — pesan ASLI langsung ke layar (mode diagnosa)
  return NextResponse.json(
    { error: rawMsg, code, context },
    { status: 500 },
  )
}

/** Parse body JSON dengan aman — tidak pernah melempar, selalu objek. */
export async function safeJsonBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed: unknown = await req.json()
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return {}
  } catch {
    return {}
  }
}
