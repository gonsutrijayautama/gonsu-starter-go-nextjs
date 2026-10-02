<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Frontend

Frontend produk ini: Next.js (App Router) sebagai **static export** yang
di-embed ke binary Go dan disajikan dari satu port. Baca juga `AGENTS.md` di
akar project — aturan di sana berlaku di sini.

> **WAJIB: baca [docs/ui-guide.md](docs/ui-guide.md) seluruhnya sebelum
> menyentuh layar.** Panduan itu mengikat: komponen mana yang dipakai, pola
> formulir, toast, konfirmasi, warna, dan teks. Sebagian besar aturannya
> ditegakkan `make lint` (§11) — pelanggaran gagal di lint, bukan lolos
> diam-diam. Untuk komponen ReUI, pakai MCP reui (`.mcp.json` di akar project):
> `search` → `get_component` → `validate_usage`, jangan menebak prop.

## Batas static export

Tidak ada server Node di image rilis. Karena itu **tidak boleh**: server
actions, route handlers (`app/**/route.ts`), `proxy`/middleware, `cookies()`,
`headers()`, rewrites, atau route dinamis `[id]`. Halaman detail memakai query
string (`/invoices/detail/?id=…`) dan membaca `useSearchParams` di dalam
`Suspense`. Login, sesi, dan izin ditegakkan server Go.

## Peta

| Path | Isi |
|---|---|
| `app/page.tsx` | halaman publik `/`: web perusahaan bisnis ini atau hanya pintu Masuk, menurut pengaturan Website — juga probe chart GONSU, jangan memanggil API di sini |
| `app/sign-in/` | `/sign-in/?error=<sebab>` saat login gagal |
| `app/not-found.tsx` | halaman 404 |
| `app/(app)/layout.tsx` | area aplikasi: sesi lalu kerangka (`AppFrame`) |
| `app/(app)/loading.tsx`, `error.tsx` | memuat dan galat untuk semua rute di area aplikasi |
| `app/(app)/<route>/page.tsx` | halaman: metadata judul, lalu satu komponen layar |
| `app/(app)/notes/` | **layar contoh Catatan** — pola yang ditiru setiap layar baru |
| `app/(app)/settings/` | Profil bisnis, Website, Pengguna & Akses, Lisensi |
| `app/(app)/settings/business/` | layar Profil bisnis: formulir satu halaman (bukan dialog), unggah logo, tampilan baca untuk role tanpa izin |
| `app/(app)/settings/website/` | layar Website: mode halaman depan, isi, layanan (daftar yang bisa ditambah dan dihapus), kanal, pratinjau tautan |
| `lib/site.ts` | data halaman `/` (`Site`): dibaca dari JSON yang disisipkan server Go, atau dari `/site.json` saat `make web-dev` |
| `lib/site-icons.tsx` | ikon layanan; namanya sama dengan daftar di server |
| `lib/website.ts` | pengaturan website (`/v1/website`) |
| `lib/navigation.tsx` | menu sidebar, izinnya, dan label breadcrumb |
| `lib/api.ts` | satu-satunya jalan ke server: `api()`, `ApiError`, `newIdempotencyKey()` |
| `lib/toast-action.tsx` | `runWithToast()` untuk setiap aksi ke server |
| `lib/<modul>.ts` | tipe JSON dan panggilan API satu modul (`lib/notes.ts`) |
| `lib/permissions.ts` | nama izin, sama persis dengan `internal/authz` |
| `lib/portal.ts` | tautan ke Portal GONSU: langganan, tagihan, paket |
| `lib/business-profile.ts`, `lib/regions.ts` | modul standar GONSU: profil bisnis dan pencarian wilayah (`/v1/business-profile`, `/v1/regions`) |
| `components/session-context.tsx` | `useSession()`, `useCan()`, dan `usePortal()` (tautan Portal boleh tampil) |
| `hooks/use-resource.ts` | membaca GET dengan `reload()` sesudah mutasi |
| `hooks/use-api-form.ts` | formulir: TanStack Form + Zod + toast + galat server per isian |
| `hooks/use-file-upload.ts` | hook unggah berkas ReUI (vendor) — dipakai `components/image-field.tsx` |
| `components/image-field.tsx` | `ImageField`: ganti dan hapus satu gambar (logo, foto), langsung diunggah |
| `components/form-controls.tsx` | `TextInput`, `TextArea`, `FormSection`, `FormFooter` untuk formulir satu halaman |
| `components/business-profile-context.tsx` | `useBusinessProfile()`: profil bisnis untuk sidebar dan layar Profil bisnis |
| `components/region-picker.tsx` | `RegionPicker`: pilih desa, kecamatan, atau kota dari pencarian server |
| `components/landing/` | halaman `/`: `home.tsx` memilih web perusahaan atau pintu masuk; `site-context.tsx` (`SiteGate`, `useSite()`) menyediakan datanya; sisanya bagian-bagiannya |
| `components/app-shell/` | kerangka: sidebar, header, breadcrumb, menu akun, tema, `PageLoading`, `ConfirmAction` |
| `components/` | pola halaman: `PageHeader`, `DataTable`, `ApiForm`, `FormField`, `ApiFailure` |
| `components/ui/`, `components/reui/` | seluruh komponen shadcn dan 22 komponen ReUI — vendor, jangan disunting tangan |
| `app/globals.css` | token warna; mengganti warna produk cukup di sini |
| `docs/ui-guide.md` | **panduan UI yang mengikat** |
| `e2e/` | uji peramban Playwright (`e2e/notes.spec.ts`, `e2e/business-profile.spec.ts`, `e2e/website.spec.ts`); server-nya disiapkan `make e2e` di akar |

