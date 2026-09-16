#!/usr/bin/env bash
# Pilih schema Prisma sesuai DATABASE_URL — dipakai saat build (Vercel & lokal):
#   postgres:// / postgresql://  → prisma/schema.postgres.prisma (Supabase/Vercel)
#   file:... / kosong            → prisma/schema.prisma (SQLite lokal)
#
# Di Vercel (env VERCEL terisi): DATABASE_URL WAJIB Postgres. Kalau tidak,
# build DIHENTIKAN dengan pesan jelas — jangan sampai diam-diam menghasilkan
# client SQLite yang membuat SEMUA query gagal di runtime
# (PrismaClientInitializationError: URL must start with the protocol `file:`).
set -e
cd "$(dirname "$0")/.."

is_pg() {
  case "$1" in
    postgres://*|postgresql://*) return 0 ;;
    *) return 1 ;;
  esac
}

# Sembunyikan username/password saat mencetak URL ke log build
mask_url() {
  echo "$1" | sed -E 's#(://)[^@/]+@#\1***@#'
}

if [ -n "$VERCEL" ]; then
  if is_pg "$DATABASE_URL"; then
    echo "[prisma] Vercel: DATABASE_URL Postgres terdeteksi ($(mask_url "$DATABASE_URL")) — generate client Postgres"
    npx --yes prisma generate --schema prisma/schema.postgres.prisma
  else
    echo "=============================================================="
    echo "[prisma] BUILD DIHENTIKAN: DATABASE_URL di Vercel kosong/bukan Postgres."
    echo "  Nilai terbaca: '${DATABASE_URL:0:24}'"
    echo "  Perbaiki: Vercel → Project → Settings → Environment Variables →"
    echo "  DATABASE_URL (Supabase, host pooler.supabase.com:6543, akhiri"
    echo "  dengan ?pgbouncer=true) untuk scope Production/Preview,"
    echo "  lalu Redeploy. Tanpa ini semua API akan 500 di runtime."
    echo "=============================================================="
    exit 1
  fi
else
  if is_pg "$DATABASE_URL"; then
    echo "[prisma] DATABASE_URL Postgres terdeteksi — generate client dengan schema.postgres.prisma"
    npx --yes prisma generate --schema prisma/schema.postgres.prisma
  else
    echo "[prisma] DATABASE_URL SQLite/kosong — generate client dengan schema.prisma"
    npx --yes prisma generate --schema prisma/schema.prisma
  fi
fi
