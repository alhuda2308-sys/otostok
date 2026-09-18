-- ============================================================
-- MotoStock — Migrasi SINKRONISASI untuk database Supabase yang SUDAH ADA
-- (v3 — tahan segala kondisi kolom: text[], json, jsonb, text)
-- ============================================================
-- KAPAN dipakai:
--   Bila database Supabase dibuat SEBELUM versi skema terkini, tabel lama
--   bisa KURANG kolom/index — gejalanya:
--     • Gagal tambah/edit motor: P2022 "column ... does not exist"
--     • Tab Marketing dashboard: "Gagal memuat data (500)" / tambah rekanan
--       "kesalahan server"  → kolom "code" hilang (fitur Link Toko Personal
--       Store) — v3 menambahkannya kembali
--     • "number of array dimensions ... exceeds maximum allowed (6)"
--       → kolom teks terlanjur bertipe array (text[])
--     • Slug duplikat terdeteksi meski seharusnya unik
--
-- ISI migrasi:
--   1. CREATE TABLE IF NOT EXISTS  — tabel yang belum ada dibuat lengkap
--   2. ALTER TABLE ADD COLUMN IF NOT EXISTS — kolom yang hilang ditambahkan
--      (aman utk tabel berisi data: teks default '', timestamp default now)
--   3. KOREKSI TIPE (DO block, per kolom, tidak akan gagal massal):
--        ARRAY (text[] dll) → TEXT  via array_to_json()  — format JSON yg
--          persis diharapkan aplikasi
--        json / jsonb      → TEXT  via ::text
--        text / varchar    → dibiarkan (sudah benar)
--      HANYA kolom yang perlu yang disentuh → idempotent & tanpa error
--      "function array_to_json(text) does not exist".
--   4. Index & UNIQUE — dibuat bila belum ada; bila GAGAL karena data
--      duplikat, migrasi TETAP LANJUT (hanya WARNING + cara perbaikannya).
--   5. FOREIGN KEY — ditambahkan bila belum ada; bila gagal karena data
--      yatim (orphan), migrasi TETAP LANJUT (WARNING saja).
--   6. QUERY VERIFIKASI di akhir — hasilnya tampil di panel Results.
--
-- AMAN dijalankan BERULANG (idempotent). Tidak ada data yang dihapus.
-- Cara pakai: Supabase Dashboard → SQL Editor → paste SELURUH isi file → Run.
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
--    (no-op bila kolom sudah ada; default aman utk tabel berisi data)
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
-- kode referral Personal Store (MKT-XXXXXX) — WAJIB utk fitur Link Toko
-- (?ref=) & tombol dashboard; tanpa kolom ini SEMUA operasi marketing 500
-- (P2022 column does not exist)
ALTER TABLE "marketings" ADD COLUMN IF NOT EXISTS "code" TEXT;
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

-- -----------------------------------------------------------
-- 3) KOREKSI TIPE KOLOM → TEXT (DO block, per kolom)
--    • data_type = 'ARRAY'  (text[] dll) → array_to_json(col)::text
--      (perbaiki gejala "number of array dimensions ... exceeds (6)")
--    • data_type json/jsonb            → col::text
--    • text / varchar / lainnya        → TIDAK disentuh (sudah aman)
--    Hanya kolom yang benar-benar perlu yang di-ALTER, dan tiap kolom
--    punya exception sendiri — satu kolom aneh tidak menggagalkan migrasi.
-- -----------------------------------------------------------

DO $$
DECLARE
  r RECORD;
  conv TEXT;
  n INT := 0;