## Perintah

```sh
make run        # (di akar project) server Go build dev di 127.0.0.1:18080
make web-dev    # (di akar project) http://localhost:3000; /v1, /auth, /media, /site.json diteruskan ke make run
make -C web lint    # eslint + aturan panduan UI, typecheck, judul halaman
make -C web build   # static export ke out/
make e2e            # (di akar project) uji peramban di e2e/ terhadap server build dev
```

Masuk saat pengembangan: `http://localhost:3000/auth/login?as=staff` (atau
`administrator`, `viewer`).

## Resep: layar untuk modul baru

Contoh: faktur, `invoices`, sesudah API-nya ada (resep backend di `AGENTS.md`
akar). Tiru `app/(app)/notes/` berkas demi berkas.

1. **`lib/invoices.ts`**: tipe yang sama persis dengan JSON server
   (`snake_case`), konstanta path, dan fungsi API. Pembuatan data membawa
   `idempotencyKey`.
2. **Izin** di `lib/permissions.ts`, string yang sama dengan `internal/authz`.
3. **Menu** di `lib/navigation.tsx` (judul, `url` berakhiran `/`, ikon lucide,
   `permission`, `description` untuk kartu dasbor), dan label segmennya di
   `breadcrumbLabels`.
4. **Halaman** `app/(app)/invoices/page.tsx` — `export const metadata = {
   title: "Faktur" }` — merender `invoices-screen.tsx` (`"use client"`):
   - `PageHeader` dengan satu aksi utama;
   - `useResource()` untuk daftar; `PageLoading` selama memuat; `ApiFailure`
     bila gagal;
   - `DataTable` dengan `title`, pencarian di `toolbar`, kolom ber-`accessorFn`
     berlabel, dan kolom `id: "actions"` berisi `DropdownMenu` dengan trigger
     `Button variant="ghost" size="icon"`;
   - `useCan()` untuk menyembunyikan aksi; tanpa izin baca, `PageHeader` +
     satu kalimat.
5. **Formulir** dalam `Dialog`, dipasang ulang setiap dibuka: `useApiForm`
   (skema Zod sama dengan server, `toast` wajib) + `ApiForm` + `FormField`.
6. **Hapus, nonaktifkan, ubah role** lewat `ConfirmAction destructive`, lalu
   `runWithToast(...).then(reload)`.
7. **Uji peramban** untuk alur yang penting di `e2e/invoices.spec.ts`, meniru
   `e2e/notes.spec.ts`: masuk lewat `/auth/login?as=<role>&next=/invoices/`,
   jalur normal, dan role tanpa izin yang ditolak server. Cari elemen menurut
   role dan nama yang dilihat pengguna (`getByRole`, `getByLabel`), bukan
   kelas CSS.
8. `make -C web lint`, `make -C web build`, dan `make e2e`, lalu buka layarnya
   di kedua tema dan di lebar ponsel.

## Aturan tambahan

- **Semua panggilan server lewat `lib/api.ts`.** Tidak ada origin lain, tidak
  ada token di `localStorage` — sesi ada di cookie milik server.
  Unggah berkas juga lewat `api()`: `body` berupa `File` dikirim apa adanya
  (lihat `uploadBusinessLogo` di `lib/business-profile.ts`).
- **Tautan ke Portal GONSU** memakai `portalLinks` (`lib/portal.ts`) dengan
  `<a>` bergaya tombol, dan tampil hanya bila `usePortal()` — GONSU memberi
  alamat Portal DAN role-nya mengurus langganan. Jangan menulis alamat Portal
  sendiri. Penolakan `ENTITLEMENT_REQUIRED`/`LICENSE_INACTIVE` sudah otomatis
  menawarkan "Lihat paket"/"Bayar tagihan" lewat `ApiFailure` dan toast gagal.
- **Izin di layar hanya kenyamanan**: server tetap menolak.
- **Alamat memakai `RegionPicker`**, bukan kolom kota yang diketik bebas:
  yang disimpan kode wilayahnya, dan kode pos terisi dari desa terpilih.
- **Nama dan logo bisnis** dibaca dari `useBusinessProfile()` di area
  aplikasi dan dari `useSite()` di halaman depan, tidak ditulis di kode layar.
- **Halaman depan hanya menampilkan yang diisi.** Bagian, menu, dan tombol
  yang datanya kosong tidak dirender (`components/landing/sections.ts`); tidak
  ada teks tempat isian di halaman publik.
- **Gambar memakai `ImageField`**, dan formulir satu halaman memakai
  `FormSection` di dalam SATU `Frame`. Formulir yang menyunting data bersama
  mengirim `version` data yang dibacanya, dan dipasang ulang dengan
  `key={data.version}`.
- **Font disimpan di `fonts/`**; jangan kembali ke `next/font/google`.
- **Memasang komponen**: `bunx shadcn@latest add <nama>` atau
  `bunx shadcn@latest add @reui/<nama>`. Registry ReUI membatasi permintaan
  beruntun — pasang satu per satu bila perlu banyak.
