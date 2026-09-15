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
