# Panduan UI

Aturan yang MENGIKAT setiap kali menyentuh layar — untuk manusia maupun agen
AI. Diturunkan dari panduan UI GONSU One (Console dan Portal), sehingga produk
ini tampil dan berperilaku sama dengan platform tempat ia dijual.

Sebagian besar aturan di sini **ditegakkan `make lint`** (§11). Yang tidak
dapat diperiksa mesin tetap wajib; pelanggarannya hanya tidak ketahuan sampai
ada yang melihat layarnya.

---

## 0. Sumber kebenaran

### 0.1 MCP reui dan shadcn

`.mcp.json` di akar project mendaftarkan server MCP **reui**
(`https://mcp.reui.io`, gratis, tanpa token) dan **shadcn**. Alur wajib sebelum
menulis kode ReUI:

1. `search` — cari komponen atau contoh yang cocok;
2. `get_component` — baca API-nya (props + usage);
3. `get_examples` — ambil contoh siap pakai (`c-*`) bila ada;
4. `validate_usage` — cek kode yang direncanakan, SEBELUM ditulis;
5. `get_audit_checklist` — sesudah selesai.

Dilarang menyalin contoh Radix dari internet, dan dilarang menebak bentuk prop.
Project ini memakai **Base UI** (§3), bukan Radix.

### 0.2 Urutan memilih komponen

1. **shadcn/ui** di `components/ui/` — seluruh komponennya sudah terpasang;
2. **ReUI** di `components/reui/` — ke-22 komponennya sudah terpasang;
3. pola milik project ini di `components/` dan `components/app-shell/`;
4. baru buat sendiri — wajib reusable: berkas komponen sendiri yang menerima
   props, bukan markup panjang langsung di page.

`components/ui/` dan `components/reui/` adalah kode vendor: dipasang dan
diperbarui lewat CLI (`bunx shadcn@latest add <nama>` atau `@reui/<nama>`),
**tidak disunting tangan**. Suntingan tangan hilang pada pembaruan berikutnya.

Sebelum menyusun kontrol form atau baris daftar sendiri, lihat dulu
`ls components/ui components/reui`. Dua pola yang paling sering terlewat:

- **Kartu pilihan** (radio sebagai kartu) → `FieldLabel` > `Field
  orientation="horizontal"` > `FieldContent` (`FieldTitle`, `FieldDescription`)
  + `RadioGroupItem`.
- **Baris "ikon · judul · keterangan · aksi"** → `Item` + `ItemMedia` /
  `ItemContent` / `ItemActions`.

Mockup adalah arah visual, bukan spesifikasi markup. Bila bentuknya berbeda
dari anatomi komponen, komponennya yang menang.

---

## 1. Peta pengganti — yang WAJIB dipakai

| Kebutuhan | Pakai | Bukan |
|---|---|---|
| Wadah/panel | `Frame` (`components/reui/frame`) | `Card` |
| Tabel data | `DataTable` (`components/data-table`) | `Table` mentah, `<table>` |
| Label status | `Badge` ReUI (`components/reui/badge`) | span berwarna buatan sendiri |
| Pesan penting di halaman | `Alert` ReUI (`components/reui/alert`) | div dengan border |
| Galat dari API | `ApiFailure` (`components/api-failure`) | teks merah sendiri |
| Progres bertahap / riwayat | `Timeline` | daftar biasa |
| Wizard bertahap | `Stepper` | tab buatan sendiri |
| Teks berbentuk kode apa pun | `CodeBlock` | `<pre>` / `<code>` |
| Input angka | `NumberField` | `<Input type="number">` |
| Ikon dalam kotak | `IconTile` | ikon telanjang |
| Halaman memuat | `PageLoading` (`IconStack` + `Spinner`) | teks "Loading…" |
| Keadaan kosong | `Empty` shadcn | div berisi kalimat |
| Konfirmasi | `ConfirmAction` | `AlertDialog` sendiri, `window.confirm` |
| Toast | `runWithToast` / `toast` Base UI | sonner |
| Formulir | `useApiForm` + `ApiForm` + `FormField` | `<form>` + state sendiri |
| Kepala halaman | `PageHeader` | `<h1>` sendiri |

"Teks berbentuk kode apa pun" berarti apa pun: id, token, sandi sementara,
perintah terminal. Semuanya butuh tombol salin — `CodeBlockCopyButton` sudah
menyediakannya (`labels={{ copy: "Salin", copied: "Tersalin" }}`).

## 2. Pemakaian yang sudah terbukti

