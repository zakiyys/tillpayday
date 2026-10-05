# Spesifikasi: App Keuangan Pribadi Self-Hosted

Versi 1.0, 5 Oktober 2026. Dokumen ini bersifat umum dan boleh ikut masuk repo publik (misalnya sebagai `docs/SPEC.md`). Tidak ada nama orang, domain, hostname, atau detail server di dalamnya, dan harus tetap begitu.

---

## 0. Untuk coding agent: cara memakai dokumen ini

Kamu diminta membangun app ini dari nol sampai siap dipakai dan siap dibuka sebagai repo publik. Dokumen ini adalah satu-satunya sumber kebutuhan. Baca sampai habis sebelum menulis kode.

**Yang dimaksud selesai**

- Semua bagian di dokumen ini terbangun, bukan versi minimal. Pemilik sengaja meminta lingkup penuh sekaligus. Urutan di bagian 17 adalah urutan ketergantungan, bukan daftar pilihan.
- Semua skenario uji di bagian 16 lolos lewat test otomatis.
- Orang asing bisa memasang app dari README saja, tanpa bertanya, di server Linux mana pun.
- Pemindai rahasia bersih, dan tidak ada data atau detail server pemilik di repo.

**Soal desain: pakai semua skill desain yang kamu punya**

Pemilik secara khusus meminta hasil visual yang bagus, bukan tampilan template. Sebelum menulis satu baris UI:

1. Periksa skill yang tersedia di lingkunganmu, lalu muat dan ikuti **semua** skill yang menyangkut desain: desain frontend atau UI, design system, visualisasi data atau chart, tipografi, aksesibilitas, motion, dan review desain. Jangan pilih satu saja kalau ada beberapa.
2. Pakai skill itu di tiap tahap, bukan hanya di awal: saat menetapkan design system, saat membangun tiap halaman, dan saat mereview hasil.
3. Bagian 12 berisi arah visual dan hierarki informasi yang sudah disetujui pemilik. Itu titik berangkat. Skill desain boleh memperhalus rupa, tapi hierarki informasi dan isi tiap layar di bagian 12 tidak boleh berubah tanpa persetujuan pemilik.
4. Setelah tiap halaman jadi, ambil screenshot di lebar 390 px dan 1360 px, mode terang dan gelap, lalu review sendiri dengan skill desain sebelum lanjut. Perbaiki yang kurang, baru lanjut.

**Cara bekerja**

- Kerjakan per tahap di bagian 17. Tiap tahap diakhiri dengan test yang lolos, commit, dan laporan singkat ke pemilik: apa yang selesai, apa yang berubah dari spec dan alasannya.
- Kalau spec ini ambigu, pilih tafsiran yang paling masuk akal, catat di `docs/DECISIONS.md`, dan lanjut. Jangan berhenti untuk hal kecil.
- Berhenti dan tanya pemilik hanya untuk hal di bagian 18, atau untuk keputusan yang tidak bisa dibatalkan.
- Jangan menebak API pihak ketiga. Untuk sumber harga, kurs, dan penyedia model, periksa dokumentasi resminya sebelum menulis kode. Kalau tidak bisa diverifikasi, bangun antarmukanya dan biarkan sumbernya manual.
- Logika uang (bagian 5 sampai 8) ditulis sebagai fungsi murni dengan test dulu, baru UI. Kesalahan di sini merusak kepercayaan pada seluruh app.

**Aturan repo yang berlaku dari commit pertama**

- `.gitignore` dibuat di commit pertama, sebelum file lain.
- Tidak ada rahasia, data asli, domain, hostname, IP, path server, nama, atau email pemilik di kode, komentar, pesan commit, seed, screenshot, atau dokumen. Detail deploy pemilik disimpan di folder `deploy.local/` yang masuk `.gitignore`.
- Rincian lengkap ada di bagian 15.

---

## 1. Ringkasan produk

App web pribadi (PWA) yang dipasang di server sendiri untuk mengelola keuangan dari ujung ke ujung: pemasukan, pengeluaran, transfer, tabungan, hutang, dan investasi.

Dua hal yang membedakannya:

1. **Satu bar input.** Pemakai mengetik bebas ("kopi 25k gopay"), memotret struk, atau mengirim screenshot. AI menerjemahkannya jadi transaksi, pemakai menyetujui, kode yang menyimpan dan menghitung.
2. **Satu angka di depan.** Beranda menjawab satu pertanyaan: hari ini masih aman belanja berapa.

Pemakai sasaran: satu orang atau satu pasangan yang memasang app di server sendiri. Bukan layanan multi-tenant.

### Prinsip desain produk

1. **Input selesai dalam 5 detik.** App keuangan ditinggalkan karena malas mencatat, bukan karena kurang fitur.
2. **Berbasis akun.** Tiap rekening, e-wallet, cash, hutang, dan aset punya saldo sendiri. Pindah uang antar akun adalah transfer, bukan pengeluaran.
3. **Periode ikut tanggal gajian,** bukan tanggal 1.
4. **Semua yang bisa bertambah adalah data.** Akun, kategori, jenis aset, mata uang, goal, dan tagihan ditambah dari dalam app tanpa ubah kode.
5. **AI hanya penerjemah.** Model tidak pernah menghitung saldo, menulis ke database, atau menjalankan query bebas. Semua angka berasal dari kode.
6. **App berjalan penuh tanpa AI.** AI adalah jalan pintas, bukan syarat.
7. **Tidak ada yang dikunci ke satu negara, bank, atau server.**

---

## 2. Keputusan

### 2.1 Sudah diputuskan pemilik

| Hal | Keputusan |
| --- | --- |
| Bentuk | PWA, satu kode untuk HP (Android dan iPhone) dan desktop |
| Akses | Link publik di belakang reverse proxy. Tidak bergantung pada VPN |
| Repo | Akan dibuka publik supaya orang lain bisa memasang sendiri. Mulai private sampai versi pertama stabil |
| README | Umum, tanpa kredensial dan tanpa detail server |
| Onboarding | Dua jalur: isi sendiri, atau dibantu AI lewat wawancara singkat |
| Lingkup | Keuangan pribadi. Keuangan usaha tidak dicampur |
| Mode berdua | Disiapkan di struktur data, dinyalakan saat dibutuhkan |
| Investasi | Semua jenis instrumen didukung lewat jenis aset yang bisa ditambah sendiri |
| Mata uang | Multi mata uang, dengan satu mata uang dasar |

### 2.2 Default yang dipakai sampai pemilik mengubah

Pemilik belum menjawab hal-hal ini. Bangun sesuai default, dan jadikan semuanya setelan yang bisa diubah di app.

| Hal | Default | Bisa diubah di |
| --- | --- | --- |
| Konfirmasi input AI | Selalu muncul. Tersedia setelan simpan otomatis untuk pengeluaran di bawah batas nominal tertentu, bawaannya mati | Setelan |
| Satuan jatah belanja | Harian, sisa hari ini otomatis ikut dibagi ke hari-hari berikutnya | Setelan (harian atau mingguan) |
| Potongan tabungan saat gajian | Nominal tetap per goal | Per goal (nominal atau persen) |
| Pembelian dicicil di kartu kredit | Diakui per cicilan lewat tagihan tetap, bukan penuh saat beli | Per transaksi |
| Net worth di mode berdua | Tiap anggota melihat akun pribadinya ditambah akun bersama | Setelan household |
| Sisa dana belanja di akhir periode | Ditawarkan untuk dipindah ke goal. Tidak otomatis terbawa ke periode berikutnya | Setelan |
| Lapis akses di depan app | Opsional. Keamanan app harus cukup tanpa lapis ini | Dokumentasi |
| Fitur tambahan di bagian 11 | Semua masuk lingkup | Pemilik boleh mencoret |

### 2.3 Masih terbuka

Lihat bagian 18. Jangan menebak hal-hal itu.

---

## 3. Stack dan arsitektur

### 3.1 Stack

