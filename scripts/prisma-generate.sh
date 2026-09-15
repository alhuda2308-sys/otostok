#!/usr/bin/env bash
# Pilih schema Prisma sesuai DATABASE_URL — dipakai saat build (Vercel & lokal):
#   postgres:// / postgresql://  → prisma/schema.postgres.prisma (Supabase/Vercel)
#   file:... / kosong            → prisma/schema.prisma (SQLite lokal)
set -e
cd "$(dirname "$0")/.."

case "$DATABASE_URL" in
  postgres://*|postgresql://*)
    echo "[prisma] DATABASE_URL Postgres terdeteksi — generate client dengan schema.postgres.prisma"
    npx --yes prisma generate --schema prisma/schema.postgres.prisma
    ;;
  *)
    echo "[prisma] DATABASE_URL SQLite/kosong — generate client dengan schema.prisma"
    npx --yes prisma generate --schema prisma/schema.prisma
    ;;
esac
