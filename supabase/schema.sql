-- ============================================================
-- OtoStok — Migrasi skema untuk Supabase (PostgreSQL)
-- ============================================================
-- Cara pakai:
--   1. Buka Supabase Dashboard → SQL Editor
--   2. Copy-paste SELURUH isi file ini → Run
--   3. Selesai — semua tabel siap dipakai aplikasi
--
-- CATATAN:
--   • Jalankan pada database Supabase yang MASIH KOSONG (sekali saja).
--     Bila sudah pernah dijalankan, tabel akan dilaporkan "already exists"
--     — itu berarti skema sudah ada, abaikan/skip.
--   • Skema ini di-generate dari prisma/schema.postgres.prisma
--     (sumber kebenaran model aplikasi).
--   • Semua kolom ID & FK bertipe UUID — aplikasi (Prisma) mengisi
--     UUIDv4 sendiri via @default(uuid()), cocok dgn konvensi Supabase.
--   • Setelah ini, set env Vercel: DATABASE_URL (connection string
--     Postgres Supabase) + SUPER_ADMIN_SECRET, lalu redeploy.
--
-- Tabel: licenses, showrooms, staff_accounts, branches, taxonomies,
--        vehicles, marketings, bookings
-- ============================================================


-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "licenses" (
    "id" UUID NOT NULL,
    "license_key" TEXT NOT NULL,
    "plan_type" TEXT NOT NULL,
    "max_vehicles" INTEGER NOT NULL DEFAULT 10,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "licenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showrooms" (
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

-- CreateTable
CREATE TABLE "staff_accounts" (
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

-- CreateTable
CREATE TABLE "branches" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "maps_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taxonomies" (
    "id" UUID NOT NULL,
    "showroom_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "taxonomies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicles" (
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

-- CreateTable
CREATE TABLE "marketings" (
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

-- CreateTable
CREATE TABLE "bookings" (
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

-- CreateIndex
CREATE UNIQUE INDEX "licenses_license_key_key" ON "licenses"("license_key");

-- CreateIndex
CREATE UNIQUE INDEX "showrooms_license_id_key" ON "showrooms"("license_id");

-- CreateIndex
CREATE UNIQUE INDEX "showrooms_slug_key" ON "showrooms"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "staff_accounts_showroom_id_username_key" ON "staff_accounts"("showroom_id", "username");

-- CreateIndex
CREATE UNIQUE INDEX "branches_showroom_id_name_key" ON "branches"("showroom_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "taxonomies_showroom_id_kind_name_key" ON "taxonomies"("showroom_id", "kind", "name");

-- CreateIndex
CREATE INDEX "vehicles_showroom_id_status_idx" ON "vehicles"("showroom_id", "status");

-- CreateIndex
CREATE INDEX "vehicles_branch_id_idx" ON "vehicles"("branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "marketings_showroom_id_phone_number_key" ON "marketings"("showroom_id", "phone_number");

-- CreateIndex
CREATE INDEX "bookings_vehicle_id_status_idx" ON "bookings"("vehicle_id", "status");

-- CreateIndex
CREATE INDEX "bookings_marketing_id_idx" ON "bookings"("marketing_id");

-- AddForeignKey
ALTER TABLE "showrooms" ADD CONSTRAINT "showrooms_license_id_fkey" FOREIGN KEY ("license_id") REFERENCES "licenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_accounts" ADD CONSTRAINT "staff_accounts_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taxonomies" ADD CONSTRAINT "taxonomies_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketings" ADD CONSTRAINT "marketings_showroom_id_fkey" FOREIGN KEY ("showroom_id") REFERENCES "showrooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_marketing_id_fkey" FOREIGN KEY ("marketing_id") REFERENCES "marketings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