| Lapisan | Pilihan |
| --- | --- |
| Framework | Next.js (App Router) dengan TypeScript mode strict |
| Database | PostgreSQL |
| ORM | Prisma, dengan migrasi berversi |
| Validasi | Zod di semua batas: form, API, keluaran model, variabel lingkungan |
| Antrean dan job | Berbasis PostgreSQL (misalnya pg-boss), dijalankan proses worker terpisah. Tanpa Redis |
| Autentikasi | Passkey (WebAuthn) sebagai utama, password (argon2id) ditambah TOTP sebagai cadangan, sesi disimpan di database |
| PWA | Web app manifest, service worker, antrean offline di IndexedDB, Web Share Target, Web Push dengan VAPID |
| Bahasa antarmuka | Indonesia dan Inggris lewat pustaka i18n. Tidak ada teks yang ditulis langsung di komponen |
| Angka | Uang sebagai bilangan bulat satuan terkecil, unit aset dan kurs sebagai desimal presisi tinggi. Tidak ada floating point untuk uang |
| Test | Unit test untuk logika uang, test integrasi untuk API, test end to end untuk alur utama |
| Pemasangan | Docker Compose (app, worker, database) sebagai jalur utama. Jalur manual dengan process manager dan reverse proxy juga didokumentasikan |

Pakai versi stabil terbaru tiap pustaka saat mulai, dan kunci versinya di lockfile.

### 3.2 Komponen

```
Perangkat (PWA di HP, browser di laptop)
        |
Reverse proxy (TLS). Lapis akses tambahan bersifat opsional
        |
App Next.js: UI, API, autentikasi, aturan pencatatan
        |                         \
PostgreSQL (hanya koneksi lokal)   Penyedia model AI (opsional)
        |
Worker: transaksi rutin, tagihan, harga, kurs, antrean file, rekap, notifikasi, backup
        \
         Sumber harga dan kurs (opsional), lokasi backup
```

Yang keluar dari server hanya tiga hal, dan ketiganya diisi sendiri oleh pemilik instalasi: permintaan ke penyedia model, pengambilan harga dan kurs, dan salinan backup. Tidak ada telemetri.

### 3.3 Struktur kode

- `src/domain/` berisi logika uang sebagai fungsi murni tanpa akses database: saldo, periode, jatah, budget, goal, valuasi, kurs, pencocokan duplikat. Semua punya unit test.
- `src/server/` berisi akses data, layanan, job, dan adapter (model AI, harga, kurs, penyimpanan file, notifikasi).
- `src/app/` berisi halaman dan route API.
- Adapter selalu di belakang antarmuka, supaya penyedia bisa diganti tanpa menyentuh domain.

---

## 4. Model data

Nama entitas dan field dalam bahasa Inggris. Semua tabel punya `id`, `createdAt`, `updatedAt`. Tabel yang bisa dihapus pemakai punya `deletedAt` (hapus lunak). Semua data terikat ke `householdId`.

| Entitas | Field penting | Catatan |
| --- | --- | --- |
| Household | name, baseCurrency, timezone, locale, paydayRule, allowanceUnit, settings | Satu instalasi biasanya satu household |
| Member | householdId, name, email, role (OWNER, MEMBER) | Pendaftaran tertutup, hanya lewat undangan |
| Credential | memberId, passkey, passwordHash, totpSecret | Rahasia TOTP disimpan terenkripsi |
| Session | memberId, deviceLabel, lastSeenAt, expiresAt | Bisa dicabut satu per satu |
| ApiToken | memberId, tokenHash, scope (INGEST, SUMMARY_READ), label, lastUsedAt | Token asli hanya tampil sekali saat dibuat |
| Account | name, type, institution, last4, aliases[], currency, role (DAILY, SAVINGS, NONE), ownerId, visibility (PRIVATE, SHARED), isDefaultForInstitution, openingBalance, openingDate, creditLimit, statementDay, dueDay, loanTerms, counterpartyId, lastReconciledAt, archivedAt | Lihat 4.1 untuk type |
| Counterparty | name, aliases[] | Orang atau pihak dalam hutang, piutang, dan patungan |
| Category | name, kind (INCOME, EXPENSE), parentId, countsToPool, isSystem | 8 sampai 12 kategori bawaan, bisa ditambah dan digabung |
| Transaction | Lihat 4.2 | Satu-satunya sumber saldo |
| Period | startDate, endDate, incomeTotal, savingsAllocated, billsTotal, poolAmount, status (OPEN, CLOSED) | Nilai turunan boleh disimpan sebagai cache, tapi harus bisa dihitung ulang |
| Budget | periodId, categoryId, limitAmount, isSuggested | Satu per kategori per periode |
| Recurring | template transaksi, schedule, mode (AUTO_POST, CREATE_BILL), opensPeriod, active | Gaji, tagihan, cicilan, langganan, setoran |
| Bill | recurringId, periodId, dueDate, amount, status (UNPAID, PAID, SKIPPED), paidTransactionId | Tagihan kartu kredit dibuat otomatis tiap tanggal cetak |
| InstallmentPlan | accountId, description, totalAmount, months, monthlyAmount, startDate, categoryId | Pembelian yang dicicil |
| Goal | name, targetAmount, targetDate, contributionAmount atau contributionPercent, isEmergencyFund, visibility, status | |
| GoalAllocation | goalId, accountId, amount | Bagian saldo sebuah akun simpanan yang dijatah untuk goal |
| AssetType | name, unitLabel, valuation (UNITS_TIMES_PRICE, FIXED_PLUS_INTEREST, APPRAISED), priceSource (AUTO, MANUAL, FIXED), providerKey, isSystem | Bisa ditambah dari dalam app |
| Holding | accountId, assetTypeId, name, symbol, currency, units, avgCost, interestRate, maturityDate | Satu baris per aset yang dimiliki |
| Price | holdingId atau symbol, date, price, currency, source | Riwayat harga |
| FxRate | date, fromCurrency, toCurrency, rate, source | Kurs referensi harian |
| Currency | code, exponent, symbol | Exponent menentukan satuan terkecil, misalnya 0 atau 2 |
| Trip | name, startDate, endDate, defaultCurrency, goalId, active | Mode perjalanan |
| Attachment | path, mime, size, sha256, warrantyUntil | File di disk, bukan di database |
| IngestDraft | rawText, attachmentId, status (PENDING_AI, NEEDS_REVIEW, CONFIRMED, DISCARDED), proposedActions, error | Antrean input yang belum jadi transaksi |
| ImportBatch | accountId, attachmentId, status, rows, matchedCount, newCount | Hasil import mutasi |
| Rule | matchField, matchValue, setCategoryId, setAccountId, createdFromCorrection | Aturan otomatis dari koreksi pemakai |
| Notification | memberId, kind, payload, readAt | |
| PushSubscription | memberId, endpoint, keys | |
| AiConfig | endpoint, model, apiKeyEncrypted, capabilities, fallbackEndpoint, fallbackModel, fallbackKeyEncrypted | Diisi lewat layar |
| AuditLog | actorId, via (UI, AI, IMPORT, JOB, API), action, entity, before, after | Semua perubahan data keuangan |

### 4.1 Jenis akun

| type | Sisi | Contoh |
| --- | --- | --- |
| BANK | Aset | Rekening giro atau tabungan |
| EWALLET | Aset | Dompet digital |
| CASH | Aset | Uang tunai, termasuk tunai mata uang asing |
| INVESTMENT | Aset | Akun sekuritas, emas, reksadana. Nilainya saldo kas ditambah nilai holding |
| RECEIVABLE | Aset | Piutang ke satu orang |
| CREDIT_CARD | Hutang | Kartu kredit |
| PAYLATER | Hutang | Paylater |
| LOAN | Hutang | KPR, kredit kendaraan, pinjaman tanpa agunan |
| PERSONAL_DEBT | Hutang | Hutang ke satu orang |

Akun hutang adalah akun biasa yang saldonya negatif. Aritmetikanya sama dengan akun aset, tidak ada tanda yang dibalik.

`role` hanya berlaku untuk akun aset: `DAILY` dihitung sebagai uang belanja, `SAVINGS` tidak.

### 4.2 Transaction