### Tabel: `DataTable`, selalu berbingkai

```tsx
const columns = useMemo<ColumnDef<DataGridFeatures, Invoice>[]>(() => [
  {
    id: "number",
    accessorFn: (invoice) => invoice.number,
    header: ({ column }) => <DataGridColumnHeader title="Nomor" column={column} />,
  },
  { id: "actions", header: "", enableSorting: false, size: 56, cell: ({ row }) => <InvoiceActions invoice={row.original} /> },
], [])

<DataTable
  title="Semua faktur"
  toolbar={searchInput}   // pencarian, penyaring — DI DALAM kepala Frame
  data={invoices}
  columns={columns}
  emptyMessage="Belum ada faktur."
/>
```

- `DataTable` membungkus `DataGrid` dalam `Frame stacked`, dengan label
  berbahasa Indonesia, pengurutan, dan paginasi. Jangan menyusun DataGrid
  sendiri per halaman.
- **Pencarian dan penyaring tinggal di dalam kepala Frame** (`toolbar`), bukan
  baris terpisah di atasnya.
- Yang diurutkan adalah TEKS YANG TERTULIS di sel: `accessorFn` mengembalikan
  labelnya (`"Aktif"`), bukan nilai mentah (`"ACTIVE"`).
- Kolom aksi ber-`id: "actions"`: disematkan di kanan otomatis, sehingga tetap
  terlihat di layar sempit. Isinya `DropdownMenu` dengan trigger `Button
  variant="ghost" size="icon"`.

### Frame

```tsx
<Frame className="w-full">
  <FrameHeader>
    <FrameTitle>Ringkasan</FrameTitle>
    <FrameDescription>Satu kalimat penjelas.</FrameDescription>
  </FrameHeader>
  <FramePanel>…</FramePanel>
</Frame>
```

**Beberapa kartu: SATU Frame, banyak FramePanel** — bukan satu Frame per kartu.
`gap-0.5` membuat sekatnya terbaca sebagai sekat. `FramePanel` sudah `relative`
dan sudah punya padding: seluruh panel dapat dijadikan tautan dengan anchor
`after:absolute after:inset-0` (lihat `app/(app)/dashboard/dashboard.tsx`).

### IconStack dan PageLoading

Ikon `IconStack` adalah CHILDREN, bukan prop. Untuk memuat, cukup
`<PageLoading label="Memuat faktur…" />`.

### CodeBlock

`language` diisi untuk kode (`bash`, `json`, `yaml`, `sql`, `go`, …). Nama yang
salah tulis GAGAL DIAM-DIAM — blok abu tanpa warna. Untuk id, token, dan sandi,
biarkan `language` kosong dan pakai `highlight={false}`.

## 3. Base UI, BUKAN Radix

**`render`, bukan `asChild`.** `render` menerima elemen TANPA children;
children ditulis sebagai children komponennya:

```tsx
<SidebarMenuButton tooltip={item.title} render={<Link href={item.url} />}>
  <item.icon />
  <span>{item.title}</span>
</SidebarMenuButton>
```

**Tautan TIDAK memakai `Button`**, termasuk dengan `nativeButton={false}`.
Anchor punya semantiknya sendiri; `Button` menempelkan `role="button"`. Tautan
yang terlihat seperti tombol:

```tsx
import Link from "next/link"
import { cn } from "cn"
import { buttonVariants } from "@/components/ui/button"

<Link href="/notes/" className={cn(buttonVariants({ variant: "outline" }))}>Catatan</Link>
```

`cn()` WAJIB membungkus `buttonVariants()` — tanpa itu kelas tambahan kalah oleh
kelas bawaan. Jalur yang dilayani server Go (`/auth/*`) memakai `<a>`, bukan
`<Link>`: butuh navigasi penuh.

**`nativeButton` bawaan BERBEDA per komponen:**

| Komponen | Bawaan | Isi `nativeButton` bila `render` … |
|---|---|---|
| `Button` | `true` | … bukan `<button>` (misalnya `<div>`) → `false` |
| `DropdownMenuItem` | `false` | … `<button type="submit">` → `nativeButton` |

`type="submit"` WAJIB ditulis eksplisit pada `Button` agar ia men-submit form.

**`items` hanya untuk `Select` dan `Combobox`** — supaya `SelectValue`
menampilkan label, bukan nilai mentah. `DropdownMenu` tidak punya `items`;
pilihan tunggal di menu memakai `DropdownMenuRadioGroup`.