BEGIN
  FOR r IN
    SELECT c.table_name, c.column_name, c.data_type
    FROM information_schema.columns c
    JOIN (VALUES
      -- kolom yang SEHARUSNYA bertipe TEXT sesuai skema aplikasi
      ('licenses','license_key'),('licenses','plan_type'),('licenses','status'),
      ('showrooms','name'),('showrooms','slug'),('showrooms','owner_phone'),('showrooms','address'),('showrooms','logo_url'),('showrooms','header_url'),('showrooms','maps_url'),
      ('staff_accounts','name'),('staff_accounts','username'),('staff_accounts','password_hash'),('staff_accounts','role'),
      ('branches','name'),('branches','address'),('branches','maps_url'),
      ('taxonomies','kind'),('taxonomies','name'),
      ('vehicles','brand'),('vehicles','model'),('vehicles','category'),('vehicles','license_plate'),('vehicles','color'),('vehicles','tax_status'),('vehicles','document_status'),('vehicles','status'),('vehicles','photos'),('vehicles','notes'),('vehicles','arrival_notes'),('vehicles','arrival_photos'),('vehicles','sold_by'),('vehicles','handover_photo'),
      ('marketings','full_name'),('marketings','phone_number'),('marketings','address_city'),('marketings','code'),('marketings','ktp_photo_url'),('marketings','notes'),
      ('bookings','marketing_name'),('bookings','marketing_phone'),('bookings','status')
    ) AS wanted(tbl, col)
      ON c.table_name = wanted.tbl AND c.column_name = wanted.col
    WHERE c.table_schema = 'public'
      AND (c.data_type = 'ARRAY' OR c.data_type IN ('json','jsonb'))
  LOOP
    IF r.data_type = 'ARRAY' THEN
      conv := format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING (CASE WHEN %I IS NULL THEN NULL ELSE array_to_json(%I)::text END)',
        r.table_name, r.column_name, r.column_name, r.column_name);
    ELSE -- json / jsonb
      conv := format(
        'ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING (%I::text)',
        r.table_name, r.column_name, r.column_name);
    END IF;
    BEGIN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', r.table_name, r.column_name);
      EXECUTE conv;
      -- default kembali utk kolom JSON foto (sesuai skema Prisma)
      IF r.table_name = 'vehicles' AND r.column_name IN ('photos','arrival_photos') THEN
        EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT ''[]''', r.table_name, r.column_name);
      END IF;
      n := n + 1;
      RAISE NOTICE 'OK: kolom %.% (%) dikonversi ke TEXT', r.table_name, r.column_name, r.data_type;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Lewati %.% (%): %', r.table_name, r.column_name, r.data_type, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'Selesai koreksi tipe: % kolom dikonversi', n;
END $$;

-- ------------------------------------------------------------
-- 4) Index & UNIQUE — disamakan dengan schema.postgres.prisma
--    GAGAL karena data duplikat TIDAK menggagalkan migrasi (WARNING saja):
--    bila muncul WARNING duplikat, bersihkan data duplikat lalu Run ulang.
-- ------------------------------------------------------------

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "licenses_license_key_key" ON "licenses"("license_key");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index licenses_license_key_key: % (cek duplikat license_key)', SQLERRM; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "showrooms_license_id_key" ON "showrooms"("license_id");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index showrooms_license_id_key: % (cek duplikat license_id)', SQLERRM; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "showrooms_slug_key" ON "showrooms"("slug");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index showrooms_slug_key: % (cek duplikat slug)', SQLERRM; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "staff_accounts_showroom_id_username_key" ON "staff_accounts"("showroom_id", "username");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index staff_accounts_..._key: % (cek duplikat username)', SQLERRM; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "branches_showroom_id_name_key" ON "branches"("showroom_id", "name");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index branches_..._key: % (cek duplikat nama cabang)', SQLERRM; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "taxonomies_showroom_id_kind_name_key" ON "taxonomies"("showroom_id", "kind", "name");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index taxonomies_..._key: % (cek duplikat taxonomy — aman dihapus duplikatnya)', SQLERRM; END $$;

CREATE INDEX IF NOT EXISTS "vehicles_showroom_id_status_idx" ON "vehicles"("showroom_id", "status");
CREATE INDEX IF NOT EXISTS "vehicles_branch_id_idx" ON "vehicles"("branch_id");

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "marketings_showroom_id_phone_number_key" ON "marketings"("showroom_id", "phone_number");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index marketings_..._key: % (cek duplikat phone_number)', SQLERRM; END $$;

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "marketings_code_key" ON "marketings"("code");
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'Index marketings_code_key: % (cek duplikat kode referral — NULL aman, hapus duplikat non-NULL)', SQLERRM; END $$;

CREATE INDEX IF NOT EXISTS "bookings_vehicle_id_status_idx" ON "bookings"("vehicle_id", "status");
CREATE INDEX IF NOT EXISTS "bookings_marketing_id_idx" ON "bookings"("marketing_id");

-- ------------------------------------------------------------
-- 5) FOREIGN KEY — hanya ditambahkan bila belum ada (idempotent);
--    bila gagal karena data yatim/orphan → WARNING, migrasi lanjut.
-- ------------------------------------------------------------

DO $$ BEGIN
  ALTER TABLE "showrooms" ADD CONSTRAINT "showrooms_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK showrooms_license_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK staff_accounts_showroom_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "branches" ADD CONSTRAINT "branches_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK branches_showroom_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK taxonomies_showroom_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK vehicles_showroom_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK vehicles_branch_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "marketings" ADD CONSTRAINT "marketings_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK marketings_showroom_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK bookings_vehicle_id_fkey: %', SQLERRM; END $$;

DO $$ BEGIN
  ALTER TABLE "bookings" ADD CONSTRAINT "bookings_marketing_id_fkey" FOREIGN KEY ("marketing_id") REFERENCES "marketings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN OTHERS THEN RAISE WARNING 'FK bookings_marketing_id_fkey: %', SQLERRM; END $$;

-- ------------------------------------------------------------
-- 6) VERIFIKASI — hasil tampil di panel Results setelah Run.
--    Harapan: vehicles_kolom_baru_ok = 7, slug_unique_ok = 1,
--             tipe_photos = text, tipe_arrival_photos = text
--    (Bila semua sesuai → skema sudah sinkron; coba lagi aplikasinya.)
-- ------------------------------------------------------------

SELECT
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles'
      AND column_name IN ('commission_amount','branch_id','purchased_at',
                          'arrival_photos','sold_at','handover_photo','updated_at')
  ) AS vehicles_kolom_baru_ok,
  (SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'marketings'
      AND column_name = 'code'
  ) AS marketings_code_ok, -- HARUS 1 (bila 0 → fitur Link Toko & daftar marketing masih 500)
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = 'showrooms_slug_key'
  ) AS slug_unique_ok,
  (SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'photos'
  ) AS tipe_photos,
  (SELECT data_type FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vehicles' AND column_name = 'arrival_photos'
  ) AS tipe_arrival_photos;
