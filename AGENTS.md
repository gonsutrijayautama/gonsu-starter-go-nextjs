# AGENTS.md — Produk Contoh

<!-- gonsu-kit:begin -->
> **Repository ini adalah STARTER KIT, bukan produk.** `gonsu new` menyalinnya
> menjadi project produk dan mengganti identitas contohnya. Sebelum mengubah
> apa pun di sini, baca `KIT.md`: aturan identitas contoh, tag `kit-v*`, dan
> berkas yang hanya milik kit. Sisa berkas ini adalah instruksi yang akan
> dibaca tim produk — sunting sebagai dokumen produk.
<!-- gonsu-kit:end -->

Produk GONSU One (`produk-contoh`), dibuat dengan `gonsu new`. Berkas ini
dibaca manusia maupun agen AI (Claude Code, Codex, Cursor, Copilot, dan
lainnya) sebelum mengubah kode. Bacalah seluruhnya sebelum tugas pertama.

GONSU One menjual, memasang, dan melisensikan produk ini. Login, sandi,
pembayaran, dan pemasangan adalah urusan GONSU. Tugas produk adalah **bisnis
aplikasinya**: modul, data, dan layar yang dipakai pelanggan.

## Peta project

| Path | Isi |
|---|---|
| `cmd/api/main.go` | titik masuk: migrasi lalu melayani `:8080`; subperintah `migrate` dan `users` |
| `cmd/api/routes.go` | merangkai kit GONSU, sesi, dan route — **modul baru dipasang di sini** |
| `cmd/api/users.go` | perintah operator `produk-contoh users list\|grant\|suspend` |
| `internal/apperr` | katalog kode galat API dan konstruktornya |
| `internal/authn` | sesi, login lewat GONSU (`gonsu.go`), Pengguna & Akses (`users.go`), `Check` |
| `internal/authz` | permission, role, dan matriks role → permission |
| `internal/config` | variabel environment, divalidasi saat start |
| `internal/entitlement` | `ProductCode`, key hak pakai, `Guard`, status lisensi |
| `internal/httpx` | router, helper JSON, envelope galat, pembatas laju, penyaji frontend |
| `internal/idempotency` | `Idempotency-Key` untuk pembuatan data |
| `internal/modules` | **modul standar GONSU** dari library `gonsu-appkit-go`: profil bisnis, media, wilayah — hanya perekatnya yang ada di sini |
| `internal/notes` | **modul contoh Catatan** — pola yang ditiru setiap modul baru |
| `internal/security` | test yang membaca kode: setiap izin ditegakkan, setiap query menyaring tenant |
| `internal/storage` | koneksi PostgreSQL dan migrasi |
| `internal/tenant` | organization pemasangan — satu-satunya sumber `organization_id` |
| `internal/testdb` | database test dan pembuat pengguna test |
| `internal/<module>/store` | **hasil `sqlc`** — jangan diedit tangan |
| `migrations/` | migrasi SQL goose, di-embed ke binary |
| `web/` | frontend; hasil build-nya di `web/out` dan di-embed ke binary — aturannya di `web/AGENTS.md` dan panduan UI di `web/docs/ui-guide.md` |
| `Dockerfile` | image rilis: frontend, lalu binary TANPA tag `dev`, di atas alpine sebagai UID 10001 |
| `.github/workflows/ci.yml` | CI setiap PR — memanggil target make yang sama dengan di laptop |
| `.github/workflows/release.yml` | rilis ke GONSU saat tag `v*`; disalin dari pipeline GONSU One — jangan ditulis ulang |
| `scripts/` | `smoke.sh` (image rilis di bawah batasan chart GONSU) dan `e2e.sh` (server untuk uji peramban) |

Stack sudah diputuskan: `net/http` + `chi`, `pgx/v5`, `sqlc`, `goose`,
`log/slog`. Jangan menambah ORM, router HTTP lain, atau Redis.

## Perintah