## 3b. Jebakan tata letak

- **`Button` dan `Badge` tidak memakai prop `size`** — ukuran yang
  berbeda-beda membuat aksi utama tidak terbaca sebagai aksi utama.
  **Satu pengecualian: tombol yang isinya HANYA ikon memakai `size="icon"`**
  supaya persegi — titik tiga di tabel, pemilih tema, ⚙ pengaturan. Tautan
  ikon memakai `buttonVariants({ variant: "ghost", size: "icon" })`. Wajib
  disertai `aria-label`. `sm`, `lg`, dan `xs` tetap dilarang.
- **Lebar popup mengikuti lebar TRIGGER.** Menu dari tombol ikon perlu
  `DropdownMenuContent className="w-fit"` (atau lebar sendiri), kalau tidak
  teksnya terlipat.
- **Separator vertikal** di header flex: `className="data-vertical:h-4
  data-vertical:self-auto"` — `h-4` saja kalah oleh `self-stretch`.
- **`DropdownMenuLabel` WAJIB di dalam `DropdownMenuGroup`**, kalau tidak Base
  UI melempar "MenuGroupContext is missing" dan halamannya mati.
- **`new Date()` saat render** ditolak lint sebagai fungsi tidak murni. Hitung
  di initializer `useState(() => …)`.
- **Peringatan next-themes** "Encountered a script tag…" hanya muncul di
  development dan tidak dapat dihilangkan. Bukan bug.

## 3d. Kerangka

`AppShell` (`components/app-shell/`), diisi `AppFrame`
(`components/app-frame.tsx`). Bentuknya sama dengan Console dan Portal:

- **Sidebar desktop tidak dapat diciutkan**; di mobile ia Sheet yang dibuka
  tombol di header.
- **Header `sticky`**: breadcrumb di kiri; tema, pengaturan, dan menu akun di
  kanan — urutan itu dipatok.
- **Menu dari `lib/navigation.tsx`**, dikelompokkan dalam section. Section
  pertama beranda; Pengaturan dibuka dari tombol ⚙ di header dan membawa
  "← Kembali ke Dasbor". Menu disembunyikan menurut izin (`permission`).
- **Breadcrumb diturunkan dari alamat** (`breadcrumbLabels`), bukan dipasang
  per halaman. Segmen baru WAJIB didaftarkan labelnya.
- **Kaki sidebar `Copyright`**. Versi aplikasi ada di Pengaturan → Lisensi.

## 4. Toast

Base UI Toast, **atas-tengah**, ikon berwarna per jenis. Setiap aksi ke server
memberi tahu hasilnya — berhasil maupun gagal — lewat `runWithToast`:
"Menyimpan…" begitu dikirim, lalu toast YANG SAMA berganti hasilnya.

```tsx
runWithToast(deleteInvoice(id), { loading: "Menghapus faktur…", success: "Faktur dihapus" })
  .then(reload)
  .catch(() => undefined)   // galat sudah menjadi toast
```

- **Kalimatnya menyebut objeknya**: "Faktur dihapus", bukan "Berhasil".
- **Gagal** memakai pesan server beserta `request_id`, bertahan 10 detik.
  Penolakan `ENTITLEMENT_REQUIRED` dan `LICENSE_INACTIVE` membawa tombol
  "Lihat paket"/"Bayar tagihan" bagi yang mengurus langganan — `ApiFailure`
  melakukan hal yang sama untuk galat saat memuat.
- **Galat per isian tetap di bawah kolomnya** (§7b2); tidak ada kotak galat
  umum di atas tombol dan tidak ada tanda "Tersimpan" di samping tombol.
- `useApiForm` sudah memasang toast ini; opsi `toast`-nya WAJIB.

## 5. Halaman memuat

- `app/(app)/loading.tsx` memakai `PageLoading` — sekali untuk semua rute.
- Data yang dimuat layar: `PageLoading` dengan label ("Memuat faktur…").
- **Keadaan di alamat** (`?status=`, `?id=`) tidak mengganti segmen, jadi
  `loading.tsx` tidak menyala. Pakai `PendingNavigationProvider` +
  `PendingContent` + `PendingLink` / `navigate()` dari
  `components/app-shell/pending-navigation.tsx`.

## 6. Detail singkat

`Sheet` atau `Drawer` untuk melihat detail tanpa berpindah halaman; `Dialog`
hanya untuk yang menuntut keputusan. Detail yang panjang atau bertab adalah
halaman (`/invoices/detail/?id=…`). Isi sheet dirender hanya saat terbuka.