| Field | Keterangan |
| --- | --- |
| type | INCOME, EXPENSE, TRANSFER, ASSET_BUY, ASSET_SELL, ADJUSTMENT, OPENING |
| occurredOn | Tanggal kejadian, dalam zona waktu household |
| recordedAt | Waktu dicatat. Terpisah dari tanggal kejadian |
| accountId | Akun utama |
| counterAccountId | Akun lawan untuk TRANSFER |
| amount | Selalu positif, dalam mata uang akun utama, satuan terkecil |
| counterAmount | Nominal di akun lawan kalau mata uangnya berbeda |
| baseAmount | Nilai dalam mata uang dasar pada saat transaksi. Tidak berubah saat kurs bergerak |
| fxRate, fxRateIsEstimate | Kurs yang dipakai, dan tanda kalau masih perkiraan |
| originalAmount, originalCurrency | Nominal asing untuk belanja di luar negeri dengan kartu mata uang dasar |
| categoryId, payee, note | |
| source | TEXT, PHOTO, IMPORT, RECURRING, MANUAL, API |
| rawInput, attachmentId | Teks atau file asli yang jadi sumber |
| billId, goalId, tripId, installmentPlanId, importBatchId, counterpartyId | Kaitan |
| holdingId, units, unitPrice, feeAmount, realizedPnl | Untuk beli dan jual aset |
| excludeFromAllowance | Tidak memotong jatah harian |
| isAdjustment | Berasal dari cek saldo |
| createdById | Anggota yang mencatat |

---

## 5. Aturan pencatatan

Bagian ini adalah inti app. Implementasikan sebagai fungsi murni dengan test.

### 5.1 Efek tiap jenis transaksi

| type | Efek |
| --- | --- |
| OPENING | Saldo awal akun |
| INCOME | Saldo akun utama bertambah `amount` |
| EXPENSE | Saldo akun utama berkurang `amount`. Di kartu kredit, saldo jadi makin negatif |
| TRANSFER | Akun utama berkurang `amount`, akun lawan bertambah `counterAmount` (atau `amount` kalau mata uangnya sama) |
| ASSET_BUY | Akun utama berkurang `amount` ditambah biaya. Unit holding bertambah, harga beli rata-rata dihitung ulang dengan rata-rata tertimbang |
| ASSET_SELL | Akun utama bertambah hasil jual dikurangi biaya. Unit holding berkurang. `realizedPnl` = hasil jual bersih dikurangi (unit dijual x harga beli rata-rata) |
| ADJUSTMENT | Saldo akun utama bertambah atau berkurang sebesar selisih, tanpa masuk pemasukan atau pengeluaran |

Aturan tetap:

- Saldo akun tidak disimpan sebagai sumber kebenaran. Saldo = jumlah efek semua transaksi yang tidak terhapus. Cache boleh, asal bisa dibangun ulang.
- Transfer adalah satu baris dengan dua sisi, bukan dua baris.
- Hapus selalu hapus lunak dan bisa dibatalkan.
- Mengubah atau menambah transaksi bertanggal mundur menghitung ulang semua angka turunan yang terdampak.

### 5.2 Hutang, piutang, dan kartu kredit

| Kejadian | Dicatat sebagai |
| --- | --- |
| Belanja dengan kartu kredit atau paylater | EXPENSE di akun kartu, pada tanggal transaksi. Memotong jatah harian seperti belanja biasa |
| Bayar tagihan kartu | TRANSFER dari rekening ke akun kartu. Bukan pengeluaran |
| Bunga, denda, iuran tahunan kartu | EXPENSE di akun kartu dengan kategori biaya keuangan |
| Menerima pinjaman dari orang | TRANSFER dari akun PERSONAL_DEBT ke rekening. Bukan pemasukan |
| Membayar hutang ke orang | TRANSFER dari rekening ke akun PERSONAL_DEBT. Bukan pengeluaran |
| Meminjamkan uang | TRANSFER dari rekening ke akun RECEIVABLE. Bukan pengeluaran |
| Piutang dibayar | TRANSFER dari akun RECEIVABLE ke rekening. Bukan pemasukan |
| Cicilan pinjaman | Bagian pokok: TRANSFER dari rekening ke akun LOAN. Bagian bunga: EXPENSE dari rekening |
| Patungan | EXPENSE sebesar bagian sendiri, sisanya TRANSFER ke akun RECEIVABLE tiap orang |

- Akun RECEIVABLE dan PERSONAL_DEBT dibuat otomatis per Counterparty saat pertama dibutuhkan.
- Kartu kredit menyimpan limit, tanggal cetak, dan jatuh tempo. Tiap tanggal cetak, sebuah Bill dibuat sebesar saldo terhutang saat itu.
- Untuk pinjaman, kalau syaratnya diisi (pokok, bunga, tenor), pembagian pokok dan bunga tiap cicilan dihitung otomatis. Kalau tidak, seluruh cicilan dicatat sebagai TRANSFER dan selisihnya dibereskan lewat cek saldo dengan kategori bunga.
- Net worth = jumlah saldo semua akun (hutang bernilai negatif) ditambah nilai semua holding, dalam mata uang dasar.

**Pembelian yang dicicil di kartu.** Pembelian dicatat sebagai EXPENSE penuh di akun kartu dengan `installmentPlanId` dan `excludeFromAllowance = true`, supaya saldo hutang benar. Untuk jatah harian dan budget kategori, yang dihitung adalah porsi bulanannya: tiap periode muncul satu Bill sebesar `monthlyAmount` yang ikut memotong dana belanja sebagai tagihan tetap dan masuk ke budget kategori terkait. Pemakai bisa memilih pengakuan penuh saat beli untuk transaksi tertentu.

### 5.3 Tabungan dan goal

- Hanya akun dengan `role = DAILY` yang dianggap uang belanja. Akun `SAVINGS` tidak.
- Goal adalah kantong di atas akun simpanan lewat GoalAllocation. Satu akun bisa dibagi ke beberapa goal, dan satu goal bisa tersebar di beberapa akun.
- Batasan: jumlah alokasi sebuah akun tidak boleh melebihi saldonya. Kalau saldo turun di bawah jumlah alokasi, app menandainya dan meminta pemakai memilih goal mana yang dikurangi.
- Saldo akun simpanan yang tidak dialokasikan tampil sebagai simpanan bebas.
- Setoran ke goal adalah TRANSFER ke akun simpanan dengan `goalId`, yang menaikkan alokasi.
- Menarik tabungan adalah TRANSFER ke akun harian, dan pemakai memilih alokasi goal mana yang berkurang.
- Perkiraan tanggal tercapai = sisa target dibagi setoran rutin per periode.
- Goal dengan `isEmergencyFund` juga menampilkan nilainya dalam bulan: jumlah alokasi dibagi rata-rata pengeluaran tiga periode terakhir.

### 5.4 Investasi

Jenis aset adalah data dengan tiga setelan.

| Setelan | Pilihan |
| --- | --- |
| Satuan | gram, lot, lembar, unit, koin, nominal, atau bebas |
| Valuasi | UNITS_TIMES_PRICE, FIXED_PLUS_INTEREST, APPRAISED |
| Sumber harga | AUTO lewat provider, MANUAL, FIXED |

Paket awal jenis aset: emas, saham, reksadana, obligasi, deposito, kripto, properti, lainnya. Paket awal adalah seed yang bisa diubah, bukan kode.

- Beli dan jual mengikuti 5.1. Membeli aset bukan pengeluaran.
- Untung atau rugi belum terealisasi = nilai sekarang dikurangi (unit x harga beli rata-rata). Tidak pernah masuk pemasukan atau cashflow.
- Untung atau rugi terealisasi dicatat saat jual.
- Dividen, kupon, dan bunga dicatat sebagai INCOME dengan kategori sendiri.
- Tiap holding menampilkan kapan harganya terakhir diperbarui. Harga manual yang lebih tua dari batas tertentu diberi tanda.
- Provider harga berada di belakang antarmuka `PriceProvider` dengan satu method untuk mengambil harga terakhir sebuah simbol. Jangan menulis provider untuk sumber yang belum kamu verifikasi dokumentasinya. Tanpa provider, semua harga manual dan app tetap berfungsi penuh.

### 5.5 Mata uang asing

- Household punya satu mata uang dasar. Tiap akun dan tiap holding punya mata uang sendiri.
- Uang disimpan sebagai bilangan bulat satuan terkecil sesuai `Currency.exponent`.
- Tiap transaksi valas menyimpan nominal asli, kurs, dan `baseAmount`. Laporan historis memakai `baseAmount`, jadi tidak berubah saat kurs bergerak.
- Saldo akun valas dan nilai holding valas untuk tampilan sekarang dinilai dengan kurs referensi terbaru.
- Kurs aktual dari transaksi selalu menang atas kurs referensi.

