# Starter kit GONSU — Go + Next.js

**Untuk yang merawat starter kit ini.** Berkas ini tidak ikut ke project
hasil; `gonsu new` membuangnya.

Repository ini adalah titik awal setiap produk GONSU ber-stack Go + Next.js.
`gonsu new <kode-produk>` menyalin isi `main`-nya, mengganti identitas
contohnya dengan identitas produk, lalu menyiapkan git.

Bedanya dengan template biasa: **ini aplikasi sungguhan**. Ia dapat dijalankan,
diuji, dan dirilis apa adanya dengan identitas contoh `produk-contoh`. Tidak
ada placeholder, tidak ada berkas `.tmpl`, dan tidak ada salinan golden —
yang Anda sunting adalah yang diterima tim produk.

```sh
make run        # server Go build dev di 127.0.0.1:18080
make web-dev    # http://localhost:3000
make lint && make test && make e2e
```

`README.md` dan `AGENTS.md` adalah dokumen PRODUK: keduanya ikut ke project
hasil dan dibaca tim produk beserta agen AI-nya. Aturan untuk perawat kit
hanya ada di berkas ini.

## Manifes: `gonsu.kit.json`

| Isian | Arti |
|---|---|
| `identity.product_code` | kode produk contoh, `produk-contoh` |
| `identity.display_name` | nama tampilan contoh, `Produk Contoh` |
| `identity.module_path` | module path Go contoh, sama dengan alamat repository ini |
| `remove` | berkas milik kit yang dibuang dari project hasil |
| `install` | perintah pemasangan dependency yang dijalankan `gonsu new` |
| `next_steps` | baris "langkah berikutnya" yang dicetak `gonsu new` |

`gonsu new` mengganti ketiga nilai `identity` di **setiap berkas teks**, dalam
satu lintasan. Tidak ada daftar berkas: di mana pun nilai contoh itu tertulis,
ia menjadi identitas produk.

## Aturan identitas contoh

- **Tulis identitas hanya lewat nilai contohnya.** Kode produk selalu
  `produk-contoh`, nama tampilan selalu `Produk Contoh`, module path selalu
  `github.com/gonsutrijayautama/gonsu-starter-go-nextjs`. Nilai turunan
  mengikuti dengan sendirinya: `produk-contoh.core`,
  `products/produk-contoh-web`.
- **Jangan memakai nilai contoh untuk hal lain.** Kalimat seperti "lihat
  produk-contoh di bawah" akan berubah menjadi kode produk orang. Untuk
  contoh di dokumen, pakai nama lain (`invoices`, `produk-lain`).
- **Nama tampilan hanya di Markdown dan di dalam string TypeScript, JSON,
  atau Go.** Di berkas `.ts`, `.tsx`, `.js`, `.mjs`, `.json`, dan `.go`
  `gonsu new` menuliskannya ter-escape; di berkas lain apa adanya. Jangan
  menaruhnya di YAML atau shell.
- **Nilai contoh tidak boleh muncul di berkas kunci dan vendor** (`go.sum`,
  `web/bun.lock`, `web/components/ui`, `web/components/reui`).
  `scripts/kit-check.sh` menolaknya.

## Bagian yang hanya untuk kit

Baris di antara penanda `gonsu-kit:begin` dan `gonsu-kit:end` dibuang dari
project hasil, beserta kedua baris penandanya. Pakai untuk catatan singkat di
berkas yang ikut ke produk — misalnya pengantar di `AGENTS.md`:

```md
<!-- gonsu-kit:begin -->
…hanya terbaca di repository kit…
<!-- gonsu-kit:end -->
```

Berkas yang seluruhnya milik kit didaftarkan di `remove`: manifes, berkas
ini, `LICENSE` (lisensi kit; lisensi produk urusan tim produknya),
`scripts/kit-check.sh`, dan `.github/workflows/kit.yml`.

## `main` adalah yang dipakai

`gonsu new` selalu mengambil ujung `main` repository ini. Tidak ada pin versi
dan tidak ada rilis: begitu sebuah perubahan masuk `main`, project berikutnya
yang dibuat siapa pun sudah membawanya.

- **`main` harus selalu siap dipakai.** Perubahan masuk lewat PR dengan CI
  hijau, tidak didorong langsung. `main` yang rusak berarti project baru yang
  rusak, sampai diperbaiki.
- Project hasil mencatat asalnya di `.gonsu/kit.json` (kit dan commit-nya).
  Selisih commit itu dengan `main` adalah catatan naik versi bagi produk yang
  sudah berjalan: `git diff <commit> main`.
- **Versi kit adalah tag berawalan `kit-`**: `kit-v0.1.0`. Pasang saat ada
  titik yang layak dirujuk; `gonsu new nama-produk --version 0.1.0` mengambil keadaan
  pada tag itu. JANGAN memakai tag `v*` di repository ini — tag `v*` memicu
  `release.yml`, pipeline rilis produk. Pemakai cukup menulis nomornya; gonsu
  yang menambahkan awalan `kit-v`.
- Yang harus sama di SETIAP produk tidak hidup sebagai kode salinan di sini,
  melainkan di paket berversi: login dan lisensi di `gonsu-one-sdk-go`, modul
  standar di `gonsu-appkit-go`. Perbaikan di sana sampai ke produk lewat
  `go get`, tanpa menyalin apa pun.

## Sebelum menggabung ke `main`

1. `make lint`, `make test`, `make e2e`, `make smoke` hijau — CI menjalankan
   keempatnya di PR.
2. `scripts/kit-check.sh` hijau.
3. Job "gonsu new dari kit ini" hijau: CI memasang gonsu rilis terbaru,
   menjalankan `gonsu new` terhadap PR itu, dan memastikan hasilnya
   ter-compile tanpa sisa identitas contoh. Untuk perubahan besar, coba juga
   sendiri dari folder lain:
   `gonsu new uji-kit --kit-source /path/ke/repository/ini`, lalu `make test`
   di hasilnya. Cabang yang sudah didorong:
   `gonsu new uji-kit --version nama-cabang`.
4. `README.md` dan `AGENTS.md` masih cocok dengan kodenya
   (`TestDocsReferToExistingCode`).

## Yang tidak boleh

- **Tanpa rahasia dan tanpa nilai milik satu pemasangan.** Kit hanya menyebut
  NAMA secret dan variabel; alamat server, domain, dan kredensial diisi tim
  produk di repository mereka.
- **CI hanya memakai runner GitHub**, termasuk rilis, dengan versi yang
  ditulis terang (`ubuntu-24.04`, sama dengan pipeline rilis GONSU) — bukan
  `ubuntu-latest`, yang berpindah ke Ubuntu baru pada jadwal GitHub. Naik
  versi runner adalah PR tersendiri. `release.yml` dipicu
  tag `v*` saja, dan tidak pernah berjalan di repository ini.
- **Jangan menulis ulang yang dibawa SDK dan appkit**: login, lease, pemberian
  akses, profil bisnis, media, wilayah.
- **`release.yml` hanya pemanggil.** Langkah rilisnya milik platform dan hidup
  di repository `gonsu-release`; yang ada di sini hanya identitas produk
  (`product_code`, `variant_code`, `image_path`) dan nama satu secret. Jangan
  menyalin langkahnya ke sini.