## 7. Unggah berkas

Satu gambar (logo, foto) memakai `ImageField` (`components/image-field.tsx`):
tombol unggah, ganti, dan hapus dengan konfirmasi, langsung diunggah begitu
dipilih. Di bawahnya hook `useFileUpload` (`hooks/use-file-upload.ts`, dari
registry ReUI).
Bentuk lain (drag-drop, banyak berkas) diambil dari contoh registry
`@reui/c-file-upload-1` sampai `-4`. Jangan menulis drag-drop atau validasi
tipe sendiri.

- Isian berkasnya `Input` dengan `{...getInputProps()}` dan `className="sr-only"`,
  bukan `<input>` mentah.
- Pesan galat hook berbahasa Inggris: tampilkan kalimat sendiri lewat `onError`.
- Berkas dikirim lewat `api()` dengan `body` berupa `File`.

## 7b. Konfirmasi untuk aksi yang MENCABUT

`ConfirmAction` (`components/app-shell/confirm-action.tsx`) adalah SATU-SATUNYA
pintu `AlertDialog`.

WAJIB untuk aksi yang **mencabut sesuatu dari seseorang** dengan satu klik:
menghapus data, menonaktifkan pengguna, **mengubah role** (naik maupun turun —
yang dipegang sebelumnya hilang). Pilihan dari menu atau `Select` DITAHAN di
state sampai dikonfirmasi, bukan langsung dikirim (lihat
`app/(app)/settings/users/users-screen.tsx`).

```tsx
<ConfirmAction
  open={deleting !== null}
  onOpenChange={(open) => !open && setDeleting(null)}
  destructive
  title="Hapus faktur ini?"
  description="Faktur INV-001 hilang untuk seluruh tim dan tidak bisa dikembalikan."
  confirmLabel="Hapus"
  onConfirm={() => runWithToast(deleteInvoice(id), { … }).then(reload).catch(() => undefined)}
/>
```

- **Deskripsinya menyebut apa yang akan terjadi.** "Apakah Anda yakin?" tidak
  menambah informasi apa pun.
- **`destructive`** untuk yang mencabut; tombolnya merah padat.
- TIDAK perlu dikonfirmasi: menyimpan formulir, keluar, navigasi.

Item menu yang men-submit form (Keluar): form-nya DI DALAM menu, membungkus
itemnya — `<form … noValidate><DropdownMenuItem nativeButton render={<button
type="submit" />}>`.

## 7b1. Kepala halaman dan judul tab

Setiap halaman memakai `PageHeader`: judul, satu kalimat penjelas, satu
`Badge` keadaan, dan SATU aksi utama. **Tanpa breadcrumb dan tanpa tautan
kembali** — breadcrumb sudah ada di header.

Setiap `page.tsx` memasang judul tabnya sendiri; bagian belakangnya (nama
aplikasi) dipasang root layout:

```tsx
export const metadata: Metadata = { title: "Faktur" }
```

`make lint` menolak halaman tanpa judul (`scripts/check-pages.mjs`). Pola
halaman: `page.tsx` (server, metadata) merender satu komponen layar
`"use client"` (`invoices-screen.tsx`).

Role yang tidak memegang izin halaman tetap di halamannya: `PageHeader` beserta
satu kalimat biasa ("Role Anda belum bisa membuka faktur."). Menunya tetap
disembunyikan.

## 7b2. Isian formulir: `FormField`, galatnya di bawah kolomnya

```tsx
<form.Field name="number">
  {(field) => (
    <FormField field={field} label="Nomor faktur" serverError={serverErrors.number}>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={field.state.meta.isTouched && !field.state.meta.isValid}
        aria-required
      />
    </FormField>
  )}
</form.Field>
```

- **`id` isian WAJIB `field.name`** — label dan kunci galat server memakai nama
  itu. Dua formulir berfield sama di satu halaman memberi awalan `useId()`
  lewat prop `inputId`.
- **JANGAN atribut `required` native**: peramban menghentikan kiriman dengan
  gelembung berbahasa Inggris sebelum Zod jalan. Pakai `aria-required`.
  `ApiForm` sudah `noValidate`, jadi `type="email"` aman dipakai.
- Galat client tampil setelah isian disentuh; menekan kirim memunculkan
  semuanya dan memberi toast "Ada isian yang belum benar".
- **Formulir yang MENGUBAH data wajib diisi nilai lamanya** (`defaultValues`).