| Kasus | Cara dicatat |
| --- | --- |
| Tukar valas | TRANSFER dari akun mata uang dasar ke akun valas, dengan `amount` dan `counterAmount` aktual |
| Belanja dari akun valas | EXPENSE di akun valas. `baseAmount` dihitung dari kurs rata-rata tertimbang saat akun itu diisi, bukan kurs hari itu |
| Belanja di luar negeri dengan kartu mata uang dasar | EXPENSE di akun kartu, `originalAmount` dan `originalCurrency` diisi, `amount` berupa perkiraan dengan `fxRateIsEstimate = true`. Saat mutasi diimport, `amount` diganti nilai yang benar-benar didebet |
| Aset dalam mata uang asing | Nilai = unit x harga x kurs. Untung atau rugi dipecah jadi dua: dari harga dan dari kurs |

- Provider kurs berada di belakang antarmuka `FxProvider`, dengan aturan verifikasi yang sama seperti harga. Tanpa provider, kurs diisi manual.

**Mode perjalanan.** Selama sebuah Trip aktif: mata uang bawaan input mengikuti Trip, tiap pengeluaran diberi `tripId` dan `excludeFromAllowance = true`, dan nilainya mengurangi alokasi goal yang dikaitkan. Kalau pengeluaran dibayar dari akun harian, app menawarkan transfer dari akun simpanan goal itu untuk menggantinya.

### 5.6 Cek saldo dan penyesuaian

- Pemakai melaporkan saldo asli sebuah akun. Selisih = saldo dilaporkan dikurangi saldo tercatat.
- Selisih nol hanya memperbarui `lastReconciledAt`.
- Selisih dengan nilai mutlak di bawah atau sama dengan batas kecil: app menyarankan kategori. Kurang berarti biaya admin, lebih berarti bunga. Kalau disetujui, dicatat sebagai EXPENSE atau INCOME dengan `isAdjustment = true`. Kalau ditolak, dicatat sebagai ADJUSTMENT netral.
- Selisih di atas batas kecil tidak langsung dicatat. App menandainya sebagai kemungkinan transaksi yang belum tercatat dan menawarkan import mutasi atau input manual. Pemakai tetap boleh memaksa penyesuaian.
- Batas kecil adalah setelan per mata uang.
- Selisih biaya yang muncul berulang tiap bulan ditawarkan untuk dijadikan Recurring.

---

## 6. Periode, jatah, budget, dan tagihan

### 6.1 Periode

- `paydayRule` menentukan tanggal gajian terjadwal tiap bulan.
- Periode baru dimulai pada tanggal gaji benar-benar dicatat kalau jatuh dalam jendela lima hari sebelum atau sesudah jadwal. Di luar jendela itu, periode dimulai pada tanggal terjadwal dan app menandai bahwa gaji belum dicatat.
- Periode sebelumnya berakhir sehari sebelum periode baru dimulai.
- Semua perhitungan hari memakai zona waktu household.

Saat periode dibuka:

1. Recurring dengan mode AUTO_POST untuk periode itu dijadwalkan.
2. Bill untuk periode itu dibuat: tagihan, cicilan, porsi InstallmentPlan.
3. Setoran goal dibuat sebagai Bill atau transfer otomatis sesuai setelan goal.
4. Saran budget dihitung dari rata-rata dua periode terakhir, tiap kategori. Kalau belum ada riwayat, budget kosong dan tidak memaksa pemakai mengisi.

### 6.2 Dana belanja dan jatah harian

Definisi:

- `pemasukanPeriode` = jumlah INCOME pada periode itu dari kategori dengan `countsToPool = true`.
- `tabunganPeriode` = jumlah setoran goal terjadwal periode itu.
- `tagihanTetap` = jumlah semua Bill periode itu, lunas atau belum.
- `danaBelanja` = `pemasukanPeriode` - `tabunganPeriode` - `tagihanTetap`.
- `belanjaVariabel(rentang)` = jumlah EXPENSE dalam rentang tanggal yang tidak terkait Bill dan tidak `excludeFromAllowance`.
- `sisaAwalHari(H)` = `danaBelanja` - `belanjaVariabel(awal periode sampai H-1)`.
- `hariTersisa(H)` = jumlah hari dari H sampai akhir periode, termasuk H.
- `jatahHarian(H)` = `sisaAwalHari(H)` dibagi `hariTersisa(H)`, dibulatkan ke bawah.
- `amanHariIni` = `jatahHarian(hari ini)` - `belanjaVariabel(hari ini)`.

Contoh yang harus jadi test: pemasukan 15.000.000, tabungan 3.000.000, tagihan tetap 4.500.000, periode 30 hari. Dana belanja 7.500.000. Sampai hari ke-10 terpakai 2.900.000. Di hari ke-11 tersisa 20 hari, jadi jatah harian 4.600.000 / 20 = 230.000. Hari itu belanja 63.000, maka aman hari ini 167.000 dan sisa sampai gajian 4.537.000.

Aturan:

- `amanHariIni` boleh negatif. Tampilkan sebagai lewat sekian, dan jatah besok otomatis mengecil karena dihitung ulang dari sisa.
- Pemasukan tambahan di tengah periode menaikkan dana belanja, dan app menawarkan untuk mengalokasikannya ke goal.
- Mode mingguan memakai rumus yang sama dengan satuan minggu.
- Pemeriksaan kewajaran: kalau jumlah saldo akun DAILY lebih kecil dari sisa dana belanja ditambah tagihan belum lunas, tampilkan peringatan bahwa mungkin ada transaksi yang belum tercatat.
- Di akhir periode, sisa dana belanja ditawarkan untuk dipindah ke goal.

### 6.3 Budget

- Budget adalah batas per kategori per periode. Yang dihitung adalah EXPENSE kategori itu dalam periode, dengan pembelian yang dicicil dihitung per porsi bulanan.
- Budget bersifat opsional. Jatah harian tetap bekerja tanpa budget.
- Status: aman, hampir habis di atas 85 persen, lewat di atas 100 persen.

### 6.4 Recurring dan Bill

- Jadwal Recurring: bulanan pada tanggal tertentu, relatif terhadap awal periode, mingguan, atau tahunan.
- AUTO_POST membuat transaksi otomatis pada tanggalnya (misalnya autodebet). CREATE_BILL membuat tagihan yang perlu ditandai lunas.
- Mencatat pembayaran yang cocok dengan Bill yang belum lunas (lewat teks, import, atau manual) menandai Bill itu lunas dan mengaitkan transaksinya.
- Recurring dengan `opensPeriod = true` adalah gaji.

### 6.5 Metrik dashboard

| Metrik | Rumus |
| --- | --- |
| Net worth | Lihat 5.2. Perubahannya dibanding akhir periode lalu |
| Cashflow periode | INCOME dikurangi EXPENSE dalam periode. TRANSFER, beli aset, dan jual aset tidak dihitung |
| Savings rate | (INCOME - EXPENSE) / INCOME untuk periode yang sudah tutup. Periode berjalan diberi label sementara |
| Tren kategori | EXPENSE per kategori untuk enam periode terakhir |

---

## 7. Input lewat AI

### 7.1 Alur

1. Pemakai mengirim teks, foto, atau file lewat bar input, menu Share di HP, atau endpoint ingest.
2. **Parser lokal dulu.** Pola sederhana dipecah tanpa model: keterangan, nominal, dan alias akun yang dikenal. Rule dari koreksi pemakai diterapkan untuk kategori.
3. Kalau parser lokal tidak yakin, atau inputnya gambar atau PDF, model dipanggil dengan batas waktu beberapa detik.
4. Model mengembalikan daftar aksi terstruktur sesuai skema di 7.3. Keluaran divalidasi dengan Zod. Yang tidak valid dibuang.
5. Kode mencocokkan nama akun, kategori, aset, dan counterparty ke data yang ada, dan mengisi nilai bawaan.
6. Yang masih kurang ditanyakan ke pemakai lewat tombol pilihan. Tidak ada tebakan.
7. Kartu konfirmasi tampil. Setelah disetujui, kode yang menyimpan.

### 7.2 Aturan parser nominal