```sh
make run         # database + server Go build dev di 127.0.0.1:18080
make web-dev     # frontend dengan hot reload di http://localhost:3000
make test        # seluruh test, build rilis dan build dev, terhadap database lokal
make lint        # go vet, gofmt, eslint, dan typecheck frontend
make build       # frontend lalu binary rilis ke bin/app
make generate    # kode sqlc dari migrations/ dan internal/*/queries.sql
make e2e         # uji peramban (web/e2e) terhadap server build dev, database app_e2e
make smoke       # image rilis dibangun lalu diuji di bawah batasan chart GONSU
```

Build `dev` punya login pengembangan:
`http://localhost:3000/auth/login?as=administrator` (atau `staff`, `viewer`).
Port bentrok? `DEV_DB_PORT=15433` untuk database, `DEV_HTTP_PORT=18081` untuk
server Go.

## Resep: menambah modul bisnis

Contoh: modul faktur, `invoices`. Tiru `internal/notes` berkas demi berkas.

1. **Migrasi** `migrations/00003_invoices.sql` — nomor berikutnya, nama
   Inggris, blok `-- +goose Up` dan `-- +goose Down`. Aplikasi hanya
   menjalankan migrasi naik; blok Down untuk membaca ulang maksud migrasinya,
   tidak perlu diuji. Setiap tabel bisnis:
   - `organization_id uuid NOT NULL` dan `UNIQUE (organization_id, id)`;
   - rujukan ke tabel lain lewat foreign key **komposit**
     `(organization_id, <kolom>)`, supaya rujukan lintas tenant ditolak database;
   - index diawali `organization_id`;
   - id `uuid PRIMARY KEY DEFAULT uuidv7()`.
2. **Query** `internal/invoices/queries.sql`. Setiap query menyaring
   `organization_id = @organization_id` — termasuk `UPDATE` dan `DELETE`.
   Salin blok `notes` di `sqlc.yaml`, ganti path-nya, lalu `make generate`.
   `models.go` di setiap paket `store` ikut berubah — itu wajar, karena setiap
   paket membawa model seluruh tabel; commit semuanya.
3. **Izin** di `internal/authz/authz.go`: `InvoicesRead`, `InvoicesWrite`
   (`"invoices.read"`, `"invoices.write"`), lalu isi `grants`. Izin tanpa
   pemakai atau tanpa role membuat `internal/security` gagal.
4. **Service** `internal/invoices/invoices.go`. Setiap method dimulai dengan
   urutan yang sama — izin dulu, lalu tenant:
   ```go
   p, err := authn.Check(ctx, authz.InvoicesWrite)
   // ...
   org, err := tenant.OrganizationID(ctx)
   ```
   Sesudah itu validasi (`apperr.Validation` dengan `apperr.FieldError` per
   field), lalu query. Data yang tidak ada — **termasuk milik pemasangan
   lain** — dijawab `apperr.NotFound`. Keadaan yang tidak mengizinkan
   tindakan, atau nilai unik yang sudah dipakai, dijawab `apperr.Conflict`
   (lihat "Pola yang sering dibutuhkan"). Pembuatan data memakai
   `idempotency.Replay`/`Claim`/`Complete` di transaksi yang sama, persis
   seperti `notes.Create`.
5. **HTTP** `internal/invoices/http.go`: `Routes(r chi.Router, s *Service,
   logger *slog.Logger)`. Handler hanya membaca request dan menulis jawaban:
   `httpx.ReadBody`, `httpx.DecodeJSON` (field tak dikenal ditolak),
   `httpx.WriteJSON`, `httpx.WriteError`. Daftar dijawab `{"data": [...]}`
   dengan `httpx.QueryLimit`. Tidak ada logika bisnis di handler.
6. **Pasang** di grup `business` pada `cmd/api/routes.go`, di samping
   `notes.Routes`. Grup itu sudah dijaga sesi, CSRF, pembatas laju, dan hak
   pakai utama.
