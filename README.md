# Produk Contoh

Produk GONSU One, dibuat dengan `gonsu new`.

| | |
|---|---|
| Kode produk | `produk-contoh` — **harus sama persis** dengan kode produk di Console GONSU |
| Varian | `web` |
| Repository image | `products/produk-contoh-web` |
| Hak pakai utama | `produk-contoh.core` — daftarkan di Console, lalu isi di setiap paket |
| Kuota pengguna | `users.max` — daftarkan di Console, lalu isi di setiap paket |
| Backend | Go (`github.com/gonsutrijayautama/gonsu-starter-go-nextjs`) |
| Frontend | Next.js |

## Yang sudah ada sejak awal

- **Login lewat GONSU** — produk tidak punya formulir login maupun sandi. Kit
  web SDK GONSU melayani `/auth/gonsu/*`; `internal/authn/gonsu.go` menjawab
  bagian milik produk: siapa yang diberi akses, admin pertama, dan sesi.
  Login yang gagal diarahkan ke `/sign-in/?error=<sebab>` — `not-granted`,
  `expired`, `unreachable`, `not-configured`, atau `rejected` — dan halaman
  frontend itu yang menyusun pesannya.
- **Pengguna & Akses** — `GET/POST/PATCH /v1/users`: memberi akses login lewat
  email, mengubah role, menonaktifkan, dengan kuota `users.max` dari paket.
- **Hak pakai** — `internal/entitlement`: `Guard(produk-contoh.core)` menjaga seluruh
  API bisnis; lisensi yang tidak aktif menolak mutasi, bukan membaca.
- **Tautan ke Portal GONSU** — "Kelola langganan" (menu akun, Pengaturan →
  Lisensi), "Bayar tagihan" (banner lisensi), dan "Lihat paket" saat fitur
  belum termasuk paket atau kuota penuh. Kit GONSU yang tahu alamat Portal dan
  bisnisnya (`/auth/gonsu/portal/*`); tampil hanya bagi administrator (izin
  `settings.subscription.view`, dijaga server).
- **Pembatas laju** — `internal/httpx/ratelimit.go`: login per alamat IP,
  mutasi per pengguna, pembacaan tidak dibatasi.
- **Satu organization per pemasangan** — `internal/tenant`, satu-satunya
  sumber `organization_id`.
- **Modul standar GONSU** — `internal/modules` memasang library
  `gonsu-appkit-go`. Kodenya sama di setiap produk GONSU dan di-upgrade lewat
  `go get`; yang milik produk ini hanya pemetaan izinnya.
  - **Profil bisnis** (`/v1/business-profile`, layar Pengaturan → Profil
    bisnis): nama, kontak, NPWP, alamat, dan logo. Nama dan logonya tampil di
    sidebar. Izin `settings.business.manage`.
  - **Website** (`/v1/website`, layar Pengaturan → Website): halaman depan
    publik — hanya pintu masuk (bawaan), atau web perusahaan dengan tentang,
    layanan, kontak, dan kanal. Izin `settings.website.manage`.
  - **Media** (`/media/{id}`): logo dan gambar halaman depan sebagai berkas
    publik.
  - **Wilayah** (`/v1/regions`): wilayah Indonesia sampai desa, untuk pemilih
    alamat.
- **Halaman depan membawa identitas bisnis** — server Go menyisipkan judul,
  deskripsi, tag pratinjau tautan, dan datanya ke `/` saat disajikan
  (`httpx.Options.Home`), jadi tautan yang dibagikan tampil dengan nama dan
  logo bisnis, dan halamannya tidak memanggil API. Data yang sama ada di
  `/site.json`. Simpan bersamaan dua orang dijaga `version`: yang belakangan
  ditolak, tidak menimpa.
- **Modul contoh Catatan** — `internal/notes` dan layar `web/app/(app)/notes`:
  pola lengkap satu modul bisnis, dari tabel sampai layar.
- **Frontend** — Next.js di `web/`, di-build sebagai halaman statis lalu
  di-embed ke binary: satu binary, satu port, tanpa server Node. Kerangkanya
  sama dengan Console dan Portal GONSU One (sidebar, breadcrumb, menu akun,
  tema terang/gelap, toast di atas-tengah), seluruh komponen shadcn dan 22
  komponen ReUI sudah terpasang, dan halaman bawaannya: halaman depan di `/`
  (isinya dari pengaturan Website), masuk, dasbor, Catatan, Pengaturan →
  Profil bisnis, Website, Pengguna & Akses, dan Lisensi, halaman 404.