- Mengenali akhiran ribu dan juta dalam bentuk umum, misalnya `25k`, `25rb`, `2,3jt`, `1.5 juta`, dengan pemisah ribuan titik dan desimal koma untuk locale Indonesia.
- Untuk mata uang dasar tanpa pecahan desimal dalam pemakaian sehari-hari, angka polos di bawah 1000 ditafsirkan sebagai ribuan (misalnya "bensin 150" berarti 150.000), dan tafsiran itu selalu terlihat di kartu konfirmasi. Perilaku ini adalah setelan per locale.
- Tanggal relatif (kemarin, 2 hari lalu, Jumat lalu, tanggal 28) diubah jadi tanggal pasti dan ditampilkan di kartu. Tanpa tanggal berarti hari ini.
- Mata uang asing dikenali dari kata atau kodenya.

### 7.3 Skema aksi

Model hanya boleh mengembalikan aksi dari daftar ini.

| intent | Isi utama |
| --- | --- |
| record_income | nominal, akun, kategori, tanggal |
| record_expense | nominal, akun, kategori, payee, tanggal, mata uang asal |
| record_transfer | nominal, akun asal, akun atau counterparty tujuan, tanggal |
| record_debt_or_loan | arah (meminjam, meminjamkan, membayar, dibayar), counterparty, nominal |
| split_bill | total, akun, jumlah orang atau daftar counterparty |
| asset_buy, asset_sell | aset, unit, harga per unit, akun, biaya |
| pay_bill | tagihan yang dimaksud, nominal, akun |
| balance_check | akun, saldo asli |
| correct_last | transaksi yang dimaksud, field yang diubah |
| query | nama fungsi dari daftar di 7.5 dan argumennya |
| clarify | pertanyaan dan pilihan jawaban |

Tiap aksi membawa daftar field yang belum diketahui. Satu input boleh menghasilkan beberapa aksi.

### 7.4 Contoh yang harus berjalan

| Input | Hasil |
| --- | --- |
| gajian masuk 15jt | INCOME ke akun gaji bawaan, periode baru dibuka |
| kopi 25k gopay | EXPENSE 25.000 dari e-wallet itu, kategori makan dan minum |
| kopi 25k gopay, trus makan siang 38rb bca | Dua EXPENSE dalam satu kartu |
| trf ke [akun sendiri] 3jt | TRANSFER antar akun |
| trf ke budi 2 hari lalu dari bca 100rb | Tanggal mundur dua hari, lalu pertanyaan: bayar sesuatu, meminjamkan, atau bayar hutang |
| isi bensin 150 | 150.000, kategori transport, lalu pertanyaan akun |
| beli saham ABCD 2 lot di 9000 | ASSET_BUY, unit bertambah |
| jual emas 5 gram 2,3jt | ASSET_SELL, untung atau rugi terealisasi dicatat |
| bayar listrik 450 | EXPENSE, Bill listrik periode itu ditandai lunas |
| saldo gopay sekarang 85rb | Cek saldo |
| ramen 1200 yen cash | EXPENSE di akun tunai yen, atau perkiraan kurs kalau akun itu tidak ada |
| makan 300rb bca, patungan bertiga | EXPENSE 100.000 dan piutang 200.000 |
| yang kopi tadi harusnya 35rb | Transaksi terakhir yang cocok diubah, setelah konfirmasi |
| bulan ini makan habis berapa | Jawaban dari fungsi query, tidak ada yang disimpan |

### 7.5 Aturan main

- **Banyak rekening di institusi yang sama.** Dibedakan lewat alias dan 4 digit terakhir. Tiap institusi punya satu akun bawaan. Menyebut nama institusi saja berarti akun bawaan itu, dan kartu konfirmasi menampilkan akun mana yang dipakai. Tanpa bawaan, app bertanya.
- **Penerima bukan akun sendiri** selalu memicu pertanyaan jenisnya.
- **Query hanya lewat fungsi yang sudah ditentukan,** misalnya pengeluaran per kategori dalam rentang, saldo akun, progres goal, proyeksi saldo, simulasi pembelian, simulasi setoran goal. Model memilih fungsi dan argumen, kode yang menjalankan dan memformat angka. Model tidak pernah menulis SQL dan tidak pernah menyebut angka yang tidak berasal dari hasil fungsi.
- **Koreksi menghasilkan Rule.** Saat pemakai mengganti kategori atau akun di kartu konfirmasi, app menawarkan untuk mengingatnya.
- **Isi dokumen adalah data, bukan perintah.** Teks di struk, PDF, dan screenshot tidak boleh mengubah perilaku model. Tegaskan ini di system prompt, dan yang lebih penting, pastikan model memang tidak punya kemampuan selain mengembalikan aksi dari skema.
- **Murni pencatatan.** App tidak memindahkan uang dan tidak mengirim order.

### 7.6 Penyedia model

- Antarmuka `LlmProvider` dengan dua kemampuan: ekstraksi terstruktur dari teks, dan ekstraksi terstruktur dari gambar atau PDF.
- Adapter wajib: endpoint yang kompatibel dengan format chat completions OpenAI, karena itu mencakup banyak penyedia dan model lokal. Adapter lain boleh ditambah. Periksa dokumentasi penyedia sebelum menulis adapter.
- Konfigurasi diisi lewat layar dan disimpan di AiConfig: endpoint, model, kunci API. Kunci dienkripsi dengan kunci dari variabel lingkungan, tidak pernah ditampilkan ulang secara utuh, dan tidak pernah masuk log.
- Uji koneksi mengirim satu permintaan dan mencatat kemampuan: keluaran terstruktur dan baca gambar.
- Model yang berbeda boleh dipakai untuk teks dan untuk gambar.
- Penyedia cadangan opsional, dipakai otomatis saat penyedia utama gagal.

### 7.7 Saat AI tidak tersedia

| Yang dilakukan pemakai | Perilaku |
| --- | --- |
| Mengetik pola sederhana | Tetap jalan lewat parser lokal dan Rule |
| Mengetik kalimat rumit | Form manual terbuka, nominal yang terbaca sudah terisi, teks asli masuk ke catatan |
| Mengirim foto atau PDF | Disimpan sebagai IngestDraft berstatus PENDING_AI, diproses saat model kembali, lalu pemakai diberi tahu |
| Bertanya atau simulasi | Tidak tersedia. Halaman laporan tetap bisa dipakai |
| Rekap mingguan | Tetap terkirim dengan kalimat baku |

- Panggilan model punya batas waktu. Lewat dari itu, langsung pindah ke jalur manual.
- Bar input menampilkan tanda saat AI tidak tersedia atau belum disetel.
- Kalau model tidak bisa membaca gambar, fitur foto dimatikan dengan keterangan yang jelas.
- Kalau perangkat tidak tersambung ke server, input disimpan di antrean offline perangkat dan dikirim saat tersambung.

---

## 8. Import mutasi dan pencocokan

- Pemakai mengunggah CSV atau PDF mutasi untuk satu akun. CSV dipetakan dengan kode (pemetaan kolom disimpan per akun). PDF diekstrak model.
- Akun dicocokkan lewat nomor rekening di dokumen terhadap `last4`, bukan lewat nama institusi.
- Hasilnya masuk layar review sebelum ada yang disimpan.

Pencocokan duplikat, tiap baris mutasi terhadap transaksi yang sudah ada:

- Kandidat cocok: akun sama, nominal sama, arah sama, tanggal dalam jendela dua hari (setelan), dan belum pernah dipasangkan.
- Satu kandidat: dipasangkan otomatis dan ditandai. Lebih dari satu: pemakai memilih. Tidak ada: jadi transaksi baru.
- Baris yang cocok dengan transaksi ber-`fxRateIsEstimate` memperbarui `amount` ke nilai mutasi.
- Baris yang cocok dengan Bill belum lunas menandainya lunas.

Pencocokan transfer antar akun sendiri: baris keluar di satu akun dan baris masuk di akun lain dengan nominal sama dalam jendela yang sama digabung jadi satu TRANSFER.

Setelah import, app menjalankan cek saldo terhadap saldo akhir di mutasi kalau tersedia.

---

## 9. Onboarding

### 9.1 Pemasangan pertama

- Saat belum ada pemilik, app hanya menampilkan layar pembuatan pemilik, dan layar itu meminta `SETUP_TOKEN` dari variabel lingkungan. Ini mencegah orang asing mengklaim instalasi yang sudah terbuka ke internet sebelum disetel.
- Setelah pemilik dibuat, pendaftaran tertutup selamanya. Anggota kedua hanya lewat undangan.
- Pemilik mendaftarkan passkey, dan disarankan menyetel cadangan.

### 9.2 Dua jalur setel awal