7. **Test** `cmd/api/invoices_test.go`, meniru `TestCreateNoteOverHTTP`,
   `TestCreateNoteGuards`, dan `TestNotesAreTenantScoped` di
   `cmd/api/routes_test.go`. Helper-nya: `testdb.New`, `testdb.Tenant`, dan
   `testdb.User` untuk database dan pengguna; `newApp`, `sessionFor`, `do`,
   dan `errorCode` di `cmd/api/routes_test.go`; `countRows` di
   `cmd/api/users_admin_test.go`. Minimal:
   - jalur normal;
   - role yang tidak berizin ditolak `PERMISSION_DENIED`;
   - data pemasangan lain dijawab 404 di setiap route ber-`{id}`;
   - `Idempotency-Key` yang diulang tidak menggandakan data;
   - isian yang salah ditolak `VALIDATION_FAILED`.
8. **Layar** di `web/` — resepnya di `web/AGENTS.md`.
9. `make generate && make lint && make test && make build`, lalu `make e2e`
   bila layar berubah.

**Modul contoh Catatan** tetap ada sampai tim memutuskan membuangnya — itu
tugas tersendiri, jangan dikerjakan sekaligus dengan modul lain kecuali
diminta. Saat membuangnya:

- hapus `internal/notes`, izinnya, blok `sqlc.yaml`, route, dan test-nya;
- buang tabelnya lewat migrasi **baru** (`DROP TABLE notes`), bukan dengan
  menghapus `00002_notes.sql`. Bila produk sudah pernah dirilis, pelanggan
  mungkin sudah menulis catatan — tanya manusia dulu;
- perbarui resep di berkas ini supaya menunjuk ke modul pengganti sebagai
  contoh.

## Modul standar GONSU

Profil bisnis, media, dan wilayah datang dari library
`github.com/gonsutrijayautama/gonsu-appkit-go`, dipasang di
`internal/modules`. Kodenya sama di setiap produk GONSU.

- **Jangan menulis ulang atau menyalin kodenya ke sini.** Perilaku yang perlu
  berubah diubah di library, lalu produk ini `go get` versi barunya.
- **Tabelnya berawalan `appkit_`** dan dimigrasikan `appkit.Migrate` saat
  start, sebelum migrasi produk (`cmd/api/main.go`). Jangan mengubah tabel itu
  lewat `migrations/`. Tabel produk boleh merujuknya dengan foreign key
  komposit `(organization_id, id)`.
- **Identitas bisnis dibaca dari profil, tidak ditulis di kode.** Modul yang
  butuh nama, alamat, atau logo bisnis — kepala dokumen, struk — menerima
  `Profiles` dari `modules.Standard` lewat konstruktornya dan memanggil
  `Lookup(ctx, org)`, dengan `org` dari `tenant.OrganizationID(ctx)`.
- **Media hanya untuk berkas PUBLIK.** `/media/{id}` dibuka tanpa sesi; jangan
  menyimpan berkas yang butuh izin di sana.
- **Izin library dipetakan di `permissions`** (`internal/modules`). Izin
  library yang belum dipetakan ditolak, jadi modul baru dari library tidak
  terbuka hanya karena di-upgrade.
- Test-nya `TestBusinessProfileOverHTTP` dan kawan-kawannya di
  `cmd/api/modules_test.go`; layar dan uji perambannya di
  `web/app/(app)/settings/business` dan `web/e2e/business-profile.spec.ts`.

## Pola yang sering dibutuhkan

- **Status yang mengunci data** (faktur terbit tidak boleh diubah):
  - status berupa kolom `text` dengan `CHECK (status IN ('DRAFT', 'ISSUED'))`
    — huruf besar, seperti `ACTIVE`/`SUSPENDED` di `application_users`;
  - perpindahan status lewat aksi sendiri, `POST /v1/invoices/{id}/issue`,
    bukan field `status` di body PUT;
  - kuncinya dijaga query, bukan hanya kode: `UPDATE … WHERE
    organization_id = @organization_id AND id = @id AND status = 'DRAFT'`.
    Nol baris berubah → baca ulang untuk membedakan `apperr.NotFound` dari
    `apperr.Conflict("Faktur ini sudah terbit, jadi tidak bisa diubah lagi.")`;
  - aksi yang diulang pada keadaan tujuannya (menerbitkan faktur yang sudah
    terbit) dijawab sukses apa adanya, supaya retry aman.
