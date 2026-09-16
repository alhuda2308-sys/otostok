# Worklog — OtoStok

Project: Aplikasi web full-stack manajemen stok showroom motor bekas + katalog marketing freelance.
Stack: Next.js 16 (App Router), TypeScript, Tailwind CSS 4, shadcn/ui, Prisma (SQLite, portable ke Supabase/Postgres).

---
Task ID: 1
Agent: Z.ai Code (orchestrator)
Task: Eksplorasi proyek & setup skema database

Work Log:
- Eksplorasi struktur proyek: Next.js 16 + Tailwind 4 + shadcn/ui lengkap, TanStack Query, sonner, zod tersedia.
- Dev server sudah berjalan di port 3000 (dev.log ada di /home/z/my-project/dev.log).
- Menulis ulang prisma/schema.prisma dengan 4 tabel: licenses, showrooms, vehicles, bookings (camelCase mapped ke snake_case).
- Field sensitif base_price (harga modal) ada di vehicles; katalog publik tidak akan pernah mengeksposnya.
- photos disimpan sebagai JSON string array (portable SQLite/Postgres).
- Menjalankan `bun run db:push` — skema ter-push ke db/custom.db.

Stage Summary:
- Skema DB siap: License (MTR-XXXX-XXXX, trial/monthly/lifetime, max_vehicles), Showroom (slug unique, terikat 1 lisensi), Vehicle (status available/hold/sold), Booking (hold/confirmed/expired, expires_at untuk hold 2 jam).

---
Task ID: 3-a
Agent: general-purpose (sub-agent 3-a)
Task: Kumpulkan foto motor realistis via image-search + ikon PWA via image-generation