| | Isi sendiri | Dibantu AI |
| --- | --- | --- |
| Syarat | Tidak ada | Endpoint, kunci API, nama model |
| Cara mengisi | Formulir per langkah | Wawancara singkat, satu pertanyaan tiap giliran, dijawab bebas |
| Bahan tambahan | Tidak ada | Boleh melampirkan mutasi atau screenshot untuk mengisi rekening dan menemukan tagihan rutin |
| AI setelahnya | Bisa disetel belakangan | Langsung aktif |

Topik yang diisi, sama di kedua jalur: mata uang dasar, zona waktu, bahasa, aturan gajian, rekening dan saldonya, e-wallet dan tunai, hutang dan kartu kredit, aset, tagihan rutin, goal.

### 9.3 Jalur AI

1. Pemakai mengisi endpoint, kunci API, dan model. App menjalankan uji koneksi.
2. App menampilkan apa saja yang akan dikirim ke penyedia model, lalu meminta persetujuan.
3. Wawancara mengikuti daftar topik di 9.2.
4. Jawaban boleh sekaligus banyak. Topik boleh dilewati.
5. Di samping percakapan ada draf setelan yang terisi langsung dan bisa diedit dengan tangan. Di HP, draf tampil sebagai panel yang bisa dibuka.
6. Tidak ada yang disimpan sampai layar ringkasan di akhir disetujui.

Aturan:

- **Urutan dan kelengkapan topik dipegang kode, bukan model.** Kode menyimpan status tiap topik dan menentukan topik berikutnya. Model hanya merangkai pertanyaan dan mengubah jawaban jadi isian formulir. Ini membuat wawancara tetap lengkap dan konsisten di model apa pun, termasuk model lokal yang lemah.
- AI mengisi formulir yang sama dengan jalur manual. Tidak ada data yang hanya bisa dibuat lewat AI.
- Kalau uji koneksi gagal atau model mati di tengah jalan, draf tetap ada dan dilanjutkan di formulir manual dari titik yang sama. Pindah jalur bisa kapan saja.
- Wawancara tidak pernah meminta PIN, password, atau nomor kartu lengkap. Kalau pemakai mengetiknya, jangan disimpan dan beri tahu.
- Ada penunjuk progres per topik.

### 9.4 Mode contoh

Satu perintah mengisi household dengan data fiktif yang realistis untuk mencoba app. Data contoh tidak boleh menyerupai orang atau instalasi nyata.

---

## 10. Halaman

Navigasi HP: tab bawah berisi Beranda, Transaksi, Akun, Goal, Investasi. Halaman lain lewat menu. Navigasi desktop: menu samping. Bar input ada di semua halaman.

| Halaman | Isi |
| --- | --- |
| Beranda | Aman dibelanjakan hari ini beserta jatah dan terpakai, sisa sampai gajian dan jumlah hari, yang sudah ditabung, tagihan belum lunas, transaksi terakhir, draf yang menunggu review |
| Catat | Tampilan percakapan: input pemakai, kartu konfirmasi, pertanyaan dengan tombol pilihan, status tersimpan. Bisa dibatalkan |
| Transaksi | Daftar dengan filter akun, kategori, rentang tanggal, jenis, sumber, anggota. Cari. Edit, hapus, pulihkan |
| Akun | Dikelompokkan per jenis, dengan saldo, tanda terakhir dicocokkan, cek saldo, arsip. Detail akun menampilkan transaksinya |
| Hutang | Ringkasan semua akun hutang dan piutang, jatuh tempo terdekat, rencana cicilan |
| Budget | Per kategori untuk periode berjalan, dengan saran dan riwayat |
| Tagihan dan rutin | Bill periode ini, kelola Recurring, daftar langganan yang terdeteksi |
| Goal | Progres, alokasi per akun, perkiraan tercapai, simpanan bebas |
| Investasi | Holding dengan unit, harga terakhir, nilai, untung atau rugi dari harga dan dari kurs, waktu pembaruan. Kelola jenis aset |
| Dashboard | Net worth dan trennya, cashflow enam periode, savings rate, tren kategori, proyeksi saldo |
| Import | Unggah, review, pencocokan |
| Rekap | Rekap mingguan dan arsipnya |
| Perjalanan | Daftar Trip, pengeluaran per Trip |
| Setelan | Profil, household dan anggota, perangkat dan sesi, token, AI, mata uang dan kurs, kategori, notifikasi, backup dan ekspor, bahasa, tema |

Di HP, Beranda cukup ringkas untuk dibaca sekilas. Dashboard lengkap ditujukan untuk layar lebar, tapi tetap bisa dibuka di HP dengan tata letak bertumpuk.

---

## 11. Fitur tambahan

Semua masuk lingkup. Pemilik boleh mencoret.

1. **Rekap mingguan.** Terjadwal sekali seminggu pada waktu yang bisa disetel: total pengeluaran, kategori yang lewat budget, progres goal, draf yang menunggu review, akun yang lama tidak dicocokkan. Angka dari kode. Kalimat dari model kalau tersedia, kalau tidak dari template.
2. **Notifikasi.** Tagihan dan kartu kredit mendekati jatuh tempo, budget hampir habis atau lewat, hari tanpa catatan, draf selesai diproses, login dari perangkat baru, harga manual yang sudah lama, garansi mau habis. Tiap jenis bisa dimatikan.
3. **Rule dari koreksi.** Lihat 7.5.
4. **Proyeksi saldo.** Saldo harian akun DAILY untuk 30, 60, dan 90 hari ke depan dari Recurring, Bill, porsi cicilan, dan sisa dana belanja yang dibagi rata. Menandai tanggal saldo terendah dan tanggal saldo diperkirakan negatif.
5. **Patungan.** Lihat 5.2 dan 7.4.
6. **Simulasi.** Dua fungsi: pembelian dengan atau tanpa cicilan (dampak ke jatah harian dan proyeksi), dan perubahan setoran goal (dampak ke tanggal tercapai dan jatah harian). Tersedia lewat pertanyaan di bar input dan lewat form.
7. **Dana darurat dalam bulan.** Lihat 5.3.
8. **Deteksi langganan.** Payee sama, nominal mirip, jarak bulanan, minimal tiga kali: ditawarkan jadi Recurring. Perubahan nominal ditandai.
9. **Daftar harta dan hutang akhir tahun.** Ekspor posisi per 31 Desember: akun, holding dengan nilai perolehan, hutang. Format CSV dan halaman siap cetak. App tidak menghitung pajak.
10. **Struk dan garansi.** Lampiran bisa diberi tanggal garansi habis, dengan pengingat.
11. **Endpoint ringkas.** `GET /api/v1/summary` dengan token ber-scope SUMMARY_READ, mengembalikan aman hari ini, sisa periode, hari tersisa, dan net worth. Hanya baca.

Selain itu: ekspor seluruh data ke CSV dan JSON kapan saja, dan impor kembali dari ekspor itu.

---

## 12. Desain antarmuka

Muat dan ikuti semua skill desain yang tersedia (lihat bagian 0). Bagian ini adalah arah yang sudah disetujui pemilik lewat mockup.

### 12.1 Karakter

Tenang, jelas, dan terasa seperti alat, bukan seperti iklan. Angka adalah tokoh utama. Tidak ada gamifikasi, tidak ada ilustrasi maskot, tidak ada emoji sebagai ikon, tidak ada gradasi dekoratif.

### 12.2 Token awal

| Token | Nilai | Pemakaian |
| --- | --- | --- |
| Latar | `#F2F4F1` | Latar halaman |
| Permukaan | `#FFFFFF` | Kartu |
| Teks | `#12211C` | Teks utama |
| Teks redup | `#55635D` | Keterangan |
| Garis | `#DDE3DE` | Batas kartu dan pemisah |
| Aksen | `#0B5D4B` | Kartu utama, tombol utama, tab aktif, pemasukan |
| Aksen lembut | `#E3EFEA` | Chip dan item menu aktif |
| Peringatan | `#A3410A` | Teks peringatan, hampir habis, rugi |
| Batang pengeluaran | `#E8A15C` | Seri pengeluaran di chart |

