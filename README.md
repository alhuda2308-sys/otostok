# OtoStok

Aplikasi manajemen stok & katalog pemasaran untuk **showroom motor bekas** — mobile-first PWA dengan sistem lisensi (self-service activation) dan katalog publik siap-bagis ke WhatsApp.

## Fitur

- **/activate** — Aktivasi lisensi showroom (kode format `OTO-XXXX-XXXX-XXXX`)
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

## Struktur Penting

```
src/app/
  activate/           # Aktivasi kode lisensi
  admin/[slug]/       # Dashboard owner showroom
  s/[slug]/           # Katalog publik + share/save foto
  super-admin/        # Master admin (licenses generator & monitoring)
  api/                # REST API (licenses, vehicles, bookings, dst.)
prisma/schema.prisma  # Skema database (licenses, showrooms, vehicles, bookings)
supabase/schema.sql   # Skema versi PostgreSQL/Supabase
scripts/seed.ts       # Data contoh (showroom + unit motor)
```

## Skrip

| Perintah | Fungsi |
| --- | --- |
| `bun run dev` | Development server (port 3000) |
| `bun run lint` | ESLint |
| `bun run db:push` | Push skema Prisma ke database |
| `bun run db:generate` | Generate Prisma Client |
| `bun scripts/seed.ts` | Isi data contoh |
