# TillPayDay

> **Satu angka tiap hari: hari ini masih aman belanja berapa sampai gajian.**

App keuangan pribadi yang kamu pasang di server sendiri. Satu orang atau satu pasangan mencatat pemasukan,
pengeluaran, transfer, tabungan, hutang, dan investasi, dan beranda menjawab satu pertanyaan: hari ini masih aman
belanja berapa.

`TillPayDay` adalah nama kerja; ganti lewat `APP_NAME`.

English: [README.md](README.md)

<p align="center">
  <img src="docs/illustrations/readme-hero.png" alt="TillPayDay di HP dan di desktop" width="880">
</p>

## Kucing bloat menyapa 🐈

<p align="center">
  <img src="docs/illustrations/blotcat-lean.png" alt="Blotcat menimbang fitur di neraca dan memotong yang berat" width="760">
</p>

```
   /\_/\     selamat datang di
  ( o.o )    zona bloat
   > ^ <     ~~~~~~~~~~
```

Di suatu tempat di dalam anggaran, di antara pos kopi dan dana darurat, tinggal seekor kucing kecil. Dia tidak
bayar sewa. Dia tidak mengurus pajakmu. Dia cuma duduk di atas spreadsheet dan menilai tumpukan langgananmu.

App ini sengaja dibuat ringkas: tanpa Redis, tanpa kebun microservice, tanpa telemetri yang menelepon pulang,
tanpa dashboard 40 megabita untuk menampilkan satu angka. Kucing bloat tetap diundang. Dia punya pendapat soal
langganan streaming ketigamu, dan sebenarnya dia benar.

Kalau kamu suka software yang mengerjakan satu hal dengan baik, kucing bloat ada di pihakmu. Kalau kamu suka
software yang butuh klaster Kubernetes cuma untuk membuka buku kas, kucing bloat juga masih di pihakmu, cuma dia
sedikit menertawakan.

**Tiga aturan kucing bloat:**
1. Kalau sesuatu tidak menghasilkan, membelanjakan, menabung, atau memindahkan uang, ia tidak masuk jalur kritis.
2. Tiap fitur harus lulus satu pertanyaan jujur: *"apa pemiliknya benar-benar akan membuka ini hari Selasa?"*
3. Tidur dulu. Optimasi nanti.

## Fitur

<p align="center">
  <img src="docs/illustrations/blotcat-payday.png" alt="Blotcat menuang uang gajian ke cangkir-cangkir kecil yang sama, cangkir hari ini yang menyala" width="760">
</p>

- **Satu bar input.** Ketik `kopi 25k gopay`, kirim foto struk, atau bagikan screenshot. Pola sederhana dibaca
  server tanpa AI. Yang lebih rumit dikirim ke model yang kamu setel. Kartu konfirmasi selalu muncul dulu, dan
  kode (bukan model) yang menyimpan dan menghitung.
- **Aman dibelanjakan hari ini.** Periode mengikuti tanggal gajian, bukan tanggal 1. Gaji dikurangi tabungan goal
  dan tagihan tetap menjadi dana belanja, dibagi ke hari yang tersisa. Hemat hari ini, jatah besok bertambah.
- **Akun dengan saldo sendiri**: rekening, e-wallet, tunai, kartu kredit, paylater, pinjaman, hutang dan piutang ke
  orang, akun investasi. Pindah uang antar akun adalah transfer, bukan pengeluaran.
- Kartu kredit dan cicilan, patungan, pinjaman dengan pokok dan bunga, cek saldo yang menyarankan biaya admin atau
  bunga, transaksi rutin dan tagihan, budget dengan saran, goal di atas akun tabungan, dana darurat dalam bulan.
- Investasi apa saja (jenis aset adalah data): harga beli rata-rata, untung atau rugi terealisasi dan belum,
  dipecah antara harga dan kurs untuk aset valas.
- Multi mata uang dengan satu mata uang dasar; angka historis memakai kurs hari itu.
- Import mutasi (CSV lewat pemetaan kolom, PDF lewat model) dengan pencocokan duplikat dan penggabungan transfer.
- Dashboard, proyeksi saldo, simulasi, rekap mingguan, notifikasi, deteksi langganan, daftar akhir tahun, ekspor
  dan impor kembali semua data.
