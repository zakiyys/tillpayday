<p align="center">
  <img src="public/icons/icon-192.png" alt="Logo TillPayDay" width="96" height="96">
</p>

<h1 align="center">TillPayDay</h1>

<p align="center">
  <b>Satu angka tiap hari: berapa yang masih boleh kamu belanjakan sampai gajian.</b><br>
  Aplikasi keuangan pribadi self-hosted untuk satu orang atau pasangan. Server kamu, data kamu, tanpa login bank.
</p>

<p align="center">
  <a href="https://github.com/zakiyys/tillpayday/actions/workflows/ci.yml"><img src="https://github.com/zakiyys/tillpayday/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/zakiyys/tillpayday/releases"><img src="https://img.shields.io/github/v/release/zakiyys/tillpayday?style=flat-square&color=0B5D4B" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/lisensi-MIT-0B5D4B?style=flat-square" alt="Lisensi MIT">
  <img src="https://img.shields.io/badge/self--hosted-servermu-0B5D4B?style=flat-square&logo=docker&logoColor=white" alt="Self-hosted">
  <img src="https://img.shields.io/badge/Next.js-16-0B5D4B?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16">
  <img src="https://img.shields.io/badge/PostgreSQL-18-0B5D4B?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 18">
  <img src="https://img.shields.io/badge/Node-%E2%89%A522.12-0B5D4B?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node 22.12 atau lebih baru">
  <img src="https://img.shields.io/badge/PWA-bisa_diinstal-0B5D4B?style=flat-square&logo=pwa&logoColor=white" alt="PWA bisa_diinstal">
  <img src="https://img.shields.io/badge/AI-opsional-0B5D4B?style=flat-square" alt="AI opsional">
  <img src="https://img.shields.io/badge/login_bank-tidak_perlu-0B5D4B?style=flat-square" alt="Tanpa login bank">
  <img src="https://img.shields.io/badge/bahasa-EN_%C2%B7_ID-0B5D4B?style=flat-square" alt="Inggris dan Bahasa Indonesia">
</p>

<p align="center">
  <a href="#instalasi">Instalasi</a> ·
  <a href="#cara-kerjanya">Cara kerja</a> ·
  <a href="#fitur">Fitur</a> ·
  <a href="#menyambungkan-ai-opsional">Setup AI</a> ·
  <a href="#kalau-ada-masalah">Troubleshooting</a> ·
  <a href="README.md">English</a>
</p>

<p align="center">
  <img src="docs/illustrations/readme-hero.png" alt="TillPayDay di ponsel dan desktop" width="880">
</p>

## Sehari bareng TillPayDay, diceritakan si kucing bloat 🐈

<p align="center">
  <img src="docs/illustrations/blotcat-story.gif" alt="Animasi lima adegan: gajian datang, uang dibagi rata ke gelas-gelas harian, Blotcat mengetik 'coffee 25k', mencap kartu konfirmasi, lalu menyeruput kopi di samping gelas hari ini yang menyala" width="760">
</p>

1. **Gajian masuk.** Periode kamu mulai di hari gaji masuk, bukan tanggal 1.
2. **Tagihan dan tabungan disisihkan duluan.** Sisanya dibagi rata ke hari-hari sampai gajian berikutnya.
3. **Kamu ketik satu baris pendek**, misalnya `kopi 25rb`, di kolom input. Tanpa formulir.
4. **Kamu konfirmasi kartunya.** Tidak ada yang tersimpan sebelum kamu setuju, dan hitungannya dilakukan kode (bukan AI).
5. **Angka hari ini terbarui.** Hemat hari ini, jatah besok bertambah. Malamnya server membuat backup terenkripsi.

Itu inti idenya. Semua fitur lain ada supaya satu angka itu tetap jujur.

## Isi