- **Panduan UI yang ditegakkan lint** — [web/docs/ui-guide.md](web/docs/ui-guide.md):
  komponen apa yang dipakai, pola formulir, toast, konfirmasi, warna, dan teks.
  `make lint` menolak pelanggarannya.
- **CI dan pipeline rilis** — `.github/workflows/ci.yml` di setiap PR (lint,
  tes, uji peramban, image rilis, pemindaian kerentanan) dan
  `.github/workflows/release.yml` saat tag `v*` didorong: image dibangun,
  dipindai, didaftarkan, ditandatangani GONSU, dan diterbitkan. Berkas itu
  hanya memanggil workflow rilis GONSU; tidak ada runner sendiri dan hanya
  satu secret. Lihat [Merilis ke GONSU](#merilis-ke-gonsu).

## Menjalankan di laptop

Butuh Go, Docker, dan [bun](https://bun.sh).

```sh
make run        # database + server Go build dev di http://127.0.0.1:18080
make web-dev    # terminal lain: frontend dengan hot reload di http://localhost:3000
make test       # seluruh tes, build rilis dan build dev
```

Build `dev` membawa **login pengembangan**: buka
`http://localhost:3000/auth/login?as=administrator` (atau `?as=staff`,
`?as=viewer`). Binary rilis tidak membawanya sama sekali.

| Perintah | Kegunaan |
|---|---|
| `make run` | server Go build dev di 127.0.0.1:18080 (migrasi saat start) |
| `make web-dev` | frontend dengan hot reload; `/v1`, `/auth`, `/media`, dan `/site.json` diteruskan ke `make run` |
| `make build` | frontend lalu binary rilis ke `bin/app` |
| `make db` / `make down` | menyalakan / menghentikan database lokal |
| `make migrate` | menjalankan migrasi ke database lokal |
| `make generate` | kode query sqlc dari `migrations/` dan `internal/*/queries.sql` |
| `make test` | tes unit + integrasi |
| `make lint` | `go vet`, `gofmt`, eslint, dan typecheck frontend |
| `make e2e` | uji peramban (Playwright, `web/e2e`) terhadap server build dev dengan database `app_e2e` sendiri |
| `make image` | image rilis `produk-contoh:<VERSION>` dari `Dockerfile` — sama dengan yang dibangun `release.yml` |
| `make smoke` | image rilis dijalankan di bawah batasan chart GONSU dan diperiksa (`scripts/smoke.sh`) |

Port bentrok dengan project lain? `DEV_DB_PORT=15433` untuk database,
`DEV_HTTP_PORT=18081` untuk server Go, `E2E_HTTP_PORT=18092` untuk server
`make e2e` — berlaku di setiap target.

## Menambah modul bisnis

Ikuti bentuk `internal/notes`:

1. migrasi baru di `migrations/`, nomor berikutnya dengan nama Inggris
   (`00003_invoices.sql`) — tabel dengan `organization_id` dan foreign key
   komposit `(organization_id, id)`;
2. `internal/<module>/queries.sql`, daftarkan di `sqlc.yaml`, lalu `make generate`;
3. izin baru di `internal/authz` beserta role yang memegangnya;
4. service yang memanggil `authn.Check` dan `tenant.OrganizationID` lebih dulu;
5. route dipasang di grup API bisnis `cmd/api/routes.go`;
6. layarnya di `web/` — resepnya di [web/AGENTS.md](web/AGENTS.md).

Aturan lengkapnya ada di [AGENTS.md](AGENTS.md).

## Merilis ke GONSU

Rilis adalah image di registry GONSU yang dipindai, ditandatangani, dan
diterbitkan GONSU sendiri. Rilis yang terbit tidak memasang dirinya sendiri:
aplikasi cloud diperbarui lewat peluncuran yang dimulai staf GONSU di Console,
atau oleh pelanggan sendiri dari Portal.

`.github/workflows/release.yml` hanya memanggil workflow rilis GONSU
([gonsu-release](https://github.com/gonsutrijayautama/gonsu-release)). Job-nya
berjalan di runner GitHub dan tidak memegang kunci penandatangan: GONSU
menandatangani image setelah memeriksa bukti dari GitHub bahwa rilis itu
dibangun repository ini, dari tag itu.

**Sekali, sebelum rilis pertama** — dikerjakan bersama tim platform GONSU:

1. **Katalog di Console GONSU**: produk berkode `produk-contoh`, variant
   `web`, hak pakai `produk-contoh.core` dan `users.max`, paket beserta
   mode pemasangannya, harga, lalu umumkan. Kode produk dan variant harus sama
   persis dengan `product_code` dan `variant_code` di `release.yml`.
2. **Satu secret repo**: `GONSU_REGISTRY_CI_TOKEN`, token dorong registry.
   Tim platform yang mengisinya di repository ini; tim produk tidak membuat
   token itu sendiri.
3. **Repository ini berada di akun GitHub yang dipercaya platform.** Rilis
   dari akun lain ditolak.

**Setiap rilis:**

```sh
make smoke VERSION=1.0.0            # image rilis lulus uji chart GONSU
git tag v1.0.0 && git push origin v1.0.0
```

Tag harus berbentuk `vMAJOR.MINOR.PATCH`, boleh dengan akhiran prarilis
(`v1.0.0-rc.1`). Workflow lalu membangun image `products/produk-contoh-web`,
mendorongnya, memindainya, mendaftarkannya, menunggu GONSU menandatanganinya,
dan menerbitkannya. Sebab kegagalannya tercetak di log job, dalam kalimat. Yang
paling sering menahan rilis:

- **Kerentanan yang menghalangi menurut kebijakan platform** — publikasi
  ditolak dan rilisnya tertinggal di `staged`. Job "Image rilis" di CI
  memindai image yang sama, jadi biasanya sudah merah sebelum tag dibuat.
- **Repository image atau repository GitHub berbeda** — rilis pertama mengikat
  `products/produk-contoh-web` dan repository ini ke produknya; jangan mengubah
  `image_path` atau memindahkan repository sesudahnya. Mengubahnya dikerjakan
  tim platform.
- **Versi yang sama dirilis ulang** — versi yang sudah ditandatangani tidak
  dapat didaftarkan lagi; naikkan versinya.

Rilis yang gagal tertinggal di `staged` dan tidak pernah terlihat pelanggan.
Arti setiap pesan galat ada di README `gonsu-release`.

Sesudah terbit, catatan rilis untuk pelanggan ditulis di Console → Rilis.

## Bekerja dengan agen AI

[AGENTS.md](AGENTS.md) adalah instruksi untuk agen AI maupun manusia: peta
project, perintah, resep menambah modul, izin, dan hak pakai, aturan yang tidak
boleh dilanggar, dan daftar periksa sebelum selesai. Frontend punya instruksinya
sendiri di [web/AGENTS.md](web/AGENTS.md) dan panduan UI yang mengikat di
[web/docs/ui-guide.md](web/docs/ui-guide.md); `.mcp.json` mendaftarkan MCP
reui dan shadcn supaya agen membaca API komponen, bukan menebaknya. Codex, Cursor, Copilot, dan agen
lain membacanya langsung; Claude Code membacanya lewat [CLAUDE.md](CLAUDE.md).

Perintah yang cukup untuk memulai:

> Tambahkan modul faktur (`invoices`) mengikuti resep di AGENTS.md: judul,
> pelanggan, total, dan status draf/terbit. Staf boleh membuat, viewer hanya
> membaca.

Perbarui AGENTS.md bila aturan project berubah — agen hanya sebaik instruksi
yang dibacanya.

## Environment

| Variabel | Diisi oleh | Arti |
|---|---|---|
| `DATABASE_URL` (atau `DATABASE_HOST`, `_PORT`, `_NAME`, `_USER`, `_PASSWORD`) | GONSU | database pemasangan |
| `GONSU_*` | GONSU | login, lisensi, pemberian akses — dibaca kit, bukan kode produk |
| `GONSU_PORTAL_URL` | GONSU | alamat Portal untuk tautan langganan, tagihan, dan paket; kosong berarti tautannya tidak tampil |
| `APP_TRUSTED_PROXIES` | operator | alamat reverse proxy yang boleh menulis `X-Forwarded-For`; kosong berarti diabaikan |
| `APP_DEV_ORGANIZATION_ID` | pengembang | hanya build `dev`: organization lokal |
| `DEV_HTTP_ADDR` | `make run` | hanya build `dev`: alamat dengar; build rilis selalu `:8080` |

Aplikasi mendengar di `:8080` — kontrak dengan chart GONSU, bukan konfigurasi.