- **Nilai unik per pemasangan** (nomor faktur): constraint bernama di
  migrasi, `CONSTRAINT invoices_number_unique UNIQUE (organization_id,
  number)`. Di service, `storage.IsUniqueViolation(err,
  "invoices_number_unique")` → `apperr.Conflict("Nomor faktur sudah
  dipakai.", apperr.FieldError{Field: "number", Message: "…"})`.
- **Uang**: rupiah utuh disimpan `bigint` dengan `CHECK` batas atas
  9007199254740991 supaya JavaScript tidak membulatkannya. Nilai berpecahan
  (kuantitas, kurs) memakai `numeric`, yang menjadi `string` di Go dan JSON.
  Jangan pernah `float`.
- **Kode galat baru** ditambahkan di katalog `internal/apperr` beserta status
  HTTP-nya, tidak diciptakan di handler.

## Resep: izin dan role

- **Izin baru**: konstanta di `internal/authz`, lalu barisnya di `grants`.
  Service memeriksa izin, tidak pernah nama role.
- **Role baru**: konstanta, `Roles`, dan `grants` di `internal/authz`, lalu
  migrasi baru yang mengganti constraint
  `application_users_application_role_check`. Role milik produk ini; GONSU
  hanya menjawab siapa orangnya.

## Resep: fitur berbayar (hak pakai)

Kode tidak mengenal nama paket; kode hanya membaca **key hak pakai**.

1. Konstanta key di `internal/entitlement`, berawalan kode produk:
   `InvoicesExport = "produk-contoh.invoices.export"`. Jangan menulis key
   sebagai string di modul lain.
2. Key yang **persis sama** didaftarkan di Console GONSU (Katalog → produk ini
   → Hak pakai), lalu nilainya diisi di setiap paket. Key yang salah ketik
   berarti fitur mati diam-diam.
3. Pemakaiannya:
   - fitur ya/tidak untuk sekelompok route: `entitlement.Guard(a.license,
     entitlement.InvoicesExport)` di `cmd/api/routes.go`;
   - di dalam service: `Feature(ctx, key)` dari `entitlement.Resolver` yang
     diterima lewat konstruktor service, seperti `authn.NewUserAdmin`;
   - batas angka: `Limit(ctx, key)` — contohnya `users.max` di
     `internal/authn/users.go`.
4. Tidak perlu menulis tawaran upgrade: penolakan `ENTITLEMENT_REQUIRED` di
   frontend otomatis menawarkan "Lihat paket" kepada administrator (`ApiFailure`
   dan toast gagal), lewat `/auth/gonsu/portal/plans` milik kit GONSU.

Jangan pernah `if plan == "pro"`.

## Tidak boleh dilanggar

- **Tidak ada login atau sandi buatan sendiri.** Login lewat GONSU (kit web
  SDK). Tidak ada kolom password hash, formulir login, lupa sandi, atau ganti
  sandi — "Akun saya" adalah tautan ke GONSU.
- **Terbukti login ≠ berhak masuk.** Orang dicari di `application_users`
  lewat `sub`, bukan email. Jangan pernah membuat pengguna dari login pertama.
- **`organization_id` hanya dari `tenant.OrganizationID(ctx)`** — tidak dari
  body, query string, maupun environment. Setiap query tabel tenant-scoped
  menyaringnya; `internal/security` memeriksanya dengan membaca kode.
- **Izin diperiksa di service** (`authn.Check(ctx, authz.X)`), bukan dengan
  menyembunyikan tombol. Izin yang didefinisikan wajib dipakai.
- **Hak pakai lewat key, bukan nama paket.** Key hanya dikenal
  `internal/entitlement` sebagai konstanta.