- [Cocok untuk siapa](#cocok-untuk-siapa)
- [Cara kerjanya](#cara-kerjanya)
- [Fitur](#fitur)
- [Dibangun dengan apa](#dibangun-dengan-apa)
- [Instalasi](#instalasi) (pilih jalurmu)
- [Setup pertama](#setup-pertama)
- [Update](#update)
- [Backup dan restore](#backup-dan-restore)
- [Menyambungkan AI (opsional)](#menyambungkan-ai-opsional)
- [Dipakai di ponsel](#dipakai-di-ponsel)
- [Keamanan](#keamanan)
- [Kalau ada masalah](#kalau-ada-masalah)
- [FAQ](#faq)
- [Pengembangan](#pengembangan)

## Cocok untuk siapa

**Cocok kalau kamu:**

- gajian sekali atau dua kali sebulan dan mau tahu tiap hari apakah masih aman;
- mau data keuangan ada di mesin milik sendiri, tanpa telemetri dan tanpa kredensial bank;
- berbagi uang dengan pasangan dan mau akun bersama dan pribadi di satu tempat;
- lebih suka mengetik `makan siang 40rb gopay` daripada mengisi formulir.

**Kurang cocok kalau kamu:**

- butuh sinkron otomatis ke bank (sengaja tidak pernah tersambung ke bank);
- mau menjalankan banyak rumah tangga di satu instalasi (satu instalasi = satu rumah tangga, satu atau dua orang);
- butuh pembukuan double-entry untuk usaha.

## Cara kerjanya

### Angka harian

Setiap periode berjalan dari satu gajian ke gajian berikutnya. Di awal periode:

```text
dana belanja    = pemasukan periode ini - tabungan untuk tujuan - tagihan tetap
jatah hari ini  = (dana belanja - yang sudah terpakai sebelum hari ini) / sisa hari, termasuk hari ini
aman hari ini   = jatah hari ini - yang terpakai hari ini
```

**Contoh.** Gaji Rp9.000.000 masuk tanggal 25. Rp1.500.000 untuk tujuan tabungan, tagihan tetap Rp2.500.000.
Sisa dana belanja Rp5.000.000 untuk 30 hari, jadi hari pertama dapat sekitar **Rp166.000**. Belanja Rp100.000 di hari
pertama, hari kedua dapat (5.000.000 - 100.000) / 29 = sekitar **Rp169.000**. Kalau kebablasan, hari-hari berikutnya
mengecil sedikit-sedikit, bukan meledak di akhir bulan.

Transfer antar akun sendiri tidak pernah dihitung sebagai pengeluaran. Belanja kartu kredit mengurangi angka di hari
belanjanya, jadi bayar tagihan kartu nanti tidak terhitung dua kali.

### Dari kalimat jadi transaksi

```mermaid
flowchart LR
    A["Kamu mengetik, membagikan screenshot<br/>atau memotret struk"] --> B{"Catatan sederhana?<br/>mis. kopi 25rb"}
    B -- ya --> C["Parser lokal di server<br/>(tanpa AI)"]
    B -- tidak --> D["Model AI kamu mengembalikan usulan<br/>dari daftar aksi yang tetap"]
    D --> E["Zod memvalidasi setiap field"]
    C --> F["Kartu konfirmasi"]
    E --> F
    F -- "kamu konfirmasi" --> G["Kode menulis transaksi,<br/>menghitung ulang saldo dan angka harian"]
    G --> H["Catatan di audit log"]
```

AI tidak pernah menyentuh data langsung. Ia hanya boleh menjawab dengan salah satu intent yang sudah ditentukan
(`record_expense`, `record_transfer`, `split_bill`, `pay_bill`, `asset_buy`, `query`, `clarify`, dan beberapa lagi).
Ia tidak bisa membaca saldo, menjalankan query, atau menulis ke database. Tanpa model, catatan sederhana tetap jalan
dan kalimat rumit membuka formulir yang sudah terisi.

### Apa jalan di mana

```mermaid
flowchart TB
    subgraph you["Perangkat kamu"]
      P["Ponsel (PWA terpasang)"]
      L["Browser laptop"]
      S["Shortcut iPhone / share Android"]
    end
    subgraph server["Server kamu"]
      RP["Reverse proxy dengan HTTPS<br/>(Caddy, nginx, Cloudflare Tunnel...)"]
      APP["app: web + API Next.js<br/>127.0.0.1:3070"]
      W["worker: tugas terjadwal<br/>(pg-boss)"]
      DB[("PostgreSQL 18")]
      FS[("folder data<br/>lampiran + backup terenkripsi")]
    end
    AI["Penyedia AI (opsional)<br/>layanan hosted, atau model di mesin sendiri"]
    P & L & S --> RP --> APP
    APP <--> DB
    W <--> DB
    APP --> FS
    W --> FS
    APP -. "hanya yang kamu ketik atau lampirkan" .-> AI
```

Tiga proses, tanpa Redis, tanpa message broker. **Worker** memakai database yang sama dengan app dan menjalankan:

| Tugas | Kapan | Fungsinya |
| --- | --- | --- |
| `sync-households` | tiap jam | membuka periode baru, memposting transaksi berulang, membuat tagihan, statement kartu, setoran tujuan |
| `process-drafts` | tiap 5 menit | memproses ulang foto dan dokumen yang antre waktu AI tidak tersedia |
| `weekly-recap` | cek tiap jam | menyusun rekap mingguan saat jadwalnya tiba |
| `notifications` | harian | pengingat tagihan, angka harian menipis, petunjuk langganan (Web Push) |
| `backup` | harian | `pg_dump` terenkripsi, menyimpan 14 terbaru, opsional salinan ke folder kedua |

Setiap start, app mengecek environment, membuat backup, lalu menjalankan migrasi database sebelum melayani request
pertama.

## Fitur

<p align="center">
  <img src="docs/illustrations/blotcat-payday.png" alt="Blotcat menuang uang gajian ke gelas-gelas kecil yang sama besar, gelas hari ini menyala" width="680">
</p>

**Sehari-hari**

- **Satu kolom input** untuk semuanya: teks, foto struk, screenshot yang dibagikan, atau PDF mutasi rekening.
- **Struk plus keterangan.** Pilih foto, tulis misalnya *"aku cuma beli nasi goreng, hitung pajaknya"*, dan kartunya menampilkan item milikmu saja plus bagian pajak dan service-nya. Model cuma membaca struk; hitungannya dikerjakan aplikasi.
- **Aman dibelanjakan hari ini**, dengan periode mengikuti gajian dan jatah harian atau mingguan.
- **Kartu konfirmasi** sebelum menyimpan; app belajar aturan dari koreksi kamu.
- **Tanya langsung** di kolom yang sama: "makan bulan ini habis berapa?", "kuat nggak beli HP 6 juta cicil 3 kali?"

**Uang dalam segala bentuk**

- Semua jenis akun: bank, e-wallet, tunai, kartu kredit, paylater, pinjaman, akun investasi.
- Transfer sebagai satu baris dua sisi, bukan pengeluaran.
- Kartu kredit dengan statement dan cicilan; paylater.
- Utang-piutang per orang, patungan, pinjaman dengan pokok dan bunga.
- Transaksi berulang dan tagihan, anggaran dengan saran, tujuan di atas rekening tabungan, dana darurat dalam bulan.
- Investasi jenis apa pun (jenis aset adalah data): harga rata-rata tertimbang, untung terealisasi dan belum, untung
  dipisah antara harga dan kurs untuk aset luar negeri.
- Multi mata uang dengan satu mata uang dasar; angka lama memakai kurs di harinya; mode perjalanan.
- Cek saldo: ketik saldo di aplikasi bank, app menyarankan biaya admin atau bunga yang belum tercatat.

**Melihat gambaran besar**

- Dashboard, proyeksi saldo, simulasi pembelian dan tujuan.
- Rekap mingguan, notifikasi, deteksi langganan, daftar akhir tahun.
- Impor mutasi: CSV dengan pemetaan kolom, PDF lewat model, dengan pencocokan duplikat dan pasangan transfer.
- Ekspor penuh (JSON atau CSV) dan impor ulang.

**Dipakai sehari-hari**

- PWA yang bisa dipasang, antrean offline, share target Android, endpoint untuk Shortcut iPhone, Web Push.
- Mode berdua: undang pasangan, pisahkan akun pribadi dan bersama.
- Masuk dengan passkey; password plus kode autentikator dan recovery code sebagai cadangan.
- Tema terang dan gelap, warna aksen sendiri, Bahasa Indonesia dan Inggris.
- Jalan penuh tanpa AI.

<p align="center">
  <img src="docs/illustrations/readme-dark.png" alt="TillPayDay mode gelap di ponsel dan desktop" width="680">
</p>

## Dibangun dengan apa

| Lapisan | Pilihan | Alasannya |
| --- | --- | --- |
| Web dan API | [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript strict | satu proses melayani halaman dan API JSON |
| Database | [PostgreSQL](https://www.postgresql.org) 18 dengan migrasi [Prisma](https://www.prisma.io) 7 | 37 tabel, setiap query dibatasi per rumah tangga |
| Tugas latar | [pg-boss](https://github.com/timgit/pg-boss) | antrean tugas di dalam PostgreSQL, jadi tanpa Redis |
| Validasi | [Zod](https://zod.dev) 4 | di setiap batas: formulir, API, keluaran AI, impor |
| Uang | satuan terkecil integer (`bigint`), [decimal.js](https://github.com/MikeMcl/decimal.js) untuk unit dan kurs | tidak ada floating point di dekat uang |
| Masuk | [SimpleWebAuthn](https://simplewebauthn.dev) (passkey), password argon2id, otplib (TOTP) | passkey dulu, cadangan yang kuat |
| UI | Tailwind CSS 4, ikon lucide, Plus Jakarta Sans, [next-intl](https://next-intl.dev) | Indonesia dan Inggris |
| Ponsel | Service worker, antrean offline IndexedDB (idb), web-push | PWA yang bisa dipasang |
| Test | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), axe-core | unit, integrasi ke PostgreSQL asli, end-to-end di browser, aksesibilitas |
| Kebersihan repo | gitleaks plus pemindai detail pribadi | jalan di hook pre-commit dan di CI |

Dependensi runtime sengaja sedikit: 18 paket di `dependencies`, tanpa plugin ORM, tanpa UI kit, tanpa analitik.

## Instalasi

### Pilih jalurmu

Instalasi itu dua keputusan: **cara menjalankannya** dan **siapa yang bisa membukanya**.

| Cara menjalankan | Pakai | Waktu |
| --- | --- | --- |
| Mesin apa pun dengan Docker (server, VPS, mesin rumahan, laptop) | [A. Docker Compose](#a-docker-compose-disarankan) | ~10 menit |
| Cuma mau coba-coba di komputer sendiri | [B. Coba di komputer sendiri](#b-coba-di-komputer-sendiri) | ~5 menit |
| Mesin tanpa Docker | [D. Instalasi manual](#d-instalasi-manual-tanpa-docker) dengan systemd atau PM2 | ~20 menit |
| Niat mengubah kodenya | [Pengembangan](#pengembangan) | ~5 menit |

Lalu pilih siapa yang bisa membukanya di [C. Pilih cara mengaksesnya](#c-pilih-cara-mengaksesnya): cuma komputer ini,
jaringan rumah, cuma perangkat kamu sendiri, atau seluruh internet, pakai domain atau tidak. Terserah kamu; app-nya
jalan sama di semua pilihan.

**Syarat:** mesin yang selalu nyala (1 CPU dan 1 GB RAM cukup untuk dua orang, plus sekitar 2 GB disk untuk image dan
data). Passkey, notifikasi push, dan pemasangan di ponsel butuh **HTTPS** atau `localhost`.

### A. Docker Compose (disarankan)

Butuh Docker dengan plugin Compose dan `git`.

```sh
git clone https://github.com/zakiyys/tillpayday.git
cd tillpayday

# 1. Buat .env berisi secret acak baru (tidak perlu Node.js di host)
docker run --rm -v "$PWD":/w -w /w -u "$(id -u):$(id -g)" node:22-alpine node scripts/gen-secrets.mjs --write

# 2. Isi alamat yang akan kamu buka di browser (lihat "C. Pilih cara mengaksesnya")
#    PUBLIC_URL=https://uang.example.com   atau   PUBLIC_URL=http://localhost:3070
nano .env

# 3. Build dan jalankan
docker compose up -d --build
docker compose ps          # db healthy, app dan worker up
curl -s http://127.0.0.1:3070/api/health   # {"ok":true}
```

Stack-nya berisi tiga service:

| Service | Image | Terbuka di |
| --- | --- | --- |
| `db` | `postgres:18` | tidak ke mana-mana; hanya bisa dijangkau di dalam jaringan Compose |
| `app` | dibuild dari repo ini | `127.0.0.1:3070` (ubah lewat `APP_BIND` / `APP_PORT`) |
| `worker` | image yang sama dengan `app` | tidak ada |

Data disimpan di dua volume Docker: `db-data` (database) dan `app-data` (lampiran dan backup).

Berikutnya, tentukan siapa yang bisa membukanya: [C. Pilih cara mengaksesnya](#c-pilih-cara-mengaksesnya). Lalu buka
`PUBLIC_URL` dan lanjut ke [Setup pertama](#setup-pertama).

> **Mau data di folder yang kelihatan, bukan volume Docker?** Buat `compose.override.yaml` di samping
> `compose.yaml`:
>
> ```yaml
> services:
>   db:
>     volumes: [ "./data/db:/var/lib/postgresql" ]
>   app:
>     volumes: [ "./data/app:/data" ]
>   worker:
>     volumes: [ "./data/app:/data" ]
> ```
>
> App berjalan sebagai user tanpa hak istimewa di dalam container (uid 999), jadi beri akses tulis:
> `mkdir -p data/app && setfacl -m u:999:rwx -m d:u:999:rwx data/app` (atau `chown 999 data/app`).

### B. Coba di komputer sendiri

Sama dengan jalur A, dengan `PUBLIC_URL=http://localhost:3070` di langkah 2 (pilihan 1 di [C](#c-pilih-cara-mengaksesnya)). Buka
`http://localhost:3070`. Browser menganggap `localhost` aman, jadi passkey juga jalan.

Mau data contoh? Pilih **Coba dengan data contoh** saat setup. Kalau sudah selesai:

```sh
docker compose down        # berhenti, data tetap ada
docker compose down -v     # berhenti dan MENGHAPUS semua data
```

### C. Pilih cara mengaksesnya

App selalu mendengarkan di `127.0.0.1:3070` dulu, jadi tidak ada yang terbuka sampai kamu memutuskan. Ada satu aturan
untuk semua pilihan: **`PUBLIC_URL` harus persis alamat yang kamu ketik di browser**, karena passkey, cookie, push, dan
undangan terikat padanya. Bisa diganti kapan saja kalau berubah pikiran, lalu jalankan `docker compose up -d`.

| Pilihan | Siapa yang bisa membuka | Perlu domain | HTTPS | `PUBLIC_URL` kira-kira |
| --- | --- | --- | --- | --- |
| 1. Cuma komputer ini | kamu, di mesin itu | tidak | tidak perlu (`localhost` dianggap aman) | `http://localhost:3070` |
| 2. Jaringan rumah | perangkat di Wi-Fi atau LAN yang sama | tidak | tidak, jadi passkey dan pasang di ponsel mati | `http://<IP LAN>:3070` |
| 3. Perangkat sendiri, dari mana saja | ponsel dan laptop kamu, lewat jaringan privat | tidak | ya | alamat HTTPS dari jaringan privat itu |
| 4. Publik, pakai domain sendiri | siapa pun yang punya link (pendaftaran tetap tertutup) | ya | ya | `https://uang.example.com` |
| 5. Publik, tanpa domain | siapa pun yang punya link | tidak | ya | alamat HTTPS dari layanannya |

**1. Cuma komputer ini.** Tidak perlu apa-apa. Ini bawaannya.

**2. Jaringan rumah.** Di `.env` isi `APP_BIND=0.0.0.0` dan `PUBLIC_URL=http://<IP LAN mesin itu>:3070`, lalu
`docker compose up -d`. Masuk pakai password dan kode autentikator; passkey, push, dan pasang di ponsel butuh HTTPS,
jadi pakai pilihan 3, 4, atau 5 kalau mau fitur itu.

**3. Perangkat sendiri, dari mana saja (tanpa domain, tidak publik).** Pasang [Tailscale](https://tailscale.com) di
server, ponsel, dan laptop, lalu jalankan `tailscale serve --bg 3070` di server. Ia mencetak alamat HTTPS yang hanya
bisa dibuka perangkat kamu; isi itu ke `PUBLIC_URL`. VPN WireGuard dengan reverse proxy sendiri juga bisa.

**4. Publik, pakai domain sendiri.** Dua cara umum:

- *Server punya IP publik dan port 80 dan 443 bisa dibuka:* arahkan record `A` ke server, lalu pasang
  [Caddy](https://caddyserver.com) di depannya, yang mengurus sertifikat sendiri:

  ```caddy
  uang.example.com {
  	encode zstd gzip
  	reverse_proxy 127.0.0.1:3070
  }
  ```

  Lebih suka nginx? Pakai `docs/deploy/nginx.conf.example` (header forwarded dan unggahan 12 MB sudah diatur) dengan
  sertifikat dari Let's Encrypt.
- *Tanpa IP publik, tanpa port terbuka (internet rumah, CGNAT, firewall ketat):* pakai
  [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). Tambahkan domain
  ke Cloudflare, buat tunnel, jalankan `cloudflared` di server, dan tambahkan public hostname yang mengarah ke
  `http://127.0.0.1:3070`. Cloudflare yang melayani HTTPS; router kamu tetap tertutup.

**5. Publik, tanpa domain sendiri.** `tailscale funnel --bg 3070` membuka alamat HTTPS yang sama dari pilihan 3 ke
seluruh internet. Nama dynamic DNS gratis (misalnya dari DuckDNS) plus Caddy dan port forwarding juga bisa, kalau
koneksimu punya IP publik. Hindari URL tunnel sekali pakai yang berganti tiap restart: begitu alamatnya berubah,
passkey dan app yang terpasang di ponsel berhenti jalan sampai `PUBLIC_URL` diperbarui.

Dibuka ke publik itu aman secara desain (lihat [Keamanan](#keamanan)): pemilik dibuat dengan `SETUP_TOKEN`,
pendaftaran langsung ditutup, dan anggota hanya masuk lewat undangan. Mau satu kunci lagi? Pasang access gateway dengan
single sign-on di depan pilihan 4 dan 5.

Apa pun pilihannya, share target Android dan Shortcut iPhone memakai alamat yang sama.

### D. Instalasi manual (tanpa Docker)

Butuh Node.js 22.12 atau lebih baru, PostgreSQL 18 (dengan `pg_dump` dan `pg_restore` versi mayor yang sama), dan
reverse proxy untuk HTTPS.

```sh
# 1. User dan database, koneksi lokal saja
sudo -u postgres createuser --pwprompt finance
sudo -u postgres createdb -O finance finance

# 2. App
git clone https://github.com/zakiyys/tillpayday.git /opt/tillpayday && cd /opt/tillpayday
npm ci
node scripts/gen-secrets.mjs --write
nano .env                 # isi DATABASE_URL dan PUBLIC_URL
npm run db:generate
npm run db:migrate
npm run build
```

Lalu jalankan **dua** proses permanen, web app dan worker:

- **systemd:** salin `docs/deploy/tillpayday.service.example` dan `docs/deploy/tillpayday-worker.service.example` ke
  `/etc/systemd/system/` (buang `.example`), sesuaikan `User` dan `WorkingDirectory`, lalu
  `sudo systemctl enable --now tillpayday tillpayday-worker`. Unit web membuat backup dan migrasi sebelum start.
- **PM2:** `cp docs/deploy/ecosystem.config.cjs.example ecosystem.config.cjs && pm2 start ecosystem.config.cjs`.
  Jalankan `npm run db:migrate` sendiri setiap habis update.

Lalu pilih cara mengaksesnya di [C](#c-pilih-cara-mengaksesnya).

### Variabel environment

`node scripts/gen-secrets.mjs --write` membuat `.env` dari `.env.example` dan mengisi setiap secret dengan nilai acak
baru. Skrip ini menolak menimpa `.env` yang sudah ada. App menolak start kalau ada secret yang kosong, terlalu pendek,
atau masih placeholder.

| Nama | Wajib | Artinya |
| --- | --- | --- |
| `PUBLIC_URL` | ya | Alamat persis yang dibuka orang. Passkey, cookie, push, dan undangan bergantung padanya. |
| `POSTGRES_PASSWORD` | Compose | Password database bawaan; Compose menyusun `DATABASE_URL` darinya. |
| `DATABASE_URL` | manual | Connection string PostgreSQL. |
| `SETUP_TOKEN` | ya | Dibutuhkan sekali untuk membuat pemilik. Rahasiakan. |
| `SESSION_SECRET` | ya | Menandatangani data sesi. |
| `DATA_ENCRYPTION_KEY` | ya | Mengenkripsi kunci AI dan secret TOTP di database. |
| `BACKUP_ENCRYPTION_KEY` | ya | Mengenkripsi backup. **Simpan salinannya di tempat lain**: tanpa ini backup tidak bisa direstore. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | ya | Pasangan kunci Web Push. |
| `DATA_DIR` | ya | Folder lampiran dan backup, di luar web root (Compose mengisi `/data`). |
| `APP_NAME` | ya | Nama yang tampil di app dan di ikon terpasang. |
| `BACKUP_COPY_DIR` | tidak | Folder kedua yang menerima salinan setiap backup (misalnya disk remote yang di-mount). |
| `BACKUP_KEEP` | tidak | Berapa backup harian yang disimpan (default 14). |
| `APP_BIND`, `APP_PORT` | tidak | Khusus Compose: alamat dan port host (default `127.0.0.1:3070`; `0.0.0.0` membukanya ke LAN). |

Jangan pernah commit `.env`. Sudah ada di `.gitignore`.

## Setup pertama

1. Buka `PUBLIC_URL`. Selama belum ada pemilik, app hanya menampilkan layar setup.
2. Masukkan `SETUP_TOKEN` dari `.env`, nama, e-mail, dan password cadangan. **Simpan recovery code-nya.**
3. Tambahkan passkey (sidik jari, wajah, atau PIN perangkat). Sejak ini pendaftaran ditutup; orang lain masuk lewat
   undangan.
4. Pilih cara mengisi data keuangan: formulir singkat per langkah, wawancara AI, atau data contoh untuk melihat-lihat.
   Tidak ada yang tersimpan sebelum kamu mengonfirmasi ringkasannya.
5. Catat transaksi pertama di kolom input, misalnya `kopi 25rb`.

## Update

Klik **Watch > Custom > Releases** di GitHub supaya dapat notifikasi saat ada versi baru. Lalu:

```sh
cd tillpayday
git pull
docker compose up -d --build
```

Instalasi manual: `git pull && npm ci && npm run build`, lalu restart kedua service. Data kamu tidak disentuh: saat
start app membuat backup, lalu menjalankan migrasi baru. Migrasi tidak pernah menghapus data tanpa langkah eksplisit.
Catatan rilis ada di [CHANGELOG.md](CHANGELOG.md).

## Backup dan restore

- Worker menulis **backup terenkripsi setiap hari** ke `DATA_DIR/backups` (dan ke `BACKUP_COPY_DIR` kalau diisi),
  menyimpan 14 terbaru. Backup juga dibuat sebelum setiap migrasi.
- Backup kapan saja:
  ```sh
  docker compose exec app node --import tsx scripts/backup.ts     # Compose
  npm run backup                                                  # instalasi manual
  ```
- Restore ke database kosong:
  ```sh
  npm run restore -- /path/ke/backup-<waktu>.dump.enc --target postgresql://user:pass@127.0.0.1:5432/dbbaru
  ```
- Restore menimpa database yang sedang jalan di Compose (menggantinya):
  ```sh
  docker compose stop app worker
  docker compose run --rm --no-deps app sh -c 'ls "$DATA_DIR/backups"'
  docker compose run --rm --no-deps app sh -c 'node --import tsx scripts/restore.ts "$DATA_DIR/backups/<file>" --yes'
  docker compose start app worker
  ```
- Backup dienkripsi AES-256-GCM dengan kunci turunan `BACKUP_ENCRYPTION_KEY`. File yang berubah atau terpotong
  ditolak sebelum apa pun masuk ke database.
- **Setelan > Backup dan ekspor** mengunduh semua data sebagai JSON atau CSV. Ekspor tidak pernah berisi password,
  kunci, token, atau lampiran.

Backup yang belum pernah direstore itu harapan, bukan backup. Coba restore sekali ke database percobaan.

## Menyambungkan AI (opsional)

<p align="center">
  <img src="docs/illustrations/blotcat-input-bar.png" alt="Blotcat mendorong kalimat pendek ke satu kolom input bulat, lalu kartu konfirmasi keluar" width="680">
</p>

**Setelan > AI** menerima endpoint apa pun yang memakai format chat-completions OpenAI. Isi base URL yang berakhiran
`/v1`, nama model, dan kunci kalau perlu, lalu tekan tes koneksi. Tes ini mencatat apakah model mendukung keluaran
terstruktur dan gambar.

| Penyedia | Base URL | Catatan |
| --- | --- | --- |
| Layanan hosted | URL `.../v1` miliknya | butuh kunci |
| [Ollama](https://ollama.com) di server yang sama | `http://<IP LAN server>:11434/v1` | tanpa kunci; pilih model yang mendukung keluaran JSON |
| [LM Studio](https://lmstudio.ai) | `http://<host>:1234/v1` | nyalakan local server di LM Studio |
| Router atau gateway kompatibel OpenAI | URL `.../v1` miliknya | harus menghormati `"stream": false` |

Perlu diketahui:

- **Kecepatan penting.** App menunggu sampai 90 detik untuk satu jawaban, tapi model kecil yang cepat (beberapa detik
  per jawaban) terasa jauh lebih enak daripada model besar, dan foto butuh model yang bisa membaca gambar.
- Model terpisah untuk foto dan penyedia cadangan bersifat opsional.
- **Yang dikirim:** hanya yang kamu ketik atau lampirkan, plus nama akun dan kategori. Tidak pernah saldo, tidak pernah
  transaksi lain. Teks di dalam struk dan dokumen diperlakukan sebagai data, bukan perintah.
- **Tanpa AI:** catatan sederhana tetap jalan, kalimat rumit membuka formulir terisi, dan foto menunggu di antrean
  sampai model tersedia.

## Dipakai di ponsel

- **Android:** buka app di Chrome, menu > **Instal aplikasi**. Setelah itu app muncul di menu Bagikan untuk teks,
  gambar, dan PDF.
- **iPhone:** Safari > Bagikan > **Tambahkan ke Layar Utama**. iOS tidak punya share target untuk web app, jadi
  **Setelan > Token API** berisi langkah membuat Shortcut yang mengirim teks atau foto ke `POST /api/v1/ingest`
  dengan token INGEST.
- Notifikasi push di iPhone baru jalan setelah app ditambahkan ke Layar Utama dan dibuka dari sana.
- Catatan yang dibuat saat offline disimpan di perangkat dan dikirim saat online lagi.

## Keamanan

App ini dirancang aman di internet terbuka tanpa lapisan tambahan. Ringkasnya:

- **Tidak pernah menyimpan kredensial bank** dan tidak bisa memindahkan uang atau membuat pesanan.
- Pembuatan pemilik butuh `SETUP_TOKEN`; setelahnya pendaftaran ditutup dan anggota hanya masuk lewat undangan sekali
  pakai.
- Passkey dulu; password argon2id plus TOTP dan recovery code sekali pakai sebagai cadangan. Sesi tercatat per
  perangkat dan bisa dicabut. Ekspor, pengaturan AI, token, undangan, dan menghapus anggota meminta kamu masuk ulang.
- Rate limit dengan penguncian yang makin lama untuk login, unggahan, undangan, dan tes AI.
- Cek CSRF di setiap request yang mengubah data, Content Security Policy ketat tanpa origin pihak ketiga, HSTS,
  `X-Frame-Options: DENY`, dan header standar lainnya.
- Unggahan dibatasi 10 MB, dicek berdasarkan isi, metadata gambar dibuang, disimpan di luar web root.
- Kunci AI dan secret TOTP dienkripsi; token API dan recovery code hanya disimpan sebagai hash.
- Setiap perubahan data keuangan dicatat di audit log beserta sumbernya (UI, AI, impor, job, API).

Mau lapisan tambahan? Pasang VPN, access gateway dengan single sign-on, atau sertifikat klien di depan reverse proxy.
Pastikan `PUBLIC_URL` tetap sama dengan alamat yang kamu buka, kalau tidak passkey berhenti jalan.

Menemukan celah keamanan? Laporkan secara privat, lihat [SECURITY.md](SECURITY.md).

## Kalau ada masalah

**"Model tidak menjawab" di pengaturan AI, padahal modelnya jalan kalau dites dari server.**
App berjalan di dalam container, jadi `localhost` di sana adalah container, bukan server kamu. Pakai IP LAN atau IP
privat server di base URL. Kalau model hanya mendengarkan di host, firewall host mungkin memblokir trafik dari jaringan
Docker; izinkan subnet Docker ke port itu, misalnya
`sudo ufw allow from 172.16.0.0/12 to any port 11434 proto tcp` dan hal yang sama untuk `192.168.0.0/16` (Docker juga
membuat jaringan di sana). Lalu tekan tes koneksi lagi.

**Tes koneksi lolos tapi lambat, atau timeout.**
Pilih model yang lebih cepat. Model "combo" di router yang mencoba beberapa upstream berurutan bisa makan 30 sampai 60
detik per jawaban.

**Daftar passkey gagal, atau langsung ter-logout.**
`PUBLIC_URL` harus sama persis dengan alamat di browser, termasuk `https://` dan port. Setelah mengubahnya, jalankan
`docker compose up -d` supaya app dan worker memakainya.

**Container app restart terus dengan `EACCES: permission denied`.**
Kamu me-mount folder host yang tidak bisa ditulis user container (uid 999). Lihat catatan di
[jalur A](#a-docker-compose-disarankan).

**`.env already exists; not overwriting it`.**
`gen-secrets` sengaja melindungi secret yang sudah ada. Edit `.env` manual, atau cetak nilai baru dengan
`node scripts/gen-secrets.mjs` (tanpa `--write`).

**Lognya di mana?** `docker compose logs -f app worker`. Health check: `GET /api/health` mengembalikan `{"ok":true}`.

## FAQ

**Tersambung ke bank?** Tidak. Tidak pernah menyimpan kredensial bank dan tidak bisa memindahkan uang. Kamu mengetik
catatan, mengimpor mutasi, atau membagikan screenshot.

**Apa yang keluar dari server?** Hanya yang kamu atur: request ke penyedia AI dan salinan backup ke `BACKUP_COPY_DIR`.
Tidak ada telemetri. Harga dan kurs diisi manual.

**Bisa beberapa rumah tangga di satu instalasi?** Tidak. Satu instalasi = satu rumah tangga, satu atau dua orang.

**Passkey hilang.** Masuk dengan password dan kode autentikator, atau dengan recovery code, lalu tambahkan passkey
baru di **Setelan > Masuk dan perangkat**.

**Gimana lihat versi berisi data contoh?** Pilih **Coba dengan data contoh** saat setup, atau jalankan
`npm run db:seed-demo -- <e-mail pemilik>` pada rumah tangga yang belum punya transaksi.

**Boleh ganti nama?** Boleh, isi `APP_NAME`. Logo diambil dari `public/logo.svg`; `npm run gen:icons` membuat ulang
semua ikon darinya. Palet dan skala huruf ada di [DESIGN.md](DESIGN.md).

**Kenapa ada kucing di README?** Si kucing bloat menjaga dari bloat. Ia duduk di atas spreadsheet dan menghakimi
langganan streaming ketiga kamu. Ia bukan dependensi.

## Pengembangan

<p align="center">
  <img src="docs/illustrations/blotcat-lean.png" alt="Blotcat menimbang fitur di timbangan dan memotong yang berat" width="560">
</p>

```sh
npm ci                                   # sekaligus memasang git hook
node scripts/gen-secrets.mjs --write     # lalu isi DATABASE_URL dan TEST_DATABASE_URL (database terpisah)
npm run db:migrate
npm run dev                              # http://127.0.0.1:3070
```

| Perintah | Yang dijalankan |
| --- | --- |
| `npm run test:unit` | logika murni: hitungan uang, parser kalimat, klien AI |
| `npm run test:int` | ke PostgreSQL asli (`TEST_DATABASE_URL`): alur uang, impor, backup dan restore |
| `npm run test:e2e` | Playwright di browser asli dengan server AI tiruan, termasuk cek aksesibilitas |
| `npm run lint`, `npm run typecheck` | ESLint dan `tsc --noEmit` |
| `npm run scan:secrets`, `npm run scan:private` | gitleaks dan pemindai detail pribadi di seluruh history |

### Susunan proyek

```text
src/
  domain/      logika uang sebagai fungsi murni: jatah, periode, anggaran, tujuan, kurs, parser, pencocokan
  server/      akses database, auth, klien AI, impor, ledger, laporan, job worker
  app/         halaman Next.js dan route /api
  components/  UI
messages/      teks Bahasa Indonesia dan Inggris
prisma/        skema dan migrasi
scripts/       secret, backup, restore, ikon, pemindai repo
tests/         unit, integrasi, e2e, dan test instalasi bersih
docs/deploy/   contoh systemd, PM2, Caddy, dan nginx
```

Aturan uang ada di `src/domain` sebagai fungsi murni dengan test lebih dulu; kode server hanya memuat data dan
menyimpan hasil. Kalau mengubah perilaku, ubah atau tambahkan test-nya juga. Lihat [CONTRIBUTING.md](CONTRIBUTING.md).

## Lisensi

[MIT](LICENSE). Pakai, ubah, jalankan untuk dirimu dan pasanganmu.
