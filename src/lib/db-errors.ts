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
          'Database tidak dapat dihubungi. Periksa host DATABASE_URL (jaringan/firewall Supabase).',
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