- **Data milik pemasangan lain dijawab "tidak ditemukan"**, bukan "ditolak".
- **Pembuatan data idempotent** (`Idempotency-Key`), seperti `notes.Create`.
- **Migrasi hanya bertambah.** Berkas yang sudah pernah diterapkan tidak diubah;
  perubahan skema selalu berkas baru.
- **Kode sqlc di-commit dan tidak diedit tangan**: ubah `queries.sql`, lalu
  `make generate`.
- **Login pengembangan hanya di balik build tag `dev`**, tidak pernah di balik
  pemeriksaan environment.
- **Satu binary di `:8080`**, migrasi saat start, filesystem read-only.
  `make smoke` membuktikannya pada image rilis.
- **Image rilis tanpa tag `dev`.** `Dockerfile` dan `release.yml` tidak pernah
  memakai `-tags dev`.
- **`release.yml` hanya dipicu tag.** Jangan menambahkan trigger
  `pull_request` atau `push` ke branch: runner-nya memegang hak menandatangani
  image atas nama GONSU.
- **Tanpa rahasia di repository.** Nilai rahasia datang dari environment yang
  diisi GONSU atau operator.

## Tanya manusia dulu sebelum

- mengubah `ProductCode` atau key hak pakai yang sudah didaftarkan di Console;
- mengubah alur login (`/auth/*`, `internal/authn/gonsu.go`) atau cara sesi
  diperiksa;
- mengubah atau menghapus migrasi yang sudah ikut rilis;
- menambah pengecualian di `queryExceptions` (`internal/security`);
- menghapus tabel atau kolom yang sudah ikut rilis — data pelanggan ikut
  hilang;
- menambah dependency besar, service tambahan, atau port selain `:8080`;
- mendorong tag `v*` — tag menerbitkan rilis ke pelanggan;
- mengubah `release.yml`, `IMAGE_PATH`, atau digest base image di `Dockerfile`.

## Konvensi

- **Bahasa.** Identifier, nama berkas (termasuk migrasi), tabel, kolom, field
  JSON, dan path URL dalam bahasa Inggris. Komentar dan teks yang dibaca
  pengguna dalam bahasa Indonesia yang santai dan langsung.
- **JSON** memakai `snake_case`.
- **Galat**: kembalikan `apperr.*` untuk galat yang boleh dibaca pengguna.
  Galat lain menjadi 500 dengan `request_id`, dan rinciannya hanya masuk log.
- **`context.Context`** diteruskan ke setiap query dan panggilan jaringan.
- **Test** memakai PostgreSQL sungguhan lewat `internal/testdb`, bukan mock
  database. Tanpa `TEST_DATABASE_URL` test database di-skip — jalankan lewat
  `make test`.
- **Komentar** menjelaskan *mengapa*, bukan mengulang *apa* yang dilakukan kode.
- **`internal/security`** punya ambang minimal jumlah izin, tabel, dan query
  yang terbaca, supaya pengurai yang rusak tidak lolos diam-diam. Naikkan
  ambangnya ketika modul bertambah; jangan pernah menurunkannya untuk
  meloloskan test.

## Sebelum menyatakan selesai

- [ ] `make lint`, `make test`, dan `make build` bersih.
- [ ] `make e2e` bersih bila layar atau alur login berubah; uji di `web/e2e`
      ditambah untuk alur baru yang penting.
- [ ] `make smoke` bersih bila `Dockerfile`, route `/auth/*`, atau cara
      aplikasi start berubah.
- [ ] Layar yang berubah sudah dibuka di tema terang dan gelap, dan di lebar
      ponsel — lint tidak dapat melihat tampilan.
- [ ] `go tool sqlc diff` bersih (kode sqlc sama dengan `queries.sql`).
- [ ] Modul baru punya test izin, test tenant, dan test idempotency.
- [ ] Key hak pakai baru sudah disampaikan ke manusia supaya didaftarkan di
      Console.
- [ ] `README.md` diperbarui di commit yang sama bila perilaku yang terlihat
      pengguna berubah.
