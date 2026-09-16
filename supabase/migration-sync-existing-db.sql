-- ============================================================
-- OtoStok — Migrasi SINKRONISASI untuk database Supabase yang SUDAH ADA
-- ============================================================
-- KAPAN dipakai:
--   Bila database Supabase dibuat SEBELUM versi skema terkini (mis. dibuat
--   manual / dari DDL lama), tabel lama bisa KURANG kolom/index — gejalanya:
--     • Aktivasi lisensi gagal: "Invalid prisma.showroom.findUnique()
--       invocation" (Prisma men-SELECT semua kolom; bila ada kolom skema
--       yang tidak ada di tabel, query showroom langsung error — P2022)
--     • "P2022: The column ... does not exist in the current database"
--     • Slug duplikat terdeteksi meski seharusnya unik (index UNIQUE hilang)
--
-- ISI migrasi ini:
--   1. CREATE TABLE IF NOT EXISTS  — tabel yang belum ada dibuat lengkap
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS — kolom yang hilang ditambahkan
--      (aman untuk tabel yang sudah berisi data: kolom teks wajib diberi
--      default '', boolean/timestamp diberi default)
--   3. CREATE [UNIQUE] INDEX IF NOT EXISTS — index & UNIQUE disamakan,
--     termasuk showrooms_slug_key (slug WAJIB unik — konsisten dengan
--      @unique pada prisma/schema.postgres.prisma)
--   4. FOREIGN KEY — ditambahkan hanya bila belum ada (DO block)
--
-- AMAN dijalankan BERULANG (idempotent). Tidak ada data yang diubah/dihapus.
-- Cara pakai: Supabase Dashboard → SQL Editor → paste seluruh isi file → Run.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tabel yang belum ada sama sekali → dibuat lengkap
--    (no-op untuk tabel yang sudah ada)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "licenses" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "plan_type" TEXT NOT NULL,
    "max_vehicles" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "showrooms" (
    "id" UUID NOT NULL,
    "license_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "logo_url" TEXT,
    "header_url" TEXT,
    "maps_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "showrooms_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "staff_accounts" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "staff_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "branches" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "maps_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "taxonomies" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "taxonomies_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "vehicles" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "category" TEXT,
    "year" INTEGER NOT NULL,
    "license_plate" TEXT NOT NULL,
    "color" TEXT,
    "odometer" INTEGER,
    "tax_status" TEXT,
    "document_status" TEXT,
    "base_price" INTEGER,
    "selling_price" INTEGER,
    "commission_amount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'available',
    "photos" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "purchased_at" TIMESTAMP(3),
    "arrival_notes" TEXT,
    "arrival_photos" TEXT DEFAULT '[]',
    "sold_at" TIMESTAMP(3),
    "sold_price" INTEGER,
    "sold_by" TEXT,
    "handover_photo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "branch_id" UUID,
    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "marketings" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "address_city" TEXT NOT NULL,
    "ktp_photo_url" TEXT,
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "marketings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bookings" (
    "id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "marketing_id" UUID,
    "marketing_name" TEXT NOT NULL,
    "marketing_phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'hold',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- ------------------------------------------------------------
-- 2) Kolom yang hilang pada tabel LAMA → ditambahkan
--    (no-op bila kolom sudah ada; default aman untuk tabel berisi data)
--    Catatan: kolom struktur inti (id, license_id, showroom_id, vehicle_id)
--    sengaja tidak di-ALTER — tabel lama pasti sudah memilikinya; bila
--    benar-benar tidak ada, tabel harus dibuat ulang dari schema.sql.
-- ------------------------------------------------------------

-- licenses
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "license_key" TEXT NOT NULL DEFAULT '';
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "plan_type" TEXT NOT NULL DEFAULT 'monthly';
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "max_vehicles" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "licenses" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- showrooms  ← pemicu error aktivasi bila logo_url/header_url/maps_url hilang
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL DEFAULT '';
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "owner_phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "logo_url" TEXT;
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "header_url" TEXT;
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "maps_url" TEXT;
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "showrooms" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- staff_accounts
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "username" TEXT NOT NULL DEFAULT '';
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "password_hash" TEXT NOT NULL DEFAULT '';
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'admin';
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "staff_accounts" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- branches
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL DEFAULT '';
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "maps_url" TEXT;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "branches" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- taxonomies
ALTER TABLE "taxonomies" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT '';
ALTER TABLE "taxonomies" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "taxonomies" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- vehicles
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "brand" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "model" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "year" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "license_plate" TEXT NOT NULL DEFAULT '';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "color" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "odometer" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "tax_status" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "document_status" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "base_price" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "selling_price" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "commission_amount" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'available';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "photos" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "purchased_at" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "arrival_notes" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "arrival_photos" TEXT DEFAULT '[]';
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "sold_at" TIMESTAMP(3);
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "sold_price" INTEGER;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "sold_by" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "handover_photo" TEXT;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "vehicles" ADD COLUMN IF NOT EXISTS "branch_id" UUID;

-- marketings
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "full_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "phone_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "address_city" TEXT NOT NULL DEFAULT '';
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "ktp_photo_url" TEXT;
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- bookings
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "marketing_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "marketing_phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'hold';
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3);
ALTER TABLE "bookings" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- ------------------------------------------------------------
-- 3) Index & UNIQUE — disamakan dengan schema.postgres.prisma
--    Termasuk showrooms_slug_key: slug WAJIB unik (poin 3 permintaan —
--    atribut @unique slug kini juga ada di tabel Supabase, bukan hanya
--    di schema Prisma).
--    CATATAN: bila tabel lama sudah berisi slug duplikat, CREATE UNIQUE
--    INDEX akan gagal — bersihkan duplikat dulu (error akan menyebut
--    baris yang duplikat).
-- ------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS "licenses_license_key_key" ON "licenses"("license_key");
CREATE UNIQUE INDEX IF NOT EXISTS "showrooms_license_id_key" ON "showrooms"("license_id");
CREATE UNIQUE INDEX IF NOT EXISTS "showrooms_slug_key" ON "showrooms"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "staff_accounts_showroom_id_username_key" ON "staff_accounts"("showroom_id", "username");
CREATE UNIQUE INDEX IF NOT EXISTS "branches_showroom_id_name_key" ON "branches"("showroom_id", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "taxonomies_showroom_id_kind_name_key" ON "taxonomies"("showroom_id", "kind", "name");
CREATE INDEX IF NOT EXISTS "vehicles_showroom_id_status_idx" ON "vehicles"("showroom_id", "status");
CREATE INDEX IF NOT EXISTS "vehicles_branch_id_idx" ON "vehicles"("branch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "marketings_showroom_id_phone_number_key" ON "marketings"("showroom_id", "phone_number");
CREATE INDEX IF NOT EXISTS "bookings_vehicle_id_status_idx" ON "bookings"("vehicle_id", "status");
CREATE INDEX IF NOT EXISTS "bookings_marketing_id_idx" ON "bookings"("marketing_id");

-- ------------------------------------------------------------
-- 4) FOREIGN KEY — hanya ditambahkan bila belum ada (idempotent)
-- ------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "showrooms" ADD CONSTRAINT "showrooms_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "branches" ADD CONSTRAINT "branches_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "marketings" ADD CONSTRAINT "marketings_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_marketing_id_fkey" FOREIGN KEY ("marketing_id") REFERENCES "marketings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Selesai. Cek hasil (opsional): kolom tabel showrooms kini harus memuat
-- logo_url, header_url, maps_url + index UNIQUE showrooms_slug_key.