## 7b3. Formulir: `useApiForm` + `ApiForm`

```tsx
const [idempotencyKey] = useState(newIdempotencyKey)   // hanya untuk POST pembuat data
const { form, isPending, serverErrors } = useApiForm({
  schema: invoiceSchema,
  defaultValues: { number: invoice?.number ?? "", total: invoice?.total ?? 0 },
  submit: (values) => (invoice ? updateInvoice(invoice.id, values) : createInvoice(values, idempotencyKey)),
  toast: { loading: "Menyimpan faktur…", success: "Faktur disimpan" },
  onSuccess: onSaved,
})

<ApiForm form={form} isPending={isPending} submitLabel="Simpan" onCancel={onCancel} Footer={DialogFooter}>
  <DialogHeader>…</DialogHeader>
  <FieldGroup>…</FieldGroup>
</ApiForm>
```

- **Skema Zod memakai aturan yang SAMA dengan server** (panjang, wajib, format),
  dengan pesan yang sama. Validasi client tidak menggantikan validasi server.
- Formulir dalam dialog dipasang ulang setiap dialog dibuka (`{open ? <Form/> :
  null}`): isian dan kunci idempotensinya baru untuk setiap pengisian.

## 7c. Zod 4

Pakai API Zod 4: `z.email()`, `z.url()`, `z.uuid()`, `z.iso.datetime()`,
`z.enum([...], "pesan")`. Bukan gaya v3 (`z.string().email()`), yang masih
terkompilasi tetapi `@deprecated`. Periksa sendiri:
`grep -rh -A2 '@deprecated' node_modules/zod/v4/classic/*.d.cts`.

## 8. Warna

**Seluruh warna lewat token di `app/globals.css`.** Dilarang warna palet
langsung (`bg-red-500`, `text-indigo-600`) dan hex (`text-[#ff0000]`).

| Token | Untuk |
|---|---|
| `--primary` | aksen, tombol utama, menu aktif |
| `--success` | aktif, berhasil, lulus |
| `--warning` | menunggu, masa tenggang |
| `--destructive` | gagal, dicabut, dihapus |
| `--info` | keterangan netral |
| `--muted-foreground` | teks sekunder |

Mengganti warna produk cukup di `:root` dan `.dark` pada `app/globals.css`.

## 9. Dark mode

Pemilih tema (Terang, Gelap, Ikuti sistem) ada di header. Setiap komponen baru
WAJIB benar di kedua tema — cek keduanya sebelum selesai.

## 10. Teks layar

- **Bahasa Indonesia yang santai dan langsung**: "Catatan dibuat.", "Role Anda
  belum bisa membuka faktur." — bukan "Data berhasil disimpan ke dalam sistem"
  atau "Anda tidak berwenang".
- Santai tidak boleh mengorbankan kebenaran.
- Path URL, nama berkas, dan identifier dalam bahasa Inggris.

## 11. Yang dijaga `make lint`

`eslint.config.mjs` dan `scripts/check-pages.mjs` menolak pelanggaran berikut
di luar `components/ui/` dan `components/reui/`. Pesannya menyebut penggantinya.

| Ditolak | Pengganti |
|---|---|
| impor `sonner` | `toast` / `runWithToast` |
| impor `next/font/google` | font di `fonts/`, `next/font/local` |
| impor `ui/card`, `ui/table`, `ui/alert`, `ui/badge`, `ui/alert-dialog` | `Frame`, `DataTable`, `Alert`/`Badge` ReUI, `ConfirmAction` |
| `size` pada `Badge`; `size` selain `icon`/`icon-*` pada `Button` | ukuran bawaan; tombol ikon `size="icon"` |
| `asChild` | `render` |
| `Button` dengan `render={<a>}` / `render={<Link>}` | `Link`/`a` + `cn(buttonVariants())` |
| atribut `required` | `aria-required` + Zod |
| `<form>` tanpa `noValidate` | `ApiForm` |
| `<table>`, `<select>`, `<textarea>`, `<pre>`, `<input>` mentah | komponen shadcn/ReUI |
| `fetch(` di luar `lib/api.ts` | `api()` |
| `alert()`, `confirm()`, `prompt()` | `ConfirmAction`, toast |
| warna palet atau hex | token |
| `page.tsx` tanpa `metadata.title` | `export const metadata = { title: "…" }` |

Lint yang lolos BUKAN berarti layarnya benar: §3b, §7b, dan §10 hanya ketahuan
dengan membuka layarnya, di kedua tema dan di lebar ponsel.