- Huruf: Plus Jakarta Sans, dengan angka tabular di semua nominal. Huruf disajikan dari server sendiri, bukan dari CDN pihak ketiga.
- Sudut: 16 sampai 20 px untuk kartu, 10 sampai 12 px untuk tombol, bulat penuh untuk bar input.
- Ikon: garis, satu keluarga, satu ketebalan.
- Mode gelap wajib, diturunkan dari token yang sama dan diuji kontrasnya.
- Aksen bisa diganti pemakai dari beberapa pilihan.
- Pemasukan dan pengeluaran, untung dan rugi, tidak boleh dibedakan dengan warna saja. Selalu ada tanda plus atau minus, dan dua warna itu berbeda terang gelapnya.

Token ini titik berangkat. Skill desain boleh memperhalusnya menjadi design system yang lengkap, asal karakternya terjaga.

### 12.3 Tiga layar acuan

**Beranda di HP (390 x 844).** Dari atas ke bawah: baris tanggal dan hari ke berapa dalam periode, sapaan, tombol profil. Lalu kartu utama berwarna aksen: label "Aman dibelanjakan hari ini", nominal sangat besar, batang progres terpakai, keterangan terpakai dan jatah harian, lalu garis pemisah dan baris sisa sampai gajian dengan jumlah hari. Di bawahnya dua kartu kecil berdampingan: sudah ditabung, dan tagihan belum dibayar dengan jatuh tempo terdekat. Lalu daftar transaksi terakhir. Bar input menempel di bawah, di atas tab navigasi: tombol kamera, kolom teks dengan contoh, tombol kirim.

**Catat di HP.** Tampilan percakapan. Input pemakai sebagai gelembung berwarna aksen di kanan. Balasan app sebagai kartu putih di kiri: jumlah transaksi yang terbaca, tiap transaksi dengan nama, nominal, chip kategori, chip akun, lalu tombol simpan semua dan ubah. Pertanyaan klarifikasi tampil sebagai kartu dengan tombol pilihan. Transaksi yang sudah disimpan menampilkan tanda tersimpan. Pembatas tanggal di antara hari.

**Dashboard di desktop (1360 px, cair).** Menu samping. Di area isi: judul dan keterangan periode, bar catat cepat selebar isi dengan tombol foto atau file, import mutasi, dan catat. Baris empat kartu: aman dibelanjakan hari ini (berwarna aksen), net worth dengan perubahan, cashflow periode, savings rate. Baris berikutnya: chart pemasukan dan pengeluaran enam periode di kiri, budget per kategori dengan batang progres di kanan. Lalu daftar akun per kelompok dan goal dengan progres. Lalu tabel investasi dan tabel transaksi terbaru.

### 12.4 Syarat mutu

- Target sentuh minimal 44 px.
- Kontras teks minimal 4,5 banding 1.
- Semua kontrol adalah elemen asli (button, a, input dengan label), bisa dipakai lewat keyboard, dan punya nama untuk pembaca layar.
- Tidak ada scroll mendatar di lebar HP. Tabel lebar digulir di dalam kotaknya sendiri.
- Tiap halaman punya keadaan kosong, memuat, dan gagal yang dirancang, bukan dibiarkan.
- Nominal diformat sesuai locale dan mata uang.
- Chart mengikuti skill visualisasi data: sumbu dan label terbaca, tidak bergantung pada warna saja, ada nilai saat disentuh atau diarahkan.
- Animasi seperlunya dan menghormati preferensi kurangi gerak.

---

## 13. PWA dan perangkat

- Bisa dipasang di Android dan iPhone, dengan ikon, layar pembuka, dan tampilan mandiri.
- Web Share Target supaya app muncul di menu Share Android untuk teks, gambar, dan PDF.
- iPhone tidak mendukung Share Target untuk PWA. Sediakan panduan membuat Shortcut yang mengirim teks atau gambar ke `POST /api/v1/ingest` dengan token ber-scope INGEST. Hasilnya masuk sebagai IngestDraft untuk direview di app.
- Antrean offline: input yang dibuat tanpa koneksi disimpan di perangkat dan dikirim saat tersambung. Background Sync dipakai kalau didukung, kalau tidak, dikirim saat app dibuka.
- Web Push untuk notifikasi. Di iPhone hanya aktif setelah app dipasang ke home screen, dan panduannya harus menyebut itu.
- Service worker tidak boleh menyimpan respons API berisi data keuangan ke cache yang bertahan setelah logout.

---

## 14. Keamanan

App ini terbuka ke internet dan menyimpan data keuangan. Keamanannya harus cukup tanpa lapis tambahan di depan.

| Lapis | Yang dilakukan |
| --- | --- |
| Transport | Hanya HTTPS di belakang reverse proxy. Cookie Secure, HttpOnly, SameSite |
| Pemasangan | `SETUP_TOKEN` untuk membuat pemilik. Pendaftaran tertutup setelahnya |
| Login | Passkey sebagai utama. Password dengan argon2id ditambah TOTP sebagai cadangan. Kode pemulihan sekali pakai |
| Batas percobaan | Rate limit dan jeda bertingkat untuk login, ingest, dan uji koneksi AI |
| Sesi | Disimpan di database, daftar perangkat, cabut satu per satu, pemberitahuan login dari perangkat baru |
| Aksi sensitif | Ekspor, hapus massal, ubah AiConfig, buat token, dan undang anggota meminta autentikasi ulang |
| Token | Disimpan sebagai hash, ber-scope sempit, bisa dicabut, tampil sekali saat dibuat |
| Otorisasi | Tiap query disaring `householdId` dan aturan visibilitas akun. Uji ini dengan test, bukan dengan asumsi |
| Input | Validasi Zod di semua batas. Unggahan dibatasi jenis dan ukurannya, diperiksa isinya, metadata gambar dibuang |
| Lampiran | Disimpan di luar folder publik dan hanya disajikan lewat route yang memeriksa sesi |
| Web | Perlindungan CSRF, Content Security Policy yang ketat, header keamanan standar |
| Rahasia tersimpan | Kunci API model dan rahasia TOTP dienkripsi dengan kunci dari variabel lingkungan |
| Database | Hanya menerima koneksi lokal, dengan user khusus app ini |
| AI | Lihat 7.5. Model tidak punya kemampuan selain mengembalikan aksi dari skema |
| Log | Tidak mencatat rahasia, token, kunci, atau isi lampiran |
| Audit | Semua perubahan data keuangan masuk AuditLog beserta jalurnya |
| Backup | Dump database harian, dienkripsi, disalin ke lokasi yang disetel. Perintah restore disediakan dan diuji |

Batas kerusakan yang harus dijaga: app tidak pernah menyimpan kredensial bank dan tidak bisa memindahkan uang.

Sertakan `SECURITY.md` berisi cara melaporkan celah, dan panduan di README untuk memasang lapis akses tambahan di depan app bagi yang mau.

---

## 15. Repo, rahasia, dan pemasangan

### 15.1 Yang ada di repo dan yang tidak

| Hal | Di repo | Di luar repo |
| --- | --- | --- |
| Rahasia | `.env.example` berisi nama variabel dan nilai contoh | `.env` asli |
| Konfigurasi deploy | Contoh umum: Compose, process manager, reverse proxy | Domain, hostname, path, setelan tunnel atau proxy yang sebenarnya, di `deploy.local/` |
| Data | Seed fiktif untuk mode contoh | Dump, backup, lampiran |
| Token | Tidak ada | Hash di database |

### 15.2 Variabel lingkungan

Minimal: alamat database, `SETUP_TOKEN`, kunci sesi, kunci enkripsi data, kunci enkripsi backup, pasangan kunci VAPID, URL publik app, folder data, nama app.

- Divalidasi dengan Zod saat start. App menolak menyala kalau ada yang kosong atau lemah. Tidak ada nilai bawaan untuk rahasia.
- Sediakan perintah untuk membuat rahasia acak.
- Kunci API model tidak lewat variabel lingkungan, tapi lewat layar (lihat 7.6).

### 15.3 Pengaman

- Pemindai rahasia berjalan sebagai pre-commit hook dan di CI.
- CI menjalankan lint, pemeriksaan tipe, test, build, dan pemindaian. CI tidak punya akses ke server mana pun dan tidak melakukan deploy.
- Kalau rahasia terlanjur ter-commit: ganti kuncinya. Menghapus commit tidak cukup.

### 15.4 README dan dokumen

README bersifat umum dan berisi: apa app ini, fitur, screenshot dengan data contoh, stack, pasang cepat dengan Docker Compose, pasang manual, daftar variabel lingkungan, setel awal, cara memperbarui, backup dan restore, cara menyetel AI termasuk model lokal, memasang di HP, tanya jawab.