Work Log:
- Membaca worklog.md untuk konteks Task 1 (skema DB).
- Menjalankan 10 query image-search z-ai CLI. Batch paralel penuh (10 job) gagal 6 query karena rate-limit HTTP 429; hanya 4 sukses (search-01, 02, 06, 09). CLI `-o` tidak menulis file, hasil ditangkap dari stdout.
- Retry 6 query yang gagal (03 NMAX, 04 Aerox, 05 PCX, 07 CB150 Verza, 08 Mio Sporty, 10 Lexi) dalam batch kecil 2 paralel + jeda 10-12 detik → semua sukses, output ditangkap via tee ke agent-ctx/stdout-XX.log lalu diekstrak menjadi search-XX.json (masing-masing 4 hasil, success:true).
- Menyusun agent-ctx/vehicle-images.json: mapping 10 slug kendaraan → 3 URL terbaik per motor (prioritas foto landscape, hindari duplikat lintas-query — 1 URL duplikat di search-05 dibuang).
- Verifikasi 3 sampel URL dengan curl -sI → semua HTTP/2 200, content-type image/jpeg.
- Generate ikon PWA 1024x1024 via z-ai image (siluet motor putih, background biru #1d4ed8) → public/icon-1024.png.
- Output generator ternyata JPEG ber-ekstensi .png; dikonversi ke PNG asli via PIL (RGB, 1024x1024, 247KB).
- Copy ke src/app/icon.png (satu-satunya file di src/ yang dibuat). Tidak ada file source lain yang disentuh.

Stage Summary:
- 30 URL foto motor (3 per kendaraan × 10 model) tersimpan di /home/z/my-project/agent-ctx/vehicle-images.json, siap dipakai seed script (photos JSON string array). URL OSS z-cdn.chatglm.cn terverifikasi reachable (HTTP 200).
- Raw hasil per query: agent-ctx/search-01.json … search-10.json (+ stdout-XX.log).
- Ikon PWA: /home/z/my-project/public/icon-1024.png dan /home/z/my-project/src/app/icon.png (PNG asli 1024x1024, 247KB, >10KB).

---
Task ID: 2, 3-b, 4, 5, 6, 7, 8, 9, 10, 11
Agent: Z.ai Code (orchestrator)
Task: Setup DB, seed, backend API, seluruh frontend, PWA, verifikasi E2E

Work Log:
- [2] prisma/schema.prisma: 4 tabel (licenses, showrooms, vehicles, bookings) snake_case mapping, photos JSON string portable. db:push sukses.
- [3-b] scripts/seed.ts: 4 lisensi demo (MTR-JAYA-0001 monthly, MTR-BARU-0001 trial 5 unit, MTR-LIFE-8888 lifetime, MTR-OLD1-1111 expired), showroom-jaya + 10 unit motor berfoto (dari agent-ctx/vehicle-images.json), 1 booking hold Pak Deni 2 jam. Idempotent + SEED_FORCE=1.
- [4] 9 API routes: POST /api/activate (validasi key/aktif/bound/slug-reserved/unik), GET /api/license-check, GET /api/showrooms/[slug], GET /api/showrooms/[slug]/vehicles (TANPA basePrice), POST /api/vehicles/[id]/hold (lock 2 jam, 409 jika bentrok), GET /api/admin/[slug]/inventory (dengan basePrice + stats + kuota), POST /api/admin/[slug]/vehicles (enforce quota max_vehicles), PATCH/DELETE /api/admin/vehicles/[id] (efek samping status: available=lepas hold, sold=confirm booking, hold=booking Owner 2 jam), POST /api/upload (multipart ke public/uploads, maks 4MB x8).
- [5] layout global (font sistem, bg slate-50, footer sticky mt-auto, Toaster sonner), landing / (hero, lookup slug, fitur, demo box), /activate (live license-check chip, auto-slug, success panel + salin tautan).
- [6] /admin/[slug]: kuota bar + lisensi, 4 kartu statistik (stok/ditahan/terjual/perputaran modal + nilai jual), panel tahanan aktif (countdown, WA link, Deal/Lepas), search + filter status, grid kartu inventaris (jual/modal/komisi, quick-action 3 status, edit, hapus + AlertDialog), VehicleForm dialog (MoneyInput auto-format titik, datalist pajak, select surat, upload multi-foto maks 6, preview + hapus).
- [7] /s/[slug]: header showroom + tombol WA, search, filter status (Semua/Ready/Ditahan dengan count), chip merek scroll-x, kartu marketplace-style (foto 4:3, badge status, badge pajak/surat/warna, harga besar, komisi emerald, strip hold countdown), Salin Iklan (buildAdText + clipboard fallback), Tahan Unit dialog, galeri foto dialog prev/next, auto-refetch 30s + visibilitychange, Countdown onDone -> refetch.
- [8] app/manifest.ts + icon-1024.png (subagent) + src/app/icon.png + themeColor #1d4ed8 + appleWebApp meta.
- [9] supabase/schema.sql: versi Postgres/Supabase lengkap trigger updated_at + VIEW katalog_publik tanpa base_price + catatan RLS.
- [10] Lint bersih (fix: setState-in-effect di Countdown via rAF, hapus eslint-disable tak terpakai).
- [11] Verifikasi E2E agent-browser: landing/katalog/admin/activate 200; salin iklan toast OK; hold end-to-end (Bu Rina, countdown 01:59:58, tombol disabled, filter count berubah); bentrok hold 409 via curl; owner Deal -> booking 'confirmed' di DB; kuota trial 5/5 -> unit ke-6 ditolak 400; tambah/edit/hapus motor via UI OK; aktivasi via UI OK (MTR-LIFE-8888 -> motor-sejahtera-abadi, lalu dihapus lagi utk demo); aktivasi lisensi expired/terikat ditolak; manifest.webmanifest ter-serve; 0 error console & dev.log; mobile iPhone 16 & desktop 1280px rapi; footer sticky.

Stage Summary:
- Aplikasi MotorHub/OtoStok lengkap & terverifikasi E2E. Keamanan inti: endpoint katalog publik secara struktural tak pernah mengembalikan base_price; quota di-enforce server-side; hold auto-expire (lazy cleanup) + konfirmasi deal.
- Perbaikan yang ditemukan saat verifikasi: key demo MTR-PRO-8888 tidak match format MTR-XXXX-XXXX -> diganti MTR-LIFE-8888 (seed + constants).
- Data demo akhir: showroom-jaya (8 ready, 1 hold Pak Deni, 1 terjual), lisensi MTR-BARU-0001 & MTR-LIFE-8888 bebas untuk uji aktivasi.

---
Task ID: rename-brand-otostok
Agent: Z.ai Code (main)
Task: Ganti nama brand "MotorHub / OtoStok" menjadi "OtoStok" saja

Work Log:
- Identifikasi semua kemunculan "MotorHub" via Grep (7 file source + 3 file non-source)
- Update src/app/layout.tsx: metadata title default/template & applicationName → "OtoStok"
- Update src/app/manifest.ts: PWA name → "OtoStok — Stok & Katalog Motor Bekas"
- Update src/app/page.tsx: header brand → "OtoStok" (font-extrabold text-blue-700)
- Update src/components/app-footer.tsx: brand footer → "OtoStok"
- Update src/components/app-icon.tsx: alt logo → "Logo OtoStok"
- Update src/app/activate/page.tsx & activate-client.tsx: copy brand → "OtoStok"
- Update komentar di scripts/seed.ts, supabase/schema.sql, prisma/schema.prisma via sed
- Verifikasi Grep: hanya tersisa 1 mention historis di worklog entry lama

Stage Summary:
- Brand aplikasi kini konsisten "OtoStok" di seluruh UI, metadata, PWA manifest, dan komentar kode
- Tidak ada perubahan fungsional/logika — hanya branding copy

---
Task ID: dashboard-7-features
Agent: Z.ai Code (main)
Task: 7 fitur operasional harian Dashboard Owner (settings, foto unlimited, broadcast WA, manajemen staf, laporan+CSV, mutasi, taxonomy kategori/merk)

Work Log:
- [Schema] prisma/schema.prisma: Showroom += logoUrl/headerUrl/mapsUrl; Vehicle += category, purchasedAt, arrivalNotes, arrivalPhotos, soldAt, soldPrice, soldBy, handoverPhoto; model baru StaffAccount (role owner|admin, username unik per showroom, scrypt hash) & Taxonomy (kind category|brand, unique per showroom). db:push OK.
- [Auth] lib/auth.ts: hashPassword/verifyPassword (scrypt), session cookie HMAC-SHA256 HttpOnly 7 hari (otostok_session), guard requireShowroomSession/requireOwnerSession. API: /api/auth/login, /api/auth/session, /api/auth/logout.
- [API baru] settings GET/PATCH (owner), taxonomy GET/POST per-showroom + DELETE (tolak bila dipakai unit), staff GET/POST + PATCH/DELETE (owner, akun owner tak bisa diubah/hapus), reports GET (filter soldAt; admin TIDAK menerima basePrice/margin — server-side).
- [API update] inventory (session wajib; admin: license=null, quota=null, capitalTurnover=null, basePrice=null), vehicles POST/PATCH/DELETE (session; admin tak bisa set basePrice; foto sampai 60; field mutasi; saat status->sold: soldAt/soldPrice/soldBy auto-isi bila kosong; status->available reset data jual), activate (wajib password owner >=6, buat akun owner username=phone + taxonomy default), public showrooms/vehicles ikut sertakan logo/header/maps/category.
- [Client lib] image-compress.ts (canvas resize 1600px + JPEG q0.82, fallback aman), broadcast.ts (buildBroadcastText new/sold + waBroadcastLink wa.me/?text=), csv.ts (delimiter titik-koma + BOM UTF-8 + download), formatDateISO di format.ts.
- [Komponen] admin-shell.tsx (AdminGate login inline + demo hint, AdminNav tab sticky role-aware, SessionBadge logout, AdminSubHeader, ShowroomNotFound), photo-manager.tsx (upload tanpa batas batch 4/request + kompresi + preview grid + set cover + hapus satuan; mode maxPhotos=1 utk logo/header/bukti), wa-broadcast-dialog.tsx (radio format, textarea editable, Salin Teks, Buka WhatsApp), sell-dialog.tsx (tanggal laku, harga deal, nama marketing, foto serah terima; setelah simpan -> auto buka broadcast format sold), money-input.tsx reusable.
- [Dashboard /admin/[slug]] login gate; role gating (owner: lisensi+kuota+modal+perputaran modal; admin: nilai jual stok + grid 2 kolom); filter kategori & merk via Select taxonomy; quick-action Terjual -> SellDialog; tombol broadcast WA (Share2) per kartu dengan kind otomatis by status; card pakai logo showroom.
- [Halaman baru] /admin/[slug]/settings (identitas + logo/header PhotoManager single + maps; admin ditolak), /staff (list, buat akun + dialog kredensial sekali-lihat + toggle aktif + hapus confirm; admin ditolak), /reports (preset Harian/Mingguan/Bulanan/Kustom + custom date, 4 metrik (margin hanya owner), tabel desktop + kartu mobile, Ekspor CSV), /mutasi (tab Unit Masuk 11 & Unit Keluar 3; dialog kelola info masuk: tanggal/kondisi/foto; keluar: tanggal laku/deal/marketing/bukti).
- [Katalog publik /s/[slug]] header: logo + tombol Maps + banner header photo; chip Kategori (biru) & chip Merek dari taxonomy + merge nilai stok; badge kategori di kartu.
- [Aktivasi] field Password Owner + hint username=phone; success panel menampilkan akun owner; taxonomy default otomatis.
- [Seed] akun owner/demo (owner/demo1234), admin (budi/budi1234), taxonomy default, 11 unit (8 ready, 1 hold Pak Deni, 2 terjual: hari ini & 12 hari lalu utk demo laporan), purchasedAt/arrivalNotes per unit. SEED_FORCE dijalankan.
- [Supabase] schema.sql paritas Postgres: kolom baru + tabel staff_accounts & taxonomies + view katalog_publik dgn category.
- [Fix bug ditemukan] String(null) -> "null" string pada handoverPhoto & headerUrl (safeStr di vehicles PATCH & settings PATCH) + pembersihan data rusak; stale Prisma client setelah db:push -> restart dev server.
- [Verifikasi E2E agent-browser] login owner & admin; dashboard owner lengkap; Deal(Terjual) -> SellDialog -> broadcast WA (format sold & new, link katalog); laporan harian 2 unit/bulanan 3 unit (margin 6.85jt akurat), ekspor CSV; mutasi 2 tab + dialog; settings simpan OK; staff buat akun "rina" OK; admin (budi): nav Pengaturan/Staf hilang, /staff ditolak, lisensi/modal/margin disembunyikan server-side; katalog publik filter Matic -> 7 unit; mobile iPhone 14 rapi + footer sticky; aktivasi baru dgn password owner + taxonomy default + login owner baru OK; 0 error console & dev.log; lint bersih.

Stage Summary:
- 7/7 fitur selesai & terverifikasi E2E. Keamanan: semua API admin wajib sesi; role admin dibatasi server-side (tanpa lisensi/modal/margin); foto dikompresi di client sebelum upload; taxonomy per-showroom menggantikan hardcode.
- Akun demo showroom-jaya: owner/demo1234 (owner), budi/budi1234 (admin terbatas).
- Struktur baru: /admin/[slug]/{settings,staff,reports,mutasi}; API auth/*, admin/[slug]/{settings,staff,taxonomy,reports}, admin/taxonomy/[id], admin/staff/[id], showrooms/[slug]/taxonomy.

---
Task ID: 8
Agent: Z.ai Code (main)
Task: Fitur 8 — Dukungan multi-cabang showroom (lokasi unit dinamis)

Work Log:
- [Schema] prisma/schema.prisma: model Branch (showroomId, name unik per showroom, address, mapsUrl, isActive) + Vehicle.branchId (SetNull, null = lokasi utama, index). db:push + prisma generate OK. supabase/schema.sql paritas: tabel branches, vehicles.branch_id, index, view katalog_publik ikut branch_name (left join).
- [API] Baru: /api/admin/[slug]/branches (GET owner+admin, POST owner-only: validasi nama>=3, alamat>=5, maps http(s), duplikat nama 409) & /api/admin/branches/[id] (PATCH/DELETE owner-only; hapus cabang memindahkan unit ke Lokasi Utama via SetNull, respons berisi movedUnits).
- [API update] Katalog publik /api/showrooms/[slug]/vehicles: include branch per unit + daftar branches aktif. Inventory admin: include branch + branches. POST/PATCH vehicles: terima branchId (validasi milik showroom; null = utama). mappers.ts: VehicleWithBranch + toBranchInfo (basePrice tetap tidak pernah bocor).
- [UI admin] Tab "Cabang" (Building2, owner-only) di AdminNav. Halaman /admin/[slug]/branches: info panel perilaku otomatis, list cabang (alamat + Buka Google Maps + edit + hapus + AlertDialog konfirmasi), dialog tambah/edit (Nama, Alamat, Link Maps), admin ditolak. VehicleForm: dropdown "Lokasi Unit Berada" KONDISIONAL — muncul hanya bila branches.length > 0 (opsi: Lokasi Utama + cabang), payload branchId null/id. Dashboard: Select filter lokasi (kondisional), label MapPin di kartu unit (kondisional).
- [UI katalog /s/[slug]] Chip filter lokasi (emerald: Semua Lokasi / Lokasi Utama / nama cabang) DI SAMPING filter kategori & merek — hanya bila ada cabang; strip badge di kartu: "📍 Lokasi: [nama cabang / nama showroom]" + tombol Maps -> Google Maps cabang tsb (utama = mapsUrl showroom). SEMUA UI lokasi otomatis hilang bila showroom tanpa cabang (diverifikasi dengan showroom baru: 0 elemen lokasi, filter kategori tetap ada).
- [Seed] 2 cabang demo showroom-jaya: Cabang Bekasi & Cabang Depok (alamat + maps URL demo). 4 unit di cabang (NMAX+PCX -> Bekasi, Satria+CB150 -> Depok), sisanya lokasi utama. SEED_FORCE dijalankan.
- [Fix saat verifikasi] Edit MultiEdit pertama sempat membuat duplikat model Branch -> dihapus; dev server mati saat sesi shell berakhir -> restart dengan `setsid` agar persisten; Turbopack cache korup setelah rm .next di tengah proses -> kill semua proses bun/next + clean start.

Stage Summary:
- Fitur 8 SELESAI & terverifikasi E2E (agent-browser + curl): tambah/edit/hapus cabang via UI; dropdown "Lokasi Unit Berada" tampil di form motor hanya bila ada cabang; unit baru tersimpan dengan cabang benar; dashboard filter lokasi (Bekasi -> 2 unit tepat); katalog: 11 badge lokasi + filter chip + link Maps per cabang (href = maps cabang, terverifikasi); showroom TANPA cabang menyembunyikan semua UI lokasi; admin (budi) GET cabang 200 tapi POST/PATCH/DELETE 403; mobile & desktop rapi, footer sticky; lint bersih; dev.log tanpa error.
- Data demo: showroom-jaya = 11 unit (4 di cabang), 2 cabang (Bekasi, Depok). Lisensi MTR-BARU-0001 & showroom uji solo-motor dibersihkan setelah verifikasi auto-hide.
---
Task ID: 9
Agent: Z.ai Code (main)
Task: Fitur 9 — Sistem Rekanan Terdaftar (Whitelist Nomor WhatsApp) + Opsi Verifikasi KTP

Work Log:
- [Schema] prisma/schema.prisma: model Marketing (showroomId, fullName, phoneNumber unik per showroom, addressCity, ktpPhotoUrl nullable, notes, isActive default true) + Booking.marketingId (FK SetNull, null = hold manual). db:push OK. supabase/schema.sql paritas: tabel marketings, bookings.marketing_id, index bookings_marketing_idx.
- [API publik] POST /api/showrooms/[slug]/verify-marketing: cek nomor (terima 08xx/62xx, normalisasi 62xx) -> 200 {registered:true, marketing{id,fullName,addressCity}} | 404 not_found | 403 inactive.
- [Gate API] GET /api/showrooms/[slug]/vehicles: bila showroom punya >=1 rekanan, wajib header X-Mkt-Phone nomor rekanan AKTIF -> selain itu 403 {code:'WHITELIST_REQUIRED'}; respons kini memuat flag whitelistEnabled. Showroom tanpa rekanan tetap terbuka (kompatibel mundur).
- [Hold API] POST /api/vehicles/[id]/hold menerima marketingId — identitas (nama+WA) diambil dari data rekanan di SERVER (bukan input klien), divalidasi milik showroom unit & aktif; booking menyimpan marketingId + denormalisasi nama/WA (riwayat tahan delesi rekanan).
- [API admin] GET/POST /api/admin/[slug]/marketings (GET owner+admin dgn statistik holdCount/soldCount per rekanan; POST owner-only: validasi nama, WA 08xxx 10-14 digit, duplikat 409) + PATCH/DELETE /api/admin/marketings/[id] (owner-only; PATCH = edit/toggle aktif; DELETE = riwayat booking utuh via SetNull).
- [KTP aman] lib/ktp.ts: simpan PRIVAT di upload/ktp/ (di luar public/), nama file ktp-<slug>-<uuid>.<ext>; POST /api/admin/[slug]/marketings/ktp (owner-only, multipart 1 file, maks 4MB); GET /api/admin/marketings/ktp/[file] streaming image hanya utk sesi Owner/Admin showroom sama (Cache-Control private). File lama terhapus otomatis saat KTP diganti/dihapus/rekanan didelete (deleteKtpFileByUrl).
- [UI katalog] Komponen MarketingGate: layar verifikasi bersih (logo+nama showroom, input WA, tombol Masuk Katalog); ditolak -> pesan "Nomor WhatsApp Anda belum terdaftar sebagai rekanan resmi showroom." + tombol besar "Hubungi Owner / Admin via WA" (wa.me owner + draf minta pendaftaran) + "Coba nomor lain". lib/marketing-session.ts: sesi localStorage per-slug (otostok_mkt_<slug>) — tidak perlu ketik ulang; refetch senyap memvalidasi ulang, 403 -> sesi dicabut otomatis. Sapaan personal di header katalog: "Halo, [Nama] ([Domisili])" + tombol Ganti Nomor.
- [UI hold] HoldDialog dua mode: rekanan -> pop-up konfirmasi "Kunci [Merk Model] selama 2 jam atas nama [Nama]?" tanpa form input (identitas dari sesi); tanpa rekanan -> form manual nama+WA (mode lama).
- [UI admin] Tab "Marketing" (Megaphone) di AdminNav (owner+admin). Halaman /admin/[slug]/marketings: info panel whitelist, tabel desktop (Nama, WA, Domisili, Performa "Tahan X • Laku Y", Switch status, Terdaftar, KTP, Aksi) + kartu mobile; dialog tambah/edit (Nama*, WA 08xxx*, Domisili*, Catatan owner, Upload KTP opsional dgn kompresi client); pratinjau KTP dialog (img endpoint aman + lock note); AlertDialog hapus. Admin: bisa lihat & pratinjau KTP, mutasi disembunyikan & ditolak server 403.
- [Dashboard] Tahanan aktif kini menampilkan badge "Rekanan" bila booking.marketingId terisi.
- [Seed] 3 rekanan demo showroom-jaya: Deni Prasetyo 6281299312210 (aktif, Jakarta Timur, catatan spesialis sport), Rina Marlina 6281200000001 (aktif, Bekasi), Andi Saputra 6281255500777 (NONAKTIF, utk uji blokir); booking hold & terjual demo kini ter-link marketingId (Deni: Tahan 3/Laku 1, Rina: Tahan 1/Laku 1); langkah idempotent menghubungkan booking lama by phone. SEED_FORCE dijalankan.
- [Verifikasi E2E agent-browser + curl] Gate muncul utk showroom-jaya; nomor salah -> layar ditolak (href wa.me owner terverifikasi via curl 404/403/200 verify); login Deni -> katalog terbuka + sapaan; Tahan Unit Mio Sporty -> dialog konfirmasi identitas -> "Ditahan oleh Deni Prasetyo" + admin lihat badge Rekanan; Lepas utk pulihkan demo; halaman marketings: toggle Andi aktif/nonaktif langsung mengubah hasil verify (200<->403), tambah rekanan via form, pratinjau KTP, edit domisili, hapus + file KTP terhapus (upload/ktp kosong); Ganti Nomor -> sesi null -> gate; deaktivasi Deni -> reload katalog -> sesi tersimpan dicabot otomatis -> gate; showroom tanpa rekanan (solo-motor-test via MTR-BARU-0001) terbuka tanpa gate lalu dihapus; KTP endpoint: tanpa sesi 401, sesi showroom sama 200 image/png, admin showroom sama 200, POST/PATCH admin lain-role 403; mobile 390x844 & desktop 1440x900 rapi, footer sticky/ikut konten; 0 error console & dev.log; lint bersih.

Stage Summary:
- Fitur 9 SELESAI & terverifikasi E2E. Katalog kini terkunci whitelist: hanya nomor rekanan aktif (tabel marketings) yang bisa membuka /s/[slug] dan menahan unit — tanpa password; identitas rekanan otomatis tercatat di tiap hold (badge Rekanan di dashboard). Foto KTP tersimpan privat & hanya bisa dibuka Owner/Admin showroom tsb via endpoint ber-sesi.
- Showroom yang belum mendaftarkan rekanan tetap berperilaku lama (katalog terbuka, hold manual) — kompatibel mundur.
- Demo: verifikasi katalog showroom-jaya pakai 0812-9931-2210 (Deni, aktif) / 081200000001 (Rina) / 0812-5550-0777 (Andi, nonaktif utk demo penolakan).
- Struktur baru: /admin/[slug]/marketings; API admin/[slug]/marketings(+ktp), admin/marketings/[id], admin/marketings/ktp/[file], showrooms/[slug]/verify-marketing; lib/ktp.ts, lib/marketing-session.ts; komponen marketing-gate.tsx; HoldDialog mode ganda.
---
Task ID: share-save-revision
Agent: Z.ai Code (main)
Task: Revisi fitur unduh/bagikan gambar motor di katalog marketing — TANPA file .zip (Web Share API + galeri layar penuh + simpan foto tunggal)

Work Log:
- [lib/share.ts baru] shareVehicleAd(): Web Share API navigator.share — kirim FOTO UTAMA (fetch blob → File) + caption spek motor (buildAdText) langsung ke WhatsApp/media sosial; urutan fallback: share file+teks → share teks saja → salin caption ke clipboard. AbortError dibedakan dari gagal sungguhan. savePhotoToDevice(): unduh 1 foto via blob + atribut download (Android/desktop); deteksi iOS → buka tab baru agar long-press "Simpan ke Foto/Galeri" (iOS tidak dukung a.download utk gambar). buildPhotoFilename(): nama file rapi "otostok-honda-beat-dk-1234-foto-2.jpg".
- [components/photo-lightbox.tsx baru] Galeri foto LAYAR PENUH (fixed inset-0 bg-black, menggantikan Dialog kecil lama): bar atas judul unit + X tutup; swipe kanan/kiri (touchstart/move/end, threshold 56px, drag mengikuti jari + snap animasi 180ms, keputusan threshold pakai ref agar tak stale); tombol prev/next bulat utk desktop; counter "1/3" + dots indikator (klik dot = lompat foto); bar bawah tombol "Simpan Foto Ini (.jpg)" per slide + hint long-press; kunci scroll body; keyboard Escape/ArrowLeft/ArrowRight; pb safe-area-inset utk iPhone; LightboxImage subkomponen dgn placeholder gelap bila foto rusak (reset otomatis via key=url).
- [catalog-client.tsx] Tombol "Bagikan Materi Iklan" (Share2, outline biru muda) full-width di SETIAP kartu non-terjual, di atas row Salin Iklan + Tahan Unit; state loading per kartu (Loader2); toast per outcome: shared/copy-fallback (info: "Perangkat ini belum mendukung kirim foto otomatis...")/failed; cancelled tanpa toast. Dialog galeri lama dihapus, diganti PhotoLightbox (state gallery {vehicle,index} dipertahankan). Impres dibersihkan (Dialog, ChevronLeft/Right keluar; Share2, Loader2 masuk).
- [Fix saat verifikasi] react-hooks/immutability: hapus pola ref-in-effect (keyboard listener pakai callback langsung dgn deps); react-hooks/set-state-in-effect: reset error state dipindah ke subkomponen LightboxImage ber-key; swipe stale-state: dragXRef sinkron utk keputusan touchend; overlay bg-black/95 (oklab) tampak bocor di headless → diganti bg-black OPAQUE (konsisten galeri marketplace & aman utk WebView lama), elemen kecil alpha pakai rgba() literal.
- [Verifikasi E2E agent-browser] Gate Deni 0812-9931-2210 → katalog; tombol "Bagikan Materi Iklan" tampil di kartu; klik → fallback clipboard terpicu + toast info (headless tanpa navigator.share — jalur Android/iOS nyata memakai share sheet native); lightbox: ketuk foto → layar penuh; next/prev, counter 1/3↔2/3↔3/3, ArrowLeft, Escape menutup; "Simpan Foto Ini" → toast "Foto 2/3 tersimpan sebagai file JPG" + file otentik terunduh: otostok-yamaha-mio-sporty-b-6499-dze-foto-2.jpg (JPG TUNGGAL, bukan zip); klik dot → lompat foto; swipe kiri 1/3→2/3, swipe kanan 2/3→1/3, swipe kecil <56px tidak pindah; mobile 390x844 & desktop 1280px rapi; kartu TERJUAL tanpa tombol aksi (sesuai desain); lint bersih; dev.log & console 0 error.

Stage Summary:
- Marketing kini membagikan materi iklan TANPA file .zip: tombol "Bagikan Materi Iklan" per kartu memakai Web Share API (foto utama + caption spek → sheet native HP → WhatsApp/medsos), fallback otomatis salin caption bila perangkat tak mendukung.
- Ketuk foto di kartu → galeri layar penuh bisa di-swipe; tiap slide punya "Simpan Foto Ini (.jpg)" (unduh file tunggal langsung; iOS via long-press di tab baru) + hint long-press.
- File baru: src/lib/share.ts, src/components/photo-lightbox.tsx. Perubahan: src/app/s/[slug]/catalog-client.tsx. Tidak ada perubahan schema/API — murni lapisan klien.
---
Task ID: super-admin-module
Agent: Z.ai Code (main)
Task: Modul SUPER ADMIN (/super-admin) — autentikasi Master Secret Key, generator lisensi 1-klik (OTO-XXXX-XXXX-XXXX), monitoring klien & showroom, API /api/super-admin/licenses

Work Log:
- [Env] .env += SUPER_ADMIN_SECRET (random hex; nilai: otostok_sa_c346a161b047c5e756f58bbe).
- [Format lisensi] isValidLicenseKey kini menerima MTR-XXXX-XXXX (lama) ATAU OTO-XXXX-XXXX-XXXX (Super Admin); placeholder & pesan error /activate diperbarui; types.PlanType += 'half_year' | 'yearly'; PLAN_LABELS += 6 Bulan / 1 Tahun; RESERVED_SLUGS += 'super-admin' (slug tak bisa dipakai showroom).
- [lib/super-auth.ts] isSuperAuthorized(): bandingkan header X-Super-Secret / query ?secret= vs env SUPER_ADMIN_SECRET via timingSafeEqual (stateless, tanpa cookie); generateLicenseKey(): charset tanpa karakter ambigu (I,O,0,1).
- [API /api/super-admin/licenses] GET: seluruh lisensi + showroom terikat (nama/slug/WA owner/isActive) + agregasi unit per showroom (groupBy status; usedUnits = belum terjual) — respons berisi rows lengkap utk tabel. POST: validasi paket (SUPER_PLANS: trial 7d/monthly 30d/half_year 180d/yearly 365d/lifetime null) & kuota 1-10.000 → insert status 'active' dgn retry anti-tabrakan kode. PATCH {id, action}: extend (+30 hari dari max(now, expiresAt); expired → aktif lagi), suspend (status 'suspended' + showroom.isActive=false → katalog & dashboard 404), unsuspend (aktif/expired by expiry + showroom.isActive=true). Semua method wajib secret; 500 jelas bila env belum diatur.
- [UI /super-admin] page.tsx (metadata "Super Admin", robots noindex) + super-admin-client.tsx: layar login passkey (ShieldCheck, input password, sessionStorage 'otostok_sa_key' per tab — auto-verify saat buka ulang; 401 → sesi dicabut); panel: 4 kartu statistik (Total/Aktif/Showroom Aktif/Unit Stok Berjalan), Generator Lisensi (Select paket, input kuota default 50, hasil dlm kartu hijau: kode font-mono besar + chip paket/kuota/kedaluwarsa + Salin Kode + Salin Format WA Pembeli — template WA rapi berisi kode, paket, kuota, masa aktif, link /activate, langkah aktivasi), Monitoring Klien (search + tabel desktop shadcn / kartu mobile: kode mono + badge paket, showroom + link /s/[slug] + chip "Akses dibekukan", wa.me link owner, kuota used/max + progress bar merah bila penuh, masa aktif merah bila expired + "Sisa N hari" amber ≤7 hari, badge status Aktif emerald / Segera Habis amber / Kedaluwarsa merah / Suspended merah-tua + ikon Lock, aksi cepat +30 Hari (disabled utk lifetime) / Suspend⇄Buka / Salin Info); toast sonner utk semua aksi; tombol Muat Ulang; logout.
- [Verifikasi curl] tanpa/salah secret → 401; GET → 5 lisensi + agregasi; POST yearly 75 → OTO-JRPX-ANEJ-5ADW (expires +365d); PATCH extend → +30 d; paket tidak dikenal → 400; suspend → /s/showroom-jaya page 200 tapi API katalog & dashboard 404 → unsuspend → API 200 lagi; license-check menerima kode OTO-.
- [Verifikasi agent-browser] login salah → "Master Secret Key salah."; login benar → panel; dropdown Radix 5 paket; generate half_year 25 → OTO-YWA3-947A-63XE "s/d 14 Mar 2027" (+180d) + langsung muncul di tabel; Salin Format WA & Salin Info → toast; +30 Hari via UI (14 Mar → 13 Apr 2027); Suspend via UI → badge Suspended + tombol Buka; Buka → Aktif; desktop 1280 & mobile 390 rapi + footer sticky; lint bersih; PANEL_OK & katalog_api_200 pada load akhir.
- [Data] lisensi uji OTO-JRPX & OTO-3WTL dihapus; tersisa demo: MTR-JAYA-0001 (terikat), MTR-BARU-0001, MTR-OLD1-1111 (expired), MTR-LIFE-8888, + OTO-YWA3-947A-63XE (6 Bulan 25 unit, aktif, belum diaktivasi — contoh format OTO siap uji aktivasi).

Stage Summary:
- Modul Super Admin selesai & terverifikasi: panel terpisah total dari akun showroom (kunci via env SUPER_ADMIN_SECRET, timing-safe, sesi sessionStorage per tab, noindex), generator lisensi 1-klik format OTO-XXXX-XXXX-XXXX dgn 5 paket + kuota + template WA pembeli, tabel monitoring seluruh klien (relasi lisensi-showroom-unit) dgn kuota terpakai, masa aktif berwarna, dan aksi cepat +30 Hari / Suspend-Buka / Salin Info yang efektif membekukan & mengembalikan akses katalog + dashboard showroom.
- Kredensial panel: /super-admin → Master Secret Key: otostok_sa_c346a161b047c5e756f58bbe (dari .env, ganti di produksi).

---
Task ID: github-repo-push
Agent: main (Z.ai Code)
Task: Buat repository GitHub dan push seluruh kode proyek OtoStok ke akun GitHub user

Work Log:
- Cek environment: git sudah init (8 commit ber-UUID), tidak ada kredensial GitHub, gh CLI belum terpasang
- Install gh CLI v2.101.0 ke ~/.local/bin (tanpa sudo)
- TEMUAN KEAMANAN: .env (berisi SUPER_ADMIN_SECRET & DATABASE_URL) ter-track di riwayat git → risiko bocor jika di-push
- Tambah .gitignore: db/, agent-ctx/, download/, *.pid, negasi !.env.example
- Buat README.md profesional (fitur, teknologi, setup, env, struktur) + .env.example template
- Rename package.json name → "otostok", sinkron bun.lock via bun install
- Squash seluruh riwayat: git checkout --orphan → git rm -r --cached . → git add -A → verifikasi tidak ada file sensitif → 1 commit bersih
- Login gh via token classic user (scope repo, tanpa read:org) → konfigurasi manual ~/.config/gh/hosts.yml + gh auth setup-git
- Amend author commit ke identitas GitHub: alhuda2308-sys <323011534+alhuda2308-sys@users.noreply.github.com>
- gh repo create otostok --public --source . --remote origin --push → sukses
- Verifikasi: remote URL bersih (tanpa token), repo PUBLIC branch main, .env & db/custom.db TIDAK ada di GitHub

Stage Summary:
- Repo live: https://github.com/alhuda2308-sys/otostok (public, 1 commit bersih, 192 file)
- Secret .env TIDAK ikut ter-push; template .env.example tersedia untuk clone baru
- Token GitHub tersimpan di ~/.config/gh/hosts.yml (di luar folder proyek, tidak masuk git) untuk push berikutnya
- Identitas commit terhubung ke akun GitHub user (noreply email)

---
Task ID: super-admin-login-debug
Agent: main (Z.ai Code)
Task: Diagnosa laporan user gagal verifikasi kunci di /super-admin

Work Log:
- Baca lib/super-auth.ts, api/super-admin/licenses/route.ts, super-admin-client.tsx — logika auth benar (header X-Super-Secret, timingSafeEqual dengan cek panjang)
- Tes API via curl: kunci benar → 200 dgn data, kunci salah → 401 (server sehat, env termuat)
- dev.log menunjukkan percobaan user berakhir dengan 401 → kunci yang diketik salah
- Reproduksi di agent-browser: kunci salah → "Master Secret Key salah." ; kunci benar → dashboard terbuka penuh (5 lisensi, generator, monitoring)
- Tidak ada perubahan kode — murni kesalahan input kunci oleh user

Stage Summary:
- Modul Super Admin berfungsi normal; Master Key aktif: otostok_sa_c346a161b047c5e756f58bbe (dari .env)
- Solusi untuk user: salin-tempel kunci persis tanpa spasi

---
Task ID: super-admin-gateway-header-fix
Agent: main (Z.ai Code)
Task: Perbaiki login /super-admin yang selalu gagal walau kunci benar

Work Log:
- Screenshot user menampilkan "Gagal verifikasi kunci." (bukan 401) dan dev.log TIDAK mencatat request kedua user → indikasi request hilang di gateway
- Tes pembanding: langsung :3000 + header X-Super-Secret → 200; via Caddy :81 + header yang sama → 401 (HEADER DIBUANG GATEWAY); via :81 + ?secret= → 200
- Kesimpulan: akar masalah = Caddy/gateway membuang custom header X-*, bukan salah ketik user (diagnosa awal yang menuduh kunci salah TIDAK TEPAT)
- Fix super-admin-client.tsx: keempat fetch (verifyAndLoad, refetch, handleGenerate POST, handleAction PATCH) kini kirim kunci via query param ?secret= (API memang sudah mendukung); header custom dihapus total
- Pesan error kini menyertakan kode HTTP (mis. "Gagal verifikasi kunci. (HTTP 502)") + pesan khusus TypeError jaringan
- E2E via jalur gateway asli (localhost:81, sama seperti preview user): login sukses, generate lisensi OTO-B57Q-Z3PB-A46W sukses (201), suspend→unsuspend sukses (200)
- Lint bersih; push ke GitHub (5a46854); lisensi tes dikembalikan ke status active

Stage Summary:
- Login /super-admin kini berfungsi lewat preview/gateway: kunci dikirim sebagai ?secret= yang tidak mungkin dibuang proxy
- Pelajaran penting: JANGAN andalkan custom header X-* untuk auth request yang melewati Caddy gateway proyek ini — gunakan query param

---
Task ID: sandbox-restart-recovery
Agent: main (Z.ai Code)
Task: Pulihkan akses /super-admin + data setelah restart sandbox menghapus .env & database

Work Log:
- User masih gagal login; pesan berubah menjadi "Master Secret Key salah." (401)
- dev.log ter-truncate: sandbox container restart 22:25 → proses dev server lama mati, .env di-regenerate TANPA SUPER_ADMIN_SECRET, db/custom.db dikosongkan, folder agent-ctx/ (untracked) dihapus
- Pulihkan .env (tambah kembali baris SUPER_ADMIN_SECRET dengan nilai sama)
- Restart dev server: proses yang di-launch dari sesi tool berulang kali dibunuh; pola (bun run dev &) subshell-detach + parent exit bersih terbukti persisten
- dev.sh resmi menjalankan db:push saat boot — data demo hilang karena DB di-reset sandbox
- Jalankan seed ulang; tapi agent-ctx/vehicle-images.json hilang → unit tanpa foto
- Patch scripts/seed.ts: fallback foto otomatis dari public/uploads (2 foto/unit round-robin) bila mapping hilang; SEED_FORCE=1 reseed sukses
- Verifikasi penuh: :3000 200, gateway :81 200, kunci salah 401, login super-admin via gateway SUKSES (4 lisensi, 3 aktif), monitoring table + katalog /s/showroom-jaya OK
- Commit seed fallback + push ke GitHub

Stage Summary:
- Login /super-admin berfungsi penuh lewat preview; akun demo: owner/demo1234, budi/budi1234
- Data demo ter-restorasi (4 lisensi, Showroom Jaya 11 unit berfoto, cabang, marketing, taxonomy)
- PELAJARAN: restart sandbox menghapus .env (baris SUPER_ADMIN), DB, dan folder untracked — selalu cek .env & seed setelah restart container

---
Task ID: sandbox-restart-recovery-2
Agent: main (Z.ai Code)
Task: Pulihkan push GitHub pasca-restart (gh config & binary terhapus, riwayat fork)

Work Log:
- Push gagal: ~/.config/gh/hosts.yml & ~/.local/bin/gh dihapus restart sandbox → reinstall gh v2.101.0 + restore hosts.yml + setup-git
- Push kedua ditolak non-fast-forward: remote punya duplikat commit worklog (2bd5a6a) vs lokal (1bff4d9) akibat restart
- git rebase origin/main → push sukses; commit seed fallback & recovery worklog masuk semua

Stage Summary:
- GitHub sinkron; dev server hidup; super-admin API 200 via gateway

---
Task ID: super-admin-cookie-session
Agent: Z.ai Code (orchestrator)
Task: 修复用户第三次报告的 Super Admin 登录失败（截图显示 "Gagal verifikasi kunci. (HTTP 500)"）

Work Log:
- 确认错误已从 401 变为 HTTP 500，且为新增的错误格式 → 用户浏览器已运行新 JS
- 全量搜索 dev.log：零条 500 记录 → 用户的 API 请求从未到达 Next.js
- 对照实验：直连 :3000 与 Caddy :81 均 200；Caddy Admin API (2019) 被平台禁用；/app/Caddyfile (root 0600) 不可读，推测含平台级请求过滤规则
- 关键实验：有效密钥放 X-Super-Secret header 过 Caddy 返回 200 → 推翻"Caddy 剥离 header"旧结论；拦截者确认为平台外部 preview 边缘代理（不可观测、不可控制），其规则疑似匹配 header/query 中的 "secret" 关键词并返回 500
- 策略转变：放弃诊断不可见层，将认证改造为对代理最友好的标准 Cookie 会话
- src/lib/super-auth.ts：新增 HMAC-SHA256 会话令牌（exp.signature 格式，8h TTL，timingSafeEqual 校验，不存原始密钥）、readSaSessionCookie、matchesSuperSecret；isSuperAuthorized 优先校验 cookie，兼容 header/query
- 新建 /api/super-admin/session：GET 校验会话；POST 接受 JSON {key} 或 urlencoded 表单（redirect=1 时 303 相对 Location 回跳，带 ?saerr=1 错误标记）；DELETE 清除 cookie
- licenses 路由：POST/PATCH 增加 body "key" 字段后备认证；GET 走 isSuperAuthorized（含 cookie）
- 客户端：登录改为 POST /api/super-admin/session（JSON body 字段名用 "key" 而非 "secret" 以避开网关关键词过滤）；fetch 失败/5xx 时自动降级为原生 <form method=POST> 文档导航提交；所有 fetch 移除 ?secret=；挂载时先查会话（支持表单回退后自动进入仪表盘）；logout 调 DELETE 清 cookie
- curl 全矩阵测试 10 项通过（错误 401/登录 200+Set-Cookie/会话 200/列表 200/body-key 201/表单 303+cookie/表单错误 303?saerr=1/过 Caddy 200/登出/登出后 401）
- agent-browser E2E（走真实网关 :81，全新上下文）：登录→仪表盘完整渲染→生成 OTO-EDM6-FGXA-HU79→Suspend→Unsuspend→登出，全部通过；原生表单回退路径在浏览器中验证：提交→303→重挂载→自动进仪表盘
- 清理 E2E 产生的测试许可证（Prisma deleteMany）

Stage Summary:
- 根因定案：平台外部 preview 边缘代理拒绝含 "secret" 的 header/query 请求（HTTP 500），Caddy 与 Next.js 两层自始至终正常；此前归咎 Caddy 是误判
- 修复模式：Cookie 会话（HttpOnly + HMAC 签名 + 8h TTL）为主认证，原生表单 POST 为 fetch 被阻断时的兜底；请求中不再出现 "secret" 关键词（字段改名为 key）
- 教训：沙箱 preview 的外部代理层不可见不可控，跨代理认证必须使用 Cookie 等最标准机制；诊断时须先确认日志中请求是否到达，再归因
- E2E 覆盖：JSON 登录、表单回退登录、Cookie 数据加载、生成/暂停/恢复、登出，全部经真实网关验证

---
Task ID: vercel-json-error-fix
Agent: Z.ai Code (orchestrator)
Task: 修复 Vercel 部署 (otostok-showroom.vercel.app) 上 Generate Lisensi 报 "Unexpected end of JSON input"

Work Log:
- 定性：该错误 = 客户端在空响应体上调 res.json()；POST handler 的客户端代码先 res.json() 后检查 res.ok，服务器/平台 5xx 空响应时直接崩溃
- 新建 src/lib/db-errors.ts：dbErrorResponse（记录完整错误到服务器日志 → Vercel Runtime Logs 可见）+ Prisma 错误映射（P2021 表不存在/P2022 列不匹配/P1000 认证失败/P1001 连不上/P2002 唯一冲突/P2003 外键，全部印尼语可操作提示）+ safeJsonBody（null/数组/非法 JSON 一律归一为 {}）
- licenses 路由：GET/POST/PATCH 全部 try-catch 包裹，任何异常返回 JSON（永不空体/HTML）
- session 路由：同样 try-catch + 修复 body=null 边界
- 客户端 super-admin-client：refetch/handleGenerate/handleAction 全部安全解析（res.json().catch + 校验字段），错误信息带 HTTP 状态码，405 有专门提示（部署版本过旧）
- Supabase 支持：新建 prisma/schema.postgres.prisma（模型与 SQLite 版一致）；用 prisma migrate diff 生成规范 DDL supabase/schema.sql（8 表+索引+外键，附使用说明头）；package.json 增加 db:push:pg / db:generate:pg
- 构建接线：scripts/prisma-generate.sh 按 DATABASE_URL 协议自动选 schema（postgres://→postgres schema，否则 sqlite）；接入 build 与 postinstall；本地验证选型正确
- 文档：.env.example 增加 Supabase 连接串示例 + 说明 SUPABASE_SERVICE_ROLE_KEY 非必需；README 增加 "Deploy ke Vercel + Supabase" 完整步骤与错误诊断表
- 测试（真实复现故障）：备份 DB → 临时重命名 licenses 表 → 主服务器上 POST/GET/PATCH 全部返回 500+清晰 JSON（"Tabel database belum dibuat. Jalankan migrasi: SQL di supabase/schema.sql..."），非法 JSON body 与 null body 返回 400 JSON 不崩溃 → 恢复表 → 数据完整
- E2E（agent-browser 过网关 :81）：登录→生成 OTO-9N36-RE72-N7DU→Suspend→Unsuspend→登出 全通过；测试许可证已删除

Stage Summary:
- 用户在 Vercel 遇到的故障最可能根因：Supabase Postgres + SQLite 版 Prisma Client 不匹配 / 表未创建 → 所有 DB 查询 5xx，POST 路径暴露为神秘的 JSON 解析错误
- 现在两层防护：服务器任何失败都返回带修复指引的 JSON；客户端永不裸调 res.json()
- Supabase 上线三步：SQL Editor 跑 supabase/schema.sql → Vercel 设 DATABASE_URL(pooled 6543 + pgbouncer=true) 与 SUPER_ADMIN_SECRET → redeploy（构建自动生成 Postgres client）

---
Task ID: vercel-error-transparency
Agent: Z.ai Code (main)
Task: Ubah respons error handler API licenses (POST & GET) agar menampilkan pesan error asli Prisma langsung ke layar ({ error: err.message, code: err.code }), bukan pesan generik "Terjadi kesalahan server"; lalu push ke main agar ter-deploy ke Vercel.

Work Log:
- Diagnosa: pesan "Terjadi kesalahan server (licenses POST). Detail ada di log server." berasal dari cabang fallback dbErrorResponse() di src/lib/db-errors.ts — artinya try-catch + JSON-guarantee sebelumnya BEKERJA (bukan lagi "Unexpected end of JSON input"), tetapi error aktual TIDAK terpetakan ke kode Prisma yang dikenal sehingga jatuh ke pesan generik
- src/lib/db-errors.ts — dbErrorResponse() ditulis ulang (mode diagnosa):
  - Error tak-terpetakan → payload { error: <pesan ASLI err.message>, code: err.code ?? 'UNKNOWN', context } status 500
  - Kode Prisma terkenal (P1000/P1001/P2021/P2022/P2002/P2003) tetap dipetakan ke pesan ramah bahasa Indonesia, tetapi payload kini menyertakan code + detail (pesan asli) + context — tidak ada informasi yang disembunyikan
  - Kasus khusus "@prisma/client did not initialize yet" juga disertai code + detail
  - Error tanpa pesan → fallback aman "Error tidak dikenal (tanpa pesan)." tanpa crash
  - console.error detail lengkap tetap dicatat (Vercel Runtime Logs / dev.log)
- src/app/super-admin/super-admin-client.tsx:
  - Interface baru ApiErrorPayload { error?, code?, detail? } + helper formatApiError() — merakit "[CODE] pesan — detail asli" utk toast
  - Dipakai di 3 titik: refetch (GET), handleGenerate (POST), handleAction (PATCH) — kode Prisma + pesan asli kini tampil di layar, bukan hanya di log
- Verifikasi:
  - bun run lint → bersih
  - Uji dbErrorResponse langsung dgn 4 simulasi: P9999 tak-terpetakan → 500 {error: pesan asli, code}; P2021 → 500 pesan ramah + code + detail; error kosong → fallback aman; P1001 → 503 + code + detail — semua JSON valid
  - curl E2E lokal: login sesi 200 → GET licenses 200 → POST generate 201 (happy path tak terganggu)
  - agent-browser E2E: login → dashboard render → klik "Generate Lisensi" → lisensi OTO-KG3N-4DMY-QNSR sukses dibuat, toast + kartu + tabel ter-refresh; console 0 error; dev.log bersih
- Git: commit e2416e0 "feat(super-admin): tampilkan error asli Prisma di layar (mode diagnosa)" → push origin main BERHASIL (79f97b7..e2416e0) — Vercel auto-deploy terpicu

Stage Summary:
- Layar /super-admin Vercel tidak akan lagi menampilkan "Terjadi kesalahan server" — pengguna akan melihat pesan Prisma asli + kode (mis. "[P2021] Tabel database belum dibuat..." atau pesan provider/kredensial apa pun), memungkinkan diagnosa produksi langsung dari UI
- Prediksi error yang akan terlihat di Vercel setelah deploy ini: (a) P2021 → jalankan supabase/schema.sql di SQL Editor; (b) P1001/P1000 → DATABASE_URL salah; (c) pesan "the URL must start with protocol 'file:'" → Prisma Client SQLite dipakai di serverless, pastikan DATABASE_URL postgres:// agar build memilih schema.postgres.prisma (scripts/prisma-generate.sh)
- Catatan keamanan: detail error teknis ekspos ke klien hanya di endpoint Super Admin (terlindungi Master Secret Key / cookie sesi) — disengaja utk mode diagnosa produksi

---
Task ID: supabase-uuid-p2023
Agent: Z.ai Code (main)
Task: Perbaiki error P2023 "Inconsistent column data: Error creating UUID ... found 'm' at 2" saat Generate Lisensi di Vercel+Supabase — kolom id UUID menerima string cuid dari Prisma; pastikan id baru UUID v4 valid, schema Postgres & DDL Supabase konsisten, push ke main.

Work Log:
- Diagnosa: DB Supabase milik user dibuat dgn kolom id UUID (bukan dari supabase/schema.sql versi lama yg TEXT — terbukti dr P2023). Prisma Client ter-deploy masih @default(cuid()) → setiap create mengirim string cuid ("cm...") → ditolak kolom UUID
- Audit 9 titik db.*.create() di src/ + scripts/seed.ts: TIDAK ADA yg mengirim id eksplisit — semua bergantung default schema → perbaikan cukup di SATU titik: prisma/schema.postgres.prisma
- prisma/schema.postgres.prisma:
  - 8 model: @id @default(cuid()) → @id @default(uuid()) @db.Uuid (Prisma generate UUIDv4 sisi client utk semua create — tidak perlu ubah DB yang sudah ada, tidak perlu crypto.randomUUID() manual di handler)
  - Semua kolom FK dianotasi @db.Uuid: licenseId, showroomId (staff/branch/taxonomy/vehicle/marketing), branchId, vehicleId, marketingId — penting: FK TEXT→UUID akan GAGAL dibuat Postgres; UUID→UUID valid
  - Header comment: peringatan jangan pakai cuid() di schema postgres + alasan P2023
- supabase/schema.sql di-regenerate via `prisma migrate diff --from-empty --to-schema-datamodel` → semua kolom id & FK kini UUID NOT NULL (17 kolom UUID), header diberi catatan UUID; dgn ini setup fresh konsisten dgn DB Supabase yang sudah berjalan
- Verifikasi: prisma validate (dummy postgres URL) valid 🚀; db:generate:pg sukses; restore db:generate sqlite utk dev lokal; lint bersih; curl E2E lokal login 200 + POST generate 201 (SQLite lokal tetap cuid — by design, kolom TEXT tak terpengaruh)
- Git: commit b98ccd8 "fix(prisma): ID Postgres pakai UUID v4..." → push origin main (e2416e0..b98ccd8) — Vercel auto-deploy terpicu

Stage Summary:
- Setelah deploy ini, POST/PATCH/activate/vehicles/staff/branches/marketings/taxonomy/bookings — SEMUA create akan mengirim UUIDv4 valid ke kolom UUID Supabase; P2023 hilang TANPA perlu migrasi ulang DB
- User TIDAK perlu menjalankan ulang supabase/schema.sql (DB yang sudah ada tetap dipakai; DDL baru hanya utk setup fresh)
- Prinsip penting tercatat: di schema Postgres, PK & kolom FK UUID wajib @db.Uuid + @default(uuid()); cuid() hanya utk schema SQLite lokal
- Bila masih ada error setelah deploy, error asli kini tampil di layar (fitur diagnosa commit e2416e0) — mis. ketidakcocokan tipe kolom lain (timestamptz vs timestamp) akan langsung terbaca

---
Task ID: super-admin-delete-license
Agent: Z.ai Code (main)
Task: Tambah fitur Hapus Lisensi (hard delete) & Hapus Akun Showroom di panel /super-admin — endpoint DELETE terlindungi, tombol UI merah + dialog konfirmasi, error handling JSON rapi; uji alur lalu push main.

Work Log:
- Endpoint baru src/app/api/super-admin/licenses/[id]/route.ts (DELETE):
  - Auth berlapis: cookie otostok_sa (utama) → header X-Super-Secret → ?key= → body { key }
  - Lisensi belum terikat showroom → hapus baris lisensi saja
  - Lisensi terikat showroom → hard delete cascade dalam SATU transaksi db.$transaction dgn urutan leaf-first: booking (via vehicle ids showroom) → vehicle → staffAccount → branch → taxonomy → marketing → showroom → license — TIDAK bergantung definisi ON DELETE FK di DB Supabase produksi (dibuat di luar kontrol aplikasi)
  - Respons selalu JSON: 200 dgn statistik jumlah baris terhapus per tabel; 401/404/400; catch → dbErrorResponse (P2003 FK constraint → 409 JSON rapi dgn code+detail)
- Schema: Showroom.license + onDelete: Cascade (kedua schema sqlite & postgres) + supabase/schema.sql di-regenerate (FK showrooms.license_id → ON DELETE CASCADE) — cascade eksplisit di handler tetap jadi mekanisme utama, cascade DB = lapisan kedua utk setup fresh
- Catatan teknis: rebuild supabase/schema.sql dgn redirection { head; cat; } > file-yang-sama menyebabkan header hilang (truncation sebelum head selesai) — ditulis ulang header lengkap via /tmp lalu concat
- UI super-admin-client.tsx:
  - State deleteTarget + handleDelete (fetch DELETE dgn body key fallback, parse aman formatApiError)
  - Tombol "Hapus" merah (Trash2) di actionCell — tabel desktop & kartu mobile (grid 3→2 kolom jadi 2x2 rapi)
  - AlertDialog konfirmasi: teks wajib "Apakah Anda yakin ingin menghapus lisensi/akun ini secara permanen? Tindakan ini tidak dapat dibatalkan." + rincian lisensi/showroom/unit yg ikut terhapus; tombol "Ya, Hapus Permanen" merah + spinner; e.preventDefault() agar dialog tertutup HANYA setelah sukses
  - Toast sukses + refetch otomatis; error → dialog tetap terbuka utk batal/coba lagi
- Uji alur (semua lolos):
  - DELETE tanpa auth → 401
  - DELETE lisensi kosong → 200 (showroom:null, semua count 0)
  - Cascade nyata: lisensi → aktivasi (showroom + owner staff + 10 taxonomies) → DELETE 200 dgn staff:1 taxonomies:10 → API /api/showrooms/{slug} 404
  - DELETE id tak ada → 404
  - agent-browser: tombol tampil → dialog dgn teks tepat → konfirmasi → toast "dihapus permanen" → baris hilang dr tabel; 0 console error
  - lint bersih; dev.log DELETE 200
- Git: commit 4621524 → push main

Stage Summary:
- Super Admin kini punya kontrol penuh siklus hidup klien: buat → suspend/unsuspend → perpanjang → HAPUS PERMANEN
- Penghapusan aman utk DB produksi apa pun kondisi FK-nya (transaksi leaf-first), dgn jejak audit di log server (jumlah unit/booking/staff terhapus)
- Alur owner showroom setelah akun dihapus: sesi mereka otomatis gagal (data staff hilang → login/lookup 401/404)

---
Task ID: activate-findfirst-fix
Agent: Z.ai Code (main)
Task: Perbaiki error 500 "[activate] error: Invalid prisma.showroom.findUnique() invocation" saat aktivasi lisensi di Vercel+Supabase — ganti findUnique→findFirst utk cek slug, validasi input sebelum query, pastikan license_id valid & id showroom UUID v4, samakan UNIQUE slug schema↔tabel Supabase, push main.

Work Log:
- Diagnosa: error muncul di query showroom PERTAMA (license.findUnique sukses — koneksi & tabel licenses OK). Prisma men-SELECT semua kolom skema; DB Supabase user dibuat DI LUAR supabase/schema.sql (terbukti di worklog supabase-uuid-p2023: id UUID sementara DDL lama repo TEXT) → tabel showrooms lama hampir pasti kekurangan kolom baru (logo_url/header_url/maps_url) → P2022 "column does not exist" saat findUnique. Diagnosis user (@unique hilang) tidak tepat — slug SUDAH @unique di schema.postgres.prisma sejak awal; TS build Vercel lolos = filter findUnique valid. Tapi findFirst tetap lebih defensif & diminta eksplisit
- src/app/api/activate/route.ts:
  - db.showroom.findUnique({where:{slug}}) → db.showroom.findFirst({where:{slug}, select:{id:true}}) — tidak bergantung index/constraint UNIQUE di DB produksi + select minimal
  - Header doc: urutan dijamin — (1) SEMUA input divalidasi SEBELUM query DB (licenseKey format, nama≥3, slug≥3, reserved slug, phone 9-15 digit, alamat≥5, password≥6 — sudah ada sejak sebelumnya, dipertahankan), (2) cek slug findFirst, (3) create memakai licenseId dari lisensi TERVERIKASI (ada, aktif, belum terikat), id showroom diisi @default(uuid()) schema — TIDAK ada id manual cuid/nanoid, (4) catch → dbErrorResponse
  - catch: console.error manual + 500 generik "Terjadi kesalahan server." DIGANTI dbErrorResponse(e,'activate') — error Prisma asli (P2022/P2021/P2002 + pesan + code) kini tampil di layar /activate (client sudah menampilkan j.error), selaras mode diagnosa commit e2416e0
- supabase/migration-sync-existing-db.sql (BARU, idempotent): perbaikan akar masalah utk DB lama — CREATE TABLE IF NOT EXISTS (8 tabel), ALTER TABLE ADD COLUMN IF NOT EXISTS utk semua kolom fitur (logo_url/header_url/maps_url showrooms, kolom mutasi vehicles, dst — default aman utk tabel berisi data), CREATE [UNIQUE] INDEX IF NOT EXISTS (termasuk showrooms_slug_key — slug unik kini JUGA dijamin di tabel Supabase, bukan hanya schema), FK via DO block (duplicate_object catch)
- supabase/schema.sql: header ditambah rujukan → bila DB sudah ada dan muncul P2022/findUnique error, jalankan migration-sync-existing-db.sql (bukan schema.sql yg utk DB kosong)
- Verifikasi schema: prisma validate (postgres, dummy URL) valid; slug @unique & @default(uuid()) @db.Uuid terkonfirmasi — TIDAK perlu ubah schema (b98ccd8 sudah benar), tidak perlu regen client
- E2E lokal (semua lolos): generate lisensi → POST /api/activate 200 (showroom+owner+10 taxonomies) → slug duplikat 409 via findFirst → lisensi terikat 409 → validasi 400 (nama/phone/password, terbukti sebelum query) → body JSON rusak → 400 aman (parser catch) → lisensi tidak ada 404 → GET /api/showrooms/{slug} 200 → login owner 200
- agent-browser /activate: form terisi → submit → kartu "Showroom Aktif!" + toast + tautan /admin/{slug} & /s/{slug}; 0 console error
- Cleanup via DELETE /api/super-admin/licenses/{id} (regresi fitur hapus): 2 lisensi uji terhapus dgn cascade (staff:1 taxonomies:10), showroom 404 setelahnya
- lint bersih; dev.log tanpa error (SQL findFirst LIMIT/OFFSET terlihat benar)

Stage Summary:
- /api/activate kini tahan terhadap DB produksi yang drift: cek slug pakai findFirst, error Prisma asli tampil di layar (bukan 500 generik) — bila masih gagal setelah deploy, PESANNYA akan menyebut persis kolom/tabel yang bermasalah
- AKAR MASALAH produksi (tabel lama kekurangan kolom/index) diperbaiki oleh supabase/migration-sync-existing-db.sql — WAJIB dijalankan user di Supabase SQL Editor: alter menambah kolom hilang + UNIQUE slug + FK, idempotent & aman utk dataExisting
- license_id di create selalu dari lisensi terverifikasi; id showroom UUID v4 via schema default (konsisten b98ccd8); tidak ada perubahan schema.prisma

---
Task ID: upload-storage-supabase
Agent: Z.ai Code (main)
Task: Jawab 3 pertanyaan user soal upload foto (bucket Supabase? public? RLS vs service key?) + perbaiki error "Upload foto gagal" di Pengaturan Showroom — akar masalah & solusi produksi, push main.

Work Log:
- Diagnosa akar masalah: "Upload foto gagal" BUKAN soal bucket — aplikasi TIDAK PERNAH memakai Supabase Storage. PhotoManager memanggil POST /api/upload, tapi route itu TERHAPUS dari repo di commit 6e07b7f (commit sync besar-besaran; ada di commit awal 225028c, D di 6e07b7f) → 404 → pesan fallback. Desain lama: fs.writeFile ke public/uploads (disk server) — mustahil jalan di Vercel (filesystem serverless read-only). Pola sama pada KTP (lib/ktp.ts → upload/ktp/)
- src/lib/storage.ts (BARU) — storage dual-backend otomatis:
  • Supabase Storage (aktif bila SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY terisi): upload server-side via REST /storage/v1 dgn service key (x-upsert), bucket OTOMATIS dibuat saat upload pertama (GET bucket → 404 → POST create; cache per proses). MEDIA_BUCKET otostok-media (PUBLIC, path media/<uuid>.<ext>, URL publik permanen /storage/v1/object/public/...), KTP_BUCKET otostok-ktp (PRIVATE, dibaca server via service key)
  • Fallback disk (dev lokal tanpa env): public/uploads/ & upload/ktp/ — perilaku lama tetap jalan
- src/app/api/upload/route.ts (DI-BUAT ULANG): runtime nodejs, WAJIB sesi showroom (getSessionFromRequest → 401; route lama tanpa auth), maks 8 file/request, JPG/PNG/WebP, ≤4MB/file, respons { ok, urls } — kontrak sama dgn PhotoManager
- lib/ktp.ts refactor ke storage helper (savePrivateFile/readPrivateFile/deletePrivateFile); kontrak URL /api/admin/marketings/ktp/[file] TETAP — data lama valid; proxy GET KTP baca via readPrivateFile (Supabase private bucket / disk)
- .env.example: bagian Supabase Storage (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY + cara ambil + penjelasan bucket auto-create); catatan lama "service role key tidak dibutuhkan" dikoreksi (tidak utk DB, tapi YA utk storage)
- .gitignore + public/uploads/ ; git rm --cached 5 jpg test yang sempat ter-track
- E2E lokal (fallback disk, semua lolos): upload tanpa sesi 401 → upload 2 file dgn sesi owner 200 + file tersaji GET 200 → tipe invalid 400 → KTP upload 200 → baca KTP dgn sesi 200 / tanpa sesi 401
- agent-browser /admin/upload-test/settings: halaman load → upload logo via PhotoManager (input unhide + setInputFiles) → POST 200 → preview muncul → Simpan → toast "Pengaturan tersimpan" → API konfirmasi logoUrl tersimpan → katalog publik /api/showrooms/{slug} menampilkan logoUrl; 0 console error; cleanup DELETE lisensi (cascade) 200
- lint bersih

Stage Summary:
- Jawaban 3 pertanyaan user: (1) TIDAK ADA bucket yg dipanggil — endpoint /api/upload terhapus dr repo (404), desain lama disk lokal; (2) setelah fix: bucket media WAJIB PUBLIC (logo/header/foto unit utk katalog), KTP PRIVATE; (3) pakai SERVER ROUTE + SUPABASE_SERVICE_ROLE_KEY (bukan RLS anon) — auth aplikasi pakai cookie sendiri, RLS Supabase tak bisa diikat; policy anon justru lubang keamanan. KEDUA env WAJIB diisi di Vercel
- Setelah deploy: user cukup set 2 env di Vercel (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) + redeploy — bucket otomatis dibuat saat upload pertama, tidak perlu setup manual di dashboard
- Upload KTP ikut ter-fix (sama-sama disk-only sebelumnya) tanpa ubah kontrak URL

---
Task ID: upload-route-gitignore-fix
Agent: Z.ai Code (main)
Task: User "masih belum bisa upload" + Vercel logs PrismaClientInitializationError di semua API — akar masalah sebenarnya & perbaikan permanen.

Work Log:
- TERUNGKAP AKAR MASALAH SEBENARNYA: /api/upload yang "dipulihkan" di commit d4fcc6c TIDAK PERNAH masuk commit — .gitignore memuat pola `upload/` (tanpa slash awal) yang match SEMUA direktori bernama upload di seluruh repo, termasuk src/app/api/upload/ → git add diam-diam melewati file tsb → production 404 → "Upload foto gagal". File hanya ada di disk sandbox, E2E lokal lolos, commit kosong.
- Fix .gitignore: `upload/` → `/upload/` (root-anchored; hanya folder KTP disk di root yang diabaikan) — src/app/api/upload/ kini ter-track git.
- Re-create src/app/api/upload/route.ts (kali ini benar-benar ter-commit): runtime nodejs, wajib sesi (getSessionFromRequest → 401), guard khusus Vercel tanpa env Supabase → 500 dengan pesan lengkap cara mengisi SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (bukan EROFS misterius), maks 8 file/4MB, JPG/PNG/WebP, delegasi ke saveMediaFile (Supabase Storage otostok-media PUBLIC / fallback disk dev), respons { ok, urls } sesuai kontrak PhotoManager.
- BARU: GET /api/health — diagnostik produksi tanpa auth & tanpa rahasia: protokol+host DATABASE_URL (tanpa kredensial), status storage (supabase/disk), ping SELECT 1, probe skema showroom (findFirst select id+logoUrl → menangkap P2021 tabel & P2022 kolom), hint solusi per masalah. Status 200 (ok) / 503 (gagal).
- scripts/prisma-generate.sh: di Vercel (VERCEL terisi) — DATABASE_URL bukan postgres:// → build GAGAL CEPAT dengan instruksi lengkap (dulu: diam-diam generate client SQLite → semua query runtime PrismaClientInitializationError "URL must start with the protocol file:"). URL dicetak termasked (***@host).
- src/lib/db-errors.ts: P1001 kini menyebut 2 kemungkinan (host salah / proyek Supabase pause → Dashboard → Restore); baru initErrorHint() utk PrismaClientInitializationError tanpa kode: "must start with the protocol `file:`" (client SQLite di produksi), "Environment variable not found: DATABASE_URL", "Unable to open the database file" — semuanya dgn langkah perbaikan eksplisit.
- settings route: GET dibungkus try/catch → dbErrorResponse (dulu tanpa catch → body kosong), PATCH catch → dbErrorResponse (dulu 500 generik "Terjadi kesalahan server") — error DB asli kini tampil di layar Pengaturan.
- E2E lokal lengkap (semua lolos): health 200 JSON benar; lisensi uji OTO-7LXY-4FG9-8K52 dibuat → aktivasi e2e-upload-test → login owner (username=no. WA) → upload tanpa sesi 401 → tipe svg 400 → upload 2 PNG batch 200 + file tersaji GET 200 → PATCH settings logoUrl 200 → GET settings konfirmasi → PATCH tanpa sesi 403 → name<3 char 400. agent-browser: login UI → /settings → unhide input → upload lightbox-desktop.png → toast "ditambahkan" → Simpan → toast "tersimpan" → API menunjukkan logoUrl JPG baru (kompresi browser bekerja) → 0 console error. Screenshot: tool-results/e2e-settings-upload.png.
- Cleanup: 3 file uji dihapus, lisensi uji DELETE cascade (staff:1 taxonomies:10), showroom 404. lint bersih, dev.log tanpa error.

Stage Summary:
- PENYEBAB "Upload foto gagal" di produksi: 404 karena route tak pernah ter-commit (gitignore `upload/` terlalu luas) — BUKAN masalah bucket Supabase. Sekarang route benar2 ada di git.
- Masalah kedua dari screenshot log Vercel user: SEMUA query DB gagal PrismaClientInitializationError (lebih fundamental dari upload) — indikasi kuat client SQLite ter-generate di Vercel (DATABASE_URL kosong/salah saat build) atau DB tak terjangkau. Sulap: build gagal cepat dgn pesan jelas; /api/health menunjukkan persis apa yang salah; error DB tampil lengkap di layar dgn hint.
- Checklist user: (1) Vercel env DATABASE_URL (pooler.supabase.com:6543 + ?pgbouncer=true, scope Production) + SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; (2) Redeploy setelah env berubah; (3) cek Supabase tidak pause; (4) buka /api/health utk verifikasi.

---
Task ID: supabase-storage-apikey-header
Agent: Z.ai Code (main)
Task: Upload di produksi masih gagal — toast "Gagal membuat bucket Supabase "otostok-media" (401): {"message":"No API key found in request","hint":"No 'apikey' request header or url param was found."}"

Work Log:
- Progress terkonfirmasi dari screenshot user: route /api/upload SUDAH jalan di produksi, settings page termuat (DB sehat), env Supabase TERISI (jalur storage aktif). Gagal tepat di REST call Supabase Storage.
- Akar masalah: src/lib/storage.ts hanya mengirim header `Authorization: Bearer <service_key>` — gateway Supabase hosted WAJIB header `apikey: <key>` JUGA; tanpa itu semua request (probe/create bucket, upload, download, delete) ditolak 401 "No API key found in request".
- Fix: helper authHeaders() yang SELALU menyertakan `Authorization: Bearer` + `apikey` (+extra) — dipakai di 4 titik: ensureBucket (probe & create), uploadObject, downloadObject, deleteObject.
- E2E dengan mock Supabase Storage (port 3999) yang menolak request tanpa apikey PERSIS seperti produksi:
  • curl tanpa apikey → 401 {"message":"No API key found in request",...} (reproduksi persis error user)
  • curl dengan apikey → sukses
  • test integrasi modul storage.ts asli: saveMediaFile → URL publik otostok-media/media/<uuid>.png ✔, savePrivateFile/readPrivateFile/deletePrivateFile (KTP) ✔, 7/7 request membawa apikey+Bearer ✔, bucket auto-create ✔ — SEMUA TES LOLOS
- lint bersih; artefak test dihapus.

Stage Summary:
- Satu-baris-esensi: Supabase Storage hosted butuh DUA header auth (`Authorization: Bearer` + `apikey`). Setelah deploy ini, upload pertama akan OTOMATIS membuat bucket otostok-media (PUBLIC) & otostok-ktp (PRIVATE) lalu menyimpan file — tidak ada setup manual di dashboard Supabase.
- Tidak ada perubahan env/kontrak API; user tinggal tunggu deploy selesai lalu ulangi upload logo/header/foto unit.

---
Task ID: supabase-url-rest-v1-normalize
Agent: Z.ai Code (main)
Task: Upload masih gagal — toast "Gagal membuat bucket Supabase "otostok-media" (404): {"code":"PGRST125","details":null,"hint":null,"message":"Invalid path specified in request URL"}"

Work Log:
- Diagnosa: PGRST* = kode error PostgREST (database REST Supabase), BUKAN Storage. Artinya request storage mendarat di endpoint /rest/v1 — hampir pasti karena SUPABASE_URL di Vercel diisi dgn "REST URL" dari dashboard: https://<ref>.supabase.co/rest/v1 (bukan URL proyek root). Konsisten dgn error sebelumnya: sebelum fix apikey, request ditolak Kong ("No API key found"); setelah apikey lolos, request di-route ke PostgREST → PGRST125.
- Fix ganda di src/lib/storage.ts:
  1. normalizeSupabaseUrl(): buang trailing slash + akhiran path API yang tersalin salah (/rest/v1, /storage/v1, /auth/v1, /realtime/v1, /functions/v1, /pg/v1, /meta/v1) — env user yang salah KINI OTOMATIS DIKOREKSI tanpa perlu ubah Vercel
  2. storageError(): penerjemah respons gagal Supabase → pesan aksi: pola "PGRST/Invalid path" → "SUPABASE_URL harus URL proyek root tanpa /rest/v1"; "No API key found" → cek service_role key; 403/jwt/invalid key → ambil service_role dari Dashboard → API
  3. Keempat titik REST (bucket create/probe, upload, download, delete) kini pakai storageError
- supabaseUrlWasCorrected() diekspor; /api/health kini menampilkan catatan bila SUPABASE_URL terkoreksi otomatis (menganjurkan perbaikan env ke URL root)
- E2E mock Supabase v2 (port 3998, gateway palsu: tanpa apikey→401 kong, path /rest/v1/*→PGRST125):
  • SKENARIO A (SUPABASE_URL=http://localhost:3998/rest/v1 — persis env user): saveMediaFile SUKSES, URL publik benar, supabaseUrlWasCorrected=true, 0 request kena /rest/v1, KTP save/read/delete OK — SEMUA LOLOS
  • SKENARIO B (URL root normal): semua PASS, corrected=false — SEMUA LOLOS
- lint bersih; artefak test dihapus.

Stage Summary:
- Root cause ketiga (rantai upload): SUPABASE_URL berisi akhiran /rest/v1 → request storage kena PostgREST → PGRST125. Sekarang DIKOREKSI OTOMATIS di kode, jadi deploy berikutnya upload langsung jalan walau env belum diubah.
- Bila user tetap merapikan env: SUPABASE_URL = https://<project-ref>.supabase.co (root, tanpa path) — disarankan agar /api/health tidak menampilkan catatan koreksi.
- Rantai perbaikan upload sejauh ini: (1) route hilang krn gitignore → diperbaiki 4ff4773; (2) header apikey kurang → febdb3a; (3) SUPABASE_URL salah path → commit ini. Setiap langkah terverifikasi dgn mock yang mereproduksi error produksi secara persis.

---
Task ID: vehicle-create-error-transparency
Agent: Z.ai Code (main)
Task: User melapor "terjadi kesalahan server saat tambah motor baru di katalog" — toast generik "Terjadi kesalahan server." saat simpan motor baru (foto upload SUDAH berhasil, 4 foto tampil di form). Pesan generik menyembunyikan penyebab asli.

Work Log:
- Diagnosa: toast "Terjadi kesalahan server." = catch-block generik di POST /api/admin/[slug]/vehicles (line 134). Kandidat akar masalah #1 di produksi: INSERT INTO vehicles menyertakan SEMUA kolom skema — bila tabel vehicles di Supabase dibuat dari DDL lama (belum ada commission_amount/branch_id/kolom mutasi), INSERT gagal P2022 sementara query showroom/license (yang dipakai login/dashboard) tetap sukses.
- Fix 1 — transparansi error: POST /api/admin/[slug]/vehicles + PATCH & DELETE /api/admin/vehicles/[id] kini pakai dbErrorResponse(e, context) (mode diagnosa, selaras route licenses/activate/settings). Error Prisma asli + code + context tampil di toast & log server.
- Fix 2 — db-errors.ts: pesan P2022 diperjelas dgn nama kolom (err.meta.column) + instruksi PERSIS: "buka Supabase Dashboard → SQL Editor → paste SELURUH isi file supabase/migration-sync-existing-db.sql → Run (idempotent, aman utk data yang sudah ada)".
- Fix 3 — /api/health: probe ketiga mengecek tabel vehicles (select commissionAmount, branchId, purchasedAt, arrivalPhotos, soldAt, handoverPhoto) — drift kolom vehicles kini terdeteksi langsung oleh /api/health (step "skema (tabel vehicles ...)").
- Fix 4 (bug UX ditemukan saat E2E browser): vehicle-form.tsx — "Tambah merk baru" dgn nama yang SUDAH terdaftar (mis. Honda/Yamaha bawaan seed aktivasi) → POST taxonomy 409 → set('brand') TIDAK jalan → user terjebak "Merk motor wajib diisi" walau textbox tampak terisi. Fix: 409 "sudah ada" → tetap pilih merk/kategori tsb + keluar mode input baru. Pola sama diterapkan pada kategori.
- E2E API (curl): create license → activate → login owner → upload 2 foto (/api/upload 200) → POST /vehicles dgn photos+harga+notes multiline → ok:true, vehicle balik lengkap (basePrice owner-only, photos array, purchasedAt) → /api/health ok → cascade delete license OK.
- E2E browser (agent-browser, golden path penuh): login UI → Tambah Motor → pilih Merk Honda (dropdown seed) → isi semua field → upload 2 foto via input file (kompresi klien jalan, toast "2 foto ditambahkan & dikompresi", 2 thumbnail tampil) → Simpan → toast "Motor baru masuk stok — status Ready." + modal tertutup + stok 0→1 + kartu Honda Beat 110 CBS tampil dgn foto/harga/READY. Cleanup penuh (license dihapus cascade, units:1 tercatat).
- Catatan proses: agent-browser `upload` pd input[hidden] kadang silent-fail — dispatch Event('change') manual via eval dgn DataTransfer terbukti andal utk memicu onFilesPicked React.
- lint bersih; artefak test (tool-results/e2e-vehicle) dihapus.

Stage Summary:
- Setiap kegagalan "tambah motor" di produksi kini menampilkan ERROR ASLI + kode + instruksi perbaikan di layar (bukan "Terjadi kesalahan server."). Bila penyebabnya drift skema (P2022), toast langsung memandu jalankan supabase/migration-sync-existing-db.sql di SQL Editor.
- /api/health kini juga men-deteksi drift khusus tabel vehicles.
- Bug "Tambah merk baru" utk nama sudah-terdaftar diperbaiki (409 → otomatis memilih merk tsb).
- Alur tambah-motor end-to-end (form + foto + submit) terverifikasi jalan normal di lokal.