- PWA yang bisa dipasang: antrean offline, Share di Android, endpoint untuk Shortcut iPhone, Web Push.
- Mode berdua: undang pasangan; akun pribadi dan akun bersama.
- Berjalan penuh tanpa AI. Bahasa Indonesia dan Inggris.

## Stack

Next.js (App Router, TypeScript strict), PostgreSQL dengan migrasi Prisma, Zod di tiap batas, worker pg-boss
(tanpa Redis), passkey (WebAuthn) dengan password + TOTP sebagai cadangan, next-intl, Tailwind CSS, Vitest dan
Playwright. Uang disimpan dalam satuan minor bilangan bulat; unit dan kurs memakai aritmetika desimal.

## Merek

Logonya lima batang sama tinggi dengan batang tengah disorot: uang dibagi rata per hari, batang terang adalah
hari ini. SVG di `public/logo.svg` (dan `public/logo-small.svg`, tiga batang, untuk 24 px ke bawah) adalah sumber
tunggalnya. Semua aset raster dibuat dari situ, jadi mereknya bisa dibuat ulang saat aksen berubah:

```sh
npm run gen:icons     # logo.svg + logo-small.svg -> favicon, ikon PWA, apple-touch-icon
npm run check:logo    # kontras batang redup terhadap batang terang di tiap latar asli
```

Ikon app mengikuti warna aksen yang dipilih pemakai di dalam app; ikon PWA yang terpasang memakai aksen bawaan.
Lihat [DESIGN.md](DESIGN.md) untuk palet dan skala tipografi.

## Pasang cepat dengan Docker Compose

Perlu Docker dengan plugin Compose dan reverse proxy yang menangani HTTPS (contoh di `docs/deploy/`).

```sh
git clone <repositori ini> tillpayday
cd tillpayday
docker run --rm -v "$PWD":/w -w /w -u "$(id -u):$(id -g)" node:22-alpine node scripts/gen-secrets.mjs --write
# ubah .env: isi PUBLIC_URL dengan alamat HTTPS yang akan dibuka, misalnya https://finance.example.invalid
docker compose up -d --build
```