README tidak berisi: domain, hostname, IP, path server, nama, email, atau angka keuangan asli siapa pun.

Dokumen lain: `SECURITY.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `docs/DECISIONS.md`. Aturan isi yang sama berlaku untuk semuanya, juga untuk file instruksi coding agent.

Tulis README dalam bahasa Inggris dengan versi bahasa Indonesia di file terpisah.

### 15.5 Rilis dan pembaruan

- Versi mengikuti semantic versioning, dengan catatan perubahan.
- Perubahan struktur database hanya lewat migrasi Prisma. Migrasi dijalankan otomatis saat start, setelah backup dibuat.
- Tidak ada migrasi yang membuang data tanpa langkah eksplisit.

---

## 16. Skenario uji

Semua ini harus jadi test otomatis.

**Logika uang**

1. Contoh jatah harian di 6.2 menghasilkan 230.000, 167.000, dan 4.537.000.
2. Transfer antar akun sendiri tidak mengubah total pengeluaran, dana belanja, atau net worth.
3. Belanja 500.000 dengan kartu kredit: pengeluaran naik 500.000, saldo kartu jadi -500.000, jatah hari itu terpotong. Membayar tagihan 500.000: pengeluaran tidak berubah, saldo kartu jadi 0.
4. Meminjamkan 200.000 lalu dibayar: tidak ada pengeluaran dan tidak ada pemasukan di kedua langkah.
5. Patungan 300.000 bertiga: pengeluaran 100.000, piutang 200.000.
6. Pembelian 12.000.000 dicicil 12 bulan: saldo kartu langsung -12.000.000, jatah hari itu tidak berubah, tiap periode ada tagihan tetap 1.000.000 yang masuk budget kategorinya.
7. Beli aset bukan pengeluaran. Beli 10 unit di 100 lalu 10 unit di 200: harga beli rata-rata 150. Jual 5 unit di 300: untung terealisasi 750.
8. Kenaikan harga aset mengubah net worth tapi tidak mengubah pemasukan atau cashflow.
9. Cek saldo dengan selisih -700 menyarankan biaya admin dan, setelah disetujui, saldo sama dengan yang dilaporkan. Selisih besar tidak langsung dicatat.
10. Transaksi bertanggal mundur ke periode lalu mengubah angka periode itu dan saldo sekarang, bukan dana belanja periode berjalan.
11. Transaksi valas menyimpan `baseAmount` yang tidak berubah saat kurs referensi berubah, sementara nilai saldo sekarang berubah.
12. Belanja luar negeri dengan kurs perkiraan diperbarui ke nilai mutasi saat import, tanpa membuat duplikat.
13. Jumlah alokasi goal tidak bisa melebihi saldo akun. Penarikan di bawah jumlah alokasi meminta pemakai memilih goal.
14. Periode dimulai pada tanggal gaji dicatat kalau dalam jendela, dan pada tanggal terjadwal kalau tidak.

**Input**

15. Semua baris di tabel 7.4 menghasilkan aksi yang benar, dengan model tiruan untuk yang butuh model.
16. Pola sederhana berhasil tanpa memanggil model sama sekali.
17. Dengan model mati: pola sederhana tetap tersimpan, kalimat rumit membuka form terisi, foto masuk antrean dan diproses saat model kembali.
18. Keluaran model yang tidak sesuai skema ditolak dan tidak pernah mencapai database.
19. Teks dalam dokumen yang berisi perintah tidak menghasilkan aksi di luar skema.
20. Institusi dengan tiga akun: menyebut nama institusi memilih akun bawaan, dan kartu menampilkannya.

**Import**

21. Mengimport mutasi yang berisi transaksi yang sudah dicatat manual tidak membuat duplikat.
22. Transfer yang muncul di dua mutasi digabung jadi satu.

**Keamanan dan repo**

23. Tanpa `SETUP_TOKEN` yang benar, pemilik tidak bisa dibuat. Setelah pemilik ada, pendaftaran tertutup.
24. Anggota tidak bisa membaca akun PRIVATE milik anggota lain lewat halaman maupun API.
25. Token ber-scope SUMMARY_READ tidak bisa menulis. Token INGEST tidak bisa membaca data.
26. Lampiran tidak bisa diambil tanpa sesi.
27. App menolak menyala dengan rahasia kosong.
28. Pemindai rahasia bersih di seluruh riwayat repo.
29. Pencarian teks di repo tidak menemukan domain, hostname, IP, atau nama pribadi.

**Pemasangan**

30. Dari mesin bersih: clone, salin `.env.example`, isi rahasia dengan perintah yang disediakan, jalankan Compose, buat pemilik, selesaikan setel awal jalur manual, catat satu transaksi. Semua tanpa langkah yang tidak tertulis di README.
31. Mode contoh terisi dan semua halaman tampil tanpa galat.
32. Backup lalu restore ke database kosong menghasilkan saldo yang sama.

**Antarmuka**

33. Tiap halaman lolos pemeriksaan aksesibilitas otomatis dan tidak punya scroll mendatar di 390 px.
34. Screenshot tiap halaman di 390 px dan 1360 px, mode terang dan gelap, sudah direview dengan skill desain.

---

## 17. Urutan pengerjaan

Semua tahap masuk lingkup. Urutannya mengikuti ketergantungan.

1. **Fondasi.** Repo dengan `.gitignore`, pemindai rahasia, CI, validasi variabel lingkungan, skema Prisma, Docker Compose, design system dari token di bagian 12 dengan skill desain.
2. **Inti buku besar.** Domain di bagian 5 dan 6 sebagai fungsi murni dengan test 1 sampai 14.
3. **Autentikasi dan pemasangan pertama.** Pemilik, passkey, cadangan, sesi, perangkat.
4. **Pencatatan manual.** Akun, kategori, transaksi, hapus lunak, audit. Halaman Akun dan Transaksi.
5. **Periode dan beranda.** Periode, Recurring, Bill, jatah harian, budget, goal. Halaman Beranda, Budget, Tagihan, Goal.
6. **Hutang, investasi, dan mata uang.** Semua jenis akun hutang, cicilan, holding, harga, kurs, mode perjalanan.
7. **Setel awal jalur manual dan mode contoh.**
8. **Input AI.** Parser lokal, antarmuka penyedia, skema aksi, kartu konfirmasi, klarifikasi, Rule, query, jalur gagal. Halaman Catat.
9. **Setel awal jalur AI.**
10. **Import mutasi dan pencocokan.**
11. **PWA.** Manifest, service worker, antrean offline, Share Target, endpoint ingest, Web Push.
12. **Dashboard dan fitur tambahan.** Bagian 11.
13. **Mode berdua.** Undangan, visibilitas, tampilan per anggota.
14. **Pengerasan dan dokumen.** Bagian 14, backup dan restore, README dua bahasa, dokumen pendukung, review desain menyeluruh, skenario 23 sampai 34.

Akhiri tiap tahap dengan test lolos, commit, dan laporan ke pemilik.

---

## 18. Yang harus ditanyakan ke pemilik

Jangan menebak hal-hal ini. Pekerjaan lain tidak perlu menunggu jawabannya.

1. **Nama app.** Sampai dijawab, pakai nilai `APP_NAME` dengan nama kerja yang netral.
2. **Lisensi.** Jangan membuat file lisensi sampai pemilik memilih. Repo tetap private sampai ini diputuskan.
3. **Penyedia model yang dipakai pemilik sendiri,** untuk diuji sungguhan sebelum dianggap selesai.
4. **Detail deploy pemilik.** Domain, cara proxy, lokasi backup. Simpan di `deploy.local/`, tidak pernah di repo.
5. **Kapan repo dibuka publik.** Sebelum dibuka, jalankan ulang skenario 28 dan 29 pada seluruh riwayat.
6. **Fitur di bagian 11 yang mau dicoret,** kalau ada.

---

## 19. Di luar lingkup

- Koneksi langsung ke bank atau scraping aplikasi bank.
- Mengeksekusi transaksi, transfer, atau order.
- Pembukuan usaha.
- Saran investasi.
- Perhitungan pajak.
- Gamifikasi.
- Layanan multi-tenant untuk banyak household yang tidak saling kenal dalam satu instalasi.
