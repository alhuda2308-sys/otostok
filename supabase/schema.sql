-- =====================================================================
-- OtoStok — Skema PostgreSQL / Supabase
-- =====================================================================
-- Versi produksi memakai Supabase (Postgres). Skema Prisma di proyek ini
-- identik secara struktur (lihat prisma/schema.prisma). Jalankan SQL ini
-- di Supabase SQL Editor bila ingin deploy database Postgres mandiri.
--
-- Catatan keamanan:
--   * base_price (harga modal) ada di tabel vehicles dan TIDAK PERNAH
--     dikembalikan oleh endpoint katalog publik.
--   * Contoh RLS: aktifkan Row Level Security dan beri akses tabel hanya
--     ke service_role / role backend, lalu buat VIEW katalog_publik
--     tanpa kolom base_price untuk akses anonim.
-- =====================================================================

create table if not exists licenses (
  id            uuid primary key default gen_random_uuid(),
  license_key   text not null unique,               -- format MTR-XXXX-XXXX
  plan_type     text not null default 'trial',      -- trial | monthly | lifetime
  max_vehicles  integer not null default 10,
  status        text not null default 'active',     -- active | expired
  expires_at    timestamptz,                        -- null = lifetime
  created_at    timestamptz not null default now()
);

create table if not exists showrooms (
  id            uuid primary key default gen_random_uuid(),
  license_id    uuid not null unique references licenses (id) on delete cascade,
  name          text not null,
  slug          text not null unique,               -- contoh: showroom-jaya
  owner_phone   text not null,
  address       text not null,
  logo_url      text,                               -- logo showroom (katalog publik)
  header_url    text,                               -- foto header/banner katalog
  maps_url      text,                               -- link Google Maps lokasi
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Akun login dashboard (owner = kendali penuh, admin = staf terbatas)
create table if not exists staff_accounts (
  id            uuid primary key default gen_random_uuid(),
  showroom_id   uuid not null references showrooms (id) on delete cascade,
  name          text not null,
  username      text not null,
  password_hash text not null,                      -- scrypt: salt:hex
  role          text not null default 'admin',      -- owner | admin
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (showroom_id, username)
);

-- Kategori & merek custom per showroom (tidak di-hardcode)
create table if not exists taxonomies (
  id            uuid primary key default gen_random_uuid(),
  showroom_id   uuid not null references showrooms (id) on delete cascade,
  kind          text not null,                      -- category | brand
  name          text not null,
  created_at    timestamptz not null default now(),
  unique (showroom_id, kind, name)
);

-- Cabang showroom (lokasi unit dinamis).
-- Tanpa cabang = showroom hanya punya 1 lokasi (lokasi utama).
create table if not exists branches (
  id          uuid primary key default gen_random_uuid(),
  showroom_id uuid not null references showrooms (id) on delete cascade,
  name        text not null,                      -- cth: Cabang Bekasi
  address     text not null,
  maps_url    text,                               -- link Google Maps cabang
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (showroom_id, name)
);

create table if not exists vehicles (
  id                uuid primary key default gen_random_uuid(),
  showroom_id       uuid not null references showrooms (id) on delete cascade,
  branch_id         uuid references branches (id) on delete set null, -- null = lokasi utama
  brand             text not null,
  model             text not null,
  category          text,                           -- Matic, Bebek, Sport, dst (dari taxonomies)
  year              integer not null,
  license_plate     text not null,
  color             text,
  odometer          integer,                        -- KM
  tax_status        text,                           -- cth: "Hidup s/d 03/2026"
  document_status   text,                           -- cth: "STNK & BPKB Lengkap"
  base_price        bigint,                         -- SENSITIF: harga modal, hanya owner
  selling_price     bigint,                         -- harga jual showroom
  commission_amount bigint,                         -- komisi marketing nominal fix (Rp)
  status            text not null default 'available', -- available | hold | sold
  photos            jsonb not null default '[]'::jsonb, -- array URL foto
  notes             text,
  -- mutasi unit masuk
  purchased_at      timestamptz,                    -- tanggal masuk (default created_at)
  arrival_notes     text,                           -- kondisi fisik saat datang
  arrival_photos    jsonb not null default '[]'::jsonb,
  -- mutasi unit keluar / penjualan
  sold_at           timestamptz,                    -- tanggal laku
  sold_price        bigint,                         -- harga deal akhir
  sold_by           text,                           -- nama marketing yang tembus
  handover_photo    text,                           -- foto bukti serah terima (opsional)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists vehicles_showroom_status_idx on vehicles (showroom_id, status);
create index if not exists vehicles_branch_idx on vehicles (branch_id);

-- Rekanan marketing terdaftar (Whitelist Nomor WhatsApp).
-- Nomor di sini satu-satunya yang bisa membuka katalog publik
-- (bila showroom sudah mendaftarkan minimal 1 rekanan).
create table if not exists marketings (
  id            uuid primary key default gen_random_uuid(),
  showroom_id   uuid not null references showrooms (id) on delete cascade,
  full_name     text not null,
  phone_number  text not null,                      -- format lokal 08xxx, unik per showroom
  address_city  text not null,                      -- domisili / kota asal
  ktp_photo_url text,                               -- opsional, dilayani via API aman (bukan file publik)
  notes         text,                               -- catatan khusus owner
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (showroom_id, phone_number)
);

create table if not exists bookings (
  id              uuid primary key default gen_random_uuid(),
  vehicle_id      uuid not null references vehicles (id) on delete cascade,
  marketing_id    uuid references marketings (id) on delete set null, -- null = hold manual tanpa rekanan
  marketing_name  text not null,                    -- denormalisasi (riwayat tetap ada walau rekanan dihapus)
  marketing_phone text not null,
  status          text not null default 'hold',     -- hold | confirmed | expired
  expires_at      timestamptz not null,             -- hold otomatis 2 jam
  created_at      timestamptz not null default now()
);

create index if not exists bookings_vehicle_status_idx on bookings (vehicle_id, status);
create index if not exists bookings_marketing_idx on bookings (marketing_id);

-- Trigger updated_at untuk vehicles
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists vehicles_set_updated_at on vehicles;
create trigger vehicles_set_updated_at
  before update on vehicles
  for each row execute function set_updated_at();

-- =====================================================================
-- VIEW publik untuk katalog marketing (tanpa harga modal & data mutasi internal)
-- =====================================================================
create or replace view katalog_publik as
select
  v.id, v.showroom_id, v.branch_id, b.name as branch_name, v.brand, v.model, v.category,
  v.year, v.license_plate, v.color,
  v.odometer, v.tax_status, v.document_status, v.selling_price,
  v.commission_amount, v.status, v.photos, v.notes, v.updated_at
from vehicles v
left join branches b on b.id = v.branch_id;