App mendengarkan di `127.0.0.1:3070` (ubah `APP_BIND` dan `APP_PORT` di `.env`). Arahkan reverse proxy ke sana,
buka `PUBLIC_URL`, lalu lanjut ke [Setel awal](#setel-awal).

Ada tiga layanan: `db` (PostgreSQL 18, tidak terbuka di luar jaringan Compose), `app`, dan `worker`. Data ada di
volume `db-data` (database) dan `app-data` (lampiran dan backup).

## Pasang manual

Perlu Node.js 22.12 atau lebih baru, PostgreSQL 18 (dengan `pg_dump`/`pg_restore` versi mayor yang sama), dan
reverse proxy untuk HTTPS.

1. Buat user dan database untuk app, hanya bisa diakses dari localhost:
   ```sh
   sudo -u postgres createuser --pwprompt finance
   sudo -u postgres createdb -O finance finance
   ```
2. Pasang dan setel:
   ```sh
   git clone <repositori ini> tillpayday && cd tillpayday
   npm ci
   node scripts/gen-secrets.mjs --write
   # ubah .env: DATABASE_URL, PUBLIC_URL
   npm run db:generate
   npm run db:migrate
   npm run build
   ```
3. Jalankan app dan worker sebagai layanan. Contoh untuk systemd dan PM2 ada di `docs/deploy/`
   (`tillpayday.service.example`, `tillpayday-worker.service.example`, `ecosystem.config.cjs.example`).
4. Setel reverse proxy (`docs/deploy/Caddyfile.example` atau `nginx.conf.example`).

## Variabel lingkungan

| Nama | Wajib | Arti |
| --- | --- | --- |
| `DATABASE_URL` | ya (manual) | Koneksi PostgreSQL. Compose membuatnya dari `POSTGRES_PASSWORD`. |
| `POSTGRES_PASSWORD` | ya (Compose) | Password database bawaan. |
| `SETUP_TOKEN` | ya | Dipakai sekali untuk membuat pemilik. Rahasiakan. |
| `SESSION_SECRET` | ya | Menandatangani data sesi. |
| `DATA_ENCRYPTION_KEY` | ya | Mengenkripsi kunci AI dan rahasia TOTP di database. |
| `BACKUP_ENCRYPTION_KEY` | ya | Mengenkripsi backup. Simpan salinannya di tempat lain: tanpa kunci ini backup tidak bisa dipulihkan. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | ya | Pasangan kunci Web Push. |
| `PUBLIC_URL` | ya | Alamat HTTPS yang dibuka pemakai (passkey dan push bergantung padanya). |
| `DATA_DIR` | ya | Folder lampiran dan backup, di luar folder publik. |
| `APP_NAME` | ya | Nama yang tampil di app. |
| `BACKUP_COPY_DIR` | tidak | Folder kedua yang menerima salinan tiap backup. |
| `BACKUP_KEEP` | tidak | Jumlah backup harian yang disimpan (bawaan 14). |
| `APP_BIND`, `APP_PORT` | tidak | Hanya Compose: alamat dan port host (bawaan `127.0.0.1:3070`). |

`node scripts/gen-secrets.mjs --write` membuat `.env` dari `.env.example` dengan nilai acak baru. App menolak
menyala kalau ada rahasia yang kosong, pendek, atau masih contoh. Jangan pernah commit `.env`.

## Setel awal

1. Buka `PUBLIC_URL`. Selama belum ada pemilik, app hanya menampilkan layar pemasangan.
2. Masukkan `SETUP_TOKEN` dari `.env`, nama, e-mail, dan password cadangan. Simpan kode pemulihan.
3. Tambahkan passkey (sidik jari, wajah, atau PIN perangkat). Setelah ini pendaftaran tertutup; yang lain bergabung
   lewat undangan.
4. Pilih cara setel: formulir singkat per langkah, wawancara dengan model AI, atau data contoh untuk melihat-lihat.
   Belum ada yang disimpan sampai kamu menyetujui ringkasan.
5. Catat transaksi pertama di bar input, misalnya `kopi 25k`.

## Memperbarui

```sh
git pull
docker compose up -d --build     # atau untuk pasang manual: npm ci && npm run build, lalu restart kedua layanan
```

Saat menyala, app membuat backup lalu menjalankan migrasi database yang tertunda. Migrasi tidak pernah membuang
data tanpa langkah eksplisit.

## Backup dan restore

- Worker menulis backup terenkripsi tiap hari ke `DATA_DIR/backups` (dan ke `BACKUP_COPY_DIR` kalau diisi),
  menyimpan 14 terbaru. Backup juga dibuat sebelum tiap migrasi.
- Kapan saja: `npm run backup` (manual) atau `docker compose exec app node --import tsx scripts/backup.ts`.
- Restore ke database kosong:
  ```sh
  npm run restore -- /path/ke/backup-<waktu>.dump.enc --target postgresql://user:pass@127.0.0.1:5432/dbbaru
  ```
  Restore menimpa database yang ada dengan menambahkan `--yes`. Dengan Compose, hentikan app dan worker dulu:
  ```sh
  docker compose stop app worker
  docker compose run --rm --no-deps app sh -c 'ls "$DATA_DIR/backups"'
  docker compose run --rm --no-deps app sh -c 'node --import tsx scripts/restore.ts "$DATA_DIR/backups/<file>" --yes'
  docker compose start app worker
  ```
- Backup dienkripsi AES-256-GCM dengan kunci turunan `BACKUP_ENCRYPTION_KEY`. File yang berubah atau terpotong
  ditolak sebelum ada yang masuk ke database.
- Setelan > Backup dan ekspor mengunduh semua data sebagai JSON atau CSV. Ekspor ini tidak pernah berisi password,
  kunci, token, atau lampiran.

## Menyetel AI (opsional)

<p align="center">
  <img src="docs/illustrations/blotcat-input-bar.png" alt="Blotcat mendorong satu kalimat pendek ke satu bar input bulat, lalu keluar kartu untuk dikonfirmasi" width="760">
</p>

Setelan > AI menerima endpoint apa pun yang kompatibel dengan format chat completions OpenAI: penyedia hosted atau
model di mesinmu sendiri (misalnya Ollama atau LM Studio, yang menyediakan `http://<host>:<port>/v1`). Isi URL dasar
yang berakhir `/v1`, nama model, dan kunci kalau perlu. Uji koneksi mencatat apakah model mendukung keluaran
terstruktur dan gambar. Model terpisah untuk foto dan penyedia cadangan bersifat opsional.

Model hanya mengubah teks menjadi usulan aksi dari daftar tetap. Model tidak bisa membaca saldo, menulis ke
database, atau menjalankan query; nominal dan jawaban berasal dari kode. Teks di struk dan dokumen diperlakukan
sebagai data. Yang dikirim ke penyedia hanya yang kamu ketik atau lampirkan, ditambah nama akun dan kategori.

Tanpa AI, pola sederhana tetap jalan, kalimat rumit membuka formulir yang sudah terisi, dan foto menunggu di antrean.

## Memasang di HP

<p align="center">
  <img src="docs/illustrations/readme-dark.png" alt="TillPayDay mode gelap di HP dan di desktop" width="720">
</p>

- **Android:** buka app di Chrome, menu > Install app. Setelah itu app muncul di menu Share untuk teks, gambar, PDF.
- **iPhone:** Safari > Share > Add to Home Screen. iOS tidak menyediakan Share Target untuk web app; Setelan > Token
  API berisi langkah membuat Shortcut yang mengirim teks atau foto ke `POST /api/v1/ingest` dengan token INGEST.
- Notifikasi push di iPhone hanya aktif setelah app ditambahkan ke Home Screen dan dibuka dari sana.
- Catatan yang dibuat saat offline disimpan di perangkat dan dikirim saat tersambung lagi.

## Lapis akses tambahan (opsional)

App dirancang aman di internet terbuka tanpa lapis lain (passkey, rate limit, header ketat, perlindungan CSRF).
Kalau mau lapis tambahan, pasang proxy dengan pengecekan identitas atau VPN di depan reverse proxy, misalnya
gateway akses dengan single sign-on, sertifikat klien, atau jaringan privat seperti WireGuard. `PUBLIC_URL` harus
tetap sama dengan alamat yang dibuka pemakai, kalau tidak passkey berhenti bekerja. Share Target Android dan Shortcut
iPhone juga perlu bisa melewati lapis itu.

## Tanya jawab

**Apakah app tersambung ke bank?** Tidak. App tidak pernah menyimpan kredensial bank dan tidak bisa memindahkan
uang. Kamu mencatat, mengimpor mutasi, atau membagikan screenshot.

**Bisa dipakai beberapa household dalam satu instalasi?** Tidak. Satu instalasi untuk satu household berisi satu
atau dua orang.

**Apa yang keluar dari server?** Hanya yang kamu setel: permintaan ke penyedia AI, dan salinan backup ke
`BACKUP_COPY_DIR`. Tidak ada telemetri. Sumber harga dan kurs otomatis tidak disertakan; harga dan kurs diisi manual
kecuali kamu menambahkan provider.

**Passkey hilang.** Masuk dengan password dan kode autentikator, atau dengan kode pemulihan, lalu tambahkan passkey
baru di Setelan > Masuk dan perangkat.

**Bagaimana melihat dengan data contoh?** Pilih "Coba dengan data contoh" saat setel awal, atau jalankan
`npm run db:seed-demo -- <e-mail pemilik>` pada household yang belum punya transaksi.

**Kenapa ada kucing di README?** Lihat [Kucing bloat menyapa 🐈](#kucing-bloat-menyapa-). Dia bukan dependensi.

## Pengembangan

```sh
npm ci
node scripts/gen-secrets.mjs --write   # lalu isi DATABASE_URL dan tambahkan TEST_DATABASE_URL (database terpisah)
npm run db:migrate
npm run dev          # http://127.0.0.1:3070
npm run test:unit
npm run test:int     # perlu TEST_DATABASE_URL
npm run test:e2e     # Playwright, memakai TEST_DATABASE_URL dan server AI tiruan
```

Lihat [CONTRIBUTING.md](CONTRIBUTING.md) dan [SECURITY.md](SECURITY.md).
Catatan rilis: [CHANGELOG.md](CHANGELOG.md).

## Lisensi

MIT. Lihat [LICENSE](LICENSE).
