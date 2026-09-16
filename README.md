# MotoStock

Aplikasi manajemen stok & katalog pemasaran untuk **showroom motor bekas** — mobile-first PWA dengan sistem lisensi (self-service activation) dan katalog publik siap-bagis ke WhatsApp.

## Fitur

- **/activate** — Aktivasi lisensi showroom (kode format `MOTO-XXXX-XXXX-XXXX`; kode lama `OTO-`/`MTR-` tetap valid)
- **/admin/[slug]** — Owner dashboard: kelola unit, foto, status Ready/Sold/Hold, checkout & DP tracking
- **/s/[slug]** — Katalog publik: share materi iklan (Web Share API), galeri foto layar penuh dengan swipe, simpan foto per-unit
- **/super-admin** — Modul master: generator lisensi (Trial / Bulanan / 6 Bulan / 1 Tahun / Lifetime), monitoring customer, suspend/extend
- **Marketing gate** — Akses katalog by-pass untuk makelar via whitelist nomor WhatsApp

## Teknologi

| Layer | Teknologi |
| --- | --- |
| Framework | Next.js 16 (App Router) + TypeScript 5 |
| UI | Tailwind CSS 4 + shadcn/ui (New York) + Lucide icons |
| Database | Prisma ORM + SQLite (skema Supabase/PostgreSQL tersedia di `supabase/schema.sql`) |
| Toast | sonner |

## Menjalankan Proyek

```bash
# 1. Install dependencies
bun install

# 2. Setup environment
cp .env.example .env   # atau buat manual (lihat bagian Environment)

# 3. Siapkan database + data contoh
bun run db:push
bun scripts/seed.ts

# 4. Jalankan development server
bun run dev
```

Buka `http://localhost:3000`.

## Environment

Buat file `.env` di root proyek:

```env
# Prisma SQLite connection
DATABASE_URL=file:/absolute/path/to/db/custom.db

# Master key untuk halaman & API /super-admin
SUPER_ADMIN_SECRET=buat_kunci_rahasia_anda_di_sini
```

> `.env` tidak pernah di-commit ke repository. Ganti `SUPER_ADMIN_SECRET` dengan nilai kuat milik Anda.

## Deploy ke Vercel + Supabase

1. **Buat tabel di Supabase** — buka Supabase Dashboard → **SQL Editor**, copy-paste seluruh isi [`supabase/schema.sql`](supabase/schema.sql) lalu **Run**. Semua tabel (`licenses`, `showrooms`, `vehicles`, `bookings`, dst.) langsung jadi.
2. **Set Environment Variables di Vercel** (Project → Settings → Environment Variables):

   | Variabel | Nilai |
   | --- | --- |
   | `DATABASE_URL` | Connection string Postgres Supabase (mode *Connection pooling*, port `6543`, tambahkan `?pgbouncer=true`) |
   | `SUPER_ADMIN_SECRET` | Kunci master yang dipakai login `/super-admin` |

   > `SUPABASE_SERVICE_ROLE_KEY` **tidak dibutuhkan** — aplikasi mengakses DB via Prisma memakai `DATABASE_URL`.
3. **Deploy** — push ke `main` (atau import repo di Vercel). Saat build, `scripts/prisma-generate.sh` otomatis memakai `prisma/schema.postgres.prisma` bila `DATABASE_URL` berawalan `postgres`. Client Prisma di-generate otomatis (script `postinstall` + tahap build).
4. Buka `https://<domain-anda>/super-admin`, masukkan Master Secret Key, generate lisensi.

**Diagnosa cepat** — bila API Super Admin mengembalikan error, responsnya selalu JSON dengan pesan jelas:

| Pesan error | Penyebab & solusi |
| --- | --- |
| `Tabel database belum dibuat...` | Jalankan `supabase/schema.sql` di SQL Editor (langkah 1) |
| `Database tidak dapat dihubungi...` | `DATABASE_URL` salah host/region — cek ulang connection string Supabase |
| `Autentikasi database gagal...` | Password pada `DATABASE_URL` salah |
| `Prisma Client belum di-generate...` | Build tanpa `prisma generate` — pastikan build memakai script bawaan repo |

Detail teknis lengkap selalu tercatat di **Vercel → Project → Logs**.

## Struktur Penting

```
src/app/
  activate/           # Aktivasi kode lisensi
  admin/[slug]/       # Dashboard owner showroom
  s/[slug]/           # Katalog publik + share/save foto
  super-admin/        # Master admin (licenses generator & monitoring)
  api/                # REST API (licenses, vehicles, bookings, dst.)
prisma/schema.prisma  # Skema database SQLite (lokal) — licenses, showrooms, vehicles, bookings
prisma/schema.postgres.prisma # Skema PostgreSQL (Supabase/Vercel) — model identik
supabase/schema.sql   # Migrasi SQL siap-jalankan di Supabase SQL Editor
scripts/prisma-generate.sh # Pilih schema Prisma sesuai DATABASE_URL (sqlite/postgres)
scripts/seed.ts       # Data contoh (showroom + unit motor)
```

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `bun run dev` | Development server (port 3000) |
| `bun run lint` | ESLint |
| `bun run db:push` | Push skema Prisma SQLite ke database lokal |
| `bun run db:push:pg` | Push skema PostgreSQL ke Supabase (pakai `DATABASE_URL` postgres) |
| `bun run db:generate` | Generate Prisma Client (SQLite) |
| `bun run db:generate:pg` | Generate Prisma Client (PostgreSQL) |
| `bun scripts/seed.ts` | Isi data contoh |
